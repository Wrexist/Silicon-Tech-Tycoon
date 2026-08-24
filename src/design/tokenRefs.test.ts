import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guard against the silent-CSS-failure class that shipped twice before being caught in 2026-08:
// a `var(--name)` whose custom property exists NOWHERE. CSS drops the whole declaration at
// computed-value time with no warning — --spring-bounce meant eight authored entrance animations
// never played, and --ink-1/--border/--fs-h2/--fs-large/--radius-12 left chips borderless,
// dividers invisible and titles at inherited size. A reference WITH a fallback
// (`var(--x, 12px)`) is fine — that's the deliberate defensive pattern; only fallback-less
// references to never-defined names fail here.

const SRC = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("CSS custom-property references", () => {
  it("every fallback-less var(--x) resolves to a definition somewhere in src", () => {
    const files = walk(SRC);
    const defined = new Set<string>();
    for (const f of files) {
      const t = readFileSync(f, "utf8");
      // CSS declarations: --name: value
      for (const m of t.matchAll(/--([\w-]+)\s*:/g)) defined.add(m[1]);
      // TS/TSX: any string literal naming a custom property counts as a definition site —
      // covers style={{ "--i": i }}, style={{ ["--i" as string]: i }}, setProperty("--x", …).
      for (const m of t.matchAll(/["'`]--([\w-]+)["'`]/g)) defined.add(m[1]);
    }

    const offenders: string[] = [];
    for (const f of files.filter((p) => p.endsWith(".css"))) {
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line, idx) => {
        for (const m of line.matchAll(/var\(\s*--([\w-]+)\s*([,)])/g)) {
          if (m[2] === ")" && !defined.has(m[1])) {
            offenders.push(`${f.slice(SRC.length + 1)}:${idx + 1}  var(--${m[1]}) — never defined, no fallback`);
          }
        }
      });
    }

    expect(offenders, "define the token, fix the name, or give the var() a fallback:\n" + offenders.join("\n")).toEqual([]);
  });

  it("every animation name used in css has matching @keyframes", () => {
    const cssFiles = walk(SRC).filter((p) => p.endsWith(".css"));
    const keyframes = new Set<string>();
    for (const f of cssFiles) {
      for (const m of readFileSync(f, "utf8").matchAll(/@keyframes\s+([\w-]+)/g)) keyframes.add(m[1]);
    }
    const keywords = new Set(["none", "inherit", "initial", "unset", "revert", "var", "infinite", "linear", "ease", "forwards", "backwards", "both", "paused", "running", "alternate"]);
    const offenders: string[] = [];
    for (const f of cssFiles) {
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line, idx) => {
        for (const m of line.matchAll(/animation(?:-name)?:\s*([a-zA-Z][\w-]*)/g)) {
          if (!keyframes.has(m[1]) && !keywords.has(m[1])) {
            offenders.push(`${f.slice(SRC.length + 1)}:${idx + 1}  animation "${m[1]}" has no @keyframes`);
          }
        }
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
