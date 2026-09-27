/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regression pin for the 2026-09 mojibake: useGame.tsx had been round-tripped through a latin-1
// editor, so ~20 player-facing toasts read "Commission delivered â€” payment banked" and "3â˜…
// earned". Double-encoded UTF-8 always starts with one of these byte pairs, so a plain scan of
// every source file catches the whole class without a DOM.
const SRC = dirname(dirname(fileURLToPath(import.meta.url)));
const MOJIBAKE = /Â[·°±²³µ¼½¾ ]|â€|â˜|â†|â‰|âˆ|âœ|â–/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name) && !name.endsWith("encoding.test.ts")) out.push(p);
  }
  return out;
}

describe("source encoding", () => {
  it("has no double-encoded UTF-8 (mojibake) in any source file", () => {
    const offenders = walk(SRC).flatMap((file) =>
      readFileSync(file, "utf8").split("\n").flatMap((line, i) =>
        MOJIBAKE.test(line) ? [`${file.slice(SRC.length + 1)}:${i + 1}`] : []));
    expect(offenders).toEqual([]);
  });
});
