// Company Roadmap codex — a read-only, long-horizon preview of everything the player is climbing
// toward. A gameplay audit found unlocks arrive unannounced: a new player can't see that future eras,
// device categories, component tiers, IPO, the Legacy Tree, Frontier Tech, or Ascension even exist.
// This surfaces all of it as pure UI over the existing engine catalogs (engine/roadmap.ts) — zero
// engine state, zero determinism risk. Rendered inside Progress's single Sheet (back-arrow → hub).
import { Check, Lock, Map as MapIcon, Landmark, Sparkles, FlaskConical, Flame, Crown, ChevronRight, Boxes, FlaskRound, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../design/primitives.tsx";
import { useGame } from "../state/useGame.tsx";
import type { GameState } from "../state/gameState.ts";
import { eraRoadmap, type EraRoadmapEntry } from "../engine/roadmap.ts";
import "./roadmap.css";

type EraStatus = "done" | "current" | "locked";

function statusOf(entry: EraRoadmapEntry, era: number): EraStatus {
  if (entry.era < era) return "done";
  if (entry.era === era) return "current";
  return "locked";
}

// The endgame carrots that already exist in code, past the IPO. One line each, with the gate stated,
// and a live "unlocked?" read so the still-locked ones read as visible-but-locked.
interface LateItem {
  key: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  gate: string;
  unlocked: (s: GameState) => boolean;
}

const LATE_GAME: readonly LateItem[] = [
  {
    key: "ipo",
    icon: Landmark,
    title: "Go public",
    detail: "List on the exchange for a cash infusion, then answer to quarterly board mandates and a confidence ladder from a Doubtful to a Visionary board.",
    gate: "AI Era · reputation 85+",
    unlocked: (s) => s.listed,
  },
  {
    key: "legacy",
    icon: Sparkles,
    title: "Megaprojects & the Legacy Tree",
    detail: "Moonshot megaprojects bank Legacy Points; spend them on a tiered tree of permanent, route-defining boons.",
    gate: "Reach the pinnacle (go public)",
    unlocked: (s) => s.wentPublic,
  },
  {
    key: "frontier",
    icon: FlaskConical,
    title: "Frontier Tech",
    detail: "Endless research lanes and breakthrough bands that push your labs past the industry ceiling — and open the Autonomy Era.",
    gate: "Post-IPO — spend Legacy Points",
    unlocked: (s) => s.wentPublic,
  },
  {
    key: "ascension",
    icon: Flame,
    title: "Ascension · the Heat ladder",
    detail: "Restart as New Game+ at rising Heat: stiffer verdict bars and a thinner head-start, for standing on the Founder Legend board.",
    gate: "Reach the pinnacle, then start New Game+",
    unlocked: (s) => (s.ascensionLevel ?? 0) > 0,
  },
  {
    key: "legend",
    icon: Crown,
    title: "Founder Legend",
    detail: "Your career title across every company you've ever run — one endless rank that climbs with your lifetime record.",
    gate: "Always tracking",
    unlocked: () => true,
  },
];

// Icons for the three unlock groups on an era row.
const GROUP_ICON: Record<string, LucideIcon> = {
  Categories: Boxes,
  Research: FlaskRound,
  Systems: Layers,
};

function Group({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  const Icon = GROUP_ICON[label];
  return (
    <div className="rm__group">
      <span className="rm__group-label"><Icon size={12} aria-hidden /> {label}</span>
      <span className="rm__chips">
        {items.map((it) => (
          <span key={it} className="rm__chip">{it}</span>
        ))}
      </span>
    </div>
  );
}

export function RoadmapSheet({ onClose }: { onClose: () => void }) {
  const { state } = useGame();
  const eras = eraRoadmap();

  return (
    <div className="rm">
      <div className="rm__head">
        <span className="rm__head-glyph" aria-hidden><MapIcon size={22} /></span>
        <div>
          <h2 className="rm__title">Company Roadmap</h2>
          <p className="rm__sub">The long road ahead — every era, and what it opens.</p>
        </div>
      </div>

      <ol className="rm__eras">
        {eras.map((e) => {
          const st = statusOf(e, state.era);
          return (
            <li key={e.era} className={`rm__era rm__era--${st}`}>
              <div className="rm__era-head">
                <span className="rm__era-mark" aria-hidden>
                  {st === "done" ? <Check size={15} /> : st === "current" ? <ChevronRight size={15} /> : <Lock size={13} />}
                </span>
                <span className="rm__era-name">{e.name}</span>
                <span className="rm__era-num tnum">Era {e.era}</span>
              </div>
              <p className="rm__era-tag">{e.tagline}</p>
              {st === "current" && <p className="rm__gate rm__gate--here">You are here</p>}
              {st === "locked" && e.gate && (
                <p className="rm__gate"><Lock size={11} aria-hidden /> Unlock: {e.gate}</p>
              )}
              <div className="rm__groups">
                <Group label="Categories" items={e.newCategories} />
                <Group label="Research" items={e.notableResearch} />
                <Group label="Systems" items={e.majorSystems} />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rm__late">
        <h3 className="rm__section-title">Late game — beyond the IPO</h3>
        <ul className="rm__late-list">
          {LATE_GAME.map((item) => {
            const open = item.unlocked(state);
            const Icon = item.icon;
            return (
              <li key={item.key} className={`rm__late-item${open ? "" : " rm__late-item--locked"}`}>
                <span className="rm__late-glyph" aria-hidden>
                  {open ? <Icon size={18} /> : <Lock size={15} />}
                </span>
                <div className="rm__late-info">
                  <span className="rm__late-title">{item.title}</span>
                  <span className="rm__late-detail">{item.detail}</span>
                  {!open && <span className="rm__late-gate"><Lock size={11} aria-hidden /> {item.gate}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <Button block variant="secondary" onClick={onClose}>Done</Button>
    </div>
  );
}
