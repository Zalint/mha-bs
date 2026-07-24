/**
 * Formatage des colonnes SQL de type DATE (jour calendaire, sans heure).
 *
 * PIEGE CORRIGE ICI — node-postgres materialise une colonne DATE en objet Date
 * JS positionne a MINUIT LOCAL. Le reflexe `d.toISOString().slice(0, 10)`
 * reprojette cette date en UTC : sur toute machine a l'est de Greenwich, le
 * jour recule d'un cran.
 *
 *   DATE '2026-07-24' en Asia/Dubai (UTC+4)
 *     -> Date = 2026-07-24T00:00:00+04:00
 *     -> toISOString() = "2026-07-23T20:00:00Z"
 *     -> slice(0, 10)  = "2026-07-23"   ← un jour perdu
 *
 * Le symptome n'est pas qu'un affichage faux : les formulaires renvoient la
 * date qu'ils ont recue, donc chaque cycle « ouvrir puis enregistrer » recule
 * la date d'un jour supplementaire, en silence.
 *
 * Le Senegal etant a UTC+0, un serveur a Dakar (ou sur Render, en UTC) ne
 * declenche jamais le bug — d'ou son invisibilite jusqu'ici. Les postes de
 * travail hors UTC, eux, le declenchent systematiquement.
 *
 * On lit donc les composantes LOCALES, celles-la memes que le driver a posees.
 */
export function toYmd(d: Date): string;
export function toYmd(d: Date | null, siNull: null): string | null;
export function toYmd(d: Date | null, siNull: '' | null = ''): string | null {
  if (!d) return siNull;
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}

/**
 * Jour calendaire courant au format YYYY-MM-DD, dans le fuseau du serveur.
 * A preferer a `new Date().toISOString().slice(0, 10)`, qui renvoie la date
 * UTC — donc la veille pour tout serveur en UTC+ avant son heure de bascule.
 */
export function aujourdhuiYmd(): string {
  return toYmd(new Date());
}
