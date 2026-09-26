import { useEffect, useState, type SetStateAction } from "react";
import type { Product } from "../engine/types.ts";
import { loadDraft, saveDraft, type DesignStep } from "./designDraft.ts";

const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };

export function useDesignDraft(run: string, week: number, initial: () => Product, seeded: boolean, writable = true) {
  const [loaded] = useState(() => loadDraft(storage, run, week));
  const [history, setHistory] = useState(() => ({ past: [] as Product[], now: !seeded && loaded.record ? loaded.record.product : initial(), future: [] as Product[] }));
  const [step, setStep] = useState<DesignStep>(() => !seeded && loaded.record ? loaded.record.step : "components");
  const [saved, setSaved] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!writable) return;
    setSaved(saveDraft(storage, { version: 1, run, week, product: history.now, step }));
  }, [run, week, history.now, step, retry, writable]);
  const set = (action: SetStateAction<Product>) => setHistory(h => {
    const now = typeof action === "function" ? action(h.now) : action;
    if (JSON.stringify(now) === JSON.stringify(h.now)) return h;
    return { past: [...h.past, h.now].slice(-40), now, future: [] };
  });
  const undo = () => setHistory(h => h.past.length ? { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now, ...h.future] } : h);
  const redo = () => setHistory(h => h.future.length ? { past: [...h.past, h.now], now: h.future[0], future: h.future.slice(1) } : h);
  const reset = (now: Product) => setHistory({ past: [], now, future: [] });
  return { draft: history.now, setDraft: set, reset, step, setStep, undo, redo, canUndo: !!history.past.length, canRedo: !!history.future.length, saved, recovery: seeded ? "new" : loaded.status, retry: () => setRetry(n => n + 1) };
}
