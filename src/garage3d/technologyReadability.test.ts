import { describe, expect, it } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { FurniturePiece } from "./furniture3d";
import { modelFor } from "./furnitureModels";
import { roomPalette } from "./palette";

// Check the actual procedural component, so a recessed screen cannot silently become
// hidden inside its housing again. This is geometry correctness, not a brightness threshold.
describe("arcade screen clearance", () => {
  it.each([true, false])("keeps the tilted screen clear of its housing (dark=%s)", (dark) => {
    expect(modelFor("arcade")).toBeUndefined();
    const piece = (FurniturePiece as unknown as { type: Function }).type({ type: "arcade", p: roomPalette(dark) });
    const group = piece.type(piece.props) as ReactElement<{ children: ReactElement<any>[] }>;
    const meshes = group.props.children.filter(isValidElement) as ReactElement<any>[];
    const body = meshes[0];
    const screen = meshes[1];
    body.props.geometry.computeBoundingBox();
    const frontZ = body.props.geometry.boundingBox.max.z;
    const halfHeight = screen.props.geometry.parameters.height / 2;
    const nearestZ = screen.props.position[2] - Math.abs(Math.sin(screen.props["rotation-x"])) * halfHeight;
    expect(nearestZ).toBeGreaterThan(frontZ);
  });
});

