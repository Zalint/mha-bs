/**
 * Inspecte la structure d'un classeur Excel SANS tronquer les valeurs des
 * colonnes "clés" (en-têtes + numéros + dates).
 */
import XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage : node scripts/inspect-import-format.mjs <path>');
  process.exit(1);
}

const buffer = readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer' });

function trim(s, max = 80) {
  if (s === null || s === undefined) return '∅';
  const str = String(s).replace(/\s+/g, ' ').trim();
  if (str === '') return '∅';
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

for (const sheetName of wb.SheetNames) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) continue;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  console.log(`\n══════ "${sheetName}" ══════`);

  // Trouve les 1ères lignes "utiles" (avec ≥ 2 cellules non vides)
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const row = (rows[i] ?? []).slice(0, 18);
    const nonEmpty = row.filter((c) => c !== null && String(c).trim() !== '').length;
    if (nonEmpty === 0) continue;
    console.log(`L${String(i + 1).padStart(3)}:`);
    row.forEach((c, j) => {
      if (c === null || String(c).trim() === '') return;
      console.log(`     col[${j}] type=${typeof c} : ${trim(c)}`);
    });
  }
}
