import { useState } from "react";
import { type GameState, productStats, effectiveUnitCost } from "../state/gameState.ts";
import { STAT_KEYS, type Product, type Stats } from "../engine/types.ts";
import { computeStats } from "../engine/product.ts";
import { segmentDemand, tuningSegmentBias } from "../engine/segments.ts";
import { styleAppeal } from "../engine/aesthetics.ts";
import { format, sub } from "../engine/money.ts";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";

export function ProductComparison({ state, draft }: { state: GameState; draft: Product }) {
  const previous = state.launched.filter(p => p.product.category === draft.category);
  const rivals = (state.rivalReleases ?? []).filter(p => p.category === draft.category);
  const [previousId, setPreviousId] = useState("");
  const [rivalId, setRivalId] = useState("");
  const old = previous.find(p => p.product.id === previousId) ?? previous[0];
  const rival = rivals.find(p => `${p.rivalId}:${p.week}:${p.product.id}` === rivalId) ?? rivals[0];
  const columns: { label: string; product: Product; stats: Stats; margin?: string }[] = [
    { label: "Current draft", product: draft, stats: productStats(state, draft), margin: format(sub(draft.price, effectiveUnitCost(state, draft))) },
    ...(old ? [{ label: "Previous product", product: old.product, stats: old.stats, margin: format(sub(old.product.price, effectiveUnitCost(state, old.product))) }] : []),
    ...(rival ? [{ label: rival.rivalName, product: rival.product, stats: computeStats(rival.product) }] : []),
  ];
  const fit = (p: Product, stats: Stats) => Math.round(segmentDemand(stats, p.price, state.trends, p.category, styleAppeal(p), state.week, undefined, tuningSegmentBias(p.tuning)).demandIndex);
  return <details className="mg-disclosure product-compare"><summary>Compare products</summary>
    <div className="compare-pickers">
      {previous.length > 0 && <label>Previous product<select value={old.product.id} onChange={e => setPreviousId(e.target.value)}>{previous.map(p => <option key={p.product.id} value={p.product.id}>{p.product.name}</option>)}</select></label>}
      {rivals.length > 0 && <label>Competitor<select value={`${rival.rivalId}:${rival.week}:${rival.product.id}`} onChange={e => setRivalId(e.target.value)}>{rivals.map(p => <option key={`${p.rivalId}:${p.week}:${p.product.id}`} value={`${p.rivalId}:${p.week}:${p.product.id}`}>{p.rivalName}: {p.product.name}</option>)}</select></label>}
    </div>
    {!old && <p>No previous product in this category yet.</p>}{!rival && <p>No recorded rival release in this category yet.</p>}
    <div className="mg-table-scroll" tabIndex={0} role="region" aria-label="Product comparison">
      <table><caption>Same category, current market conditions</caption><thead><tr><th scope="col">Measure</th>{columns.map(c => <th scope="col" key={c.label}>{c.label}<DeviceRenderer product={c.product} size={64} /><span>{c.product.name}</span></th>)}</tr></thead>
      <tbody><tr><th scope="row">Price</th>{columns.map(c => <td key={c.label}>{format(c.product.price)}</td>)}</tr>
        <tr><th scope="row">Buyer fit / 100</th>{columns.map(c => <td key={c.label}>{fit(c.product, c.stats)}</td>)}</tr>
        <tr><th scope="row">Unit margin today</th>{columns.map(c => <td key={c.label}>{c.margin ?? "Not disclosed"}</td>)}</tr>
        {STAT_KEYS.map(k => <tr key={k}><th scope="row">{k}</th>{columns.map(c => <td key={c.label}>{Math.round(c.stats[k])}</td>)}</tr>)}
      </tbody></table>
    </div>
    <p className="mg-footnote">Your launched specifications are recorded at launch. Rival specifications are estimated from their disclosed components; their manufacturing costs are unknown. Your unit margins use today's supply costs, before fixed costs. Fit is a model score, not a sales guarantee.</p>
  </details>;
}
