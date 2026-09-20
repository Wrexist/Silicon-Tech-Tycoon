// The game-owned dressing layer: the room's own lounge / storage / culture furniture, arranged by
// `officeArrangement` around whatever the player has placed. Presentation-only — nothing here is
// written to `state.layout`, nothing is tappable, and the engine never reads it. A zone the player
// has furnished is skipped by the arranger, so their room is never redecorated for them.
//
// The arrangement is computed once per relevant state change (tier, headcount, the player's layout,
// theme, upgrades) and memoized; nothing here allocates per frame. The cosmetic (seed, week) that
// picks the culture accent's row is read at compute time from the live-office singleton, so the same
// week always lays out the same room.
import { memo, useMemo } from "react";
import { worldOf, type PlacedItem } from "../engine/furniture.ts";
import type { OfficeConfig } from "./officeConfig.ts";
import { FurniturePiece } from "./furniture3d.tsx";
import { arrangeOffice, derivedYawFor } from "./officeArrangement.ts";
import { officeSeed, officeWeek } from "./officeLive.ts";
import type { RoomPalette } from "./palette.ts";

const NO_LAYOUT: readonly PlacedItem[] = [];

export const OfficeDressing = memo(function OfficeDressing({
  p,
  cfg,
  dark,
  headcount,
  layout,
}: {
  p: RoomPalette;
  cfg: OfficeConfig;
  dark: boolean;
  headcount: number;
  /** The player's layout. Absent (the decorative hero) means an empty room to dress. */
  layout?: readonly PlacedItem[];
}) {
  const arrangement = useMemo(
    () =>
      arrangeOffice({
        facilityTier: cfg.facilityTier,
        headcount,
        occupied: layout ?? NO_LAYOUT,
        dark,
        amenities: cfg.amenityTier,
        designSuite: cfg.showEasel,
        testLab: cfg.showTestChamber,
        seed: officeSeed(),
        week: officeWeek(),
      }),
    [cfg.facilityTier, cfg.amenityTier, cfg.showEasel, cfg.showTestChamber, headcount, layout, dark],
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
