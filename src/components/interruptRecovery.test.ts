/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INTERRUPT_ORDER } from "../design/interruptPriority.ts";

// The BRICKED-SAVE loop, pinned. lazyBoundaries.test.ts already asserts the coarse rule — a module
// that creates lazy components also declares a boundary. That is not enough for the interrupts,
// because WHICH boundary catches, and WHAT it renders, is the whole difference between "the card
// doesn't appear this launch" and "the save is unplayable":
//
//   `pendingX` lives in the SAVE. A chunk that 404s (a stale service worker asking for a hash a new
//   deploy already deleted) re-throws during render. If that throw reaches the ROOT boundary, the
//   whole app becomes the crash card — and the next launch re-raises the same pending card, re-fetches
//   the same missing chunk and crashes again. The only exit from that loop was deleting the company.
//
// So the overlay's own boundary must sit ABOVE the Suspense, must render an INERT fallback (a
// boundary with no `fallback` renders the full-screen crash card, which traps the player just as
// thoroughly), and must not touch the pending state — the decision stays in the save and a later
// launch, with a fresh chunk list, shows it. Source-invariant like its neighbours: this is a
// structural rule about where the boundary sits, and there is no seam to call at runtime.

const HERE = dirname(fileURLToPath(import.meta.url));
const INTERRUPTS = readFileSync(resolve(HERE, "./Interrupts.tsx"), "utf8");
const BOUNDARY = readFileSync(resolve(HERE, "./ErrorBoundary.tsx"), "utf8");

/** The body of the `When` wrapper — the one component every interrupt overlay is mounted through. */
const WHEN = (() => {
  const start = INTERRUPTS.indexOf("function When(");
  expect(start, "Interrupts.tsx no longer defines the When wrapper — re-check this file by hand").toBeGreaterThan(-1);
  const end = INTERRUPTS.indexOf("\n}", start);
  return INTERRUPTS.slice(start, end);
})();

describe("a failed interrupt chunk cannot trap a save", () => {
  it("mounts every overlay in INTERRUPT_ORDER lazily (the scan is not vacuous)", () => {
    expect(INTERRUPT_ORDER.length).toBeGreaterThan(5);
    for (const key of INTERRUPT_ORDER) {
      expect(INTERRUPTS, `${key} is not in the lazy OVERLAY map`).toMatch(
        new RegExp(`${key}:\\s*lazy\\(`),
      );
    }
  });

  it("bounds the lazy mount ABOVE the Suspense, not beside it", () => {
    const boundary = WHEN.indexOf("<ErrorBoundary");
    const suspense = WHEN.indexOf("<Suspense");
    expect(boundary, "the interrupt overlays are no longer wrapped in an ErrorBoundary").toBeGreaterThan(-1);
    expect(suspense, "the interrupt overlays are no longer wrapped in a Suspense").toBeGreaterThan(-1);
    // Suspense handles PENDING and nothing else; a rejected chunk is an error, so the boundary has
    // to be the outer one or the throw escapes to the root.
    expect(boundary, "Suspense is outside the boundary — a rejected chunk escapes to the root boundary")
      .toBeLessThan(suspense);
  });

  it("renders an INERT fallback, so a dead chunk costs one card and not the app", () => {
    // `fallback={null}`: no crash card, no retry, nothing that can throw again. A boundary with no
    // fallback prop renders ErrorBoundary's full-screen reset card instead — which, for an overlay
    // raised straight off the save, is the bricked-save loop with extra steps.
    expect(WHEN, "the interrupt boundary no longer renders an inert fallback")
      .toMatch(/<ErrorBoundary\s+fallback=\{null\}/);
  });

  it("leaves the pending decision in the save rather than clearing it to escape", () => {
    // The tempting "fix" for a card that won't load is to clear its pendingX so it stops being
    // raised. That silently eats a decision the player never saw. The wrapper must not touch state
    // at all: it renders nothing and the next launch tries again with a fresh chunk list.
    expect(WHEN).not.toMatch(/pending/i);
    expect(WHEN).not.toMatch(/\b(dispatch|useGame|set[A-Z]|clear[A-Z])/);
  });

  it("routes EVERY overlay through that wrapper", () => {
    // A Suspense mounted anywhere else in this file would be an overlay outside the boundary.
    const suspenseMounts = INTERRUPTS.match(/<Suspense/g) ?? [];
    expect(suspenseMounts).toHaveLength(1);
    // Every lazy overlay is mounted via <When …>: the priority map, plus the earned nemesis trophy.
    expect(INTERRUPTS).toMatch(/<When key=\{key\} on=\{isPending\(state, key\)\}>/);
    expect(INTERRUPTS).toMatch(/<When on=\{state\.pendingNemesisTrophy != null\}><NemesisTrophy \/><\/When>/);
  });
});

describe("the error fallback cannot crash the same way", () => {
  it("returns the caller's fallback before it renders anything of its own", () => {
    const render = BOUNDARY.slice(BOUNDARY.indexOf("  render()"));
    const passthrough = render.indexOf("if (!this.state.error) return this.props.children;");
    const fallback = render.indexOf("if (this.props.fallback !== undefined) return this.props.fallback;");
    expect(passthrough).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(-1);
    // The fallback path is a bare return of a value the caller already constructed: nothing between
    // the catch and it can throw, so a boundary handed `null` genuinely renders nothing.
    expect(fallback).toBeGreaterThan(passthrough);
    const preamble = render.slice(0, fallback);
    expect(preamble).not.toMatch(/this\.(report|copy)\(/);
  });

  it("does not re-enter the machinery that just failed", () => {
    // A fallback that lazily loads a chunk would fail on exactly the offline/stale-deploy conditions
    // that raised it, and one that read game state could re-throw the error it is displaying.
    expect(BOUNDARY).not.toMatch(/(?:^|[^A-Za-z0-9_$.])lazy\s*\(/);
    expect(BOUNDARY).not.toMatch(/<Suspense/);
    expect(BOUNDARY).not.toMatch(/useGame\s*\(/);
  });

  it("keeps the crash card's own escape hatches free of the failing subsystem", () => {
    // Copy is wrapped (a blocked clipboard must not throw out of the card), and Reset goes through
    // the same clearSave every other surface uses, imported statically so the card never depends on
    // a chunk fetch to get the player out.
    expect(BOUNDARY).toMatch(/import \{ clearSave \} from "\.\.\/state\/persistence\.ts";/);
    expect(BOUNDARY).toMatch(/try \{\s*await navigator\.clipboard\.writeText/);
  });
});
