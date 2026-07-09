// Cascading events (Track B): some market events are not one-shots but the FIRST beat of a chain.
// A chain plays out over several weeks: an opening consequence fires now, later beats are scheduled,
// and the chain ends in a player CHOICE, so the world reacts and remembers instead of forgetting.
// PURE: this is the catalog + selection only; the state layer applies each beat's effect.
import { BALANCE } from "./balance.ts";
import type { ChoiceEvent, EventEffect } from "./events.ts";
import type { Rng } from "./rng.ts";

type Tone = "positive" | "negative" | "neutral" | "accent";

/** A beat whose effect is applied automatically when it fires. */
export interface ChainEffectStep {
  kind: "effect";
  title: string;
  tone: Tone;
  effect: EventEffect;
  delayWeeks: number; // weeks after the previous beat (ignored for step 0)
}
/** A terminal beat that hands off to the player-choice system; the chain ends here. */
export interface ChainChoiceStep {
  kind: "choice";
  delayWeeks: number;
  choice: ChoiceEvent;
}
export type ChainStep = ChainEffectStep | ChainChoiceStep;

export interface EventChain {
  id: string;
  minEra: number;
  steps: ChainStep[]; // steps[0] must be an effect beat (fires on trigger)
}

export const EVENT_CHAINS: EventChain[] = [
  {
    id: "recall-ripple",
    minEra: 1,
    steps: [
      { kind: "effect", tone: "positive", delayWeeks: 0,
        title: "A major rival recalled its flagship. The whole category suddenly looks shaky.",
        effect: { kind: "rivalScandal", factor: 0.55 } },
      { kind: "effect", tone: "negative", delayWeeks: 3,
        title: "The recall set off an industry-wide parts shortage, and your costs spiked with it.",
        effect: { kind: "supplyCrunch", cash: 14_000 } },
      { kind: "choice", delayWeeks: 3, choice: {
        id: "chain-recall-talent",
        title: "Talent on the Market",
        body: "The recalled rival is shedding engineers. You can poach their best, or back the people who got you here.",
        minEra: 1,
        tone: "accent",
        options: [
          { id: "poach", label: "Poach their best", description: "A wave of seasoned talent lands in your lab, research leaps ahead.", effect: { kind: "rpBonus", amount: 40 } },
          { id: "loyal", label: "Back your own people", description: "Promote from within instead. The whole team feels seen.", effect: { kind: "talentWave", mood: 12 } },
        ],
      } },
    ],
  },
  {
    id: "viral-spiral",
    minEra: 2,
    steps: [
      { kind: "effect", tone: "positive", delayWeeks: 0,
        title: "A clip of your product blew up overnight, and fans are pouring in.",
        effect: { kind: "fansBonus", fans: 1_600 } },
      { kind: "effect", tone: "negative", delayWeeks: 2,
        title: "The surge overwhelmed support; a backlog of frustrated buyers soured the mood.",
        effect: { kind: "burnout", mood: -8 } },
      { kind: "choice", delayWeeks: 2, choice: {
        id: "chain-viral-ride",
        title: "Ride the Wave?",
        body: "The moment is still hot. Pour cash into the spotlight while it lasts, or let it cool and shore up support first.",
        minEra: 2,
        tone: "accent",
        options: [
          { id: "double", label: "Double down", description: "Throw fuel on the fire with a campaign. The fanbase swells.", effect: { kind: "fansBonus", fans: 2_600 } },
          { id: "steady", label: "Steady the ship", description: "Fix support and let the hype settle. Buyers respect the follow-through.", effect: { kind: "repBoost", rep: 5 } },
        ],
      } },
    ],
  },
  {
    id: "supply-shock",
    minEra: 1,
    steps: [
      { kind: "effect", tone: "negative", delayWeeks: 0,
        title: "A key supplier's plant went dark overnight — parts got scarce and pricey.",
        effect: { kind: "supplyCrunch", cash: 9_000 } },
      { kind: "effect", tone: "positive", delayWeeks: 3,
        title: "You'd quietly stockpiled ahead of the crunch; rivals scrambled while your lines kept moving.",
        effect: { kind: "repBoost", rep: 3 } },
      { kind: "choice", delayWeeks: 2, choice: {
        id: "chain-supply-lockin",
        title: "Lock In Supply?",
        body: "The shortage exposed how fragile your sourcing is. Sign a long-term deal for stability, or stay nimble and cheap.",
        minEra: 1,
        tone: "accent",
        options: [
          { id: "contract", label: "Sign a long-term deal", description: "Guaranteed parts and a steadier reputation for reliability.", effect: { kind: "repBoost", rep: 4 } },
          { id: "flexible", label: "Stay flexible", description: "Keep your options — and your cash — open. The team gets creative with sourcing.", effect: { kind: "rpBonus", amount: 22 } },
        ],
      } },
    ],
  },
  {
    id: "counterfeit-surge",
    minEra: 2,
    steps: [
      { kind: "effect", tone: "negative", delayWeeks: 0,
        title: "Convincing counterfeits of your best-seller flooded gray markets — some sales bled away.",
        effect: { kind: "supplyCrunch", cash: 12_000 } },
      { kind: "effect", tone: "positive", delayWeeks: 2,
        title: "Ironically, being the one everyone copies made your brand the name to beat — buzz spiked.",
        effect: { kind: "fansBonus", fans: 1_800 } },
      { kind: "choice", delayWeeks: 2, choice: {
        id: "chain-counterfeit-fight",
        title: "Fight the Fakes?",
        body: "The knockoffs aren't going away on their own. Lawyer up and defend the brand, or simply out-build them.",
        minEra: 2,
        tone: "accent",
        options: [
          { id: "sue", label: "Take them to court", description: "A public win for authenticity — customers trust the real thing more.", effect: { kind: "repBoost", rep: 5 } },
          { id: "innovate", label: "Out-innovate them", description: "Pour the energy into the next leap instead. Let the copies chase your taillights.", effect: { kind: "rpBonus", amount: 32 } },
        ],
      } },
    ],
  },
  {
    id: "standards-war",
    minEra: 3,
    steps: [
      { kind: "effect", tone: "accent", delayWeeks: 0,
        title: "A consortium is forming around a new industry standard, and everyone wants your name on it.",
        effect: { kind: "fansBonus", fans: 1_400 } },
      { kind: "effect", tone: "negative", delayWeeks: 3,
        title: "Committee politics dragged on for weeks and quietly drained your engineers' focus.",
        effect: { kind: "burnout", mood: -6 } },
      { kind: "choice", delayWeeks: 2, choice: {
        id: "chain-standards-pick",
        title: "Which Standard Do You Champion?",
        body: "You have the clout to tip the outcome. Back the open standard for goodwill, or push your own for a proprietary edge.",
        minEra: 3,
        tone: "accent",
        options: [
          { id: "open", label: "Back the open standard", description: "The industry applauds a rare act of generosity. Your reputation swells.", effect: { kind: "repBoost", rep: 6 } },
          { id: "proprietary", label: "Push your own", description: "If it sticks, everyone builds on your terms. Your labs race to make it undeniable.", effect: { kind: "rpBonus", amount: 45 } },
        ],
      } },
    ],
  },
];

export function chainById(id: string): EventChain | undefined {
  return EVENT_CHAINS.find((c) => c.id === id);
}

/** Maybe start a chain in an event window (gated by chainChance). Draws rng deterministically:
 *  always one `next` gate, plus one `int` selection when it fires. Returns null most windows. */
export function pickChain(rng: Rng, era: number): EventChain | null {
  if (rng.next() >= BALANCE.events.chainChance) return null;
  const pool = EVENT_CHAINS.filter((c) => c.minEra <= era);
  if (pool.length === 0) return null;
  return pool[rng.int(pool.length)];
}
