import { useSyncExternalStore, type ReactNode } from "react";

type Tone = "neutral" | "positive" | "negative";
type Toast = { id: number; text: string; glyph?: ReactNode; tone: Tone; action?: () => void; actionLabel?: string };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function showToast(text: string, opts: { glyph?: ReactNode; tone?: Tone; action?: () => void; actionLabel?: string } = {}) {
  const id = nextId++;
  toasts = [...toasts, { id, text, glyph: opts.glyph, tone: opts.tone ?? "neutral", action: opts.action, actionLabel: opts.actionLabel }];
  emit();
  setTimeout(() => dismiss(id), opts.action ? 4200 : 2600);
}

export function ToastHost() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => toasts,
  );
  if (list.length === 0) return null;
  return (
    <div className="ds-toast-host" role="status" aria-live="polite">
      {list.map((t) => (
        <button
          type="button"
          key={t.id}
          className={`ds-toast${t.tone === "neutral" ? "" : ` ds-toast--${t.tone}`}`}
          onClick={() => { t.action?.(); dismiss(t.id); }}
          aria-label={t.action && t.actionLabel ? `${t.text} — ${t.actionLabel}` : "Dismiss notification"}
        >
          {t.glyph && <span aria-hidden>{t.glyph}</span>}
          <span>{t.text}</span>
          {t.action && t.actionLabel && <span className="ds-toast-cta" aria-hidden>{t.actionLabel} ›</span>}
        </button>
      ))}
    </div>
  );
}
