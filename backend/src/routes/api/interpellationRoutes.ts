import { Router } from 'express';

import { aujourdhuiYmd } from '../../lib/dateOnly.js';
import { z } from 'zod';

import { NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { query, queryOne } from '../../db/query.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import {
  createInterpellation,
  findInterpellationById,
  getInterpellationStats,
  listInterpellations,
} from '../../models/interpellationModel.js';

export const interpellationRoutes = Router();

const createSchema = z.object({
  reference: z.string().min(3).max(30),
  deputeId: z.string().uuid(),
  sessionId: z.string().uuid().nullable().optional(),
  titre: z.string().min(3),
  description: z.string().nullable().optional(),
  typeInterpellation: z.string().min(1).max(40),
  dateReception: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  echeanceReponse: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

interpellationRoutes.post(
  '/',
  authJwt,
  requireRole('bs', 'admin'),
  validate(createSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const created = await createInterpellation(req.body, req.user.userId);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

interpellationRoutes.get('/', authJwt, async (_req, res, next) => {
  try {
    res.json({ items: await listInterpellations() });
  } catch (err) {
    next(err);
  }
});

interpellationRoutes.get('/stats', authJwt, async (_req, res, next) => {
  try {
    res.json(await getInterpellationStats());
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/interpellations/export.xlsx — exporte au format compatible avec
 * l'import (1 onglet 'In. des députés' avec les colonnes attendues).
 * Doit être DÉFINI AVANT /:id sinon Express matche /:id avec 'export.xlsx'.
 */
interpellationRoutes.get('/export.xlsx', authJwt, async (_req, res, next) => {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const items = await listInterpellations();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'MHA · Bureau de Suivi';
    wb.created = new Date();
    const ws = wb.addWorksheet('In. des députés');
    ws.columns = [
      { header: 'Nom des Députés', key: 'depute', width: 32 },
      { header: 'Questions', key: 'titre', width: 80 },
      { header: 'Localité', key: 'localite', width: 30 },
      { header: 'Domaine/Thématique', key: 'domaine', width: 28 },
      { header: 'Structure Resp', key: 'structure', width: 22 },
      { header: 'Groupe parlementaire', key: 'groupe', width: 22 },
      { header: 'Date réception', key: 'dateReception', width: 14 },
      { header: 'État', key: 'etat', width: 14 },
    ];
    function parseField(desc: string | null, prefix: string): string {
      if (!desc) return '';
      const re = new RegExp(`${prefix}\\s*:\\s*([^·\\n]+)`, 'i');
      const m = desc.match(re);
      return m && m[1] ? m[1].trim() : '';
    }
    for (const i of items) {
      ws.addRow({
        depute: i.deputeNom ?? '',
        titre: i.titre,
        localite: parseField(i.description, 'Localit[ée]'),
        domaine: parseField(i.description, 'Domaine'),
        structure: parseField(i.description, 'Structure responsable'),
        groupe: i.deputeGroupe ?? 'Non renseigné',
        dateReception: i.dateReception,
        etat: i.etat,
      });
    }
    const header = ws.getRow(1);
    header.height = 24;
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle' };
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    const buffer = await wb.xlsx.writeBuffer();
    const today = aujourdhuiYmd();
    const filename = `mha-interpellations-${today}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.byteLength));
    res.send(Buffer.from(buffer as ArrayBuffer));
  } catch (err) {
    next(err);
  }
});

interpellationRoutes.get('/:id', authJwt, async (req, res, next) => {
  try {
    const item = await findInterpellationById(req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Interpellation introuvable' });
      return;
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/interpellations/:id — édition (admin + bs)
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  titre: z.string().min(3).optional(),
  description: z.string().nullable().optional(),
  typeInterpellation: z.string().min(1).max(40).optional(),
  dateReception: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  echeanceReponse: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dateReponse: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  etat: z.enum(['recue', 'enPreparation', 'aValider', 'repondue']).optional(),
  texteReponse: z.string().nullable().optional(),
  deputeId: z.string().uuid().optional(),
});

interpellationRoutes.put(
  '/:id',
  authJwt,
  requireRole('bs', 'admin'),
  validate(updateSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const patch = req.body as z.infer<typeof updateSchema>;
      const keys = Object.keys(patch) as (keyof typeof patch)[];
      if (keys.length === 0) {
        res.status(400).json({ error: 'Aucun champ à mettre à jour' });
        return;
      }
      const setters: string[] = [];
      const params: unknown[] = [];
      for (const k of keys) {
        params.push(patch[k] as unknown);
        setters.push(`"${k}" = $${params.length}`);
      }
      params.push(req.user.userId);
      setters.push(`"updatedBy" = $${params.length}`);
      params.push(req.params.id);
      const updated = await queryOne<{ id: string }>(
        `UPDATE "interpellations" SET ${setters.join(', ')}, "updatedAt" = NOW()
         WHERE "id" = $${params.length}
         RETURNING "id"`,
        params,
      );
      if (!updated) throw new NotFoundError('Interpellation introuvable');
      const fresh = await findInterpellationById(updated.id);
      res.json(fresh);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/interpellations/:id — suppression (admin uniquement)
// DELETE /api/interpellations (body: { ids: string[] }) — bulk
// ---------------------------------------------------------------------------

interpellationRoutes.delete('/:id', authJwt, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await query(
      `DELETE FROM "interpellations" WHERE "id" = $1`,
      [req.params.id],
    );
    if (result.rowCount === 0) throw new NotFoundError('Interpellation introuvable');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

interpellationRoutes.post(
  '/bulk-delete',
  authJwt,
  requireRole('admin'),
  validate(bulkDeleteSchema),
  async (req, res, next) => {
    try {
      const { ids } = req.body as z.infer<typeof bulkDeleteSchema>;
      const result = await query(
        `DELETE FROM "interpellations" WHERE "id" = ANY($1::uuid[])`,
        [ids],
      );
      res.json({ deleted: result.rowCount ?? 0 });
    } catch (err) {
      next(err);
    }
  },
);

