import { haptic } from "../design/haptics.ts";
import type { Attention } from "../state/gameState.ts";
import { TABS, type Tab } from "./BottomNav.tsx";
import "./railNav.css";

/** The vertical side rail that replaces the bottom tab bar on tablet and wide layouts. It reads the
 *  same TABS list as BottomNav, so the two presentations can never disagree about the roots. */
export function RailNav({
  active,
  onChange,
  badge,
  visible,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  /** Per-tab attention weight — identical contract to BottomNav. */
  badge?: Partial<Record<Tab, Attention>>;
  /** Progressive onboarding; omitted → every tab shows. */
  visible?: Partial<Record<Tab, boolean>>;
}) {
  const shown = TABS.filter((t) => visible == null || visible[t.id] || t.id === active);
  return (
    <nav className="railnav" aria-label="Primary">
      {shown.map((t) => (
        <button
          key={t.id}
          className={`railnav__item${active === t.id ? " railnav__item--active" : ""}`}
          style={active === t.id ? { color: t.color } : undefined}
          onClick={() => {
            if (active !== t.id) haptic.light();
            onChange(t.id);
          }}
          aria-current={active === t.id ? "page" : undefined}
        >
          <span className="railnav__glyph" aria-hidden>
            <t.Icon size={20} strokeWidth={active === t.id ? 2.4 : 2} />
            {badge?.[t.id] && active !== t.id && (
              <span className={`railnav__badge railnav__badge--${badge[t.id]}`} />
            )}
          </span>
          <span className="railnav__label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
