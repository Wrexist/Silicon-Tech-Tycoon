export function priceAssessment(ratio: number) {
  if (ratio < .65) return { label: "Underpriced", tone: "accent" as const };
  if (ratio < .95) return { label: "Good value", tone: "positive" as const };
  if (ratio < 1.3) return { label: "Fair", tone: "positive" as const };
  if (ratio < 1.8) return { label: "Premium", tone: "neutral" as const };
  return { label: "Overpriced", tone: "negative" as const };
}
export function designAdvice(input: { missing: string[]; priceRatio: number; weak: string | null; fit: number; trend: string | null; buyerNeeds?: string }) {
  if (input.missing.length) return { tone: "warning", title: `Choose ${input.missing.join(", ")} before production.`, action: "Choose components", step: "components" as const };
  if (priceAssessment(input.priceRatio).tone === "negative") return { tone: "warning", title: "The asking price is high for these specifications.", action: "Review pricing", step: "launch" as const };
  if (input.weak) return { tone: "warning", title: `The ${input.weak} is the weakest component in this build.`, action: "Improve components", step: "components" as const };
  if (input.fit < 50) return { tone: "warning", title: input.buyerNeeds ?? "The current specification mix has limited buyer appeal.", action: "Review buyer priorities", step: "components" as const };
  if (input.trend) return { tone: "info", title: `${input.trend} demand is rising.`, action: "Explore components", step: "components" as const };
  return { tone: "positive", title: "No major component or pricing issue identified.", action: "Review launch plan", step: "launch" as const };
}
