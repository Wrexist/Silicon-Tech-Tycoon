// The page stack: the navigation model ABOVE the five tab roots. Each frame carries the ROOT tab it
// was opened from and its own params, so a reload restores both — a bare page id would drop the
// player back on Office. The rules are pure and testable; usePageNav owns the live instance.

/** The five tab roots. `BottomNav` re-exports this as `Tab`, so there is ONE source of truth for the
 *  root ids — a second hand-written union is how the nav and the router would drift apart. */
export type RootId = "hq" | "design" | "research" | "market" | "company";

export type PageId = "settings" | "platform" | "museum" | "goals";

export type RouteParams = Readonly<Record<string, string>>;

export interface PageFrame {
  readonly id: PageId;
  /** The tab that was active when this page was opened; encoded so a reload can restore it. */
  readonly root: RootId;
  readonly params: RouteParams;
}

export type PageStack = readonly PageFrame[];

/** Hosted-page titles. Replaced by richer per-page descriptors when a page needs its own actions. */
export const PAGE_TITLES: Record<PageId, string> = {
  settings: "Settings",
  platform: "Platform",
  museum: "Device Museum",
  goals: "Goals",
};

/** Pages that have a render block in the shell TODAY. `PageId` is deliberately wider than this set:
 *  the type names the pages the model will carry, this names the ones that can actually be shown. */
export const WIRED_PAGES: readonly PageId[] = ["settings", "platform"];

const ROOTS: readonly RootId[] = ["hq", "design", "research", "market", "company"];

function isRootId(v: string): v is RootId {
  return (ROOTS as readonly string[]).includes(v);
}

function isWiredPage(v: string): v is PageId {
  return (WIRED_PAGES as readonly string[]).includes(v);
}

/** Frames are compared by VALUE: `push` must be a no-op for the same page at the same params, but a
 *  different section is a genuinely different frame and must deepen the stack. */
export function sameFrame(a: PageFrame, b: PageFrame): boolean {
  if (a.id !== b.id || a.root !== b.root) return false;
  const ak = Object.keys(a.params);
  const bk = Object.keys(b.params);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a.params[k] === b.params[k]);
}

/** True when `frame` has the same PAGE as the current top — the condition that lets a push REPLACE the
 *  top frame instead of deepening the stack (rail navigation must not grow history per tap). Exported
 *  so the stateful hook and the pure model cannot disagree about whether a push replaced. */
export function replacesTop(stack: PageStack, frame: PageFrame): boolean {
  const top = topPage(stack);
  return top !== null && top.id === frame.id;
}

/** Push a frame. An identical top frame is a no-op, so a double-tap cannot deepen the stack. When
 *  `replaceTop` is set and the top frame shares the id, the top is replaced in place instead — a
 *  rail that re-pushes its own page must not grow the stack on every tap. */
export function pushPage(stack: PageStack, frame: PageFrame, replaceTop = false): PageStack {
  const top = topPage(stack);
  if (top && sameFrame(top, frame)) return stack;
  if (replaceTop && replacesTop(stack, frame)) return [...stack.slice(0, -1), frame];
  return [...stack, frame];
}

/** Pop the top frame. Popping an empty stack is a no-op, so Escape on a root is safe. */
export function popPage(stack: PageStack): PageStack {
  if (stack.length === 0) return stack;
  return stack.slice(0, -1);
}

export function topPage(stack: PageStack): PageFrame | null {
  return stack.length ? stack[stack.length - 1] : null;
}

/** `decodeURIComponent` throws on a malformed escape (`#/company/settings/%`), and a pasted URL must
 *  never crash the app — an undecodable segment is used verbatim instead. */
function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** `#/company/platform/services` -> { root: "company", frame: { id: "platform", params: { section:
 *  "services" } } }. An unrecognised root, or any absent value, yields the fallback root with no
 *  frame — never a guessed root, and never a page whose screen does not exist. */
export function routeFromHash(hash: string, fallbackRoot: RootId): { root: RootId; frame: PageFrame | null } {
  const parts = hash
    .replace(/^#\/?/, "")
    .split("/")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const root = parts[0] && isRootId(parts[0]) ? parts[0] : fallbackRoot;
  const id = parts[1];
  if (!id || !isWiredPage(id)) return { root, frame: null };
  const section = parts[2] ? safeDecode(parts[2]) : undefined;
  return { root, frame: { id, root, params: section ? { section } : {} } };
}

/** The inverse, so the address bar always names the root and the page that are actually showing.
 *  Only `section` is URL-encoded today; a params key that must survive a reload has to be added
 *  here as well as in `routeFromHash`, or it will silently vanish from the link. */
export function hashForRoute(root: RootId, frame: PageFrame | null): string {
  if (!frame) return `#/${root}`;
  const section = frame.params.section ? `/${encodeURIComponent(frame.params.section)}` : "";
  return `#/${root}/${frame.id}${section}`;
}
