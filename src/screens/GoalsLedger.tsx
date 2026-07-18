// Goals Ledger — one surface for everything the player is chasing: the guided next-move, the rolling
// contracts, and the post-IPO board mandate, all in one consistent row grammar (source · goal ·
// progress · reward · deadline). Folds three previously-scattered "what do I chase next" surfaces into
// a single discoverable place. A completed contract can be claimed right here.
import {
  Target, ScrollText, Landmark, Package, Award, Check, Clock,
  Rocket, UserPlus, Repeat, FlaskConical, Sparkles, TrendingUp, Wrench, Layers, Building2, Trophy, Crown, Cpu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, EmptyState } from "../design/primitives.tsx";
import { useGame } from "../state/useGame.tsx";
import { collectGoals, type GoalSource } from "../state/goals.ts";
import { upcomingObjectives } from "../engine/objectives.ts";
import type { ObjectiveIconName } from "../engine/objectives.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./goalsLedger.css";

const SOURCE_ICON: Record<GoalSource, LucideIcon> = {
  objective: Target,
  contract: ScrollText,
  mandate: Landmark,
  sideOrder: Package,
  award: Award,
};

// Resolve an objective's Lucide icon NAME (the engine stays DOM-free) to its component.
const OBJECTIVE_ICON: Record<ObjectiveIconName, LucideIcon> = {
  Rocket, UserPlus, Repeat, FlaskConical, Sparkles, TrendingUp, Wrench, Layers, Building2, Trophy, Crown, Cpu,
};

export function GoalsLedgerSheet({ onClose }: { onClose: () => void }) {
  const { state, claimContract } = useGame();
  const rows = collectGoals(state);
  // The guided ladder ahead — the current next-move plus the couple that follow, so the player sees
  // where the spine is taking them, not just the single immediate step.
  const upcoming = upcomingObjectives(state, 3);

  return (
    <div className="gl">
      <div className="gl__head">
        <span className="gl__head-glyph" aria-hidden><Target size={22} /></span>
        <div>
          <h2 className="gl__title">Goals</h2>
          <p className="gl__sub">Everything you're working toward, in one place.</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Free play" sub="No active goals right now — chase your own empire, or wait for the next contract to land." />
      ) : (
        <ul className="gl__list">
          {rows.map((g) => {
            const Icon = SOURCE_ICON[g.source];
            const pct = g.frac == null ? null : Math.round(g.frac * 100);
            return (
              <li key={g.key} className={`gl__row${g.done ? " gl__row--done" : ""}`}>
                <div className="gl__row-top">
                  <span className="gl__chip" aria-hidden><Icon size={13} /> {g.sourceLabel}</span>
                  {g.weeksLeft != null && !g.done && (
                    <span className="gl__deadline"><Clock size={12} aria-hidden /> {g.weeksLeft}w left</span>
                  )}
                  {g.done && <span className="gl__met"><Check size={12} aria-hidden /> Met</span>}
                </div>
                <p className="gl__row-title">{g.title}</p>
                {g.detail && <p className="gl__row-detail">{g.detail}</p>}
                {pct != null && (
                  <div className="gl__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="gl__bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <div className="gl__row-foot">
                  {g.reward && <span className="gl__reward">Reward: {g.reward}</span>}
                  {g.progressText && !g.reward && <span className="gl__reward gl__reward--muted">{g.progressText}</span>}
                  {g.claimable && g.contractId && (
                    <Button
                      variant="primary"
                      onClick={() => { haptic.light(); sfx("confirm"); claimContract(g.contractId!); }}
                    >
                      Claim reward
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {upcoming.length > 1 && (
        <div className="gl__coming">
          <h3 className="gl__coming-title">Coming up</h3>
          <ol className="gl__steps">
            {upcoming.map((o, i) => {
              const Icon = OBJECTIVE_ICON[o.objective.icon];
              return (
                <li key={o.objective.id} className={`gl__step${i === 0 ? " gl__step--active" : " gl__step--later"}`}>
                  <span className="gl__step-glyph" aria-hidden><Icon size={15} /></span>
                  <span className="gl__step-info">
                    <span className="gl__step-title">{o.objective.label}</span>
                    <span className="gl__step-meta tnum">Step {o.step} of {o.total}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <Button block variant="secondary" onClick={onClose}>Done</Button>
    </div>
  );
}
