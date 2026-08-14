// The founding brief — one question, asked once, before the founding offer.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────
// The single largest documented lever on subscription conversion isn't the paywall — it's the
// screen before it. Apps that ask the player to state what they want first convert several times
// better than apps that open with a price list, for two reasons: the answer lets the offer lead
// with the thing this particular player actually came for, and stating an ambition is a small
// commitment that makes the next screen feel like an answer rather than an interruption.
//
// ── AND WHY IT IS NOT A DARK PATTERN ────────────────────────────────────────────────────────────
// The industry version of this is a ten-question "personalization quiz" that changes nothing except
// which testimonial you see. This is one question, it says plainly what it is for, and the answer
// does exactly what it claims: it reorders what the offer leads with, and it sticks around in
// Settings as the ambition you set. No fake computation, no "analyzing your answers…" spinner, no
// invented urgency. If the player skips it, everything still works — they just get the default
// ordering.
//
// PURE-ish (localStorage only) and fully testable.

/** What the player says they came to Silicon for. */
export type FounderIntent = "empire" | "craft" | "rivalry";

export interface IntentOption {
  id: FounderIntent;
  /** The answer, in the player's voice. */
  label: string;
  /** One line of texture under it. */
  sub: string;
}

export const INTENT_OPTIONS: IntentOption[] = [
  { id: "empire", label: "An empire that outlives me", sub: "Scale from a garage to a company that shapes the industry." },
  { id: "craft", label: "One perfect device", sub: "Obsess over the design until every component is right." },
  { id: "rivalry", label: "To beat everyone else", sub: "Out-think the incumbents and take the market from them." },
];

const KEY = "silicon.founderIntent";

export function getFounderIntent(): FounderIntent | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "empire" || raw === "craft" || raw === "rivalry" ? raw : null;
  } catch {
    return null;
  }
}

export function setFounderIntent(intent: FounderIntent): void {
  try {
    localStorage.setItem(KEY, intent);
  } catch {
    /* storage unavailable — the default ordering is used, nothing breaks */
  }
}

/** True when the brief has never been answered on this device. Asked exactly once. */
export function founderIntentAsked(): boolean {
  return getFounderIntent() !== null || readSkipped();
}

const SKIP_KEY = "silicon.founderIntent.skipped";

function readSkipped(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

export function markFounderIntentSkipped(): void {
  try {
    localStorage.setItem(SKIP_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Dev/test only. */
export function resetFounderIntent(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(SKIP_KEY);
  } catch {
    /* ignore */
  }
}

/** The stated ambition, for the Settings row. Null when never answered. */
export function founderIntentLabel(): string | null {
  const intent = getFounderIntent();
  return intent ? (INTENT_OPTIONS.find((o) => o.id === intent)?.label ?? null) : null;
}

/* ─────────────────────────────  HOW IT SHAPES THE OFFER  ───────────────────────────── */

/** Headline the founding offer leads with, per stated ambition. Each one is a true description of
 *  what Pro contains — the choice changes the ORDER of the argument, never its honesty. */
export const INTENT_HEADLINE: Record<FounderIntent, { title: string; body: string }> = {
  empire: {
    title: "Then you'll need the whole arc",
    body: "Free takes you from the garage through the Growth Era. Pro carries the rest — the Platform and AI eras, the IPO, and New Game+.",
  },
  craft: {
    title: "Then design without a budget",
    body: "Pro includes Creative Mode: unlimited funds and research, the later eras' components, and a Museum of everything you ship.",
  },
  rivalry: {
    title: "Then take the whole board",
    body: "Pro opens all six scenarios, the Ascension ladder for a harder game, and the Platform Division that locks rivals into your ecosystem.",
  },
};

/** Benefit ids (matching PRO_BENEFITS titles) to float to the top for each ambition. Anything not
 *  listed keeps its default order behind them. */
export const INTENT_BENEFIT_ORDER: Record<FounderIntent, string[]> = {
  empire: ["The full campaign", "New Game+", "Platform Division"],
  craft: ["Creative Mode", "The archives", "The full campaign"],
  rivalry: ["Every scenario", "Platform Division", "New Game+"],
};

/**
 * Float the named titles to the front of a list, keeping everything else in its authored order.
 *
 * The ONE operation any personalization in this product is allowed to perform. It is a permutation
 * by construction — same length, same members — which is what makes "everyone is shown the same
 * promises" a property of the code rather than a claim in a comment. Pure; a no-op on an empty lead
 * list or a title that doesn't exist.
 */
export function leadWith<T extends { title: string }>(items: T[], leadTitles: readonly string[]): T[] {
  if (leadTitles.length === 0) return items;
  const rank = (b: T) => {
    const i = leadTitles.indexOf(b.title);
    return i === -1 ? leadTitles.length : i;
  };
  // Stable sort by rank — ties keep their authored order.
  return items
    .map((b, i) => ({ b, i, r: rank(b) }))
    .sort((x, y) => x.r - y.r || x.i - y.i)
    .map((x) => x.b);
}

/** Reorder a benefit list so the ones matching the stated ambition lead. Stable for everything
 *  else, and a no-op when no ambition was given. Pure. */
export function orderBenefits<T extends { title: string }>(benefits: T[], intent: FounderIntent | null): T[] {
  return intent ? leadWith(benefits, INTENT_BENEFIT_ORDER[intent]) : benefits;
}
