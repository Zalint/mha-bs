import { z } from 'zod';

import { DATE_REGEX, REGIONS_SENEGAL } from '../constants.js';

const dateString = z.string().regex(DATE_REGEX, 'Format date attendu YYYY-MM-DD');

export const ouvrageVisiteSchema = z.object({
  id: z.string().uuid(),
  missionId: z.string().uuid(),
  nomOuvrage: z.string().min(2),
  typeOuvrage: z.string().nullable(),
  etatOuvrage: z.enum(['fonctionnel', 'maintenance', 'horsService', 'enConstruction']),
  observations: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type OuvrageVisite = z.infer<typeof ouvrageVisiteSchema>;

export const missionTerrainSchema = z.object({
  id: z.string().uuid(),
  dateMission: dateString,
  localite: z.string().min(2),
  region: z.enum(REGIONS_SENEGAL).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  projetRattache: z.string().nullable(),
  constats: z.string().nullable(),
  recommandations: z.string().nullable(),
  /**
   * Nombre d'ouvrages visites rattaches a la mission, calcule par le serveur.
   * Permet aux listes d'afficher un vrai total de sites sans devoir requeter
   * les ouvrages mission par mission (N+1).
   */
  nbOuvrages: z.number().int().nonnegative(),
  /**
   * Nombre d'ouvrages PAR CODE DE TYPE, ex. `{ bassinRetention: 2, forage: 1 }`.
   *
   * Un simple tableau des types distincts ne suffisait pas : l'interface doit
   * pouvoir compter les ouvrages correspondant a un filtre de type, sinon un
   * ecran filtre sur « bassin de retention » affiche le total d'ouvrages de la
   * mission, ceux des autres types compris.
   *
   * Les cles donnent aussi les types presents (coloration du marqueur). Objet
   * vide si la mission n'a aucun ouvrage. La somme des valeurs peut etre
   * INFERIEURE a `nbOuvrages` : les ouvrages sans type n'y figurent pas.
   */
  ouvragesParType: z.record(z.string(), z.number().int().positive()),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MissionTerrain = z.infer<typeof missionTerrainSchema>;

/**
 * Schéma de création — volontairement plus TOLÉRANT que l'entité complète :
 *
 *  - `.nullish()` au lieu de `.nullable()` : une clé ABSENTE du payload ne doit
 *    pas provoquer un 422. Avec `.nullable()` seul, Zod exige la présence de la
 *    clé (même à null), ce qui cassait tout client n'envoyant que les champs
 *    remplis.
 *  - `region` : une chaîne vide (select « — » non renseigné) est convertie en
 *    null avant validation, au lieu d'être rejetée par l'enum.
 *
 * Les contraintes métier réelles (dateMission, localite ≥ 2, bornes lat/lng)
 * restent strictes.
 */
export const createMissionTerrainSchema = missionTerrainSchema
  .omit({
    id: true,
    // Calcules par le serveur a partir de la table "ouvragesVisites" : jamais
    // fournis par le client.
    nbOuvrages: true,
    ouvragesParType: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    region: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.enum(REGIONS_SENEGAL).nullable(),
    ),
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
    projetRattache: z.string().nullish(),
    constats: z.string().nullish(),
    recommandations: z.string().nullish(),
  });
export type CreateMissionTerrainInput = z.infer<typeof createMissionTerrainSchema>;
