// Category Mastery view (feature #3) — the ten device categories as visible grind bars, each earned
// by shipping in that category. Shows current level, progress to the next, the small category-scoped
// bonus each level grants, and the cosmetic signature waiting at level 5. All derived PURELY from the
// launch history (engine/mastery.ts) — this screen reads, never writes.
import { ChevronLeft, Lock, Star } from "lucide-react";
import { Button } from "../design/primitives.tsx";
import { CategoryIcon } from "../design/icons.tsx";
import { CATEGORY_LIST } from "../engine/catalogs.ts";
import { isCategoryUnlocked } from "../engine/eras.ts";
import {
  categoryMastery,
  masteryBonusForLevel,
  nextThreshold,
  MASTERY_MAX_LEVEL,
  MASTERY_THRESHOLDS,
  MASTERY_PER_LEVEL,
  CATEGORY_SIGNATURES,
} from "../engine/mastery.ts";
import { useGame } from "../state/useGame.tsx";
import "./mastery.css";

/** The five level pips for a category (filled = earned). Gold when maxed (signature unlocked). */
function Pips({ level }: { level: number }) {
  const maxed = level >= MASTERY_MAX_LEVEL;
  return (
    <span className={`mst__pips${maxed ? " mst__pips--maxed" : ""}`} aria-label={`Level ${level} of ${MASTERY_MAX_LEVEL}`}>
      {Array.from({ length: MASTERY_MAX_LEVEL }, (_, i) => (
        <span key={i} className={`mst__pip${i < level ? " mst__pip--on" : ""}`} aria-hidden />
      ))}
    </span>
  );
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function MasterySheet({ onClose }: { onClose: () => void }) {
  const { state } = useGame();
  const table = categoryMastery(state.launched);
  const maxedCount = CATEGORY_LIST.filter((c) => table[c.id].level >= MASTERY_MAX_LEVEL).length;

  // Level-5 grant totals for the "what mastery gives" explainer.
  const capBonus = masteryBonusForLevel(MASTERY_MAX_LEVEL);

  return (
    <div className="mst">
      <button className="mst__back" onClick={onClose}><ChevronLeft size={16} aria-hidden /> Progress</button>

      <div className="mst__head">
        <div>
          <h2 className="mst__title">Category Mastery</h2>
          <p className="mst__sub">Ship in each category to master it. Every level lends a small edge to that category's products; level {MASTERY_MAX_LEVEL} unlocks its signature.</p>
        </div>
        <span className="mst__count tnum" aria-label={`${maxedCount} of ${CATEGORY_LIST.length} mastered`}>{maxedCount}<span className="mst__count-total">/{CATEGORY_LIST.length}</span></span>
      </div>

      <div className="mst__legend">
        <span className="mst__legend-title">Each level grants, for that category only:</span>
        <ul className="mst__legend-list">
          <li>−{pct(MASTERY_PER_LEVEL.buildCostMult)} build cost <span className="mst__legend-cap">(−{pct(capBonus.buildCostMult)} at L{MASTERY_MAX_LEVEL})</span></li>
          <li>+{MASTERY_PER_LEVEL.design.toFixed(1)} design appeal <span className="mst__legend-cap">(+{capBonus.design.toFixed(0)} at L{MASTERY_MAX_LEVEL})</span></li>
          <li>+{pct(MASTERY_PER_LEVEL.hype)} launch hype <span className="mst__legend-cap">(+{pct(capBonus.hype)} at L{MASTERY_MAX_LEVEL})</span></li>
        </ul>
      </div>

      <ul className="mst__list">
        {CATEGORY_LIST.map((c) => {
          const m = table[c.id];
          const maxed = m.level >= MASTERY_MAX_LEVEL;
          const unlocked = isCategoryUnlocked(c.id, state.era);
          const next = nextThreshold(m.level);
          const prevThreshold = m.level > 0 ? MASTERY_THRESHOLDS[m.level - 1] : 0;
          const frac = maxed ? 1 : next != null ? Math.max(0, Math.min(1, (m.points - prevThreshold) / (next - prevThreshold))) : 1;
          const sig = CATEGORY_SIGNATURES[c.id];
          return (
            <li key={c.id} className={`mst__row${maxed ? " mst__row--maxed" : ""}`}>
              <div className="mst__row-top">
                <span className="mst__row-icon" aria-hidden><CategoryIcon id={c.id} size={18} /></span>
                <span className="mst__row-name">{c.displayName}</span>
                {!unlocked && <span className="mst__row-lock"><Lock size={10} aria-hidden /> Era {c.unlockEra}</span>}
                <Pips level={m.level} />
              </div>
              <div className="mst__bar" aria-hidden>
                <div className={`mst__fill${maxed ? " mst__fill--maxed" : ""}`} style={{ width: `${Math.round(frac * 100)}%` }} />
              </div>
              <div className="mst__row-foot">
                <span className="mst__row-progress tnum">
                  {maxed
                    ? `Mastered · ${m.launches} shipped`
                    : next != null
                      ? `Level ${m.level} · ${m.points}/${next} pts to L${m.level + 1}`
                      : `Level ${m.level}`}
                </span>
                {maxed ? (
                  <span className="mst__row-sig mst__row-sig--on"><Star size={11} aria-hidden /> {sig.edition} signature</span>
                ) : (
                  <span className="mst__row-sig"><Star size={11} aria-hidden /> {sig.edition} at L{MASTERY_MAX_LEVEL}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mst__note">Mastery points: +1 per launch, +1 more for a solid, +2 more for a hit. Bonuses apply automatically to products in the mastered category.</p>

      <Button block variant="secondary" onClick={onClose}>Done</Button>
    </div>
  );
}
