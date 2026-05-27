/**
 * Test dry-run de l'import via API.
 * Usage : node scripts/test-import-dryrun.mjs <file.xlsx> <jwt>
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const filePath = process.argv[2];
const token = process.argv[3];
if (!filePath) {
  console.error('Usage : node scripts/test-import-dryrun.mjs <file> [jwt]');
  process.exit(1);
}

const buffer = readFileSync(filePath);
const form = new FormData();
const blob = new Blob([buffer], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});
form.append('file', blob, basename(filePath));

const url = 'http://localhost:3001/api/import?dryRun=true';
const headers = {};
if (token) headers.Authorization = `Bearer ${token}`;

console.log(`POST ${url} (dryRun) avec ${basename(filePath)}\n`);
const res = await fetch(url, { method: 'POST', body: form, headers });
const text = await res.text();
console.log(`HTTP ${res.status}`);
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
