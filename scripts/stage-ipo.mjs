// Stage saves that surface the post-IPO shareholder loop: an earnings-miss call, and the equity card
// (shareholder pulse + buyback) on a listed company.
import { writeFileSync, readFileSync } from "node:fs";
import { judgeQuarter, nextExpectation } from "../src/engine/shareholders.ts";
const base = JSON.parse(readFileSync("/tmp/silicon-awards.json").toString());
base.pendingAwards = null; base.pendingStrike = null; base.pendingRivalry = null; base.pendingEureka = null; base.pendingCommunityAsk = null;
base.listed = true; base.ownership = 0.7; base.cash = 50000000000000;
base.valuationMomentum = 0.02;
const wk = base.week ?? 40;

// 1) Earnings MISS call (both buttons: defend / ride).
const missRev = 820000000;   // $8.2M this quarter
const missExp = 1200000000;  // $12.0M expected
const earnings = { ...base,
  pendingEarnings: judgeQuarter(3, wk, missRev, missExp),
  earningsExpectation: nextExpectation(missRev), earningsQuarter: 3,
  quarterStartRevenue: base.cumulativeRevenue, lastEarningsWeek: wk,
};
writeFileSync("/tmp/silicon-earnings.json", JSON.stringify(earnings));
console.error("wrote earnings-miss:", earnings.pendingEarnings.beat, Math.round(earnings.pendingEarnings.priceMovePct*100)+"%");

// 2) Equity card mid-quarter (~62% of the way to the bar), no pending call.
const listed = { ...base,
  pendingEarnings: null, earningsQuarter: 2, earningsExpectation: 1200000000,
  quarterStartRevenue: (base.cumulativeRevenue ?? 0) - 740000000, // ~62% of $12M booked so far
  lastEarningsWeek: wk - 8, // 8 weeks into the quarter → call in ~5 wk
};
writeFileSync("/tmp/silicon-listed.json", JSON.stringify(listed));
console.error("wrote listed equity card");
