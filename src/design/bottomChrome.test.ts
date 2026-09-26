/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regression pin for the 2026-09 toast / simulation-control collision: `.ds-toast-host` reserved
// 96px from the bottom while the floating SpeedDial owned 72–132px, so a toast covered the pause /
// fast-forward / skip controls (proven in a real browser — `npm run verify:overlay` does the live
// input check; this suite pins the CSS relationship cheaply, without a DOM).
//
// The geometry lives in ONE place (design/tokens.css). These assertions fail if any consumer
// re-hardcodes its old offset, or if the dial's real expanded height drifts away from the declared
// `--bottom-chrome-controls`.
const SRC = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), "utf8");

const TOKENS = read("design", "tokens.css");
const PRIMITIVES = read("design", "primitives.css");
const HUD = read("components", "hud.css");
const APP = read("App.css");

/** The declaration block of the FIRST rule with exactly this selector (selectors are anchored with
 *  the brace, so `.speeddial` never matches `.speeddial--open` or `.speeddial__btn`). */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(escaped + "\\s*\\{([^}]*)\\}"));
  if (!m) throw new Error(`rule ${selector} not found`);
  return m[1];
}

function pxToken(css: string, name: string): number {
  const m = css.match(new RegExp(`--${name}\\s*:\\s*(\\d+)px`));
  if (!m) throw new Error(`token --${name} not found`);
  return Number(m[1]);
}

describe("bottom chrome / toast lane", () => {
  it("declares the band geometry as named tokens", () => {
    expect(pxToken(TOKENS, "bottom-chrome-bottom")).toBe(72);
    expect(pxToken(TOKENS, "bottom-chrome-controls")).toBe(60);
    expect(pxToken(TOKENS, "bottom-chrome-gap")).toBe(20);
    const band = TOKENS.match(/--bottom-chrome\s*:\s*([^;]+);/);
    expect(band?.[1]?.trim()).toBe(
      "calc(var(--bottom-chrome-bottom) + var(--bottom-chrome-controls) + var(--bottom-chrome-gap))",
    );
  });

  it("reserves the dial content height plus clearance for its border", () => {
    // 48px button + 2×6px padding (the expanded pill). If the button or padding changes, the
    // declared band must move with it — otherwise the toast lane silently stops clearing it.
    expect(rule(HUD, ".speeddial--open")).toMatch(/padding:\s*var\(--sp-6\)/);
    expect(rule(HUD, ".speeddial__btn")).toMatch(/height:\s*48px/);
    const sp6 = pxToken(TOKENS, "sp-6");
    expect(48 + 2 * sp6).toBe(pxToken(TOKENS, "bottom-chrome-controls"));
  });

  it("stacks toasts ABOVE the persistent-control band, never inside it", () => {
    const host = rule(PRIMITIVES, ".ds-toast-host");
    expect(host).toMatch(/bottom:\s*calc\(var\(--bottom-chrome\)\s*\+\s*env\(safe-area-inset-bottom\)\)/);
    const bottom = pxToken(TOKENS, "bottom-chrome-bottom");
    const controls = pxToken(TOKENS, "bottom-chrome-controls");
    const band = bottom + controls + pxToken(TOKENS, "bottom-chrome-gap");
    // The toast lane starts no lower than the dial's top edge (plus the breathing gap).
    expect(rule(HUD, ".speeddial")).toMatch(/border:\s*1px solid/);
    expect(band).toBeGreaterThan(bottom + controls + 2);
  });

  it("anchors the dial and the scroll spacer on the same band", () => {
    expect(rule(HUD, ".speeddial")).toMatch(/bottom:\s*calc\(var\(--bottom-chrome-bottom\)\s*\+\s*env\(safe-area-inset-bottom\)\)/);
    expect(rule(APP, ".app__spacer")).toMatch(/height:\s*calc\(var\(--bottom-chrome\)\s*\+\s*env\(safe-area-inset-bottom\)\)/);
  });
});
