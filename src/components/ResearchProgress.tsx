import { useGame } from "../state/useGame.tsx";
import type { ActiveResearch } from "../state/gameState.ts";
import { GameArt, ProgressMeter } from "../design/management.tsx";
import { Button } from "../design/primitives.tsx";
import "./researchProgress.css";

/** Only committed simulation weeks are progress, without speculative sub-week smoothing. */
export function ResearchProgress({ research }: { research: ActiveResearch }) {
  const { state, cancelResearch, cancelQueuedResearch } = useGame();
  const elapsed = Math.max(0, state.week - research.startWeek);
  const pct = Math.min(100, Math.round(elapsed / Math.max(1, research.totalWeeks) * 100));
  const left = Math.max(0, research.totalWeeks - elapsed);
  const queue = state.researchQueue ?? [];
  return <div className="research-work">
    <span className="mg-eyebrow">In progress</span>
    <div className="research-work__project">
      <GameArt asset={research.kind === "tier" ? "research-components" : "research-projects"} />
      <div><strong>{research.name}</strong><p>{research.blurb}</p><ProgressMeter label={`${research.name} completion`} value={pct} /><small>{pct}% · {left} weeks left · {research.rpCost} RP invested</small></div>
    </div>
    <details className="research-work__cancel"><summary>Cancel project</summary><p>Refunds all {research.rpCost} RP. Progress is lost; the next queued project starts immediately.</p><Button size="sm" variant="secondary" onClick={() => cancelResearch()}>Cancel and refund {research.rpCost} RP</Button></details>
    <div className="research-work__queue"><span className="mg-eyebrow">Queued · {queue.length}</span>
      {queue.length ? <ul>{queue.map((q, i) => <li key={q.ref}><span className="research-work__number">{i + 1}</span><div><strong>{q.name}</strong><small>{q.totalWeeks} weeks · {q.rpCost} RP</small></div><Button size="sm" variant="tertiary" onClick={() => cancelQueuedResearch(q.ref)}>Refund {q.rpCost} RP</Button></li>)}</ul>
        : <p className="mg-empty-inline">Nothing queued. Your next choice will start when this project finishes.</p>}
    </div>
  </div>;
}
