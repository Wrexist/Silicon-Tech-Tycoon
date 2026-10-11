// The game-owned dressing layer: the room's own lounge / storage / culture furniture, arranged by
// `officeArrangement` around whatever the player has placed. Presentation-only — nothing here is
// written to `state.layout`, nothing is tappable, and the engine never reads it. A zone the player
// has furnished is skipped by the arranger, so their room is never redecorated for them.
//
// The arrangement is computed once per relevant state change (tier, headcount, the player's layout,
// theme, upgrades, the run's seed and era) and memoized; nothing here allocates per frame. The scene
// normally hands in the arrangement it already built (`arrangement`); the fallback folds the same
// (seed, era) props, so a run keeps one room until an era advance.
import { memo, useMemo } from "react";
import { worldOf, type PlacedItem } from "../engine/furniture.ts";
import type { OfficeConfig } from "./officeConfig.ts";
import { FurniturePiece } from "./furniture3d.tsx";
import { arrangeOffice, derivedYawFor } from "./officeArrangement.ts";
import type { RoomPalette } from "./palette.ts";

const NO_LAYOUT: readonly PlacedItem[] = [];

export const OfficeDressing = memo(function OfficeDressing({
  p,
  cfg,
  dark,
  headcount,
  layout,
  arrangement: supplied,
  seed = 0,
  era = 0,
}: {
  p: RoomPalette;
  cfg: OfficeConfig;
  dark: boolean;
  headcount: number;
  /** The player's layout. Absent (the decorative hero) means an empty room to dress. */
  layout?: readonly PlacedItem[];
  arrangement?: ReturnType<typeof arrangeOffice>;
  seed?: number;
  era?: number;
}) {
  const arrangement = useMemo(
    () =>
      supplied ?? arrangeOffice({
        facilityTier: cfg.facilityTier,
        headcount,
        occupied: layout ?? NO_LAYOUT,
        dark,
        amenities: cfg.amenityTier,
        designSuite: cfg.showEasel,
        testLab: cfg.showTestChamber,
        monitors: cfg.monitors,
        seed,
        era,
      }),
    [supplied, cfg.facilityTier, cfg.amenityTier, cfg.showEasel, cfg.showTestChamber, cfg.monitors, headcount, layout, dark, seed, era],
  );

  return (
    <group>
      {arrangement.dressing.map((piece) => {
        const w = worldOf(piece, cfg.facilityTier);
        return (
          <group key={piece.iid} position={[w.x, 0, w.z]} rotation-y={derivedYawFor(piece, arrangement.pieces, cfg.facilityTier)}>
            <FurniturePiece type={piece.type} p={p} />
          </group>
        );
      })}
    </group>
  );
});
