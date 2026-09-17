// The page stack: the navigation model ABOVE the five tab roots. Pushing a page shows it in place of
// the tab content; popping returns to the root. It is a plain array so the rules are pure and
// testable, and the hook that owns the live instance (usePageNav) is the only stateful part.
//
// Deliberately NOT a general router: there are no nested stacks, no params yet, and no page that is
// reachable only via another page. Adding those is a change to this file's contract, not a tweak.

export type PageId = "settings" | "platform" | "museum" | "goals";

export type PageStack = readonly PageId[];

/** Hosted-page titles, so the shell header and the hash encoder agree on what a page is called. */
export const PAGE_TITLES: Record<PageId, string> = {
  settings: "Settings",
  platform: "Platform",
  museum: "Device Museum",
  goals: "Goals",
};

/** Pages that have a render block in the shell TODAY. `PageId` is deliberately wider — the type
 *  names the pages the model will support, while this set is the subset that can actually be shown.
 *  A hash for a declared-but-unwired page must resolve to null, or the shell would hide every root
 *  and render an empty main under a page header. */
export const WIRED_PAGES: readonly PageId[] = ["settings"];

function isWiredPage(v: string): v is PageId {
  return (WIRED_PAGES as readonly string[]).includes(v);
}

/** Push a page. Pushing the page that is already on top is a no-op, so a double-tap cannot deepen
 *  the stack, and the caller can rely on identity to skip a re-render. */
export function pushPage(stack: PageStack, page: PageId): PageStack {
  if (topPage(stack) === page) return stack;
  return [...stack, page];
}

/** Pop the top page. Popping an empty stack is a no-op, so an Escape or back press on a root is safe. */
export function popPage(stack: PageStack): PageStack {
  if (stack.length === 0) return stack;
  return stack.slice(0, -1);
}

export function topPage(stack: PageStack): PageId | null {
  return stack.length ? stack[stack.length - 1] : null;
}

/** `#/settings` -> "settings". Anything unrecognised — including a bare `#`, an empty string, a typo
 *  a player might paste, or a page the model declares but no screen renders yet — resolves to null
 *  (the root), never to a guessed page. */
export function pageFromHash(hash: string): PageId | null {
  const raw = hash.replace(/^#\/?/, "").trim().toLowerCase();
  return raw && isWiredPage(raw) ? raw : null;
}

/** The inverse, so the address bar always names the page that is actually showing. */
export function hashForPage(page: PageId | null): string {
  return page ? `#/${page}` : "#/";
}
