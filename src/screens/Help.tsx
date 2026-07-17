// Help & Guide — the persistent lookup surface once the first-build Coach is gone. Consolidates the
// three families of copy that already live single-sourced in engine/glossary.ts (the headline SCORES,
// the five product STATS, and the economic/system TERMS) into one scannable place, and can replay the
// build Coach. Pure read-only over static copy — no state, no sim contact. Opened as a sub-sheet from
// the Progress hub.
import { BookOpen, Gauge, Layers, Sparkles, RotateCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../design/primitives.tsx";
import { SCORE_INFO, STAT_INFO, TERM_INFO } from "../engine/glossary.ts";
import { STAT_KEYS } from "../engine/types.ts";
import { useGame } from "../state/useGame.tsx";
import { haptic } from "../design/haptics.ts";
import "./help.css";

interface HelpEntry { term: string; def: string }
interface HelpSection { id: string; title: string; icon: LucideIcon; blurb: string; entries: HelpEntry[] }

const STAT_ENTRIES: HelpEntry[] = STAT_KEYS.map((k) => ({ term: STAT_INFO[k].label, def: STAT_INFO[k].blurb }));

const SECTIONS: HelpSection[] = [
  { id: "scores", title: "The three scores", icon: Gauge, blurb: "The numbers you weigh in the Design Lab before every launch.", entries: SCORE_INFO },
  { id: "stats", title: "Product stats", icon: Layers, blurb: "The five things every device is measured on — and who pays for each.", entries: STAT_ENTRIES },
  { id: "terms", title: "Money & systems", icon: Sparkles, blurb: "The vocabulary the game's economy and late-game systems are built on.", entries: TERM_INFO },
];

export function HelpSheet({ onClose }: { onClose: () => void }) {
  const { replayCoach } = useGame();
  return (
    <div className="help">
      <div className="help__head">
        <span className="help__head-glyph" aria-hidden><BookOpen size={22} /></span>
        <div>
          <h2 className="help__title">Help &amp; Guide</h2>
          <p className="help__sub">Every number and term the game uses, defined in plain language.</p>
        </div>
      </div>

      {SECTIONS.map((sec) => (
        <section key={sec.id} className="help__section">
          <div className="help__section-head">
            <span className="help__section-glyph" aria-hidden><sec.icon size={16} /></span>
            <div className="help__section-titles">
              <h3 className="help__section-title">{sec.title}</h3>
              <p className="help__section-blurb">{sec.blurb}</p>
            </div>
          </div>
          <dl className="help__list">
            {sec.entries.map((e) => (
              <div key={e.term} className="help__row">
                <dt className="help__term">{e.term}</dt>
                <dd className="help__def">{e.def}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <div className="help__coach">
        <div className="help__coach-info">
          <span className="help__coach-title">New here, or need a refresher?</span>
          <span className="help__coach-sub">Replay the step-by-step build coach on your Home screen.</span>
        </div>
        <Button variant="secondary" size="sm" onClick={() => { replayCoach(); haptic.light(); onClose(); }}>
          <RotateCw size={14} /> Replay coach
        </Button>
      </div>

      <Button block variant="secondary" onClick={onClose}>Done</Button>
    </div>
  );
}
