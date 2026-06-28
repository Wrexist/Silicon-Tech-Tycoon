// Progress hub — the meta/progression layer (Achievements · Scenarios · Challenges · Device Museum)
// pulled OUT of the Finance tab's junk drawer into one discoverable surface, opened from the HUD
// trophy. Each row opens its existing sheet; the hub stays mounted behind so closing a sub-sheet
// returns here. Gated (in App) on the first ship, so an empty garage isn't buried under systems.
import { useState } from "react";
import { Award, Boxes, CalendarDays, Target, Trophy, X } from "lucide-react";
import { Sheet } from "../design/primitives.tsx";
import { AchievementsSheet } from "./Achievements.tsx";
import { ScenariosSheet } from "./Scenarios.tsx";
import { ChallengesSheet } from "./Challenges.tsx";
import { MuseumSheet } from "./Museum.tsx";
import { getMuseum } from "../state/museum.ts";
import { getProfileAchievements } from "../state/achievementsProfile.ts";
import { getScenarioStars } from "../state/scenarioProgress.ts";
import { ACHIEVEMENT_COUNT } from "../engine/achievements.ts";
import { SCENARIOS } from "../engine/scenarios.ts";
import { useGame } from "../state/useGame.tsx";
import "./progress.css";

export function ProgressSheet({ onClose }: { onClose: () => void }) {
  const { state } = useGame();
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [scenariosOpen, setScenariosOpen] = useState(false);
  const [challengesOpen, setChallengesOpen] = useState(false);
  const [museumOpen, setMuseumOpen] = useState(false);

  const museumCount = getMuseum().length;
  // Lifetime (cross-company) earned set — the profile union with this run's unlocks.
  const earnedAchievements = [...new Set([...getProfileAchievements(), ...state.unlockedAchievements])];
  const storedScenarioStars = getScenarioStars();
  const scenarioStars = SCENARIOS.reduce((sum, s) => sum + (storedScenarioStars[s.id] ?? 0), 0);

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

      <button className="prog__row" onClick={() => setAchievementsOpen(true)} aria-label="View achievements">
        <span className="prog__row-glyph" aria-hidden><Award size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Achievements</span>
          <span className="prog__row-sub">Milestones on the road to an empire</span>
        </span>
        <span className="prog__row-count tnum">{earnedAchievements.length}<span className="prog__row-count-total">/{ACHIEVEMENT_COUNT}</span></span>
      </button>

      <button className="prog__row" onClick={() => setScenariosOpen(true)} aria-label="View scenarios">
        <span className="prog__row-glyph" aria-hidden><Target size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Scenarios</span>
          <span className="prog__row-sub">Hand-crafted challenges with star goals</span>
        </span>
        <span className="prog__row-count tnum">{scenarioStars}<span className="prog__row-count-total">/{SCENARIOS.length * 3}★</span></span>
      </button>

      <button className="prog__row" onClick={() => setChallengesOpen(true)} aria-label="View daily and weekly challenges">
        <span className="prog__row-glyph" aria-hidden><CalendarDays size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Challenges</span>
          <span className="prog__row-sub">A fresh seeded run every day — beat your best</span>
        </span>
      </button>

      <button className="prog__row" onClick={() => setMuseumOpen(true)} aria-label="Open the device museum">
        <span className="prog__row-glyph" aria-hidden><Boxes size={20} /></span>
        <span className="prog__row-info">
          <span className="prog__row-title">Device Museum</span>
          <span className="prog__row-sub">Every device you've ever shipped</span>
        </span>
        {museumCount > 0 && <span className="prog__row-count tnum">{museumCount}</span>}
      </button>

      <Sheet open={achievementsOpen} onClose={() => setAchievementsOpen(false)}>
        <AchievementsSheet unlocked={earnedAchievements} onClose={() => setAchievementsOpen(false)} />
      </Sheet>
      <Sheet open={scenariosOpen} onClose={() => setScenariosOpen(false)}>
        <ScenariosSheet onClose={() => setScenariosOpen(false)} />
      </Sheet>
      <Sheet open={challengesOpen} onClose={() => setChallengesOpen(false)}>
        <ChallengesSheet onClose={() => setChallengesOpen(false)} />
      </Sheet>
      <Sheet open={museumOpen} onClose={() => setMuseumOpen(false)}>
        <MuseumSheet onClose={() => setMuseumOpen(false)} />
      </Sheet>
    </div>
  );
}
