import { Router } from 'express';
import { z } from 'zod';

import {
  createReunionTechniqueSchema,
  type ReunionTechnique,
  SOUS_SECTEURS,
  updateReunionTechniqueSchema,
  type UpdateReunionTechniqueInput,
} from '@mha-bs/shared';

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../lib/errors.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import {
  createReunion,
  deleteReunion,
  findReunionById,
  getReunionStatsBySousSecteur,
  listReunions,
  updateReunion,
} from '../../models/reunionModel.js';

export const reunionRoutes = Router();

const listQuerySchema = z.object({
  sousSecteur: z.enum(SOUS_SECTEURS).optional(),
});

/**
 * L'id de reunion transite desormais par la query string du formulaire de
 * saisie (`/bs/reunion?reunion=<uuid>`), donc par l'URL que l'utilisateur voit
 * et peut modifier. Sans ce garde-fou, un id non-UUID part tel quel dans le
 * `WHERE "id" = $1` et Postgres remonte une erreur 22P02 -> 500. On veut un 422.
 */
const idParam = z.object({ id: z.string().uuid() });

reunionRoutes.get('/', authJwt, validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const items = await listReunions(
      req.query as z.infer<typeof listQuerySchema>,
      req.user ?? null,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

reunionRoutes.get('/stats/sous-secteur', authJwt, async (_req, res, next) => {
  try {
    res.json({ items: await getReunionStatsBySousSecteur() });
  } catch (err) {
    next(err);
  }
});

reunionRoutes.get('/:id', authJwt, validate(idParam, 'params'), async (req, res, next) => {
  try {
    const item = await findReunionById(req.params.id, req.user?.userId ?? null);
    if (!item) throw new NotFoundError('Reunion introuvable');
    // Meme regle de publication que listReunions : une reunion non publiee
    // n'est lisible que par son createur et les admins. Sans ce controle, le
    // filtre de la liste ne servait a rien — il suffisait de connaitre l'id,
    // que le formulaire affiche en clair dans l'URL (?reunion=<uuid>).
    //
    // 404 et non 403 : repondre « interdit » confirmerait l'existence de la
    // reunion a quelqu'un qui n'a pas le droit de la voir.
    const visible =
      item.visibleSg || item.createdBy === req.user?.userId || req.user?.role === 'admin';
    if (!visible) throw new NotFoundError('Reunion introuvable');
    res.json(item);
  } catch (err) {
    next(err);
  }
});

reunionRoutes.post(
  '/',
  authJwt,
  requireRole('bs', 'admin'),
  validate(createReunionTechniqueSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const created = await createReunion(req.body, req.user.userId);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Charge une reunion et verifie que l'appelant a le droit de la SUPPRIMER.
 *
 * La suppression reste restreinte a son createur ou a un admin, meme si tout
 * profil `bs` peut desormais MODIFIER n'importe quelle reunion (bureau qui
 * travaille en commun) : effacer le travail d'un collegue est irreversible, la
 * modifier ne l'est pas. Une reunion sans createur (`createdBy` NULL — import,
 * ou compte supprime : la FK est ON DELETE SET NULL) reste supprimable par tout
 * `bs`, sinon on gelerait des donnees que plus personne ne possede.
 */
async function chargerReunionSupprimable(
  id: string,
  user: { userId: string; role: string },
): Promise<ReunionTechnique> {
  const existante = await findReunionById(id, user.userId);
  if (!existante) throw new NotFoundError('Reunion introuvable');
  const estProprietaire = existante.createdBy === user.userId;
  const sansProprietaire = existante.createdBy === null;
  if (!estProprietaire && !sansProprietaire && user.role !== 'admin') {
    throw new ForbiddenError(
      'Seul le createur de cette reunion (ou un administrateur) peut la supprimer',
    );
  }
  return existante;
}

reunionRoutes.put(
  '/:id',
  authJwt,
  requireRole('bs', 'admin'),
  validate(idParam, 'params'),
  validate(updateReunionTechniqueSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { expectedVersion, ...champs } = req.body as UpdateReunionTechniqueInput;

      // Un body vide (ou ne contenant que des cles inconnues, que Zod retire)
      // arrivait jusqu'a updateReunion qui levait une Error nue -> 500.
      if (Object.keys(champs).length === 0) {
        throw new ValidationError('Aucun champ a mettre a jour');
      }

      // MODIFICATION ouverte a tout profil bs/admin (la route est deja gardee
      // par requireRole) : le Bureau de Suivi travaille en commun. On charge
      // donc juste la reunion pour distinguer 404 de conflit.
      const existante = await findReunionById(req.params.id, req.user.userId);
      if (!existante) throw new NotFoundError('Reunion introuvable');

      // SEULE exception : les notes privees restent celles de leur auteur. Elles
      // sont libellees « uniquement visible par vous » ; meme un collegue qui
      // edite le reste de la reunion, et meme un admin, ne les touche pas.
      if ('notesPrivees' in champs && existante.createdBy !== req.user.userId) {
        throw new ForbiddenError(
          'Seul le createur peut modifier les notes privees de cette reunion',
        );
      }

      const resultat = await updateReunion(
        req.params.id,
        champs,
        req.user.userId,
        expectedVersion,
      );
      if (resultat.statut === 'introuvable') throw new NotFoundError('Reunion introuvable');
      if (resultat.statut === 'conflit') {
        throw new ConflictError(
          'Cette reunion a ete modifiee entre temps par quelqu\'un d\'autre',
          { reunion: resultat.reunion },
        );
      }
      res.json(resultat.reunion);
    } catch (err) {
      next(err);
    }
  },
);

reunionRoutes.delete(
  '/:id',
  authJwt,
  requireRole('admin', 'bs'),
  validate(idParam, 'params'),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      // La suppression, elle, reste reservee au createur ou a un admin : elle
      // est irreversible, contrairement a la modification.
      await chargerReunionSupprimable(req.params.id, req.user);
      await deleteReunion(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
