// Stage a save with a pending community ask, for a review screenshot of the overlay.
import { writeFileSync, readFileSync } from "node:fs";
import { generateCommunityAsk } from "../src/engine/community.ts";
const base = JSON.parse(readFileSync("/tmp/silicon-awards.json").toString());
base.pendingAwards = null; base.pendingStrike = null; base.pendingRivalry = null; base.pendingEureka = null;
base.fans = Math.max(base.fans ?? 0, 120000);
base.fanSentiment = 0.2;
base.cash = 600000000000; // plenty to answer
const ask = generateCommunityAsk(base.seed ?? 7, base.week ?? 40, base.fans);
base.pendingCommunityAsk = ask;
base.lastCommunityAskWeek = base.week;
writeFileSync("/tmp/silicon-cma.json", JSON.stringify(base));
console.error("staged community ask:", ask.kind, "cost", ask.cost, "fanGain", ask.fanGain);
