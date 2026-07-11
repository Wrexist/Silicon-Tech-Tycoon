// Marketing channels — how you take a finished product to market. Each adds launch hype
// (and sometimes reputation) for a cash cost. PURE catalog.
import { dollars, type Money } from "./money.ts";
import type { SegmentId } from "./types.ts";

export type ChannelId = "none" | "social" | "search" | "billboards" | "influencer" | "tv" | "event" | "global";

export interface MarketingChannel {
  id: ChannelId;
  name: string;
  blurb: string;
  icon: string; // lucide icon name (resolved in UI)
  cost: Money;
  hype: number; // added to the launch hype multiplier
  reputation: number; // one-time reputation bump on launch
  /** Minimum era before this channel is offered in the picker (undefined/1 = always). The bigger
   *  channels open as the company grows, so early launches aren't a wall of options. */
  unlockEra?: number;
  /** Item 1.3 — who this channel REACHES. A per-segment multiplier (>1 favours, <1 neglects) that
   *  REDISTRIBUTES the launch's demand toward the buyers the channel is good at (renormalised in
   *  segments.ts, so it never inflates total demand — the hype does that). Makes the campaign step a
   *  positioning choice ("Search finds Pro/Enterprise intent; Influencer owns Style") instead of a
   *  pure pay-more-hype ladder. Omitted → neutral (all segments 1). */
  segmentBias?: Partial<Record<SegmentId, number>>;
  /** A short human tag naming who the channel skews toward (for the wizard hint). */
  audience?: string;
}

export const MARKETING_CHANNELS: MarketingChannel[] = [
  { id: "none", name: "No campaign", blurb: "Let the product speak for itself.", icon: "Ban", cost: dollars(0), hype: 0, reputation: 0 },
  { id: "social", name: "Social Media", blurb: "Cheap, modern reach.", icon: "Share2", cost: dollars(4_000), hype: 0.16, reputation: 0,
    audience: "Style & Mainstream", segmentBias: { style: 1.35, mainstream: 1.15, budget: 1.1, pro: 0.85, enterprise: 0.8 } },
  { id: "search", name: "Search Ads", blurb: "Catch buyers with intent.", icon: "Search", cost: dollars(9_000), hype: 0.3, reputation: 0,
    audience: "Pro & Enterprise intent", segmentBias: { pro: 1.4, enterprise: 1.3, mainstream: 1.05, budget: 0.9, style: 0.8 } },
  { id: "billboards", name: "Billboards", blurb: "Big, bold, everywhere.", icon: "Megaphone", cost: dollars(15_000), hype: 0.45, reputation: 1,
    audience: "Broad mainstream", segmentBias: { mainstream: 1.25, budget: 1.2, style: 1.05, pro: 0.9, enterprise: 0.95 } },
  { id: "influencer", name: "Influencer Blitz", blurb: "Trusted voices, huge buzz.", icon: "Users", cost: dollars(20_000), hype: 0.58, reputation: 1, unlockEra: 2,
    audience: "Style-led & young", segmentBias: { style: 1.5, mainstream: 1.1, budget: 1.05, pro: 0.85, enterprise: 0.75 } },
  { id: "tv", name: "TV Commercial", blurb: "Old-school mass reach.", icon: "Tv", cost: dollars(30_000), hype: 0.72, reputation: 2, unlockEra: 2,
    audience: "Mass market", segmentBias: { mainstream: 1.3, budget: 1.2, enterprise: 1.1, pro: 0.95, style: 1.0 } },
  { id: "event", name: "Launch Event", blurb: "A spectacle the press can't ignore.", icon: "Sparkles", cost: dollars(45_000), hype: 0.95, reputation: 4, unlockEra: 3,
    audience: "Pro & Style press", segmentBias: { pro: 1.35, style: 1.3, enterprise: 1.15, mainstream: 1.05, budget: 0.85 } },
  { id: "global", name: "Global Launch", blurb: "A worldwide simultaneous reveal — the biggest stage there is.", icon: "Globe", cost: dollars(90_000), hype: 1.2, reputation: 6, unlockEra: 4,
    audience: "Everyone, everywhere", segmentBias: { mainstream: 1.12, pro: 1.12, style: 1.12, enterprise: 1.12, budget: 1.08 } },
];

export function channelById(id: ChannelId): MarketingChannel {
  return MARKETING_CHANNELS.find((c) => c.id === id) ?? MARKETING_CHANNELS[0];
}

/** The channels offered at a given era (the full catalog stays resolvable by id for stored picks). */
export function channelsForEra(era: number): MarketingChannel[] {
  return MARKETING_CHANNELS.filter((c) => (c.unlockEra ?? 1) <= era);
}
