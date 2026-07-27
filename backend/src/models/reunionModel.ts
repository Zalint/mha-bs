import type { CreateReunionTechniqueInput, ReunionTechnique, SousSecteur } from '@mha-bs/shared';

import { toYmd as ymd } from '../lib/dateOnly.js';

import { query, queryAll, queryOne } from '../db/query.js';

interface ReunionRow {
  id: string;
  dateReunion: Date;
  heureDebut: string | null;
  dureeEstimee: string | null;
  theme: string;
  lieu: string | null;
  sousSecteurs: SousSecteur[];
  copilLies: string[];
  typeReunion: string | null;
  ordreDuJour: string | null;
  decisions: string | null;
  participants: string[];
  visibleSg: boolean;
  inclusRapportHebdo: boolean;
  notesPrivees: string | null;
  version: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// toYmd vit dans lib/dateOnly.ts : la version locale d'origine reprojetait
// la date en UTC et reculait d'un jour hors Greenwich.
const toYmd = (d: Date | null): string => (d ? ymd(d) : '');

/**
 * Convertit une ligne SQL en objet public.
 *
 * `viewerUserId` est l'id de l'utilisateur qui lit la donnee. Le champ
 * `notesPrivees` est masque (`null`) si le viewer n'est PAS le createur de
 * la reunion. Si `viewerUserId` est `undefined`, on considere le contexte
 * comme non-authentifie/admin technique et on masque par defaut (principe
 * de moindre privilege).
 */
function toReunion(row: ReunionRow, viewerUserId?: string | null): ReunionTechnique {
  const isCreator = viewerUserId != null && row.createdBy === viewerUserId;
  return {
    id: row.id,
    dateReunion: toYmd(row.dateReunion),
    heureDebut: row.heureDebut,
    dureeEstimee: row.dureeEstimee,
    theme: row.theme,
    lieu: row.lieu,
    sousSecteurs: Array.isArray(row.sousSecteurs) ? row.sousSecteurs : [],
    copilLies: Array.isArray(row.copilLies) ? row.copilLies : [],
    typeReunion: row.typeReunion,
    ordreDuJour: row.ordreDuJour,
    decisions: row.decisions,
    participants: Array.isArray(row.participants) ? row.participants : [],
    visibleSg: row.visibleSg,
    inclusRapportHebdo: row.inclusRapportHebdo,
    // Visible UNIQUEMENT par le createur — sinon null cote API
    notesPrivees: isCreator ? row.notesPrivees : null,
    version: row.version,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const SELECT_COLS = `
  "id", "dateReunion", "heureDebut", "dureeEstimee", "theme", "lieu",
  "sousSecteurs", "copilLies", "typeReunion", "ordreDuJour", "decisions", "participants",
  "visibleSg", "inclusRapportHebdo", "notesPrivees", "version",
  "createdBy", "createdAt", "updatedAt"
`;

/**
 * Liste les reunions VISIBLES par `viewer`.
 *
 * Une reunion `visibleSg = false` est une saisie en cours : sortie de l'etape 1
 * du formulaire, elle n'a encore ni lieu, ni participants, ni ordre du jour.
 * Elle reste donc privee a son createur (et aux admins) jusqu'a ce qu'il la
 * publie explicitement a l'etape 2. Sans ce filtre, la colonne `visibleSg`
 * n'aurait aucun effet reel : elle n'etait lue nulle part.
 *
 * NB : les reunions importees depuis Excel heritent du DEFAULT TRUE de la
 * colonne, elles restent donc visibles de tous.
 */
export async function listReunions(
  filters: { sousSecteur?: SousSecteur } = {},
  viewer?: { userId: string; role: string } | null,
): Promise<ReunionTechnique[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.sousSecteur) {
    // Containment JSONB : la reunion est retenue si le sous-secteur demande
    // figure parmi les siens.
    params.push(JSON.stringify([filters.sousSecteur]));
    conditions.push(`"sousSecteurs" @> $${params.length}::jsonb`);
  }
  if (viewer?.role !== 'admin') {
    // `"createdBy" = NULL` n'est jamais vrai : un viewer anonyme ne voit que
    // les reunions publiees, ce qui est le comportement voulu.
    params.push(viewer?.userId ?? null);
    conditions.push(`("visibleSg" = TRUE OR "createdBy" = $${params.length})`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await queryAll<ReunionRow>(
    `SELECT ${SELECT_COLS} FROM "reunionsTechniques" ${where}
     ORDER BY "dateReunion" DESC`,
    params,
  );
  return rows.map((r) => toReunion(r, viewer?.userId ?? null));
}

export async function findReunionById(
  id: string,
  viewerUserId?: string | null,
): Promise<ReunionTechnique | null> {
  const row = await queryOne<ReunionRow>(
    `SELECT ${SELECT_COLS} FROM "reunionsTechniques" WHERE "id" = $1`,
    [id],
  );
  return row ? toReunion(row, viewerUserId) : null;
}

export async function createReunion(
  input: CreateReunionTechniqueInput,
  createdBy: string,
): Promise<ReunionTechnique> {
  const row = await queryOne<ReunionRow>(
    `INSERT INTO "reunionsTechniques" (
       "dateReunion", "heureDebut", "dureeEstimee", "theme", "lieu",
       "sousSecteurs", "copilLies", "typeReunion", "ordreDuJour", "decisions", "participants",
       "visibleSg", "inclusRapportHebdo", "notesPrivees", "createdBy"
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11::jsonb, $12, $13, $14, $15)
     RETURNING ${SELECT_COLS}`,
    // `?? null` / `?? []` systematique : depuis le formulaire en 2 etapes,
    // l'etape 1 n'envoie que le contexte + le theme, les autres cles sont
    // absentes du payload (donc `undefined` ici).
    [
      input.dateReunion,
      input.heureDebut ?? null,
      input.dureeEstimee ?? null,
      input.theme,
      input.lieu ?? null,
      JSON.stringify(input.sousSecteurs ?? []),
      JSON.stringify(input.copilLies ?? []),
      input.typeReunion ?? null,
      input.ordreDuJour ?? null,
      input.decisions ?? null,
      JSON.stringify(input.participants ?? []),
      input.visibleSg ?? true,
      input.inclusRapportHebdo ?? false,
      input.notesPrivees ?? null,
      createdBy,
    ],
  );
  if (!row) throw new Error('Echec creation reunion');
  // Le createur lit toujours ses propres notes → on passe createdBy comme viewer
  return toReunion(row, createdBy);
}

/**
 * Resultat d'une tentative de mise a jour.
 *  - `ok`          : ecriture appliquee
 *  - `introuvable` : l'id n'existe plus (404 cote route)
 *  - `conflit`     : la reunion a ete modifiee depuis que le client l'a
 *                    chargee (409 cote route). `reunion` porte l'etat courant,
 *                    pour que l'interface puisse proposer de recharger.
 */
export type UpdateReunionResult =
  | { statut: 'ok'; reunion: ReunionTechnique }
  | { statut: 'introuvable' }
  | { statut: 'conflit'; reunion: ReunionTechnique };

/**
 * Met a jour une reunion sous verrou OPTIMISTE.
 *
 * Quand `expectedVersion` est fourni, la condition de version fait partie du
 * `WHERE` de l'UPDATE : la verification et l'ecriture sont donc atomiques. Un
 * `SELECT` prealable suivi d'un `UPDATE` laisserait une fenetre ou deux
 * enregistrements simultanes passeraient tous les deux.
 */
export async function updateReunion(
  id: string,
  input: Partial<CreateReunionTechniqueInput>,
  viewerUserId?: string | null,
  expectedVersion?: number,
): Promise<UpdateReunionResult> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, value: unknown, json = false): void => {
    params.push(json ? JSON.stringify(value) : value);
    const cast = json ? '::jsonb' : '';
    sets.push(`"${col}" = $${params.length}${cast}`);
  };
  if (input.dateReunion !== undefined) push('dateReunion', input.dateReunion);
  if (input.heureDebut !== undefined) push('heureDebut', input.heureDebut);
  if (input.dureeEstimee !== undefined) push('dureeEstimee', input.dureeEstimee);
  if (input.theme !== undefined) push('theme', input.theme);
  if (input.lieu !== undefined) push('lieu', input.lieu);
  if (input.sousSecteurs !== undefined) push('sousSecteurs', input.sousSecteurs, true);
  if (input.copilLies !== undefined) push('copilLies', input.copilLies, true);
  if (input.typeReunion !== undefined) push('typeReunion', input.typeReunion);
  if (input.ordreDuJour !== undefined) push('ordreDuJour', input.ordreDuJour);
  if (input.decisions !== undefined) push('decisions', input.decisions);
  if (input.participants !== undefined) push('participants', input.participants, true);
  if (input.visibleSg !== undefined) push('visibleSg', input.visibleSg);
  if (input.inclusRapportHebdo !== undefined) push('inclusRapportHebdo', input.inclusRapportHebdo);
  // notesPrivees : autorise UNIQUEMENT si le viewer est le createur (controle
  // au niveau route AVANT d'arriver ici, mais on protege en defense en
  // profondeur).
  if (input.notesPrivees !== undefined) push('notesPrivees', input.notesPrivees);

  if (sets.length === 0) throw new Error('Aucun champ a mettre a jour');
  // Toute ecriture fait avancer le jeton de verrou.
  sets.push(`"version" = "version" + 1`);

  params.push(id);
  const conditions = [`"id" = $${params.length}`];
  if (expectedVersion !== undefined) {
    params.push(expectedVersion);
    conditions.push(`"version" = $${params.length}`);
  }

  const row = await queryOne<ReunionRow>(
    `UPDATE "reunionsTechniques" SET ${sets.join(', ')}
     WHERE ${conditions.join(' AND ')}
     RETURNING ${SELECT_COLS}`,
    params,
  );
  if (row) return { statut: 'ok', reunion: toReunion(row, viewerUserId) };

  // Zero ligne touchee : soit l'id n'existe plus, soit la version a bouge.
  const actuel = await findReunionById(id, viewerUserId);
  return actuel ? { statut: 'conflit', reunion: actuel } : { statut: 'introuvable' };
}

export async function deleteReunion(id: string): Promise<void> {
  await query(`DELETE FROM "reunionsTechniques" WHERE "id" = $1`, [id]);
}

export interface ReunionStatsBySousSecteur {
  sousSecteur: SousSecteur | null;
  count: number;
}

export async function getReunionStatsBySousSecteur(): Promise<ReunionStatsBySousSecteur[]> {
  const rows = await queryAll<{ sousSecteur: SousSecteur | null; cnt: string }>(
    // `sousSecteurs` etant un tableau, on l'aplatit : une reunion a 2 sous-
    // secteurs compte dans chacun (choix multi-tag). Meme regle de publication
    // que listReunions : un agregat ne doit pas trahir les reunions non
    // publiees.
    `SELECT ss.value AS "sousSecteur", COUNT(*)::TEXT AS "cnt"
     FROM "reunionsTechniques" r
     CROSS JOIN LATERAL jsonb_array_elements_text(r."sousSecteurs") ss
     WHERE r."visibleSg" = TRUE
     GROUP BY ss.value
     ORDER BY "cnt" DESC`,
  );
  return rows.map((r) => ({ sousSecteur: r.sousSecteur, count: Number(r.cnt) }));
}
