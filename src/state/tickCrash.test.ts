/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The weekly tick runs inside setInterval. A throw there is NOT a render error: React never sees it,
// no boundary catches it, the interval callback simply dies. The visible result is the worst kind of
// failure this app can have — the clock stops, every button still works, nothing says anything is
// wrong, and the player keeps tapping a game that will never advance another week again.
//
// The fix (useGame.tsx) is small and easy to lose in a refactor: catch the throw, park it in state,
// and RE-THROW it during render so the root ErrorBoundary handles it like any other crash — copyable
// report, Reload, guarded Reset. Two details make it safe and are pinned here with it: the re-throw
// sits after every hook (throwing earlier would skip the hooks below it and leave React's hook list
// for this fiber inconsistent), and `store.set` evaluates its updater before assigning, so the last
// committed week — and the save on disk — survive the crash.
//
// Source-invariant: the interval body has no seam to call, and a timing test on a real interval would
// be flaky. What must not regress is structural.
const SRC = readFileSync(resolve(__dirname, "./useGame.tsx"), "utf8");

/** The tick's setInterval body, from the interval that advances the week. */
const TICK = (() => {
  const start = SRC.indexOf("const id = setInterval(() => {");
  expect(start, "useGame.tsx no longer starts the weekly tick with setInterval").toBeGreaterThan(-1);
  const end = SRC.indexOf("return () => clearInterval(id);", start);
  expect(end, "could not find the end of the tick effect").toBeGreaterThan(start);
  return SRC.slice(start, end);
})();

/** The re-throw, as a LIVE statement: anchored so a commented-out copy can never satisfy it. */
const THROW_LINE = /^[ \t]*if \(tickError\) throw tickError;$/m;

describe("a sim-tick throw surfaces instead of freezing the clock", () => {
  it("advances the week inside the guarded body (the scan is not vacuous)", () => {
    expect(TICK).toMatch(/advanceOneWeek\(s\)/);
    expect(TICK).toMatch(/store\.set\(/);
  });

  it("catches the throw and parks it in state", () => {
    expect(TICK).toMatch(/\btry \{/);
    const catchBody = TICK.slice(TICK.lastIndexOf("} catch ("));
    // Not swallowed, not merely logged: the error is kept so render can re-throw it.
    expect(catchBody).toMatch(/setTickError\(e instanceof Error \? e : new Error\(String\(e\)\)\)/);
    // An empty or comment-only catch is the freeze this pin exists to prevent.
    expect(TICK).not.toMatch(/catch\s*(\([^)]*\))?\s*\{\s*\}/);
  });

  it("re-throws during render, so the ROOT boundary shows the crash card", () => {
    // Anchored to the start of a line: a commented-out `// if (tickError) throw …` is a frozen
    // clock, and matching it anywhere in the file would pass on exactly that regression.
    expect(SRC).toMatch(THROW_LINE);
    expect(SRC).toMatch(/const \[tickError, setTickError\] = useState<Error \| null>\(null\)/);
  });

  it("re-throws AFTER every hook and immediately before the provider's return", () => {
    const throwAt = SRC.search(THROW_LINE);
    expect(throwAt).toBeGreaterThan(-1);
    const returnAt = SRC.indexOf("return (\n    <StoreContext.Provider", throwAt);
    expect(returnAt, "the provider's return moved — re-check where the tick error is thrown").toBeGreaterThan(throwAt);
    // Nothing but whitespace/comments between the throw and the return: no hook call can be skipped
    // by it, which is what makes throwing from render safe here.
    const between = SRC.slice(throwAt + (SRC.match(THROW_LINE)?.[0].length ?? 0), returnAt);
    expect(between.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "").trim()).toBe("");
    // And it really is the last thing in the component: no `use…(` follows it.
    const after = SRC.slice(throwAt, returnAt);
    expect(after).not.toMatch(/\buse[A-Z][A-Za-z]*\(/);
  });
});
