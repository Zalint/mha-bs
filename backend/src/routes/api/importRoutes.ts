import { Router } from 'express';
import multer from 'multer';

import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { importWorkbook } from '../../services/excelImportService.js';

export const importRoutes = Router();

/**
 * Upload mémoire (pas de fichier sur disque) — limite 10 Mo pour les fichiers
 * de seed habituels (~500 Ko à ~5 Mo).
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      /\.(xlsx|xls)$/i.test(file.originalname);
    if (!ok) {
      cb(new Error('Format de fichier non supporté (XLSX/XLS attendu)'));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /api/import
 * multipart/form-data : champ `file` = .xlsx / .xls
 * Query : ?dryRun=true pour un mode preview (compte ce qui serait inséré sans
 *         rien écrire en base).
 *
 * Parse les feuilles connues du classeur et insère ce qui manque encore
 * (idempotent — pas de doublons grâce aux clés naturelles).
 */
importRoutes.post(
  '/',
  authJwt,
  requireRole('bs', 'admin'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Fichier manquant (champ "file")' });
        return;
      }
      const dryRun = req.query.dryRun === 'true' || req.query.dryRun === '1';
      const summary = await importWorkbook(req.file.buffer, { dryRun });
      res.json({
        filename: req.file.originalname,
        sizeBytes: req.file.size,
        dryRun,
        ...summary,
      });
    } catch (err) {
      next(err);
    }
  },
);
