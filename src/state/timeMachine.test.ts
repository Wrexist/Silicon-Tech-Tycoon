// Time Machine. The two things that matter here are the fairness rule (scored runs are never
// snapshotted, so a Pro player and a free player are measured identically) and the storage rule
// (snapshots must never grow until they push the player's actual save out of localStorage).
import { describe, expect, it, beforeEach } from "vitest";
import {
  MAX_SNAPSHOTS,
  SNAPSHOT_EVERY_WEEKS,
  agoLabel,
  captureIfDue,
  clearSnapshots,
  isEligibleRun,
  isSnapshotWeek,
  listSnapshots,
  restoreSnapshot,
} from "./timeMachine.ts";
import { newGame, type GameState } from "./gameState.ts";

class MemStorage {
  map = new Map<string, string>();
  /** When set, setItem throws for payloads over this many characters (a fake quota). */
  limit = Infinity;
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void {
    if (v.length > this.limit) {
      const e = new Error("quota"); e.name = "QuotaExceededError"; throw e;
    }
    this.map.set(k, String(v));
  }
  removeItem(k: string): void { this.map.delete(k); }
}

let store: MemStorage;

beforeEach(() => {
  store = new MemStorage();
  // @ts-expect-error node stub
  globalThis.localStorage = store;
  clearSnapshots();
});

function campaign(week: number, over: Partial<GameState> = {}): GameState {
  return { ...newGame(1234), week, companyName: "Volt", ...over };
}

describe("cadence", () => {
  it("fires on the quarter and nowhere else", () => {
    expect(isSnapshotWeek(SNAPSHOT_EVERY_WEEKS)).toBe(true);
    expect(isSnapshotWeek(SNAPSHOT_EVERY_WEEKS * 3)).toBe(true);
    expect(isSnapshotWeek(SNAPSHOT_EVERY_WEEKS + 1)).toBe(false);
  });

  it("never snapshots week zero — there is nothing to go back to yet", () => {
    expect(isSnapshotWeek(0)).toBe(false);
  });

  it("ignores nonsense weeks", () => {
    expect(isSnapshotWeek(NaN)).toBe(false);
    expect(isSnapshotWeek(-4)).toBe(false);
  });
});

describe("fairness — scored runs are never snapshotted", () => {
  it("allows the freeform campaign", () => {
    expect(isEligibleRun({ activeScenario: null, activeChallenge: null, bankrupt: false })).toBe(true);
  });

  it("refuses a scenario", () => {
    // Scenarios have star ratings. Rewinding one would let a subscriber buy three stars.
    expect(isEligibleRun({ activeScenario: "underdog", activeChallenge: null, bankrupt: false })).toBe(false);
  });

  it("refuses a challenge", () => {
    // Challenges are seeded and scored — free and Pro players must run identical rules.
    expect(isEligibleRun({ activeScenario: null, activeChallenge: { kind: "daily" } as never, bankrupt: false })).toBe(false);
  });

  it("refuses a bankrupt run", () => {
    expect(isEligibleRun({ activeScenario: null, activeChallenge: null, bankrupt: true })).toBe(false);
  });

  it("captures nothing during a scenario even on a snapshot week", () => {
    captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS, { activeScenario: "underdog" }), 1000, true);
    expect(listSnapshots()).toHaveLength(0);
  });

  it("captures nothing during a challenge even on a snapshot week", () => {
    captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS, { activeChallenge: { kind: "daily" } as never }), 1000, true);
    expect(listSnapshots()).toHaveLength(0);
  });
});

describe("entitlement", () => {
  it("captures nothing for a free player", () => {
    expect(captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS), 1000, false)).toBe(false);
    expect(listSnapshots()).toHaveLength(0);
  });

  it("refuses to restore once Pro has lapsed", () => {
    captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS), 1000, true);
    const [snap] = listSnapshots();
    expect(restoreSnapshot(snap.id, true)).not.toBeNull();
    expect(restoreSnapshot(snap.id, false)).toBeNull();
  });
});

describe("capture and restore", () => {
  it("records a snapshot with usable metadata", () => {
    captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS), 5_000, true);
    const list = listSnapshots();
    expect(list).toHaveLength(1);
    expect(list[0].week).toBe(SNAPSHOT_EVERY_WEEKS);
    expect(list[0].companyName).toBe("Volt");
    expect(list[0].savedAt).toBe(5_000);
  });

  it("round-trips the company", () => {
    const state = campaign(SNAPSHOT_EVERY_WEEKS, { reputation: 41 });
    captureIfDue(state, 1000, true);
    const [snap] = listSnapshots();
    const back = restoreSnapshot(snap.id, true);
    expect(back).not.toBeNull();
    expect(back!.week).toBe(SNAPSHOT_EVERY_WEEKS);
    expect(back!.reputation).toBe(41);
    expect(back!.companyName).toBe("Volt");
  });

  it("does not take a second snapshot for the same week", () => {
    captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS), 1000, true);
    expect(captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS), 2000, true)).toBe(false);
    expect(listSnapshots()).toHaveLength(1);
  });

  it("keeps only the most recent snapshots, newest first", () => {
    for (let i = 1; i <= MAX_SNAPSHOTS + 3; i++) {
      captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS * i), 1000 * i, true);
    }
    const list = listSnapshots();
    expect(list).toHaveLength(MAX_SNAPSHOTS);
    expect(list[0].week).toBe(SNAPSHOT_EVERY_WEEKS * (MAX_SNAPSHOTS + 3)); // newest first
    expect(list[list.length - 1].week).toBe(SNAPSHOT_EVERY_WEEKS * 4); // oldest fell off
  });

  it("a clock that moved BACKWARD cannot evict the snapshot just taken", () => {
    // Fill the list with stamps from "the future" — a device whose clock was later corrected
    // backwards (travel, a manual change, a bad sync) leaves exactly this state behind.
    const future = Date.now() + 365 * 24 * 3600_000;
    for (let i = 1; i <= MAX_SNAPSHOTS; i++) {
      captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS * i), future + i, true);
    }
    expect(listSnapshots()).toHaveLength(MAX_SNAPSHOTS);

    // Now the clock is sane again and a new quarter comes due. Ranked purely by savedAt this
    // snapshot sorts last of six and is sliced straight off — the Time Machine would silently
    // stop recording for a YEAR. It must be kept.
    const freshWeek = SNAPSHOT_EVERY_WEEKS * (MAX_SNAPSHOTS + 1);
    expect(captureIfDue(campaign(freshWeek), Date.now(), true)).toBe(true);
    const weeks = listSnapshots().map((s) => s.week);
    expect(weeks).toContain(freshWeek);
    expect(weeks).toHaveLength(MAX_SNAPSHOTS);
    // ...and it is genuinely restorable, not just listed.
    const id = listSnapshots().find((s) => s.week === freshWeek)!.id;
    expect(restoreSnapshot(id, true)?.week).toBe(freshWeek);
  });

  it("returns null for an unknown id", () => {
    expect(restoreSnapshot("nope", true)).toBeNull();
  });

  it("returns null rather than a broken company for a corrupt payload", () => {
    captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS), 1000, true);
    const [snap] = listSnapshots();
    const raw = JSON.parse(store.getItem("silicon.timeMachine.v1")!);
    raw[0].json = "{not json";
    store.setItem("silicon.timeMachine.v1", JSON.stringify(raw));
    expect(restoreSnapshot(snap.id, true)).toBeNull();
  });

  it("survives a corrupted store without throwing", () => {
    store.setItem("silicon.timeMachine.v1", "{{{");
    expect(listSnapshots()).toEqual([]);
    expect(captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS), 1000, true)).toBe(true);
  });

  it("clears completely", () => {
    captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS), 1000, true);
    clearSnapshots();
    expect(listSnapshots()).toEqual([]);
  });
});

describe("storage pressure", () => {
  it("sheds the oldest snapshots rather than failing, so the player's real save keeps its room", () => {
    for (let i = 1; i <= 3; i++) captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS * i), 1000 * i, true);
    const full = store.getItem("silicon.timeMachine.v1")!.length;
    // Squeeze the quota to roughly one snapshot's worth and take another.
    store.limit = Math.floor(full / 2.5);
    captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS * 4), 4000, true);
    const list = listSnapshots();
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThan(4);
    expect(list[0].week).toBe(SNAPSHOT_EVERY_WEEKS * 4); // the newest one survived
  });

  it("gives up quietly when not even one snapshot fits", () => {
    store.limit = 10;
    expect(captureIfDue(campaign(SNAPSHOT_EVERY_WEEKS), 1000, true)).toBe(false);
    expect(listSnapshots()).toEqual([]);
  });
});

describe("agoLabel", () => {
  const NOW = 1_000_000_000;
  it("reads naturally across the ranges", () => {
    expect(agoLabel(NOW, NOW)).toBe("just now");
    expect(agoLabel(NOW - 5 * 60_000, NOW)).toBe("5 min ago");
    expect(agoLabel(NOW - 3 * 3_600_000, NOW)).toBe("3 hours ago");
    expect(agoLabel(NOW - 1 * 3_600_000, NOW)).toBe("1 hour ago");
    expect(agoLabel(NOW - 2 * 86_400_000, NOW)).toBe("2 days ago");
  });

  it("never shows a negative age from a clock that moved backwards", () => {
    expect(agoLabel(NOW + 60_000, NOW)).toBe("just now");
  });
});
