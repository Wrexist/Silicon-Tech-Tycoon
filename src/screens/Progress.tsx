// Progress hub — the meta/progression layer (Achievements · Scenarios · Challenges · Device Museum)
// pulled OUT of the Company tab's junk drawer into one discoverable surface, opened from the HUD
// trophy. SINGLE-SHEET model: App wraps this in one <Sheet>; selecting a row swaps THIS content for
// the chosen sub-sheet's content (no nested <Sheet>, so there's only ever one aria-modal + one Escape
// handler). The sub-sheet's close returns to the hub; the hub's close (or Escape) exits Progress.
// Gated (in App) on the first ship, so an empty garage isn't buried under systems.
import { useState } from "react";
import { Award, Boxes, CalendarDays, Crown, Target, Trophy, X } from "lucide-react";
import { AchievementsSheet } from "./Achievements.tsx";
import { ScenariosSheet } from "./Scenarios.tsx";
import { ChallengesSheet } from "./Challenges.tsx";
import { MuseumSheet } from "./Museum.tsx";
import { FounderLegendSheet } from "./FounderLegend.tsx";
import { getMuseum } from "../state/museum.ts";
import { getFounderRecord, legendStanding, liveLegendScore } from "../state/founderLegend.ts";
import { ipoValuation, industryRank } from "../state/gameState.ts";
import { toDollars } from "../engine/money.ts";
import { getProfileAchievements } from "../state/achievementsProfile.ts";
import { getScenarioStars } from "../state/scenarioProgress.ts";
import { ACHIEVEMENT_COUNT } from "../engine/achievements.ts";
import { SCENARIOS } from "../engine/scenarios.ts";
import { useGame } from "../state/useGame.tsx";
import "./progress.css";

type View = "hub" | "achievements" | "scenarios" | "challenges" | "museum" | "legend";

export function ProgressSheet({ onClose, initialView = "hub" }: { onClose: () => void; initialView?: View }) {
  const { state } = useGame();
  // The sheet unmounts when closed, so the initial view is honoured fresh on every open — this is
  // how HQ's daily-challenge card deep-links straight to Challenges.
  const [view, setView] = useState<View>(initialView);
  const toHub = () => setView("hub");

  const museumCount = getMuseum().length;
  // Lifetime (cross-company) earned set — the profile union with this run's unlocks.
  const earnedAchievements = [...new Set([...getProfileAchievements(), ...state.unlockedAchievements])];
  const storedScenarioStars = getScenarioStars();
  const scenarioStars = SCENARIOS.reduce((sum, s) => sum + (storedScenarioStars[s.id] ?? 0), 0);

  // Founder Legend standing — lifetime record folded with the live run, so the title is up to date.
  const legendHits = state.launched.filter((lp) => lp.verdict === "hit" || lp.verdict === "solid").length;
  const legendTitle = legendStanding(
    liveLegendScore(getFounderRecord(), {
      hitsInRun: legendHits,
      valuationDollars: toDollars(ipoValuation(state)),
      rank: industryRank(state),
    }),
  ).title;

  // Sub-views render their content directly inside App's single Sheet (back-arrow returns to the hub).
  if (view === "achievements") return <AchievementsSheet unlocked={earnedAchievements} onClose={toHub} />;
  if (view === "scenarios") return <ScenariosSheet onClose={toHub} />;
  if (view === "challenges") return <ChallengesSheet onClose={toHub} />;
  if (view === "museum") return <MuseumSheet onClose={toHub} />;
  if (view === "legend") return <FounderLegendSheet state={state} onClose={toHub} />;

  return (
    <div className="prog">
      <div className="prog__head">
        <span className="prog__head-glyph" aria-hidden><Trophy size={22} /></span>
        <div className="prog__head-info">
          <h2 className="prog__title">Progress</h2>
          <p className="prog__subtitle">Milestones, challenges and the devices you've shipped.</p>
        </div>
        <button className="prog__close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>

      <button className="prog__row" onClick={() => setView("legend")}>
        <span className="prog__row-glyph" aria-hidden><Crown size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Founder Legend</span>
          <span className="prog__row-sub">Your career rank across every company</span>
        </span>
        <span className="prog__row-count prog__row-count--title">{legendTitle}</span>
      </button>

      <button className="prog__row" onClick={() => setView("achievements")}>
        <span className="prog__row-glyph" aria-hidden><Award size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Achievements</span>
          <span className="prog__row-sub">Milestones on the road to an empire</span>
        </span>
        <span className="prog__row-count tnum">{earnedAchievements.length}<span className="prog__row-count-total">/{ACHIEVEMENT_COUNT}</span></span>
      </button>

      <button className="prog__row" onClick={() => setView("scenarios")}>
        <span className="prog__row-glyph" aria-hidden><Target size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Scenarios</span>
          <span className="prog__row-sub">Hand-crafted challenges with star goals</span>
        </span>
        <span className="prog__row-count tnum">{scenarioStars}<span className="prog__row-count-total">/{SCENARIOS.length * 3}★</span></span>
      </button>

      <button className="prog__row" onClick={() => setView("challenges")}>
        <span className="prog__row-glyph" aria-hidden><CalendarDays size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Challenges</span>
          <span className="prog__row-sub">A fresh seeded run every day, beat your best</span>
        </span>
      </button>

      <button className="prog__row" onClick={() => setView("museum")}>
        <span className="prog__row-glyph" aria-hidden><Boxes size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Device Museum</span>
          <span className="prog__row-sub">Every device you've ever shipped</span>
        </span>
        {museumCount > 0 && <span className="prog__row-count tnum">{museumCount}</span>}
      </button>
    </div>
  );
}
