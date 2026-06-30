// Achievements view — a premium, celebratory grid of milestones the player discovers by playing.
// No FOMO, no nags: unlocked cards glow full-colour; locked cards are elegant, muted placeholders
// with a tasteful hint (never an exact threshold to grind toward). Tokens + 8pt grid only.
import { Lock } from "lucide-react";
import { Button, EmptyState } from "../design/primitives.tsx";
import { AchievementIcon } from "../design/achievementIcons.tsx";
import { ACHIEVEMENTS } from "../engine/achievements.ts";
import "./achievements.css";

export function AchievementsSheet({
  unlocked,
  onClose,
}: {
  unlocked: string[];
  onClose: () => void;
}) {
  const earned = new Set(unlocked);
  const earnedCount = ACHIEVEMENTS.filter((a) => earned.has(a.id)).length;
  const total = ACHIEVEMENTS.length;
  const pct = total > 0 ? Math.round((earnedCount / total) * 100) : 0;

  return (
    <div className="ach">
      <div className="ach__head">
        <div>
          <h2 className="ach__title">Achievements</h2>
          <p className="ach__sub">Milestones you've reached on the way to an empire.</p>
        </div>
        <span className="ach__count tnum" aria-label={`${earnedCount} of ${total} unlocked`}>
          {earnedCount}<span className="ach__count-total">/{total}</span>
        </span>
      </div>

      <div className="ach__progress" role="presentation">
        <div className="ach__progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {total === 0 ? (
        <EmptyState title="No milestones yet" sub="Keep building, achievements will appear here." />
      ) : (
        <ul className="ach__grid">
          {ACHIEVEMENTS.map((a) => {
            const got = earned.has(a.id);
            return (
              <li key={a.id} className={`ach__card${got ? " ach__card--earned" : ""}`}>
                <span className="ach__glyph" aria-hidden>
                  {got ? <AchievementIcon name={a.icon} size={22} /> : <Lock size={20} strokeWidth={1.9} />}
                </span>
                <span className="ach__card-name">{got ? a.title : "Locked"}</span>
                <span className="ach__card-desc">{got ? a.description : a.hint}</span>
              </li>
            );
          })}
        </ul>
      )}

      <Button block onClick={onClose}>Done</Button>
    </div>
  );
}
