import { describe, expect, it } from "vitest";
import { DEVELOPMENT_STAGES, developmentStage, type DevelopmentDraft } from "./developmentStage.ts";

const draft = (over: Partial<DevelopmentDraft> = {}): DevelopmentDraft => ({
  designStarted: false,
  componentsChosen: false,
  prototypeRun: false,
  building: false,
  ...over,
});

describe("developmentStage", () => {
  it("starts at concept before anything is chosen", () => {
    expect(developmentStage(draft())).toEqual({ stage: "concept", index: 0 });
  });

  it("reads design once choosing has begun but slots remain", () => {
    expect(developmentStage(draft({ designStarted: true }))).toEqual({ stage: "design", index: 1 });
  });

  it("reaches components once every slot is chosen, before any prototype", () => {
    expect(developmentStage(draft({ designStarted: true, componentsChosen: true })))
      .toEqual({ stage: "components", index: 2 });
  });

  it("reaches testing once a prototype has been run", () => {
    expect(developmentStage(draft({ componentsChosen: true, prototypeRun: true })))
      .toEqual({ stage: "testing", index: 3 });
  });

  it("reaches finalize while a build is underway", () => {
    expect(developmentStage(draft({ componentsChosen: true, prototypeRun: true, building: true })))
      .toEqual({ stage: "finalize", index: 4 });
  });

  it("is a lens, not a gate: a build underway wins even when a prototype was skipped", () => {
    expect(developmentStage(draft({ componentsChosen: true, building: true })).stage).toBe("finalize");
  });

  it("lists the five pipeline stages in order", () => {
    expect(DEVELOPMENT_STAGES.map((s) => s.stage)).toEqual(["concept", "design", "components", "testing", "finalize"]);
    expect(DEVELOPMENT_STAGES.map((s) => s.label)).toEqual(["Concept", "Design", "Components", "Testing", "Finalize"]);
  });
});
