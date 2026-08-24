/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guard against the silent-CSS-failure class that shipped twice before being caught in 2026-08:
// a `var(--name)` whose custom property exists NOWHERE. CSS drops the whole declaration at
// computed-value time with no warning — --spring-bounce meant eight authored entrance animations
// never played, and --ink-1/--border/--fs-h2/--fs-large/--radius-12 left chips borderless,
// dividers invisible and titles at inherited size. A reference WITH a fallback
// (`var(--x, 12px)`) is fine — that's the deliberate defensive pattern; only fallback-less
// references to never-defined names fail here.
//
// Read with node:fs, NOT import.meta.glob("?raw"): under Vitest the CSS pipeline wins over the
// raw query and every stylesheet comes back as an EMPTY STRING, which makes the whole scan pass
// vacuously (that version was written, and caught only because injecting a deliberate bug failed
// to fail it). The triple-slash reference above is what keeps `tsc -b` happy — tsconfig.app.json
// narrows `types` to vitest/globals, so node built-ins are otherwise unresolvable here.

const SRC = dirname(dirname(fileURLToPath(import.meta.url))); // …/src

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const cssFiles = files.filter((p) => p.endsWith(".css"));
const rel = (p: string) => p.slice(SRC.length + 1);

describe("CSS custom-property references", () => {
  it("is actually reading stylesheet CONTENT (not just finding filenames)", () => {
    // The vacuity trap this suite fell into once: a file list of the right length whose contents
    // are all "". Assert on bytes and on a token known to exist, so an empty read can't pass.
    expect(cssFiles.length).toBeGreaterThan(20);
    const total = cssFiles.reduce((n, p) => n + readFileSync(p, "utf8").length, 0);
    expect(total).toBeGreaterThan(50_000);
    const tokens = readFileSync(join(SRC, "design", "tokens.css"), "utf8");
    expect(tokens).toContain("--spring-bounce");
  });

  it("every fallback-less var(--x) resolves to a definition somewhere in src", () => {
    const defined = new Set<string>();
    for (const f of files) {
      const t = readFileSync(f, "utf8");
      // CSS declarations: --name: value
      for (const m of t.matchAll(/--([\w-]+)\s*:/g)) defined.add(m[1]);
      // TS/TSX: any string literal naming a custom property counts as a definition site —
      // covers style={{ "--i": i }}, style={{ ["--i" as string]: i }}, setProperty("--x", …).
      for (const m of t.matchAll(/["'`]--([\w-]+)["'`]/g)) defined.add(m[1]);
    }

    // Scan CSS *and* TS/TSX: inline styles reference tokens too (`accent: "var(--fn-design)"`),
    // and a typo there fails exactly as silently as one in a stylesheet. Scanning whole file text
    // rather than line-by-line also catches a var() split across lines; the line number is
    // recovered from the match index for the error message.
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/var\(\s*--([\w-]+)\s*([,)])/g)) {
        if (m[2] === ")" && !defined.has(m[1])) {
          const line = text.slice(0, m.index).split("\n").length;
          offenders.push(`${rel(f)}:${line}  var(--${m[1]}) — never defined, no fallback`);
        }
      }
    }

    expect(offenders, "define the token, fix the name, or give the var() a fallback:\n" + offenders.join("\n")).toEqual([]);
  });

  it("every animation name used in css has matching @keyframes", () => {
    const keyframes = new Set<string>();
    for (const f of cssFiles) {
      for (const m of readFileSync(f, "utf8").matchAll(/@keyframes\s+([\w-]+)/g)) keyframes.add(m[1]);
    }
    const keywords = new Set([
      "none", "inherit", "initial", "unset", "revert", "var", "infinite", "linear", "ease",
      "forwards", "backwards", "both", "paused", "running", "alternate",
    ]);
    const offenders: string[] = [];
    for (const f of cssFiles) {
      readFileSync(f, "utf8").split("\n").forEach((line, idx) => {
        for (const m of line.matchAll(/animation(?:-name)?:\s*([a-zA-Z][\w-]*)/g)) {
          if (!keyframes.has(m[1]) && !keywords.has(m[1])) {
            offenders.push(`${rel(f)}:${idx + 1}  animation "${m[1]}" has no @keyframes`);
          }
        }
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
