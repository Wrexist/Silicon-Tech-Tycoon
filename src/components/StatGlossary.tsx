import { useState } from "react";
import { STAT_INFO } from "../engine/glossary.ts";
import { STAT_KEYS } from "../engine/types.ts";
import { haptic } from "../design/haptics.ts";
import "./statGlossary.css";

export interface GlossaryEntry { term: string; def: string }

/**
 * Tap-to-reveal plain-language definitions. Self-contained toggle so it never clutters a screen
 * until the player asks. Generic over any term/def list — used for the five product stats (Design
 * Lab + launch post-mortem) and for headline economic terms (the Bank). Single source of copy lives
 * in engine/glossary.ts so nothing drifts.
 */
export function Glossary({ entries, label, hideLabel = "Hide guide" }: { entries: GlossaryEntry[]; label: string; hideLabel?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="sg__toggle" aria-expanded={open} onClick={() => { setOpen((o) => !o); haptic.light(); }}>
        {open ? hideLabel : label}
      </button>
      {open && (
        <div className="sg__list">
          {entries.map((e) => (
            <div key={e.term} className="sg__row">
              <span className="sg__term">{e.term}</span>
              <span className="sg__def">{e.def}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const STAT_ENTRIES: GlossaryEntry[] = STAT_KEYS.map((k) => ({ term: STAT_INFO[k].label, def: STAT_INFO[k].blurb }));

/** The five product stats — the original Design Lab / post-mortem guide. */
export function StatGlossary({ label = "What the stats mean" }: { label?: string } = {}) {
  return <Glossary entries={STAT_ENTRIES} label={label} hideLabel="Hide stat guide" />;
}
