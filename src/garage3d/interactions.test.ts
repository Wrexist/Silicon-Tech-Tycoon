// Contract tests for the interaction state machine. Pure functions only — the scene's visuals are
// verified by the capture harness; what a frame cannot pin is the RULE (nothing at idle, hover beats
// idle, a tap reads as selected, a locked target never advertises an action, touch has no hover).
import { describe, expect, it } from "vitest";
import { interactionStateFor, isHoverPointer, type InteractionTarget } from "./interactions.ts";

const bank: InteractionTarget = { id: "bank", title: "Bank", actionLabel: "Tap for finances" };
const vault: InteractionTarget = { id: "vault", title: "Vault", actionLabel: "Tap for finances", locked: true };

describe("office interactions — state machine", () => {
  it("is idle with no target, no hover and no press", () => {
    expect(interactionStateFor(null, null, null)).toBe("idle");
    expect(interactionStateFor(bank, null, null)).toBe("idle");
  });

  it("shows hover only for the hovered target", () => {
    expect(interactionStateFor(bank, "bank", null)).toBe("hover");
    expect(interactionStateFor(bank, "someone-else", null)).toBe("idle");
  });

  it("reads a press as selected, even while the pointer still hovers", () => {
    expect(interactionStateFor(bank, "bank", "bank")).toBe("selected");
    expect(interactionStateFor(bank, null, "bank")).toBe("selected");
  });

  it("never advertises an action on a locked target", () => {
    expect(interactionStateFor(vault, "vault", null)).toBe("locked");
    expect(interactionStateFor(vault, "vault", "vault")).toBe("locked");
  });

  it("treats only real pointing devices as hover-capable", () => {
    expect(isHoverPointer("mouse")).toBe(true);
    expect(isHoverPointer("pen")).toBe(true);
    expect(isHoverPointer("touch")).toBe(false);
    expect(isHoverPointer(undefined)).toBe(true);
  });
});
