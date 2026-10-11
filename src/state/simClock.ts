// Where the live sim is inside the current week, for UI that smooths between ticks (the research and
// build rings). The tick loop in useGame publishes here: `arm` when its interval starts (or restarts —
// resume, Fast toggle, foreground), `tick` each time a week lands, `stop` when it halts for any reason
// (pause, hidden, suspended, bankrupt, another tab).
//
// This is the ONE source of the in-week position, so every ring agrees — one that stays mounted and
// one opened later. A stop freezes the phase where it stood; the sim then restarts its interval from
// scratch on resume, so the phase carries over and the rest of the week is spread across that fresh
// full tick. A landed week resets it to 0.
//
// Presentation only: a wall-clock side channel the simulation never reads.

let running = false;
let tickMs = 0;
let lastAt = 0;
let carry = 0;   // the phase the week had reached when the current interval started
let frozen = 0;  // the phase shown while time is stopped
let known = false; // nothing armed yet this session: no phase to report

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

function livePhase(now: number): number {
  if (!(tickMs > 0)) return carry;
  const t = Math.min(1, Math.max(0, (now - lastAt) / tickMs));
  return Math.min(1, carry + (1 - carry) * t);
}

export function armSimClock(ms: number, now = nowMs()): void {
  if (!(ms > 0)) return;
  if (!running) carry = known ? frozen : 0;
  running = true;
  known = true;
  tickMs = ms;
  lastAt = now;
}

export function markSimTick(now = nowMs()): void {
  carry = 0;
  frozen = 0;
  lastAt = now;
}

export function stopSimClock(now = nowMs()): void {
  if (!running) return;
  frozen = livePhase(now);
  running = false;
}

export interface SimPhase { phase: number; running: boolean }

/** The sim's progress through the current week in [0, 1] — live while it runs, frozen while it's
 *  stopped — or null before the sim has ever run this session. */
export function simWeekPhase(now = nowMs()): SimPhase | null {
  if (!known) return null;
  return running ? { phase: livePhase(now), running: true } : { phase: frozen, running: false };
}

/** Test-only: forget everything (each test starts from a cold clock). */
export function resetSimClockForTests(): void {
  running = false; tickMs = 0; lastAt = 0; carry = 0; frozen = 0; known = false;
}
