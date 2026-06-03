// Marketing channels — how you take a finished product to market. Each adds launch hype
// (and sometimes reputation) for a cash cost. PURE catalog.
import { dollars, type Money } from "./money.ts";

export type ChannelId = "none" | "social" | "search" | "billboards" | "influencer" | "tv" | "event";

export interface MarketingChannel {
  id: ChannelId;
  name: string;
  blurb: string;
  icon: string; // lucide icon name (resolved in UI)
  cost: Money;
  hype: number; // added to the launch hype multiplier
  reputation: number; // one-time reputation bump on launch
}

export const MARKETING_CHANNELS: MarketingChannel[] = [
  { id: "none", name: "No campaign", blurb: "Let the product speak for itself.", icon: "Ban", cost: dollars(0), hype: 0, reputation: 0 },
  { id: "social", name: "Social Media", blurb: "Cheap, modern reach.", icon: "Share2", cost: dollars(4_000), hype: 0.16, reputation: 0 },
  { id: "search", name: "Search Ads", blurb: "Catch buyers with intent.", icon: "Search", cost: dollars(9_000), hype: 0.3, reputation: 0 },
  { id: "billboards", name: "Billboards", blurb: "Big, bold, everywhere.", icon: "Megaphone", cost: dollars(15_000), hype: 0.45, reputation: 1 },
  { id: "influencer", name: "Influencer Blitz", blurb: "Trusted voices, huge buzz.", icon: "Users", cost: dollars(20_000), hype: 0.58, reputation: 1 },
  { id: "tv", name: "TV Commercial", blurb: "Old-school mass reach.", icon: "Tv", cost: dollars(30_000), hype: 0.72, reputation: 2 },
  { id: "event", name: "Launch Event", blurb: "A spectacle the press can't ignore.", icon: "Sparkles", cost: dollars(45_000), hype: 0.95, reputation: 4 },
];

export function channelById(id: ChannelId): MarketingChannel {
  return MARKETING_CHANNELS.find((c) => c.id === id) ?? MARKETING_CHANNELS[0];
}
