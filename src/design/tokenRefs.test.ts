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

// This file is excluded from its own scan: it necessarily contains `var(--x)` examples in prose
// and token names in assertions, which are neither real references nor real definitions.
const SELF = fileURLToPath(import.meta.url);
const files = walk(SRC).filter((p) => p !== SELF);
const cssFiles = files.filter((p) => p.endsWith(".css"));
const rel = (p: string) => p.slice(SRC.length + 1);

/** Everything the `animation` shorthand accepts that ISN'T a @keyframes name. */
const ANIMATION_KEYWORDS = new Set([
  "none", "inherit", "initial", "unset", "revert", "revert-layer",
  "linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start", "step-end",
  "infinite", "normal", "reverse", "alternate", "alternate-reverse",
  "forwards", "backwards", "both", "running", "paused",
]);

/** Drop `fn(…)` calls — innermost first, so nesting unwinds — because they hold the commas that
 *  would otherwise break item splitting (`cubic-bezier(0.2, 0.9, …)`, `var(--a, var(--b))`) and
 *  never contain an animation name. */
function stripFunctions(value: string): string {
  let out = value, prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(/[\w-]*\([^()]*\)/g, " ");
  }
  return out;
}

/** The @keyframes names an `animation` shorthand value refers to — one per comma-separated item,
 *  found regardless of field order (`fade 200ms` and `200ms ease fade` both name `fade`).
 *  Exported shape kept tiny and pure so the parser itself is unit-testable above. */
function animationNames(value: string): string[] {
  return stripFunctions(value)
    .split(",")
    .flatMap((item) =>
      item
        .trim()
        .split(/\s+/)
        // Names are identifiers; durations/counts start with a digit or sign, so they drop out.
        .filter((tok) => /^-?[a-zA-Z_][\w-]*$/.test(tok) && !ANIMATION_KEYWORDS.has(tok)),
    );
}

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
      // TS/TSX definition SITES only — an object key (`style={{ "--a": … }}`, or the
      // `["--i" as string]:` computed-key form) or a setProperty call. Deliberately NOT "any
      // quoted --name": this file itself contains `toContain("--spring-bounce")`, and counting
      // that as a definition would let the assertion prop up the very reference it is checking.
      for (const m of t.matchAll(/["'`]--([\w-]+)["'`](?:\s+as\s+[\w.]+)?\s*\]?\s*:/g)) defined.add(m[1]);
      for (const m of t.matchAll(/setProperty\(\s*["'`]--([\w-]+)/g)) defined.add(m[1]);
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

  it("parses animation names out of the shorthand in any field order", () => {
    // Regression cases for the shape the first version missed: it read only the identifier
    // immediately after `animation:`, so a name placed after a duration, or any name past the
    // first in a comma-separated list, was never checked.
    expect(animationNames("fade 200ms ease both")).toEqual(["fade"]);
    expect(animationNames("200ms ease late-name")).toEqual(["late-name"]);
    expect(animationNames("fade 200ms, second-name 1s")).toEqual(["fade", "second-name"]);
    // Commas inside functions must not split an item, and function values are never names.
    expect(animationNames("cele-ray 520ms var(--d) cubic-bezier(0.2, 0.9, 0.3, 1) both")).toEqual(["cele-ray"]);
    expect(animationNames("awd-drop var(--spring-bounce, var(--spring-standard)) both")).toEqual(["awd-drop"]);
    // Pure-keyword declarations name nothing.
    expect(animationNames("none")).toEqual([]);
  });

  it("every animation name used in css has matching @keyframes", () => {
    const keyframes = new Set<string>();
    for (const f of cssFiles) {
      for (const m of readFileSync(f, "utf8").matchAll(/@keyframes\s+([\w-]+)/g)) keyframes.add(m[1]);
    }
    const offenders: string[] = [];
    for (const f of cssFiles) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/animation(?:-name)?\s*:\s*([^;{}]+)/g)) {
        for (const name of animationNames(m[1])) {
          if (!keyframes.has(name)) {
            const line = text.slice(0, m.index).split("\n").length;
            offenders.push(`${rel(f)}:${line}  animation "${name}" has no @keyframes`);
          }
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
