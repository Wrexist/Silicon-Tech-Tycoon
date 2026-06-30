// Device Museum — a permanent, cross-run gallery of every device you've shipped, re-rendered
// parametrically from the stored Product (zero image assets). Collection-as-meta-progression.
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button, EmptyState } from "../design/primitives.tsx";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import { CategoryIcon } from "../design/icons.tsx";
import { getMuseum, type MuseumEntry } from "../state/museum.ts";
import { eraName } from "../engine/eras.ts";
import { deviceLegacy } from "../engine/deviceLegacy.ts";
import { postMortem, type Verdict, type FactorKey, type FactorTone } from "../engine/postmortem.ts";
import { CATEGORIES } from "../engine/catalogs.ts";
import { format } from "../engine/money.ts";
import { useGame } from "../state/useGame.tsx";
import type { CategoryId, LaunchedProduct } from "../engine/types.ts";
import "./museum.css";

const VERDICT_LABEL: Record<string, string> = { hit: "Hit", solid: "Solid", flop: "Flop", steady: "Steady" };

// The five launch factors, in a fixed reading order, with friendly labels for the analytics view.
const FACTOR_ORDER: FactorKey[] = ["demand", "price", "competition", "hype", "audience"];
const FACTOR_LABEL: Record<FactorKey, string> = {
  demand: "Market fit", price: "Pricing", competition: "Competition", hype: "Launch buzz", audience: "Audience",
};
const TONE_WORD: Record<FactorTone, string> = {
  positive: "Strong", negative: "Weak", accent: "Mixed", neutral: "Neutral",
};

function MuseumCard({ e, onSelect }: { e: MuseumEntry; onSelect: (e: MuseumEntry) => void }) {
  const slab = e.category === "phone" || e.category === "tablet";
  return (
    <li>
      <button className="mus__card" onClick={() => onSelect(e)} aria-label={`${e.name} details`}>
      <div className="mus__device">
        {slab ? (
          // Slabs have a distinct back: show the front + the back beside it so the design
          // reads in full (the camera module is the back's signature).
          <div className="mus__faces">
            <DeviceRenderer product={e.product} size={92} face="front" />
            <DeviceRenderer product={e.product} size={92} face="back" />
          </div>
        ) : (
          <DeviceRenderer product={e.product} size={120} />
        )}
      </div>
      <div className="mus__meta">
        <span className="mus__name">{e.name}</span>
        <span className="mus__detail">
          <CategoryIcon id={e.category} size={12} /> {CATEGORIES[e.category]?.displayName ?? e.category} · {eraName(e.era)}
        </span>
        <span className="mus__detail mus__detail--sub">
          {e.companyName}{e.verdict ? ` · ${VERDICT_LABEL[e.verdict] ?? e.verdict}` : ""}
        </span>
        <span className="mus__legacy">{deviceLegacy(e)}</span>
      </div>
      </button>
    </li>
  );
}

/** Per-device detail: the design (front + back), its legacy line, and a launch analytics breakdown
 *  of how it did and what went well or poorly. */
function MuseumDetail({ e, live, onBack }: { e: MuseumEntry; live: LaunchedProduct | null; onBack: () => void }) {
  const slab = e.category === "phone" || e.category === "tablet";
  // Normalize the persisted verdict (a plain string) to a known Verdict before postMortem, so a stale
  // or corrupt localStorage value can't flow in and misrender the detail view.
  const verdict: Verdict =
    e.verdict === "hit" || e.verdict === "solid" || e.verdict === "steady" || e.verdict === "flop" ? e.verdict : "steady";
  const pm = e.insight ? postMortem(e.insight, verdict) : null;
  // Real performance if this device is from the current run (matched live in the save); otherwise
  // the launch-moment snapshot is all we have for a cross-run device.
  const sellThrough = live && live.plannedUnits ? Math.round((live.unitsSold / live.plannedUnits) * 100) : null;
  return (
    <div className="mdt">
      <button className="mdt__back" onClick={onBack}><ChevronLeft size={16} aria-hidden /> All devices</button>

      <div className="mdt__hero">
        {slab ? (
          <div className="mus__faces">
            <DeviceRenderer product={e.product} size={132} face="front" />
            <DeviceRenderer product={e.product} size={132} face="back" />
          </div>
        ) : (
          <DeviceRenderer product={e.product} size={150} />
        )}
      </div>

      <div className="mdt__title-row">
        <h2 className="mdt__name">{e.name}</h2>
        {e.verdict && <span className={`mdt__verdict mdt__verdict--${e.verdict}`}>{VERDICT_LABEL[e.verdict] ?? e.verdict}</span>}
      </div>
      <p className="mdt__meta">
        <CategoryIcon id={e.category} size={13} /> {CATEGORIES[e.category]?.displayName ?? e.category} · {eraName(e.era)} · {e.companyName}
      </p>
      <p className="mdt__legacy">{deviceLegacy(e)}</p>

      <div className="mdt__stats">
        {live ? (
          <>
            <div className="mdt__stat"><span className="mdt__stat-label">Units sold</span><span className="mdt__stat-value tnum">{live.unitsSold.toLocaleString()}</span></div>
            <div className="mdt__stat"><span className="mdt__stat-label">Revenue</span><span className="mdt__stat-value tnum">{format(live.revenueToDate)}</span></div>
            <div className="mdt__stat"><span className="mdt__stat-label">{sellThrough != null ? "Sell-through" : "Launch score"}</span><span className="mdt__stat-value tnum">{sellThrough != null ? `${sellThrough}%` : (e.launchScore != null ? Math.round(e.launchScore) : "—")}</span></div>
          </>
        ) : (
          <>
            <div className="mdt__stat"><span className="mdt__stat-label">Launch score</span><span className="mdt__stat-value tnum">{e.launchScore != null ? Math.round(e.launchScore) : "—"}</span></div>
            <div className="mdt__stat"><span className="mdt__stat-label">Projected sales</span><span className="mdt__stat-value tnum">{e.forecastUnits != null ? e.forecastUnits.toLocaleString() : "—"}</span></div>
            <div className="mdt__stat"><span className="mdt__stat-label">Launch price</span><span className="mdt__stat-value tnum">{format(e.product.price)}</span></div>
          </>
        )}
      </div>

      {pm ? (
        <div className="mdt__why">
          <h3 className="mdt__why-title">How it did</h3>
          <p className="mdt__headline">{pm.headline}</p>
          <p className="mdt__story">{pm.narrative}</p>
          <div className="mdt__factors">
            {FACTOR_ORDER.map((k) => {
              const f = pm.impacts[k];
              const key = pm.dominant.includes(k);
              return (
                <div key={k} className={`mdt__factor mdt__factor--${f.tone}${key ? " mdt__factor--key" : ""}`}>
                  <span className="mdt__factor-label">{FACTOR_LABEL[k]}</span>
                  <span className="mdt__factor-tone">{TONE_WORD[f.tone]}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mdt__note">Detailed launch analytics were not recorded for this device.</p>
      )}
    </div>
  );
}

export function MuseumSheet({ onClose }: { onClose: () => void }) {
  const { state } = useGame();
  const all = getMuseum();
  const [filter, setFilter] = useState<CategoryId | "all">("all");
  const [selected, setSelected] = useState<MuseumEntry | null>(null);

  if (selected) {
    // Devices from the CURRENT run are matched live in the save for real sales/revenue; cross-run
    // devices fall back to their launch-moment snapshot.
    const live = state.launched.find((l) => l.product.id === selected.product.id) ?? null;
    return <MuseumDetail e={selected} live={live} onBack={() => setSelected(null)} />;
  }
  // Categories actually present, in catalog order, so the filter only offers what you own.
  const present = (Object.keys(CATEGORIES) as CategoryId[]).filter((c) => all.some((e) => e.category === c));
  const entries = filter === "all" ? all : all.filter((e) => e.category === filter);
  // Group the gallery by device category (in catalog order) so it reads as organized shelves, not
  // one long mixed list. The filter narrows which shelves show; "All" shows every present category.
  const groups = present
    .map((c) => [c, entries.filter((e) => e.category === c)] as const)
    .filter(([, items]) => items.length > 0);

  return (
    <div className="mus">
      <div className="mus__head">
        <div>
          <h2 className="mus__title">Device Museum</h2>
          <p className="mus__sub">Every device you've shipped, across every company you've built.</p>
        </div>
        <span className="mus__count tnum" aria-label={`${all.length} devices`}>{all.length}</span>
      </div>

      {present.length > 1 && (
        <div className="mus__filters">
          <button className={`mus__filter${filter === "all" ? " mus__filter--on" : ""}`} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
          {present.map((c) => (
            <button key={c} className={`mus__filter${filter === c ? " mus__filter--on" : ""}`} aria-pressed={filter === c} onClick={() => setFilter(c)}>
              <CategoryIcon id={c} size={13} /> {CATEGORIES[c].displayName}
            </button>
          ))}
        </div>
      )}

      {all.length === 0 ? (
        <EmptyState
          glyph={<CategoryIcon id="phone" size={28} />}
          title="No devices yet"
          sub="Design and launch your first product, and it'll be enshrined here forever."
        />
      ) : (
        <div className="mus__sections">
          {groups.map(([cat, items]) => (
            <section key={cat} className="mus__section">
              <div className="mus__group-head">
                <CategoryIcon id={cat} size={14} />
                <span className="mus__group-title">{CATEGORIES[cat]?.displayName ?? cat}</span>
                <span className="mus__group-count tnum">{items.length}</span>
              </div>
              <ul className="mus__grid">
                {items.map((e) => <MuseumCard key={e.key} e={e} onSelect={setSelected} />)}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Button block variant="secondary" onClick={onClose}>Done</Button>
    </div>
  );
}
