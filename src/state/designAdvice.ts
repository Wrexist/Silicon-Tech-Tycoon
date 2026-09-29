export function priceAssessment(ratio: number) {
  if (ratio < .65) return { label: "Underpriced", tone: "accent" as const };
  if (ratio < .95) return { label: "Good value", tone: "positive" as const };
  if (ratio < 1.3) return { label: "Fair", tone: "positive" as const };
  if (ratio < 1.8) return { label: "Premium", tone: "neutral" as const };
  return { label: "Overpriced", tone: "negative" as const };
}
export function designAdvice(input: {
  missing: string[]; priceRatio: number; weak: string | null; fit: number; trend: string | null; buyerNeeds?: string;
  /** The Lab's projected launch outcome (same gate the launch applies) and how many live rivals
   *  outclass the build. Without these the advice could say "no major issue" over a forecast flop,
   *  because the drag came from competition rather than the parts or the price. */
  forecast?: { label: string; flop: boolean; betterRivals: number };
}) {
  if (input.missing.length) return { tone: "warning", title: `Choose ${input.missing.join(", ")} before production.`, action: "Choose components", step: "components" as const };
  if (priceAssessment(input.priceRatio).tone === "negative") return { tone: "warning", title: "The asking price is high for these specifications.", action: "Review pricing", step: "launch" as const };
  if (input.weak) return { tone: "warning", title: `The ${input.weak} is the weakest component in this build.`, action: "Improve components", step: "components" as const };
  if (input.forecast?.flop && input.forecast.betterRivals > 0) {
    const n = input.forecast.betterRivals;
    return { tone: "warning", title: `Forecast: slow start. ${n} rival${n > 1 ? "s" : ""} outclass this build right now.`, action: "Out-spec them", step: "components" as const };
  }
  if (input.fit < 50) return { tone: "warning", title: input.buyerNeeds ?? "The current specification mix has limited buyer appeal.", action: "Review buyer priorities", step: "components" as const };
  if (input.trend) return { tone: "info", title: `${input.trend} demand is rising.`, action: "Explore components", step: "components" as const };
  return { tone: "positive", title: input.forecast ? `${input.forecast.label}. No major component or pricing issue.` : "No major component or pricing issue identified.", action: "Review launch plan", step: "launch" as const };
}
