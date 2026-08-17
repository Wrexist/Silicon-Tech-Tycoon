#!/usr/bin/env node
// Validate App Store localization files against Apple's field limits.
// Usage:  node appstore/localizations/validate.mjs <locale> [<locale> ...]
//         node appstore/localizations/validate.mjs --all
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Guideline 3.1.2 — every localized description must carry a FUNCTIONAL Terms of Use (EULA) link.
// v1.3.0 (build 70) was rejected for exactly this: the ASC License Agreement field alone does not
// satisfy Apple's automated metadata check, the link has to be in the description text itself.
const EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/';

const LIMITS = {
  'name.txt': 30,
  'subtitle.txt': 30,
  'promotional_text.txt': 170,
  'keywords.txt': 100,
  'description.txt': 4000,
  'release_notes.txt': 4000,
};
const REQUIRED = Object.keys(LIMITS).concat(['screenshot_captions.txt']);

const len = (s) => Array.from(s).length; // code points, matches App Store Connect counting

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
    counts[file] = len(text);
    if (LIMITS[file] && len(text) > LIMITS[file]) {
      problems.push(`${file}: ${len(text)} chars > limit ${LIMITS[file]}`);
    }
    if (text.trim() === '') problems.push(`${file}: empty`);
    if (/\p{Extended_Pictographic}/u.test(text)) problems.push(`${file}: contains emoji`);
  }

  // legal links — the subscription rejection guard
  const descPath = join(dir, 'description.txt');
  if (existsSync(descPath)) {
    const desc = readFileSync(descPath, 'utf8');
    if (!desc.includes(EULA_URL)) problems.push('description.txt: no Terms of Use (EULA) link — Guideline 3.1.2');
    if (!desc.includes(PRIVACY_URL)) problems.push('description.txt: no Privacy Policy link — Guideline 3.1.2');
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
