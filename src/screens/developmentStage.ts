// The Development Stage lens — a PURE read of where a design draft sits in the design pipeline.
// It is a lens, never a gate: it never blocks a build, requires no state of its own, and every stage
// is reachable by ordinary progress (Testing included). It reads only facts the draft already carries.

export type DevelopmentStage = "concept" | "design" | "components" | "testing" | "finalize";

/** The five pipeline steps, in order. `index` in `developmentStage` is this array's position. */
export const DEVELOPMENT_STAGES: readonly { stage: DevelopmentStage; label: string }[] = [
  { stage: "concept", label: "Concept" },
  { stage: "design", label: "Design" },
  { stage: "components", label: "Components" },
  { stage: "testing", label: "Testing" },
  { stage: "finalize", label: "Finalize" },
];

/** The draft facts the lens reads — already present on a draft, so nothing new is simulated. */
export interface DevelopmentDraft {
  /** At least one component slot has been chosen (the draft has moved past a blank concept). */
  designStarted: boolean;
  /** Every required component slot for the category has a tier chosen. */
  componentsChosen: boolean;
  /** A Test Prototype has been run against this draft. */
  prototypeRun: boolean;
  /** A production build for this draft is underway. */
  building: boolean;
}

/** Which stage a draft is at. Later stages win (a build underway reads Finalize even if a prototype
 *  was skipped). Deterministic and total; it never implies an action is required. */
export function developmentStage(draft: DevelopmentDraft): { stage: DevelopmentStage; index: number } {
  const stage: DevelopmentStage =
    draft.building ? "finalize"
    : draft.prototypeRun ? "testing"
    : draft.componentsChosen ? "components"
    : draft.designStarted ? "design"
    : "concept";
  return { stage, index: DEVELOPMENT_STAGES.findIndex((s) => s.stage === stage) };
}
