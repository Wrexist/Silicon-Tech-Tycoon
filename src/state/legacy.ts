// Prestige "legacy" — persists across companies (separate from the game save) so that
// taking a company public and starting New Game+ grants a permanent head start.
const KEY = "silicon.legacy";

export function getLegacy(): number {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

export function setLegacy(level: number): void {
  try {
    localStorage.setItem(KEY, String(Math.max(0, level)));
  } catch {
    /* ignore */
  }
}
