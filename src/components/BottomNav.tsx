import { Building2, FlaskConical, Home, PencilRuler, TrendingUp, type LucideIcon } from "lucide-react";
import { haptic } from "../design/haptics.ts";
import "./bottomNav.css";

export type Tab = "hq" | "design" | "research" | "market" | "company";

const TABS: { id: Tab; label: string; Icon: LucideIcon; color: string }[] = [
  { id: "hq", label: "Office", Icon: Home, color: "var(--accent)" },
  { id: "design", label: "Design", Icon: PencilRuler, color: "var(--fn-design)" },
  { id: "research", label: "Research", Icon: FlaskConical, color: "var(--fn-eng)" },
  { id: "market", label: "Market", Icon: TrendingUp, color: "var(--fn-mkt)" },
  { id: "company", label: "Company", Icon: Building2, color: "var(--accent)" },
];

export function BottomNav({
  active,
  onChange,
  badge,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  badge?: Partial<Record<Tab, boolean>>;
}) {
  return (
    <nav className="bnav" aria-label="Primary">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`bnav__item${active === t.id ? " bnav__item--active" : ""}`}
          style={active === t.id ? { color: t.color } : undefined}
          onClick={() => {
            if (active !== t.id) haptic.light();
            onChange(t.id);
          }}
          aria-current={active === t.id ? "page" : undefined}
        >
          <span className="bnav__glyph" aria-hidden>
            <t.Icon size={21} strokeWidth={active === t.id ? 2.4 : 2} />
            {/* Attention dot — only on the tabs you're NOT already looking at. */}
            {badge?.[t.id] && active !== t.id && <span className="bnav__badge" />}
          </span>
          <span className="bnav__label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
