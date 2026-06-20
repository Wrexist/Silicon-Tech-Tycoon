import {
  type ButtonHTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { Sparkles } from "lucide-react";
import { haptic } from "./haptics.ts";
import { sfx } from "./sound.ts";
import "./primitives.css";

/* ---------- Card ---------- */
export function Card({
  children,
  variant,
  className = "",
  style,
}: {
  children: ReactNode;
  variant?: "flush" | "inset";
  className?: string;
  style?: React.CSSProperties;
}) {
  const mod = variant ? ` ds-card--${variant}` : "";
  return (
    <div className={`ds-card${mod} ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ---------- Button ---------- */
type BtnVariant = "primary" | "secondary" | "tertiary" | "destructive";
export function Button({
  children,
  variant = "primary",
  block,
  size,
  haptics = "light",
  onClick,
  ...rest
}: {
  children: ReactNode;
  variant?: BtnVariant;
  block?: boolean;
  size?: "sm";
  haptics?: "light" | "medium" | "none";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`ds-btn ds-btn--${variant}${block ? " ds-btn--block" : ""}${
        size ? " ds-btn--sm" : ""
      }`}
      onClick={(e) => {
        if (haptics !== "none") {
          haptic[haptics]();
          sfx("tap");
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Stat ----------
   A label + value pair with an optional tone (colours the value) and hint line.
   Shared across Market / Company / Design Lab. Pass `className` so each screen keeps
   its own layout class (e.g. mkt__stat, co__stat, wiz__stat) for grid placement. */
export type StatTone = "positive" | "negative" | "accent" | "neutral";
// Stat values render as TEXT, so use the on-light text variants (legible in light theme; they
// fall back to the bright hues on dark surfaces). --accent is already AA as text in light theme.
const STAT_TONE_COLOR: Record<StatTone, string> = {
  positive: "var(--positive-text)",
  negative: "var(--negative-text)",
  accent: "var(--accent)",
  neutral: "var(--ink)",
};
export function Stat({
  label,
  value,
  tone = "neutral",
  hint,
  className = "",
}: {
  label: string;
  value: ReactNode;
  tone?: StatTone;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`ds-stat ${className}`.trim()}>
      <span className="ds-stat__label">{label}</span>
      <span className="ds-stat__value tnum" style={{ color: STAT_TONE_COLOR[tone] }}>{value}</span>
      {hint && <span className="ds-stat__hint">{hint}</span>}
    </div>
  );
}

/* ---------- StatPill ---------- */
export function StatPill({
  label,
  value,
  tone = "neutral",
}: {
  label?: string;
  value: ReactNode;
  tone?: "neutral" | "accent" | "positive" | "negative";
}) {
  const mod = tone === "neutral" ? "" : ` ds-pill--${tone}`;
  return (
    <span className={`ds-pill${mod}`}>
      {label && <span className="ds-pill__label">{label}</span>}
      <span className="ds-pill__value tnum">{value}</span>
    </span>
  );
}

/* ---------- SectionHeader ---------- */
export function SectionHeader({
  title,
  accessory,
}: {
  title: string;
  accessory?: ReactNode;
}) {
  return (
    <div className="ds-section">
      <span className="ds-section__title">{title}</span>
      {accessory && <span className="ds-section__accessory">{accessory}</span>}
    </div>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({
  glyph,
  title,
  sub,
  action,
}: {
  glyph?: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ds-empty">
      <div className="ds-empty__glyph" aria-hidden>
        {glyph ?? <Sparkles size={36} strokeWidth={1.6} />}
      </div>
      <div className="ds-empty__title">{title}</div>
      {sub && <div className="ds-empty__sub">{sub}</div>}
      {action}
    </div>
  );
}

/* ---------- Slider ---------- */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
  accent = "var(--accent)",
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  ariaLabel?: string;
  accent?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className="ds-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      style={{ "--pct": `${pct}%`, "--accent-local": accent } as React.CSSProperties}
      onChange={(e) => {
        haptic.light();
        onChange(Number(e.target.value));
      }}
    />
  );
}

/* ---------- focus-trap helper ----------
   Shared a11y plumbing for modal dialogs. On mount it captures the element that had focus, moves
   focus into the dialog (first focusable child, else the dialog itself), and traps Tab/Shift+Tab so
   focus wraps within the dialog. On unmount it restores focus to the original opener. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogFocus(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === dialog,
      );
    const first = focusables()[0];
    (first ?? dialog).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && (activeEl === firstEl || activeEl === dialog)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    dialog.addEventListener("keydown", onKey);
    return () => {
      dialog.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [active, ref]);
}

/* ---------- Sheet ---------- */
export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Drag-to-dismiss. On touch the WHOLE sheet is grabbable (gated on the scroll being at the top
  // so it never fights content scrolling — see the effect below). On mouse, the grab handle is
  // the drag target. A real tap on the handle closes, a downward drag past the threshold closes,
  // anything shorter snaps back.
  const drag = useRef({ startY: 0, dy: 0, moved: 0, active: false });
  // Latest onClose, read by the touch listeners so the effect can attach once per open (re-running
  // it on every onClose identity change would tear down mid-gesture as setOffset re-renders).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  // The sheet stays rendered through its close animation (`closing`) so it slides+fades out
  // instead of vanishing. Opening shows it immediately (no mount-delay frame).
  const [closing, setClosing] = useState(false);
  const wasOpen = useRef(open);
  // Children are cached while open so a sheet whose content is gated on the same state that
  // toggles `open` (e.g. `{detail && <…>}`) still shows that content while sliding out.
  const lastChildren = useRef<ReactNode>(children);
  if (open) lastChildren.current = children;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  useEffect(() => { if (open) setOffset(0); }, [open]);
  // Touch swipe-to-dismiss across the whole sheet. We claim the gesture as a dismiss only when the
  // content is scrolled to the very top AND the finger is moving down — so scrolling the content
  // still works everywhere else. A tap that starts on the grab handle also closes. Attached once
  // per open (refs hold the live gesture state) so the re-renders from setOffset don't detach it.
  useEffect(() => {
    const el = dialogRef.current;
    if (!open || !el) return;
    let startY = 0, dy = 0, maxMove = 0;
    let active = false, dragging = false, onHandle = false;
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      dy = 0; maxMove = 0; active = true; dragging = false;
      onHandle = !!(e.target as HTMLElement | null)?.closest?.(".ds-sheet__grab");
    };
    const move = (e: TouchEvent) => {
      if (!active) return;
      dy = e.touches[0].clientY - startY;
      maxMove = Math.max(maxMove, Math.abs(dy));
      if (!dragging) {
        // Decide once: a downward pull while pinned at the top is a dismiss; anything else (an
        // upward move, or any move while the content can still scroll) is left to native scroll.
        if (el.scrollTop <= 0 && dy > 4) dragging = true;
        else if (dy < -4 || el.scrollTop > 0) { active = false; return; }
        else return;
      }
      if (dy < 0) dy = 0;
      e.preventDefault(); // we own the gesture now — stop the rubber-band scroll underneath it
      setDragging(true);
      setOffset(dy);
    };
    const end = () => {
      if (!active) return;
      active = false;
      setDragging(false);
      if (dragging && dy > 96) onCloseRef.current();          // dragged far enough
      else if (onHandle && maxMove < 6) onCloseRef.current();  // a clean tap on the grab handle
      else setOffset(0);                                       // short drag — snap back
    };
    // An OS/browser-interrupted gesture is an ABORT, not a dismiss — snap back without evaluating
    // the dismiss thresholds (otherwise a cancel mid-drag past 96px would wrongly close the sheet).
    const cancel = () => {
      if (!active) return;
      active = false;
      dragging = false;
      setDragging(false);
      setOffset(0);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", cancel);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", cancel);
    };
  }, [open]);
  // Closed after being open → play the exit, then drop `closing` to unmount. Reduced motion
  // (the global catch-all makes the exit instant) skips straight to unmount.
  useEffect(() => {
    if (open) { wasOpen.current = true; setClosing(false); return; }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) { setClosing(false); return; }
    setClosing(true);
    const t = window.setTimeout(() => setClosing(false), 260);
    return () => window.clearTimeout(t);
  }, [open]);
  useDialogFocus(dialogRef, open);

  if (!open && !closing) return null;

  const grabDown = (e: ReactPointerEvent) => {
    if (e.pointerType === "touch") return; // touch is handled by the whole-sheet swipe listeners
    drag.current = { startY: e.clientY, dy: 0, moved: 0, active: true };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const grabMove = (e: ReactPointerEvent) => {
    if (!drag.current.active) return;
    const raw = e.clientY - drag.current.startY;
    drag.current.dy = Math.max(0, raw);
    drag.current.moved = Math.max(drag.current.moved, Math.abs(raw));
    setOffset(drag.current.dy);
  };
  const grabUp = () => {
    if (!drag.current.active) return;
    const { dy, moved } = drag.current;
    drag.current.active = false;
    setDragging(false);
    if (dy > 96 || moved < 6) onClose(); // dragged far enough, or a clean tap on the handle
    else setOffset(0); // a short drag — snap back
  };

  return (
    <div className={`ds-sheet-scrim${closing ? " ds-sheet-scrim--closing" : ""}`} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`ds-sheet${closing ? " ds-sheet--closing" : ""}`}
        style={!closing && offset ? { transform: `translateY(${offset}px)`, transition: dragging ? "none" : undefined } : undefined}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="ds-sheet__grab"
          aria-label="Close"
          onPointerDown={grabDown}
          onPointerMove={grabMove}
          onPointerUp={grabUp}
          onPointerCancel={grabUp}
        />
        {open ? children : lastChildren.current}
      </div>
    </div>
  );
}
