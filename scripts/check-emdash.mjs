#!/usr/bin/env node
// Enforces the project em-dash ban (CLAUDE.md working constraint): the long-dash character must not
// appear on lines ADDED on this branch. Pre-existing occurrences are NOT churned, so this checks the
// DIFF (added lines only) rather than the whole tree. Runs via `npm run lint`.
//
// Base selection: diff against the merge-base with origin/main (the branch point) so every line added
// on the branch is covered; if that ref is missing (fresh clone, detached), fall back to HEAD so at
// least uncommitted work is checked. Pure Node, zero dependencies.
import { execSync } from "node:child_process";

const EM_DASH = String.fromCharCode(0x2014); // built from the code point so this file has no literal

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function resolveBase() {
  for (const ref of ["origin/main", "origin/master", "main", "master"]) {
    try {
      return sh(`git merge-base HEAD ${ref}`);
    } catch {
      /* ref not present, try the next */
    }
  }
  return "HEAD"; // last resort: only uncommitted changes are diffed
}

const base = resolveBase();
let diff = "";
try {
  diff = execSync(`git diff --no-color ${base}`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  console.error("check-emdash: could not read git diff:", e.message);
  process.exit(2);
}

const offenders = [];
let file = null;
let newLine = 0;
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ b/")) {
    file = line.slice(6);
    continue;
  }
  if (line.startsWith("@@")) {
    // @@ -a,b +c,d @@  -> next added line is numbered c
    const m = /\+(\d+)/.exec(line);
    newLine = m ? parseInt(m[1], 10) : 0;
    continue;
  }
  if (line.startsWith("+") && !line.startsWith("+++")) {
    if (file && line.includes(EM_DASH)) {
      offenders.push({ file, line: newLine, text: line.slice(1).trim() });
    }
    newLine++;
  } else if (!line.startsWith("-")) {
    // context line advances the new-file counter; removed lines do not
    newLine++;
  }
}

if (offenders.length > 0) {
  console.error(`\ncheck-emdash: ${offenders.length} added line(s) contain the banned long-dash character (base ${base.slice(0, 12)}):\n`);
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}  ${o.text}`);
  }
  console.error("\nReplace it (usually with ':' or '(' ) before committing.\n");
  process.exit(1);
}

console.log(`check-emdash: clean (no long-dash on lines added since ${base.slice(0, 12)}).`);
