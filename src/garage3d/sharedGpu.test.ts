import { describe, expect, it } from "vitest";
import { DoubleSide, ExtrudeGeometry, FrontSide } from "three";
import {
  sharedBasic, sharedBox, sharedPhysical, sharedRounded, sharedStandard,
} from "./sharedGpu.ts";

// The whole point of the pool: same args → the SAME GPU object; any differing arg → its own.
describe("sharedGpu pooling", () => {
  it("returns the identical geometry instance for identical args", () => {
    expect(sharedBox(1, 2, 3)).toBe(sharedBox(1, 2, 3));
    expect(sharedBox(1, 2, 3)).not.toBe(sharedBox(1, 2, 3.0001));
  });

  it("pools materials by every keyed prop — side included", () => {
    const a = sharedStandard({ color: "#123456", roughness: 0.5 });
    expect(sharedStandard({ color: "#123456", roughness: 0.5 })).toBe(a);
    // side must key: one caller wanting DoubleSide must never mutate another's FrontSide material
    expect(sharedStandard({ color: "#123456", roughness: 0.5, side: DoubleSide })).not.toBe(a);
    expect(a.side).toBe(FrontSide);
  });

  it("pools basic and physical materials with their own key sets", () => {
    const b = sharedBasic({ color: "#abc", transparent: true, opacity: 0.5 });
    expect(sharedBasic({ color: "#abc", transparent: true, opacity: 0.5 })).toBe(b);
    expect(sharedBasic({ color: "#abc", transparent: true, opacity: 0.5, wireframe: true })).not.toBe(b);
    const g = sharedPhysical({ color: "#def", transmission: 0.6 });
    expect(sharedPhysical({ color: "#def", transmission: 0.6 })).toBe(g);
    expect(g.transmission).toBe(0.6);
  });

  it("never passes undefined params into a material (three warns per undefined key)", () => {
    // A material built from a sparse prop set keeps three's own defaults for the omitted keys.
    const m = sharedStandard({ color: "#654321" });
    expect(m.roughness).toBe(1); // three's MeshStandardMaterial default, not undefined
    expect(m.metalness).toBe(0);
  });

  it("builds rounded boxes drei-exactly (centred extrude) with drei's defaults", () => {
    const g = sharedRounded(0.6, 0.4, 0.2, 4, 0.05);
    expect(sharedRounded(0.6, 0.4, 0.2, 4, 0.05)).toBe(g);
    expect(g).toBeInstanceOf(ExtrudeGeometry);
    // centred: the bounding box must straddle the origin symmetrically on every axis
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    expect(bb.max.x + bb.min.x).toBeCloseTo(0, 5);
    expect(bb.max.y + bb.min.y).toBeCloseTo(0, 5);
    expect(bb.max.z + bb.min.z).toBeCloseTo(0, 5);
    // ...and span the full authored dimensions
    expect(bb.max.x - bb.min.x).toBeCloseTo(0.6, 3);
    expect(bb.max.y - bb.min.y).toBeCloseTo(0.4, 3);
    expect(bb.max.z - bb.min.z).toBeCloseTo(0.2, 3);
    // smoothness/radius default like drei's <RoundedBox> (4 / 0.05) so omitted JSX props convert 1:1
    expect(sharedRounded(0.6, 0.4, 0.2)).toBe(sharedRounded(0.6, 0.4, 0.2, 4, 0.05));
  });
});
