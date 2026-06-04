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
 * @param creeEnAnneeOnly  2e layer optionnel : si true, ajoute la contrainte
 *                          "créée dans l'année N" (r.annee = N) en plus du
 *                          mode principal. Utile combinée à 'active' pour
 *                          obtenir "créées en N ET toujours ouvertes en N".
 *                          Sans effet sur 'creation' (déjà la même contrainte).
 */
export function directiveAnneeClause(
  anneeMode: AnneeMode,
  placeholderIndex: number,
  creeEnAnneeOnly: boolean = false,
): string {
  const $n = `$${placeholderIndex}`;
  // Suffixe applique apres le filtre principal quand le 2e layer est actif.
  // Sans effet pour 'creation' (qui implique deja r.annee = $n).
  const creationSuffix =
    creeEnAnneeOnly && anneeMode !== 'creation' ? ` AND r."annee" = ${$n}` : '';
  switch (anneeMode) {
    case 'creation':
      // Strict : émise en N
      return `r."annee" = ${$n}`;
    case 'echeance':
      // Strict : échéance en N. Les directives sans échéance ne matchent pas.
      return `(EXTRACT(YEAR FROM d."echeance")::INT = ${$n}${creationSuffix})`;
    case 'active':
    default:
      // Couvre l'année N : émise pendant/avant N ET encore ouverte au sens
      // métier. "Ouverte" = état attente ou enCours (la directive est dans
      // le portefeuille actif aujourd'hui, peu importe son échéance), OU
      // bien échéance future / sans échéance (cas des fermées avec date
      // d'échéance >= N : elles ont été actives pendant N).
      //
      // Exemples sur N=2026 :
      //   - r.annee=2024, etat=enCours              → INCLUSE (ouverte)
      //   - r.annee=2025, etat=attente, echeance=2025 → INCLUSE (ouverte)
      //   - r.annee=2024, etat=realisee, echeance=2024 → exclue (close avant N)
      //   - r.annee=2024, etat=realisee, echeance=2026 → INCLUSE (active pdt N)
      return `(r."annee" <= ${$n}
               AND (d."etat" IN ('attente', 'enCours')
                    OR d."echeance" IS NULL
                    OR EXTRACT(YEAR FROM d."echeance")::INT >= ${$n})
               ${creationSuffix})`;
  }
}
