// Campaign epilogue (Track A: narrative & voice). When the player reaches the pinnacle (goes
// public), the win overlay shows a "Five years later" passage that closes the story of THIS company,
// branched on how it actually turned out: its standing, its scale, and the founder's legend. PURE +
// deterministic. House style: no em dashes.

export interface EpilogueInput {
  companyName: string;
  reputation: number;
  rank: number; // industry rank (1 = top of the leaderboard)
  valuationDollars: number;
  products: number; // lifetime products launched
  fans: number;
  legacy: number; // prestige level (0 = first company)
}

function fmtFans(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k`;
  return String(Math.max(0, Math.round(n)));
}

/** An authored 2-4 sentence "five years later" send-off, keyed on the run's outcome. */
export function campaignEpilogue(i: EpilogueInput): string {
  const standing =
    i.rank === 1
      ? `${i.companyName} sits alone at the top of the industry, the company every rival now measures itself against.`
      : i.reputation >= 90
        ? `${i.companyName} is named in the same breath as the giants, a brand the whole market watches.`
        : i.reputation >= 70
          ? `${i.companyName} earned a lasting place among the major players.`
          : `${i.companyName} proved the doubters wrong and carved out a place of its own.`;

  const sized =
    i.valuationDollars >= 50_000_000_000
      ? "a generational empire worth tens of billions"
      : i.valuationDollars >= 5_000_000_000
        ? "a multi-billion-dollar powerhouse"
        : i.valuationDollars >= 500_000_000
          ? "a serious, profitable company"
          : "a respected independent";

  const body = `Public markets value it as ${sized}, built on ${i.products} product${i.products === 1 ? "" : "s"} and ${fmtFans(i.fans)} devoted fans.`;

  const close =
    i.legacy > 0
      ? "Across every company you have founded, the legend of its founder only grows."
      : "The cramped garage where it all began is a stop on the company tour now.";

  return `Five years later. ${standing} ${body} ${close}`;
}
