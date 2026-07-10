#!/usr/bin/env node
// Validate App Store localization files against Apple's field limits.
// Usage:  node appstore/localizations/validate.mjs <locale> [<locale> ...]
//         node appstore/localizations/validate.mjs --all
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Limits per Apple's ASC reference: keywords are capped in BYTES ("up to 100 bytes of
// content"); every other field is capped in characters (code points).
const LIMITS = {
  'name.txt': 30,
  'subtitle.txt': 30,
  'promotional_text.txt': 170,
  'keywords.txt': 100,
  'description.txt': 4000,
  'release_notes.txt': 4000,
};
const BYTE_LIMITED = new Set(['keywords.txt']);
const REQUIRED = Object.keys(LIMITS).concat(['screenshot_captions.txt']);

const chars = (s) => Array.from(s).length; // code points
const bytes = (s) => Buffer.byteLength(s, 'utf8');
const len = (s, file) => (BYTE_LIMITED.has(file) ? bytes(s) : chars(s));

function checkLocale(locale) {
  const dir = join(ROOT, locale);
  const problems = [];
  const counts = {};
  if (!existsSync(dir)) return { locale, problems: ['missing directory'], counts };

  for (const file of REQUIRED) {
    const p = join(dir, file);
    if (!existsSync(p)) { problems.push(`missing ${file}`); continue; }
    const raw = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    const text = raw.replace(/\n+$/, ''); // trailing newline doesn't count
    counts[file] = len(text, file);
    if (LIMITS[file] && len(text, file) > LIMITS[file]) {
      const unit = BYTE_LIMITED.has(file) ? 'bytes' : 'chars';
      problems.push(`${file}: ${len(text, file)} ${unit} > limit ${LIMITS[file]}`);
    }
    if (text.trim() === '') problems.push(`${file}: empty`);
    if (/\p{Extended_Pictographic}/u.test(text)) problems.push(`${file}: contains emoji`);
  }

  // keyword-field format rules
  const kwPath = join(dir, 'keywords.txt');
  if (existsSync(kwPath)) {
    const kw = readFileSync(kwPath, 'utf8').trim();
    if (/,\s/.test(kw)) problems.push('keywords.txt: space after comma');
    if (/^,|,,|,$/.test(kw)) problems.push('keywords.txt: empty keyword slot');
    if (/\n/.test(kw)) problems.push('keywords.txt: must be a single line');
    // duplication against this locale's own name + subtitle (those fields are already indexed)
    const indexed = ['name.txt', 'subtitle.txt']
      .filter((f) => existsSync(join(dir, f)))
      .map((f) => readFileSync(join(dir, f), 'utf8').toLowerCase())
      .join(' ');
    for (const word of kw.toLowerCase().split(',')) {
      if (word.length > 2 && indexed.includes(word)) {
        problems.push(`keywords.txt: "${word}" already indexed via name/subtitle (wasted slot)`);
      }
    }
  }
  return { locale, problems, counts };
}

const args = process.argv.slice(2);
const locales = args.includes('--all')
  ? readdirSync(ROOT).filter((f) => statSync(join(ROOT, f)).isDirectory())
  : args;

if (locales.length === 0) {
  console.error('usage: validate.mjs --all | <locale> ...');
  process.exit(2);
}

let failed = 0;
for (const locale of locales.sort()) {
  const { problems, counts } = checkLocale(locale);
  const summary = ['name.txt', 'subtitle.txt', 'promotional_text.txt', 'keywords.txt', 'description.txt']
    .map((f) => `${f.split('.')[0].slice(0, 4)}:${counts[f] ?? '—'}`)
    .join(' ');
  if (problems.length) {
    failed++;
    console.log(`✗ ${locale}  (${summary})`);
    for (const p of problems) console.log(`    - ${p}`);
  } else {
    console.log(`✓ ${locale}  (${summary})`);
  }
}
process.exit(failed ? 1 : 0);
