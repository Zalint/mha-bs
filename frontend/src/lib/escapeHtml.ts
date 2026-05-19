/**
 * Echappement HTML pour empecher l'injection XSS quand on doit
 * inserer du texte utilisateur dans un attribut ou un innerHTML
 * (cas exceptionnels uniquement — preferer le rendu React natif).
 */
const REPLACEMENTS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => REPLACEMENTS[c] ?? c);
}
