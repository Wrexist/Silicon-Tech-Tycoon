// Rival head-to-head MEMORY (DEPTH_PLAN: reactive rivals remember) — the game remembers the
// important interactions between the player and each rival, and uses that history in what it says:
// the Market rival profile ("You lead the head-to-head 5–2"), the strike card ("their third strike
// on you"), the duel arm line, occasional feed beats on genuinely notable crossings, and the
// campaign epilogue's "defining feud" clause.
//
// PURE + deterministic by construction: this is nothing but a fold over events the state layer
// already computes deterministically (clash signals, strike resolutions, duel judgements, contested
// launches, acquisitions). No RNG anywhere — every line here is a plain function of the counts, so
// no salt is needed. Every event that writes memory requires PLAYER activity (a clash, an answered
// strike, a duel, a buyout), which the pinned do-nothing sim never has — so a do-nothing run never
// creates the record and stays byte-identical, and old saves simply read as "no history yet".
import { rivalDef } from "./competitors.ts";

/** What the game remembers about one rival. All counters are lifetime counts for THIS run. */
export interface RivalMemory {
  /** Head-to-head clashes you won (overtakes, dethronings, award wins, repelled/answered strikes). */
  wins: number;
  /** Clashes they won (strikes that landed, awards taken from you, a losing hold). */
  losses: number;
  /** Strikes they have launched at you (the interrupt card firing). */
  strikes: number;
  /** Strikes you answered — price, campaign, or a hold (win or lose, you stood in the ring). */
  strikesWeathered: number;
  /** Cut-price offensives (contested undercutter launches) they aimed at categories you were winning. */
  priceWars: number;
  /** Nemesis-duel windows judged in your favour against this rival. */
  duelsWon: number;
  /** Duel windows they survived (the countdown lapsed short of the margin). */
  duelsLost: number;
  /** Set (to the week) when you bought them out — the feud's final line. */
  acquiredWeek?: number;
  /** Week of the most recent remembered interaction. */
  lastWeek: number;
}

/** Per-rival memory keyed by rival id. Optional on GameState; absent until the first interaction. */
export type RivalHistory = Record<string, RivalMemory>;

export type RivalMemoryEvent =
  | "win"
  | "loss"
  | "strike"
  | "strikeWeathered"
  | "priceWar"
  | "duelWon"
  | "duelLost";

export function emptyRivalMemory(): RivalMemory {
  return { wins: 0, losses: 0, strikes: 0, strikesWeathered: 0, priceWars: 0, duelsWon: 0, duelsLost: 0, lastWeek: 0 };
}

/** Fold one event into the history (immutably). Creates the history/entry on first contact, so the
 *  caller can keep the state field absent until something actually happens. */
export function recordRival(
  history: RivalHistory | undefined,
  rivalId: string,
  week: number,
  ev: RivalMemoryEvent,
): RivalHistory {
  const prev = history?.[rivalId] ?? emptyRivalMemory();
  const next: RivalMemory = { ...prev, lastWeek: Math.max(prev.lastWeek, week) };
  switch (ev) {
    case "win": next.wins = prev.wins + 1; break;
    case "loss": next.losses = prev.losses + 1; break;
    case "strike": next.strikes = prev.strikes + 1; break;
    case "strikeWeathered": next.strikesWeathered = prev.strikesWeathered + 1; break;
    case "priceWar": next.priceWars = prev.priceWars + 1; break;
    case "duelWon": next.duelsWon = prev.duelsWon + 1; break;
    case "duelLost": next.duelsLost = prev.duelsLost + 1; break;
  }
  return { ...(history ?? {}), [rivalId]: next };
}

/** Stamp the buyout — the last entry in the file. Creates the entry if the feud was bloodless. */
export function markRivalAcquired(history: RivalHistory | undefined, rivalId: string, week: number): RivalHistory {
  const prev = history?.[rivalId] ?? emptyRivalMemory();
  return { ...(history ?? {}), [rivalId]: { ...prev, acquiredWeek: week, lastWeek: Math.max(prev.lastWeek, week) } };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The compact "history with you" sentence for the Market rival profile. Null when there is nothing
 *  worth saying. `record: false` drops the win–loss part (the nemesis card already shows it big). */
export function rivalMemoryLine(mem: RivalMemory, opts?: { record?: boolean }): string | null {
  const parts: string[] = [];
  const showRecord = opts?.record ?? true;
  if (showRecord && mem.wins + mem.losses > 0) {
    parts.push(
      mem.wins > mem.losses
        ? `You lead the head-to-head ${mem.wins}–${mem.losses}`
        : mem.losses > mem.wins
          ? `They lead the head-to-head ${mem.losses}–${mem.wins}`
          : `All square at ${mem.wins}–${mem.losses} head-to-head`,
    );
  }
  if (mem.strikesWeathered > 0) parts.push(`${mem.strikesWeathered} ${plural(mem.strikesWeathered, "strike", "strikes")} weathered`);
  if (mem.priceWars > 0) parts.push(`${mem.priceWars} price ${plural(mem.priceWars, "war", "wars")}`);
  if (mem.duelsWon > 0) parts.push(`${mem.duelsWon} duel ${plural(mem.duelsWon, "trophy", "trophies")} taken`);
  if (mem.duelsLost > 0) parts.push(`${mem.duelsLost} ${plural(mem.duelsLost, "duel", "duels")} lost`);
  return parts.length ? parts.join(" · ") : null;
}

const ORDINALS = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
function ordinal(n: number): string {
  return ORDINALS[n] ?? `${n}th`;
}

/** A one-line "we've been here before" for the strike card. The tick records the incoming strike
 *  BEFORE the card renders, so `mem.strikes` already counts the one on screen. Speaks only from the
 *  second strike on — a first strike has no history to tell. */
export function strikeHistoryLine(mem: RivalMemory): string | null {
  if (mem.strikes < 2) return null;
  const base = `Their ${ordinal(mem.strikes)} strike on you`;
  return mem.strikesWeathered > 0
    ? `${base} — you've weathered ${mem.strikesWeathered} ${plural(mem.strikesWeathered, "strike", "strikes")} before.`
    : `${base}.`;
}

/** A feed beat when a rival relationship crosses a genuinely notable line — a third win over them, a
 *  third loss to them, or a third price war. Fires once per crossing (prev below, next at-or-above),
 *  first match wins, so a quiet accumulation never spams the feed. `{rival}` is name-filled by the
 *  caller. NOT used for the current nemesis, whose own milestones already speak (nemesisMilestone). */
export function rivalMemoryBeat(
  prev: RivalMemory | undefined,
  next: RivalMemory,
): { text: string; tone: "positive" | "negative" } | null {
  const p = prev ?? emptyRivalMemory();
  if (p.wins < 3 && next.wins >= 3) {
    return { text: "Three times now you've gotten the better of {rival}.", tone: "positive" };
  }
  if (p.losses < 3 && next.losses >= 3) {
    return { text: "{rival} has bested you three times now. They're building a habit.", tone: "negative" };
  }
  if (p.priceWars < 3 && next.priceWars >= 3) {
    return { text: "{rival} has dragged you into a third price war.", tone: "negative" };
  }
  return null;
}

/** The epilogue's "defining feud" clause: the rival with the most remembered contact, if the feud was
 *  real (3+ events, or a buyout). Names resolve through the calibrated rival defs (which cover the
 *  full roster + challenger pool, so an acquired rival still has a name); an optional `liveName`
 *  override lets the caller prefer the live competitor list. Unresolvable ids are skipped. House
 *  style (epilogue.ts): no em dashes. Returns undefined when no feud is worth a sentence. */
export function rivalryEpilogueClause(
  history: RivalHistory | undefined,
  liveName?: (id: string) => string | undefined,
): string | undefined {
  if (!history) return undefined;
  const nameOf = (id: string): string | undefined => liveName?.(id) ?? rivalDef(id)?.name;
  const weight = (m: RivalMemory) => m.wins + m.losses + m.duelsWon + m.duelsLost + m.priceWars + (m.acquiredWeek != null ? 3 : 0);
  const ids = Object.keys(history)
    .filter((id) => weight(history[id]) >= 3 && !!nameOf(id))
    .sort((a, b) => weight(history[b]) - weight(history[a]) || (a < b ? -1 : 1));
  const id = ids[0];
  if (!id) return undefined;
  const m = history[id];
  const name = nameOf(id)!;
  if (m.acquiredWeek != null) {
    return `Its long feud with ${name} ended the old-fashioned way: it bought them.`;
  }
  if (m.wins > m.losses) return `Its defining feud, with ${name}, closed ${m.wins}–${m.losses} in your favour.`;
  if (m.losses > m.wins) return `Its defining feud, with ${name}, closed ${m.wins}–${m.losses}; some scores stay unsettled.`;
  return `Its defining feud, with ${name}, ended all square at ${m.wins}–${m.losses}.`;
}
