/**
 * Génère un fragment SQL pour filtrer les directives par année selon le
 * `anneeMode` choisi.
 *
 * Le filtre est appliqué dans une requête joignant `directives d` à
 * `rencontres r`. Le helper retourne la clause prête à coller dans le WHERE
 * (sans le AND devant), et utilise un placeholder $N basé sur la position
 * actuelle de l'array params.
 *
 * Exemple :
 *   const params = [typeRencontre];
 *   params.push(annee);
 *   const clause = directiveAnneeClause(annee, 'active', params.length);
 *   const sql = `... WHERE r."typeRencontre" = $1 AND ${clause}`;
 *
 * Sémantique des modes :
 *
 *  - 'active'   : "Active pendant N". La directive existait pendant l'année N.
 *                 Inclut les pluri-annuelles, les en-cours sans échéance, etc.
 *  - 'creation' : Émise en N. Strict — la directive doit avoir été liée à
 *                 une rencontre dont l'année = N.
 *  - 'echeance' : Échéance en N. La directive doit avoir une échéance dont
 *                 l'année = N. EXCLUT les directives sans échéance.
 */

import type { AnneeMode } from '@mha-bs/shared';

/**
 * @param anneeMode mode sélectionné par l'utilisateur
 * @param placeholderIndex position $N de l'année dans le tableau params
 *                          (l'année doit avoir été poussée AVANT l'appel)
 */
export function directiveAnneeClause(
  anneeMode: AnneeMode,
  placeholderIndex: number,
): string {
  const $n = `$${placeholderIndex}`;
  switch (anneeMode) {
    case 'creation':
      // Strict : émise en N
      return `r."annee" = ${$n}`;
    case 'echeance':
      // Strict : échéance en N. Les directives sans échéance ne matchent pas.
      return `EXTRACT(YEAR FROM d."echeance")::INT = ${$n}`;
    case 'active':
    default:
      // Couvre l'année N : émise pendant/avant N ET pas encore close début N
      return `(r."annee" <= ${$n}
               AND (d."echeance" IS NULL
                    OR EXTRACT(YEAR FROM d."echeance")::INT >= ${$n}))`;
  }
}
