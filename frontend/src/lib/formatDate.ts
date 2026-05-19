/**
 * Helpers de date — format unique YYYY-MM-DD en interne.
 * Tout affichage humain part de la chaine, pas d'objet Date dependant du timezone.
 */

const MONTH_NAMES_FR = [
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre',
] as const;

export function isValidYmd(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * "2026-05-14" → "14 mai 2026"
 */
export function formatLong(ymd: string | null | undefined): string {
  if (!isValidYmd(ymd)) return '—';
  const [y, m, d] = ymd.split('-');
  const monthIdx = Number(m) - 1;
  return `${Number(d)} ${MONTH_NAMES_FR[monthIdx] ?? m} ${y}`;
}

/**
 * "2026-05-14" → "14-05-2026" (format affichage compact, identique aux maquettes)
 */
export function formatShort(ymd: string | null | undefined): string {
  if (!isValidYmd(ymd)) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}-${m}-${y}`;
}

/**
 * Calcule la difference en jours entre deux dates YYYY-MM-DD.
 * Implementation explicite (sans timezone) pour rester deterministe.
 */
export function daysBetween(start: string, end: string): number {
  if (!isValidYmd(start) || !isValidYmd(end)) return 0;
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Aujourd'hui au format YYYY-MM-DD (en UTC pour eviter les decalages).
 */
export function todayYmd(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
