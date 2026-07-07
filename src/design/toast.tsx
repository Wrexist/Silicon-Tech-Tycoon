import { useSyncExternalStore, type ReactNode } from "react";

type Tone = "neutral" | "positive" | "negative";
type Toast = { id: number; text: string; glyph?: ReactNode; tone: Tone };

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

// Cap how many toasts can stack at once — a single busy moment (e.g. a launch tripping several
// systems) should never tower the screen. Oldest drop off when a newer one arrives.
const MAX_VISIBLE = 3;

export function showToast(text: string, opts: { glyph?: ReactNode; tone?: Tone } = {}) {
  const id = nextId++;
  toasts = [...toasts, { id, text, glyph: opts.glyph, tone: opts.tone ?? "neutral" }].slice(-MAX_VISIBLE);
  emit();
  setTimeout(() => dismiss(id), 2600);
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
          onClick={() => dismiss(t.id)}
          aria-label={`${t.text}. Tap to dismiss.`}
        >
          {t.glyph && <span aria-hidden>{t.glyph}</span>}
          <span aria-hidden>{t.text}</span>
        </button>
      ))}
    </div>
  );
}
