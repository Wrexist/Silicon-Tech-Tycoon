// First-time framing for recurring interrupt SYSTEMS. The game introduces a lot of "alive world"
// subsystems as full-screen decisions that fire cold — a community ask, a regional flare-up, an
// earnings call — and a new player meets each one mid-sentence with no idea what it is. This records,
// once and forever (cross-run, like a tutorial-seen flag), which interrupt systems the player has met,
// so an overlay can show a single "what this is" line the FIRST time it appears and never again.
//
// Purely a UI convenience — a localStorage set, read only by the overlays. Nothing here touches the
// sim, so determinism is unaffected.
import { mirrorToNative } from "./nativeStore.ts";

const KEY = "silicon.introsSeen.v1";

/** One-line explainer per interrupt system, shown the first time that system interrupts the player.
 *  Keyed by the same identifiers as the interrupt-priority list where they overlap. */
export const INTRO_COPY: Record<string, string> = {
  communityAsk: "Your community will speak up now and then — answer to grow and delight your fans, or let it pass.",
  regionalEvent: "Overseas markets flare up — booms, tariffs, a rival surging. Respond to defend your standing, or ride it out.",
  earnings: "Each quarter as a public company, the street weighs your revenue against expectations and moves your share price.",
  licenseOffer: "Rivals can offer to license your OS — a signing bonus plus weekly royalties, for a fixed term. Sign, haggle, or pass.",
  staffMoment: "Standout teammates occasionally earn a permanent upgrade — you choose how they grow.",
  staffEvent: "Your people hit personal turning points. How you respond shapes their morale and whether they stay.",
  postLaunch: "Products on shelves hit mid-life moments — a hot streak, a stall, a supply pinch — for you to manage.",
  eureka: "Your lab can strike a breakthrough: bank it for a safe gain, or gamble on chasing the full prototype.",
};

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

/** Has the player already met this interrupt system (in any company)? */
export function hasSeenIntro(key: string): boolean {
  return read().has(key);
}

/** Record that the player has now met this system, so its intro never shows again. Idempotent. */
export function markIntroSeen(key: string): void {
  const seen = read();
  if (seen.has(key)) return;
  seen.add(key);
  const serialized = JSON.stringify([...seen]);
  try {
    localStorage.setItem(KEY, serialized);
  } catch {
    /* ignore */
  }
  mirrorToNative(KEY, serialized);
}
