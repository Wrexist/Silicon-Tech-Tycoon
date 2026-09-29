import { describe, it, expect } from 'vitest';
import { newGame } from './gameState.ts';
import { readLibrary, writeLibrary, libraryKey, preserveWorkingDesign, DRAFT_LIBRARY_LIMIT } from './draftLibrary.ts';
import { defaultCameraDesign, type Product } from '../engine/types.ts';
import { dollars } from '../engine/money.ts';
const product: Product = { id:'draft', name:'Idea', category:'phone', tiers:{chip:1}, finish:'plastic', colorIndex:0, price:dollars(300), designTier:1, camera:defaultCameraDesign(), notch:'punch' };
const record = { version:1 as const, run:`${newGame(7).seed}:0`, week:0, step:'style' as const, product };
const memory = () => { const data = new Map<string,string>(); return { getItem:(k:string)=>data.get(k) ?? null, setItem:(k:string,v:string)=>{data.set(k,v);} }; };
describe('named design library', () => {
  it('preserves current work before switching and deduplicates identical snapshots', () => {
    const items=preserveWorkingDesign([],record,'one')!;
    expect(items[0].product).toEqual(product);
    expect(preserveWorkingDesign(items,record,'two')).toBe(items);
    expect(preserveWorkingDesign(items,{...record,product:{...product,name:'Second'}},'two')).toHaveLength(2);
  });
  it('round trips multiple named drafts and isolates runs', () => {
    const store=memory(),items=preserveWorkingDesign([],record,'one')!;
    expect(writeLibrary(store,record.run,0,items)).toBe(true);
    expect(readLibrary(store,record.run,1).items).toEqual(items);
    expect(readLibrary(store,'another',1).items).toEqual([]);
  });
  it('recovers corruption without overwriting the last valid library', () => {
    const store=memory(),items=preserveWorkingDesign([],record,'one')!;
    writeLibrary(store,record.run,0,items);writeLibrary(store,record.run,0,[]);
    store.setItem(libraryKey(record.run),'broken');
    expect(readLibrary(store,record.run,0)).toEqual({items,status:'recovered'});
  });
  it('rejects future timelines, malformed products and duplicate IDs', () => {
    const store=memory(),item={...record,id:'one',label:'Idea'};
    expect(writeLibrary(store,record.run,0,[{...item,week:1}])).toBe(false);
    expect(writeLibrary(store,record.run,0,[{...item,product:{...product,price:NaN as Product['price']}}])).toBe(false);
    expect(writeLibrary(store,record.run,0,[item,item])).toBe(false);
  });
  it('refuses to discard work when full or when storage fails', () => {
    const items=Array.from({length:DRAFT_LIBRARY_LIMIT},(_,i)=>({...record,id:String(i),label:String(i)}));
    expect(preserveWorkingDesign(items,{...record,step:'launch'},'extra')).toBeNull();
    const store={getItem:()=>null,setItem:()=>{throw Error('quota');}};
    expect(writeLibrary(store,record.run,0,items)).toBe(false);
  });
});

describe('design storage is bounded across runs', () => {
  it('evicts every design key of runs pushed past the recent-runs cap, and nothing else', async () => {
    const { saveDraft, draftKey, RECENT_RUNS_MAX } = await import('./designDraft.ts');
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
    data.set('silicon.save', 'untouched'); // unrelated keys are never swept
    const runs = Array.from({ length: RECENT_RUNS_MAX + 2 }, (_, i) => `seed${i}:0`);
    for (const run of runs) {
      expect(saveDraft(store, { ...record, run })).toBe(true);
      expect(saveDraft(store, { ...record, run, product: { ...product, name: 'Two' } })).toBe(true); // leaves a :backup
      expect(writeLibrary(store, run, 0, [])).toBe(true);
    }
    for (const gone of runs.slice(0, 2)) {
      expect(data.has(draftKey(gone))).toBe(false);
      expect(data.has(`${draftKey(gone)}:backup`)).toBe(false);
      expect(data.has(libraryKey(gone))).toBe(false);
    }
    for (const kept of runs.slice(2)) expect(data.has(draftKey(kept))).toBe(true);
    expect(data.get('silicon.save')).toBe('untouched');
  });
});
