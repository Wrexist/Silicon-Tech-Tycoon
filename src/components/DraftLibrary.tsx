import { useState } from 'react';
import { CATEGORIES } from '../engine/catalogs.ts';
import type { DraftRecord } from '../state/designDraft.ts';
import { DRAFT_LIBRARY_LIMIT, readLibrary, writeLibrary, preserveWorkingDesign, type SavedDesign } from '../state/draftLibrary.ts';

const storage = { getItem: (k: string) => localStorage.getItem(k), setItem: (k: string, v: string) => localStorage.setItem(k, v) };
export function DraftLibrary({ current, blocked, onOpen }: { current: DraftRecord; blocked: boolean; onOpen: (record: DraftRecord) => void }) {
  const [library, setLibrary] = useState(() => readLibrary(storage, current.run, current.week));
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [rename, setRename] = useState('');
  const [removeId, setRemoveId] = useState<string | null>(null);
  const unusable = blocked || library.status === 'invalid' || library.status === 'unavailable';
  function commit(items: SavedDesign[]) {
    if (unusable || !writeLibrary(storage, current.run, current.week, items)) { setMessage('Could not save the library. Your current design is unchanged.'); return false; }
    setLibrary({ items, status: 'ready' }); return true;
  }
  const open = (item: SavedDesign) => {
    const items = preserveWorkingDesign(library.items, current, crypto.randomUUID());
    if (!items) { setMessage('Library full. Free a slot before switching so your current design can be preserved.'); return; }
    if (!commit(items)) return;
    onOpen(item); setMessage(`Opened ${item.label}. Your previous work is kept in the library.`);
  };
  return <details className="mg-disclosure draft-library"><summary>Saved designs ({library.items.length}/{DRAFT_LIBRARY_LIMIT})</summary>
    <p>Keep named snapshots of different ideas. Opening one also preserves your current design. Saved on this device.</p>
    {library.status === 'recovered' && <p role="status">Recovered the previous library backup.</p>}
    {(library.status === 'invalid' || library.status === 'unavailable') && <p role="alert">This library cannot be read safely. Its saved data is preserved. <button onClick={() => setLibrary(readLibrary(storage, current.run, current.week))}>Retry</button></p>}
    <form onSubmit={e => { e.preventDefault(); if (library.items.length >= DRAFT_LIBRARY_LIMIT) return; if (commit([...library.items, { ...current, id: crypto.randomUUID(), label: (name.trim() || current.product.name.trim() || 'Untitled design').slice(0,42) }])) { setName(''); setMessage('Design saved to the library.'); } }}>
      <label>Design label<input value={name} maxLength={42} placeholder={current.product.name || 'My design'} onChange={e => setName(e.target.value)} /></label>
      <button disabled={unusable || library.items.length >= DRAFT_LIBRARY_LIMIT}>Save a copy</button>
    </form>
    {library.items.length === 0 && <p>No saved designs yet. Your current working draft still autosaves.</p>}
    <ul>{library.items.map(item => <li key={item.id}>
      <strong>{item.label}</strong><small>{CATEGORIES[item.product.category].displayName} · saved week {item.week}</small>
      {renameId === item.id ? <form onSubmit={e => { e.preventDefault(); if (commit(library.items.map(i => i.id === item.id ? { ...i, label: rename.trim() } : i))) setRenameId(null); }}><label>New design label<input value={rename} maxLength={42} onChange={e => setRename(e.target.value)} /></label><button disabled={unusable || !rename.trim()}>Save name</button><button type="button" onClick={() => setRenameId(null)}>Cancel</button></form>
      : <div className="draft-library__actions"><button disabled={unusable} onClick={() => open(item)}>Open {item.label}</button><button disabled={unusable} onClick={() => { setRenameId(item.id); setRename(item.label); }}>Rename</button><button disabled={unusable} onClick={() => setRemoveId(item.id)}>Delete</button></div>}
      {removeId === item.id && <div className="draft-library__actions"><span>Delete this saved copy? Your working draft stays.</span><button disabled={unusable} onClick={() => { if (commit(library.items.filter(i => i.id !== item.id))) { setRemoveId(null); setMessage('Saved copy deleted.'); } }}>Delete copy</button><button onClick={() => setRemoveId(null)}>Keep</button></div>}
    </li>)}</ul><p role="status">{message}</p>
  </details>;
}
