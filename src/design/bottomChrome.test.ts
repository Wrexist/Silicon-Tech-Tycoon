/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regression pin for the 2026-09 toast / simulation-control collision: a toast lane pinned to a
// hand-typed offset covered the pause / fast-forward / skip controls (proven in a real browser —
// `npm run verify:overlay` does the live input check; this suite pins the CSS relationship cheaply,
// without a DOM).
//
// The persistent controls now live in ONE fixed bottom dock (time controls + tab bar) that measures
// itself into `--dock-height` (BottomDock.tsx, safe area included). Every layer that floats above the
// dock — toasts, the coach, the Decision Inbox, the Pro nudge — and the scroll spacer beneath the
// content must anchor on that ONE measurement. These assertions fail if any consumer re-hardcodes an
// old nav height (the 66/72px offsets that left banners half-hidden under the dock).
const SRC = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), "utf8");

const TOKENS = read("design", "tokens.css");
const PRIMITIVES = read("design", "primitives.css");
const REDESIGN = read("design", "redesign.css");
const DOCK = read("components", "BottomDock.tsx");

/** The declaration block of the FIRST rule with exactly this selector (anchored on the brace, so
 *  `.pnudge` never matches `.pnudge__card`). */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp("(?:^|\\n)" + escaped + "\\s*\\{([^}]*)\\}"));
  if (!m) throw new Error(`rule ${selector} not found`);
  return m[1];
}

describe("bottom chrome / toast lane", () => {
  it("the dock measures itself into --dock-height, with a static fallback token", () => {
    expect(DOCK).toMatch(/setProperty\("--dock-height"/);
    expect(TOKENS).toMatch(/--dock-height:\s*\d+px/);
  });

  it("stacks toasts ABOVE the dock, never inside it", () => {
    expect(rule(PRIMITIVES, ".ds-toast-host")).toMatch(/bottom:\s*calc\(var\(--dock-height\)\s*\+\s*var\(--sp-\d+\)\)/);
  });

  it("floats every banner above the dock on the same measurement", () => {
    for (const [file, selector] of [
      [["components", "coach.css"], ".coach"],
      [["components", "decisionInbox.css"], ".dinbox"],
      [["components", "proNudge.css"], ".pnudge"],
    ] as const) {
      const css = read(...file);
      const block = css.match(new RegExp("\\n" + selector.replace(".", "\\.") + "\\s*\\{([^}]*)\\}"))?.[1] ?? css;
      expect(block, `${selector} bottom`).toMatch(/bottom:\s*calc\(var\(--dock-height\)/);
      expect(css, `${selector} must not hard-code a nav height`).not.toMatch(/bottom:\s*calc\((?:66|72)px/);
    }
  });

  it("reserves the dock's height beneath the scroll content", () => {
    expect(REDESIGN).toMatch(/\.app \.app__spacer\s*\{\s*height:\s*calc\(var\(--dock-height\)/);
  });
});
