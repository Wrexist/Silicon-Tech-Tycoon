// Device Museum — a permanent, cross-run gallery of every device you've shipped, re-rendered
// parametrically from the stored Product (zero image assets). Collection-as-meta-progression.
import { useState } from "react";
import { Button, EmptyState } from "../design/primitives.tsx";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import { CategoryIcon } from "../design/icons.tsx";
import { getMuseum } from "../state/museum.ts";
import { eraName } from "../engine/eras.ts";
import { deviceLegacy } from "../engine/deviceLegacy.ts";
import { CATEGORIES } from "../engine/catalogs.ts";
import type { CategoryId } from "../engine/types.ts";
import "./museum.css";

const VERDICT_LABEL: Record<string, string> = { hit: "Hit", solid: "Solid", flop: "Flop", steady: "Steady" };

export function MuseumSheet({ onClose }: { onClose: () => void }) {
  const all = getMuseum();
  const [filter, setFilter] = useState<CategoryId | "all">("all");
  // Categories actually present, in catalog order, so the filter only offers what you own.
  const present = (Object.keys(CATEGORIES) as CategoryId[]).filter((c) => all.some((e) => e.category === c));
  const entries = filter === "all" ? all : all.filter((e) => e.category === filter);

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
        <ul className="mus__grid">
          {entries.map((e) => (
            <li key={e.key} className="mus__card">
              <div className="mus__device">
                <DeviceRenderer product={e.product} size={120} />
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
            </li>
          ))}
        </ul>
      )}

      <Button block variant="secondary" onClick={onClose}>Done</Button>
    </div>
  );
}
