/**
 * Test dry-run de l'import en appelant le service directement (pas via HTTP).
 * Usage : node scripts/test-import-direct.mjs <file.xlsx>
 */
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Active tsx pour pouvoir importer du TypeScript directement
register('tsx/esm', pathToFileURL('./'));

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage : node scripts/test-import-direct.mjs <file>');
  process.exit(1);
}

const { importWorkbook } = await import('../backend/src/services/excelImportService.ts');

const buffer = readFileSync(filePath);
console.log(`Lecture de ${filePath} (${buffer.length} octets)\n`);
console.log('Dry-run en cours…\n');

const summary = await importWorkbook(buffer, { dryRun: true });
console.log('Résumé dry-run :');
console.log(JSON.stringify(summary, null, 2));

const total = Object.values(summary).reduce(
  (s, v) => s + (typeof v === 'number' ? v : 0),
  0,
);
console.log(`\nTotal nouvelles lignes (si on importait pour de vrai) : ${total}`);
