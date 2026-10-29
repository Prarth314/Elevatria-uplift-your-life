// Reports locations and categories only. Never prints matched credential values.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const skip = new Set(['.git', 'node_modules', 'dist', '.pnpm-store', 'artifacts']);
const rules = [
  ['provider credential', /(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|AIza[\w-]{30,})/g],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['email address (review)', /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi],
];
let findings = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(?:tsx?|jsx?|mjs|json|ya?ml|md|css|html|sh|mo|did)$/.test(file) || entry.name.startsWith('.env')) {
      const source = await readFile(file, 'utf8');
      for (const [category, regex] of rules) {
        const matches = [...source.matchAll(regex)];
        if (matches.length) { console.log(`${file}: ${category} (${matches.length})`); findings += matches.length; }
      }
    }
  }
}
await walk('.');
console.log(`Audit complete: ${findings} matches requiring review. Binary assets need visual review.`);
