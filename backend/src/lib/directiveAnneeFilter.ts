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
 *  - 'active'   : "Sur la table cette année N". Deux cas réunis :
 *                   • créées EN N (r.annee = N) → toutes, quelle que soit
 *                     l'échéance ;
 *                   • créées AVANT N (r.annee < N) → uniquement celles dont
 *                     l'échéance tombe en N (year(echeance) = N).
 *                 = le neuf de l'année + le vieux qui arrive à échéance en N.
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
      // Sémantique métier (validée user) — "sur la table cette année N" :
      //   1. Créée EN N (r.annee = N)        → INCLUSE quelle que soit
      //      l'échéance (échéance 2026, 2028, ou aucune : peu importe).
      //   2. Créée AVANT N (r.annee < N)     → INCLUSE uniquement si son
      //      échéance tombe en N (year(echeance) = N).
      //
      // L'état n'intervient PAS. Une 2024 en cours avec échéance 2025
      // n'apparaît PAS sous 2026 (échéance pas en 2026). Une 2024 échéance
      // 2026 apparaît sous 2026.
      //
      // Exemples pour N=2026 :
      //   - r.annee=2026, echeance=2028        → INCLUSE (créée en N)
      //   - r.annee=2026, echeance NULL        → INCLUSE (créée en N)
      //   - r.annee=2024, echeance=2026        → INCLUSE (antérieure, échéance N)
      //   - r.annee=2024, echeance=2025        → exclue  (échéance pas en N)
      //   - r.annee=2025, echeance NULL        → exclue  (antérieure sans échéance N)
      return `((r."annee" = ${$n}
               OR (r."annee" < ${$n}
                   AND EXTRACT(YEAR FROM d."echeance")::INT = ${$n}))
               ${creationSuffix})`;
  }
}
