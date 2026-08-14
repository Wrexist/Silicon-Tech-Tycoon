// Every interrupt overlay the game can raise, mounted in one place.
//
// These all used to sit as a bare wall of ~15 sibling tags in AppShell's return, interleaved with the
// FX hosts, the paywall and the sheets — so the single most important question about this app ("what
// can seize the screen, and in what order?") was answered by scanning a list that read like an import
// block. They're gathered here instead, in the same order as `design/interruptPriority.ts` declares
// their priority, so the mount list and the priority list can be read against each other.
//
// Every overlay below is self-gating: it reads its own `pendingX` off the game state and returns null
// when it isn't up, and asks `higherPriorityPending()` whether something above it is. Mounting them is
// therefore free — nothing renders until the engine raises its card — and the order of the JSX is
// documentation, not behaviour.
import { RivalStrike } from "./RivalStrike.tsx";
import { AwardsCeremonyOverlay } from "./AwardsCeremony.tsx";
import { RivalryDeclared } from "./RivalryDeclared.tsx";
import { EurekaMoment } from "./EurekaMoment.tsx";
import { CommunityAsk } from "./CommunityAsk.tsx";
import { EarningsCall } from "./EarningsCall.tsx";
import { StaffMoment } from "./StaffMoment.tsx";
import { RegionalEvent } from "./RegionalEvent.tsx";
import { ContractOffer } from "./ContractOffer.tsx";
import { StaffEvent } from "./StaffEvent.tsx";
import { PostLaunchEvent } from "./PostLaunchEvent.tsx";
import { SecretRevealed } from "./SecretRevealed.tsx";
import { NemesisTrophy } from "./NemesisTrophy.tsx";
import { DecisionInbox } from "./DecisionInbox.tsx";

export function Interrupts() {
  return (
    <>
      {/* Takeover tier — genuine branching stakes, in INTERRUPT_ORDER. */}
      <RivalStrike />
      <AwardsCeremonyOverlay />
      <ContractOffer />
      {/* Earned ceremonies — the reward is already banked, so these are exempt from the interrupt
          budget but still yield to anything that needs an answer. */}
      <NemesisTrophy />
      <SecretRevealed />
      {/* Inbox tier — low-stakes streams. Each of these renders its own full card only once the
          player opens it from the Decision Inbox banner below; until then they stay out of the way. */}
      <RivalryDeclared />
      <EurekaMoment />
      <CommunityAsk />
      <EarningsCall />
      <StaffMoment />
      <RegionalEvent />
      <StaffEvent />
      <PostLaunchEvent />
      {/* The non-blocking banner that holds whichever inbox-tier card is pending, so those streams
          open on the player's schedule instead of seizing the screen. */}
      <DecisionInbox />
    </>
  );
}
