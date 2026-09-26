import { decodeDraft, type DraftRecord } from './designDraft.ts';

export const DRAFT_LIBRARY_LIMIT = 12;
export interface SavedDesign extends DraftRecord { id: string; label: string }
export const libraryKey = (run: string) => `silicon.design-library.v1:${run}`;
type Store = Pick<Storage, 'getItem' | 'setItem'>;
function decode(raw: string | null, run: string, week: number): SavedDesign[] | null {
  try {
    const parsed = JSON.parse(raw ?? 'null');
    if (parsed?.version !== 1 || parsed.run !== run || !Array.isArray(parsed.items) || parsed.items.length > DRAFT_LIBRARY_LIMIT) return null;
    const ids = new Set<string>();
    for (const item of parsed.items) {
      if (!decodeDraft(JSON.stringify(item), run, week) || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 42) return null;
      ids.add(item.id);
    }
    return parsed.items;
  } catch { return null; }
}
export function readLibrary(store: Store, run: string, week: number) {
  try {
    const raw = store.getItem(libraryKey(run));
    if (raw === null) return { items: [] as SavedDesign[], status: 'ready' as const };
    const items = decode(raw, run, week);
    if (items) return { items, status: 'ready' as const };
    const backup = decode(store.getItem(`${libraryKey(run)}:backup`), run, week);
    return { items: backup ?? [], status: backup ? 'recovered' as const : 'invalid' as const };
  } catch { return { items: [] as SavedDesign[], status: 'unavailable' as const }; }
}
export function writeLibrary(store: Store, run: string, week: number, items: SavedDesign[]): boolean {
  try {
    const key = libraryKey(run), raw = JSON.stringify({ version: 1, run, items });
    if (!decode(raw, run, week)) return false;
    const old = store.getItem(key);
    if (old && decode(old, run, week)) store.setItem(`${key}:backup`, old);
    else if (old) store.setItem(`${key}:unreadable`, old);
    store.setItem(key, raw);
    return true;
  } catch { return false; }
}

/** Switching must first preserve current work; identical snapshots do not consume a slot. */
export function preserveWorkingDesign(items: SavedDesign[], current: DraftRecord, id: string): SavedDesign[] | null {
  if (items.some(i => i.step === current.step && JSON.stringify(i.product) === JSON.stringify(current.product))) return items;
  if (items.length >= DRAFT_LIBRARY_LIMIT) return null;
  return [...items, { ...current, id, label: (current.product.name.trim() || 'Untitled design').slice(0, 42) }];
}
