import { useState } from "react";
import { STAT_INFO } from "../engine/glossary.ts";
import { STAT_KEYS } from "../engine/types.ts";
import { haptic } from "../design/haptics.ts";
import "./statGlossary.css";

/**
 * Tap-to-reveal plain-language definitions of the five product stats. Self-contained toggle so it
 * never clutters a screen until the player asks. Shared by the Design Lab (where you set the stats)
 * and the launch post-mortem (where you read why they mattered) so the same terms are always one
 * tap from a definition — and both read the single-source STAT_INFO copy.
 */
export function StatGlossary({ label = "What the stats mean" }: { label?: string } = {}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="sg__toggle" aria-expanded={open} onClick={() => { setOpen((o) => !o); haptic.light(); }}>
        {open ? "Hide stat guide" : label}
      </button>
      {open && (
        <div className="sg__list">
          {STAT_KEYS.map((k) => (
            <div key={k} className="sg__row">
              <span className="sg__term">{STAT_INFO[k].label}</span>
              <span className="sg__def">{STAT_INFO[k].blurb}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
