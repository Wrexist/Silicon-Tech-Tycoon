// Industry Buzz — the world reacting to you, live. A PURE fold over the current state into a short,
// prioritised list of authored one-line headlines (rank, your latest launch, a rival's move, your
// platform, fans, the next era…). The HQ shows them as a rotating "wire" so the world feels awake
// and watching. No RNG, no economy touch — pure flavour derived from data that already exists.
import type { CategoryId } from "./types.ts";

export type BuzzTone = "neutral" | "good" | "bad" | "hot";

export interface BuzzLine {
  id: string;
  text: string;
  tone: BuzzTone;
}

export interface BuzzInput {
  company: string;
  rank: number;
  fieldSize: number;
  reputation: number;
  fans: number;
  listed: boolean;
  /** 0..1 progress toward the next era (reputation-based); ≥ ~0.6 → "a new era is near". */
  eraProgress: number;
  valuationDollars: number;
  /** The player's most recent launch + how it did, or null. */
  latestLaunch: { name: string; verdict: "hit" | "solid" | "flop" | "steady" | null } | null;
  /** A rival's most recent release, or null. */
  latestRival: { company: string; product: string; category: CategoryId } | null;
  /** Devices running your OS (0 when the platform division isn't founded). */
  platformBase: number;
  osName: string;
  licenseeCount: number;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.max(0, Math.round(n)));
}

/** Prioritised, authored headlines for the current moment (most interesting first). Pure. */
export function industryBuzz(i: BuzzInput): BuzzLine[] {
  const out: BuzzLine[] = [];

  // Your standing — always leads.
  if (i.rank === 1) out.push({ id: "rank", text: `${i.company} sits at #1 in the industry.`, tone: "hot" });
  else out.push({ id: "rank", text: `${i.company} climbs to #${i.rank} of ${i.fieldSize}.`, tone: i.rank <= 3 ? "good" : "neutral" });

  // Your latest launch — the story the market is telling about you.
  if (i.latestLaunch) {
    const v = i.latestLaunch.verdict;
    const n = i.latestLaunch.name;
    if (v === "hit") out.push({ id: "launch", text: `${n} is a hit — reviewers can't get enough.`, tone: "hot" });
    else if (v === "flop") out.push({ id: "launch", text: `${n} stumbles out of the gate; buyers shrug.`, tone: "bad" });
    else out.push({ id: "launch", text: `${n} holds its own on the shelves.`, tone: "neutral" });
  }

  // The platform division — a business the press tracks.
  if (i.platformBase > 0) {
    const partners = i.licenseeCount > 0 ? `, ${i.licenseeCount} partner${i.licenseeCount > 1 ? "s" : ""} shipping it` : "";
    out.push({ id: "os", text: `${i.osName} runs on ${fmtCount(i.platformBase)} devices${partners}.`, tone: "good" });
  }

  // A rival's move — you're not the only one shipping.
  if (i.latestRival) {
    out.push({ id: "rival", text: `${i.latestRival.company} pushes the ${i.latestRival.product} into ${i.latestRival.category}s.`, tone: "neutral" });
  }

  // Momentum signals.
  if (i.fans >= 5_000) out.push({ id: "fans", text: `A fanbase ${fmtCount(i.fans)} strong is hanging on your next move.`, tone: "good" });
  if (i.valuationDollars >= 1_000_000_000) out.push({ id: "val", text: `The Street values ${i.company} north of $${fmtCount(i.valuationDollars)}.`, tone: "good" });
  if (i.eraProgress >= 0.6 && !i.listed) out.push({ id: "era", text: `Analysts whisper a new era is close.`, tone: "neutral" });
  if (i.reputation >= 85) out.push({ id: "rep", text: `${i.company}'s name alone now moves the market.`, tone: "hot" });

  return out;
}
