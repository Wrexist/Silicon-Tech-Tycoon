// Every interrupt overlay the game can raise, mounted in one place.
//
// These all used to sit as a bare wall of ~15 sibling tags in AppShell's return, interleaved with the
// FX hosts, the paywall and the sheets — so the single most important question about this app ("what
// can seize the screen, and in what order?") was answered by scanning a list that read like an import
// block. Here the mount list IS the priority list: it's a map over `INTERRUPT_ORDER` itself.
//
// They are also CODE-SPLIT here, which is why each one is gated. Every overlay is a full-screen card
// with its own stylesheet, and in a typical week every single one renders null — the interrupt budget
// allows at most one card per four weeks. Statically imported, that was ~1,300 lines of JSX and ~50 KB
// of CSS sitting in the chunk between tapping the app icon and seeing the office. Each chunk is now
// fetched the first time its card is actually raised, and the service worker has precached it long
// before that (`globPatterns` covers every emitted .js/.css), so on any launch after the first that
// fetch is a disk read.
//
// The gate is `isPending()` — the SAME predicate `higherPriorityPending()` uses, deliberately not a
// second copy. A gate that disagreed with the overlay's own condition would be an interrupt that
// silently never appears again, which is close to unfindable; sharing the predicate makes the bug
// impossible rather than merely tested-for. And because OVERLAY is typed `Record<InterruptKey, …>`,
// adding a stream to `INTERRUPT_ORDER` without giving it an overlay here is a compile error.
//
// Mounted-and-rendering-null and not-mounted are equivalent for these components: every one of them
// short-circuits on `state.pendingX ?? null` before it runs an effect, so the split preserves
// behaviour rather than rewriting the priority rules. Each overlay still decides for itself whether
// to yield to a higher-priority card or to a launch reveal.
import { Suspense, createElement, lazy, type ComponentType, type ReactNode } from "react";
import { useGame } from "../state/useGame.tsx";
import { INTERRUPT_ORDER, isPending, type InterruptKey } from "../design/interruptPriority.ts";
// The Decision Inbox banner stays EAGER, and not by accident: it owns the open/closed lifecycle for
// the low-stakes tier, and its cleanup effect (`if (!key) closeDecision()`) is what stops the next
// decision from auto-opening instead of arriving as a banner. Unmounting it when nothing is pending
// would skip exactly that reset. It is also the smallest file here, so there is nothing to win.
import { DecisionInbox } from "./DecisionInbox.tsx";

const OVERLAY: Record<InterruptKey, ComponentType> = {
  strike: lazy(() => import("./RivalStrike.tsx").then((m) => ({ default: m.RivalStrike }))),
  awards: lazy(() => import("./AwardsCeremony.tsx").then((m) => ({ default: m.AwardsCeremonyOverlay }))),
  rivalry: lazy(() => import("./RivalryDeclared.tsx").then((m) => ({ default: m.RivalryDeclared }))),
  eureka: lazy(() => import("./EurekaMoment.tsx").then((m) => ({ default: m.EurekaMoment }))),
  communityAsk: lazy(() => import("./CommunityAsk.tsx").then((m) => ({ default: m.CommunityAsk }))),
  earnings: lazy(() => import("./EarningsCall.tsx").then((m) => ({ default: m.EarningsCall }))),
  staffMoment: lazy(() => import("./StaffMoment.tsx").then((m) => ({ default: m.StaffMoment }))),
  regionalEvent: lazy(() => import("./RegionalEvent.tsx").then((m) => ({ default: m.RegionalEvent }))),
  licenseOffer: lazy(() => import("./ContractOffer.tsx").then((m) => ({ default: m.ContractOffer }))),
  staffEvent: lazy(() => import("./StaffEvent.tsx").then((m) => ({ default: m.StaffEvent }))),
  postLaunch: lazy(() => import("./PostLaunchEvent.tsx").then((m) => ({ default: m.PostLaunchEvent }))),
  secretReveal: lazy(() => import("./SecretRevealed.tsx").then((m) => ({ default: m.SecretRevealed }))),
};

// The nemesis trophy is an EARNED ceremony with its own bespoke guard rather than a rank in
// INTERRUPT_ORDER (see interruptPriority.ts), so it's gated directly on its own pending field.
const NemesisTrophy = lazy(() => import("./NemesisTrophy.tsx").then((m) => ({ default: m.NemesisTrophy })));

/** Mount `children` only while its card exists. `fallback={null}` because the alternative — a spinner
 *  where a full-screen takeover is about to be — would be worse than the frame it replaces. */
function When({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return null;
  return <Suspense fallback={null}>{children}</Suspense>;
}

export function Interrupts() {
  const { state } = useGame();
  return (
    <>
      {INTERRUPT_ORDER.map((key) => (
        <When key={key} on={isPending(state, key)}>{createElement(OVERLAY[key])}</When>
      ))}
      <When on={state.pendingNemesisTrophy != null}><NemesisTrophy /></When>
      {/* The non-blocking banner that holds whichever inbox-tier card is pending, so those streams
          open on the player's schedule instead of seizing the screen. */}
      <DecisionInbox />
    </>
  );
}
