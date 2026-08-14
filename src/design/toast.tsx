import { useSyncExternalStore, type ReactNode } from "react";

type Tone = "neutral" | "positive" | "negative";
/** How much this line deserves the screen.
 *  - `"normal"` (default) — the RESULT of something the player just did, or a beat they'd miss
 *    otherwise (a launch verdict, a research completion, a refused action's reason).
 *  - `"low"` — passive flavour that fires on its own during the tick (fan / revenue milestones).
 *    It's nice when the screen is quiet and pure noise when it isn't, so it yields: a low toast is
 *    DROPPED rather than shown when the stack is already full, and is the first thing evicted when a
 *    real one arrives. Before this, a "$10M lifetime revenue!" milestone could push the answer to the
 *    player's own tap off the screen. */
type Priority = "normal" | "low";
type Toast = { id: number; text: string; glyph?: ReactNode; tone: Tone; priority: Priority };

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
// systems) should never tower the screen.
const MAX_VISIBLE = 3;

export function showToast(text: string, opts: { glyph?: ReactNode; tone?: Tone; priority?: Priority } = {}) {
  // Drop an exact duplicate of a toast that's already on screen — a repeated tap shouldn't stack the
  // same line twice.
  if (toasts.some((t) => t.text === text)) return;
  const priority = opts.priority ?? "normal";
  if (toasts.length >= MAX_VISIBLE) {
    // Full. A low-priority line just doesn't get shown — it is never worth displacing something the
    // player is mid-read of.
    if (priority === "low") return;
    // Otherwise make room by dropping the oldest LOW line if there is one, else the oldest line.
    const victim = toasts.find((t) => t.priority === "low") ?? toasts[0];
    toasts = toasts.filter((t) => t !== victim);
  }
  const id = nextId++;
  toasts = [...toasts, { id, text, glyph: opts.glyph, tone: opts.tone ?? "neutral", priority }];
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

/** Test-only: drop every queued toast so one spec's leftovers can't fill the next one's stack. */
export function __resetToastsForTest() {
  toasts = [];
  emit();
}

/** Test-only: the queue as it stands, so the priority rule above is verifiable without a DOM. */
export function __toastsForTest(): readonly { text: string; priority: Priority }[] {
  return toasts.map((t) => ({ text: t.text, priority: t.priority }));
}
