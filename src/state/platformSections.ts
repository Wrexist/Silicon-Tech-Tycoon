// The Platform sub-app's six sections. A section travels in the route's `params.section` (so it is
// linkable and survives a reload), and this module is the single place that decides what a given
// param value means — an unknown value must never render an empty panel.

export type PlatformSection = "overview" | "services" | "ecosystem" | "licensing" | "developers" | "distribution";

/** Rail order. `overview` is first because it is the fallback the resolver returns. */
export const PLATFORM_SECTIONS: readonly PlatformSection[] = [
  "overview",
  "services",
  "ecosystem",
  "licensing",
  "developers",
  "distribution",
];

export const SECTION_LABELS: Record<PlatformSection, string> = {
  overview: "Overview",
  services: "Services",
  ecosystem: "Ecosystem",
  licensing: "Licensing",
  developers: "Developers",
  distribution: "Distribution",
};

export function resolvePlatformSection(raw: string | undefined): PlatformSection {
  const v = (raw ?? "").trim().toLowerCase();
  return (PLATFORM_SECTIONS as readonly string[]).includes(v) ? (v as PlatformSection) : PLATFORM_SECTIONS[0];
}
