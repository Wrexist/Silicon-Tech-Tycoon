// Progress hub — the meta/progression layer (Achievements · Scenarios · Challenges · Device Museum)
// pulled OUT of the Company tab's junk drawer into one discoverable surface, opened from the HUD
// trophy. SINGLE-SHEET model: App wraps this in one <Sheet>; selecting a row swaps THIS content for
// the chosen sub-sheet's content (no nested <Sheet>, so there's only ever one aria-modal + one Escape
// handler). The sub-sheet's close returns to the hub; the hub's close (or Escape) exits Progress.
// Gated (in App) on the first ship, so an empty garage isn't buried under systems.
import { useState } from "react";
import { Award, Boxes, CalendarDays, Crown, FileLock2, Target, Trophy, X, BookOpen, Map as MapIcon, Layers } from "lucide-react";
import { ListChecks } from "lucide-react";
import { AchievementsSheet } from "./Achievements.tsx";
import { MasterySheet } from "./Mastery.tsx";
import { categoryMastery } from "../engine/mastery.ts";
import { CATEGORY_LIST } from "../engine/catalogs.ts";
import { ScenariosSheet } from "./Scenarios.tsx";
import { ChallengesSheet } from "./Challenges.tsx";
import { MuseumSheet } from "./Museum.tsx";
import { VaultSheet } from "./Vault.tsx";
import { FounderLegendSheet } from "./FounderLegend.tsx";
import { GoalsLedgerSheet } from "./GoalsLedger.tsx";
import { RoadmapSheet } from "./Roadmap.tsx";
import { HelpSheet } from "./Help.tsx";
import { collectGoals } from "../state/goals.ts";
import { getMuseum } from "../state/museum.ts";
import { getFounderRecord, legendStanding, liveLegendScore } from "../state/founderLegend.ts";
import { ipoValuation, industryRank, vaultSummary } from "../state/gameState.ts";
import { toDollars } from "../engine/money.ts";
import { getProfileAchievements } from "../state/achievementsProfile.ts";
import { getScenarioStars } from "../state/scenarioProgress.ts";
import { ACHIEVEMENT_COUNT } from "../engine/achievements.ts";
import { SCENARIOS } from "../engine/scenarios.ts";
import { useGame } from "../state/useGame.tsx";
import { ProChip } from "../components/Paywall.tsx";
import { openPaywall } from "../state/paywall.ts";
import { isLocked, type ProFeature } from "../state/proGates.ts";
import { useIsPro } from "../state/usePro.ts";
import "./progress.css";

type View = "hub" | "achievements" | "scenarios" | "challenges" | "museum" | "legend" | "goals" | "roadmap" | "help" | "mastery" | "vault";

export function ProgressSheet({ onClose, initialView = "hub" }: { onClose: () => void; initialView?: View }) {
  const { state } = useGame();
  const pro = useIsPro();
  // The sheet unmounts when closed, so the initial view is honoured fresh on every open — this is
  // how HQ's daily-challenge card deep-links straight to Challenges.
  const [view, setView] = useState<View>(initialView);
  const toHub = () => setView("hub");

  /** Open a hub row, or the offer that unlocks it. The rows stay TAPPABLE when locked rather than
   *  greying out — a lock you can't press teaches nothing about what's behind it, and a row that
   *  answers "what is this?" converts far better than one that just refuses. */
  const openView = (target: View, feature: ProFeature) => () => {
    if (isLocked(feature, pro)) {
      openPaywall({ reason: feature, onUnlocked: () => setView(target) });
      return;
    }
    setView(target);
  };

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
      ascension: state.ascensionLevel,
    }),
  ).title;

  // Active-goal count + how many are ready to claim right now (the actionable ones).
  const goals = collectGoals(state);
  const claimableGoals = goals.filter((g) => g.claimable).length;

  // Category Mastery — how many of the ten categories are fully mastered (level 5), for the hub badge.
  const masteryTable = categoryMastery(state.launched);
  const masteredCount = CATEGORY_LIST.filter((c) => masteryTable[c.id].level >= 5).length;

  // The Vault — counts only; the hub must never leak what any file contains.
  const vault = vaultSummary(state);

  // Sub-views render their content directly inside App's single Sheet (back-arrow returns to the hub).
  if (view === "achievements") return <AchievementsSheet unlocked={earnedAchievements} onClose={toHub} />;
  if (view === "scenarios") return <ScenariosSheet onClose={toHub} />;
  if (view === "challenges") return <ChallengesSheet onClose={toHub} />;
  if (view === "museum") return <MuseumSheet onClose={toHub} />;
  if (view === "legend") return <FounderLegendSheet state={state} onClose={toHub} />;
  if (view === "goals") return <GoalsLedgerSheet onClose={toHub} />;
  if (view === "roadmap") return <RoadmapSheet onClose={toHub} />;
  if (view === "help") return <HelpSheet onClose={toHub} />;
  if (view === "mastery") return <MasterySheet onClose={toHub} />;
  if (view === "vault") return <VaultSheet onClose={toHub} />;

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

      <button className="prog__row" onClick={() => setView("goals")}>
        <span className="prog__row-glyph" aria-hidden><ListChecks size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Goals</span>
          <span className="prog__row-sub">{claimableGoals > 0 ? `${claimableGoals} ready to claim` : "Everything you're working toward"}</span>
        </span>
        {goals.length > 0 && (
          <span className={`prog__row-count${claimableGoals > 0 ? " prog__row-count--ready" : ""} tnum`}>{goals.length}</span>
        )}
      </button>

      <button className="prog__row" onClick={() => setView("roadmap")}>
        <span className="prog__row-glyph" aria-hidden><MapIcon size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Company Roadmap</span>
          <span className="prog__row-sub">The eras ahead and everything they unlock</span>
        </span>
      </button>

      <button className="prog__row" onClick={openView("mastery", "mastery")}>
        <span className="prog__row-glyph" aria-hidden><Layers size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Category Mastery</span>
          <span className="prog__row-sub">Master all ten device categories</span>
        </span>
        {isLocked("mastery", pro)
          ? <ProChip />
          : <span className="prog__row-count tnum">{masteredCount}<span className="prog__row-count-total">/{CATEGORY_LIST.length}</span></span>}
      </button>

      {/* The Vault — hidden dossiers. The row itself is the tease: it states how many files exist and
          how many are open, and never a word about what any of them are. */}
      {vault.enabled && (
        <button className="prog__row" onClick={openView("vault", "vault")}>
          <span className="prog__row-glyph" aria-hidden><FileLock2 size={20} /></span>
          <span className="prog__row-info">
            <span className="prog__row-title">The Vault</span>
            <span className="prog__row-sub">
              {!vault.open
                ? "Sealed until your first product ships"
                : vault.newLeads > 0
                  ? `${vault.newLeads} file${vault.newLeads === 1 ? "" : "s"} moved since you last looked`
                  : "Classified files nobody told you about"}
            </span>
          </span>
          {isLocked("vault", pro)
            ? <ProChip />
            : (
              <span className={`prog__row-count${vault.newLeads > 0 ? " prog__row-count--ready" : ""} tnum`}>
                {vault.found}<span className="prog__row-count-total">/{vault.total}</span>
              </span>
            )}
        </button>
      )}

      <button className="prog__row" onClick={openView("legend", "founderLegend")}>
        <span className="prog__row-glyph" aria-hidden><Crown size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Founder Legend</span>
          <span className="prog__row-sub">Your career rank across every company</span>
        </span>
        {isLocked("founderLegend", pro)
          ? <ProChip />
          : <span className="prog__row-count prog__row-count--title">{legendTitle}</span>}
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

      <button className="prog__row" onClick={openView("museum", "museum")}>
        <span className="prog__row-glyph" aria-hidden><Boxes size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Device Museum</span>
          <span className="prog__row-sub">Every device you've ever shipped</span>
        </span>
        {isLocked("museum", pro)
          ? <ProChip />
          : museumCount > 0 && <span className="prog__row-count tnum">{museumCount}</span>}
      </button>

      <button className="prog__row" onClick={() => setView("help")}>
        <span className="prog__row-glyph" aria-hidden><BookOpen size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Help &amp; Guide</span>
          <span className="prog__row-sub">What every number and term means, in plain language</span>
        </span>
      </button>
    </div>
  );
}
