import { z } from 'zod';

import { DATE_REGEX, SOUS_SECTEURS } from '../constants.js';

const dateString = z.string().regex(DATE_REGEX, 'Format date attendu YYYY-MM-DD');
const timeString = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format heure attendu HH:MM');

export const reunionTechniqueSchema = z.object({
  id: z.string().uuid(),
  dateReunion: dateString,
  heureDebut: timeString.nullable(),
  dureeEstimee: z.string().nullable(),
  theme: z.string().min(3),
  lieu: z.string().nullable(),
  sousSecteur: z.enum(SOUS_SECTEURS).nullable(),
  copilLie: z.string().nullable(),
  // Nature de la réunion (copil/technique/...) — code d'un référentiel typeReunion (extensible)
  typeReunion: z.string().max(50).nullable(),
  ordreDuJour: z.string().nullable(),
  decisions: z.string().nullable(),
  participants: z.array(z.string()),
  visibleSg: z.boolean(),
  inclusRapportHebdo: z.boolean(),
  /**
   * Notes privees attachees a la reunion. Visible UNIQUEMENT par le createur
   * (filtre cote backend : null pour les autres viewers). Pas de limite de
   * taille — usage : prise de notes brute en seance.
   */
  notesPrivees: z.string().nullable(),
  /**
   * Jeton de verrou optimiste, incremente a chaque UPDATE. Le client le renvoie
   * dans `expectedVersion` : si la valeur stockee a bouge entre temps, l'API
   * repond 409 plutot que d'ecraser la modification d'un collegue.
   */
  version: z.number().int().positive(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReunionTechnique = z.infer<typeof reunionTechniqueSchema>;

/**
 * Schema de creation — volontairement plus TOLERANT que l'entite complete.
 *
 * La saisie d'une reunion se fait en DEUX etapes :
 *   1. creation   — contexte + theme uniquement          (POST /reunions)
 *   2. complement — lieu, participants, ordre du jour,
 *                   decisions, notes privees, visibilite (PUT  /reunions/:id)
 *
 * L'etape 1 n'envoie donc PAS les cles de l'etape 2. Or `.nullable()` seul
 * exige la presence de la cle (meme a null) et provoquerait un 422 : les
 * champs de l'etape 2 sont donc `.nullish()` / `.optional()`.
 *
 * Seuls `dateReunion` et `theme` restent reellement obligatoires — ce sont
 * les deux champs qui rendent une reunion identifiable, et c'est exactement
 * ce que l'etape 1 collecte.
 */
export const createReunionTechniqueSchema = reunionTechniqueSchema
  .omit({
    id: true,
    // `version` est gere par le serveur : jamais fourni a la creation.
    version: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    // --- Etape 1, facultatifs ---
    // Les `.max()` refletent la largeur des colonnes VARCHAR (cf. schema.sql) :
    // sans eux, une saisie trop longue passe la validation et c'est Postgres
    // qui la rejette (22001) -> 500 au lieu d'un 422 lisible.
    heureDebut: timeString.nullish(),
    dureeEstimee: z.string().max(20).nullish(),
    sousSecteur: z.enum(SOUS_SECTEURS).nullish(),
    copilLie: z.string().max(50).nullish(),
    typeReunion: z.string().max(50).nullish(),
    // --- Etape 2, renseignes une fois la reunion creee ---
    lieu: z.string().max(200).nullish(),
    ordreDuJour: z.string().nullish(),
    decisions: z.string().nullish(),
    notesPrivees: z.string().nullish(),
    participants: z.array(z.string()).optional(),
    visibleSg: z.boolean().optional(),
    inclusRapportHebdo: z.boolean().optional(),
  });
export type CreateReunionTechniqueInput = z.infer<typeof createReunionTechniqueSchema>;

/**
 * Corps accepte par `PUT /reunions/:id` : n'importe quel sous-ensemble des
 * champs, plus le jeton de verrou optimiste.
 *
 * `expectedVersion` est OPTIONNEL pour ne pas casser un appel API direct, mais
 * l'interface l'envoie toujours : sans lui, la mise a jour s'applique sans
 * verification et le dernier qui enregistre gagne.
 */
export const updateReunionTechniqueSchema = createReunionTechniqueSchema.partial().extend({
  expectedVersion: z.number().int().positive().optional(),
});
export type UpdateReunionTechniqueInput = z.infer<typeof updateReunionTechniqueSchema>;
