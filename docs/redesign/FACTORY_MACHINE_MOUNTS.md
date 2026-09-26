# Conveyor working-head correction — 2026-09-24

The simulation treats machines beside a connected belt as participating equipment. The previous renderer placed each complete model at the centre of its saved footprint, leaving presses and scanners visibly operating beside the product path.

The renderer now derives an adjacent conveyor working point for each machine. It prefers straight segments, separate stations and the actual intake-to-packer route. CNC, board-press, screen-bonding and QA working heads sit over that conveyor and rotate with its direction. A service cabinet, mast and overhead support stay attached to the saved footprint. Side legs are omitted on mounted heads so adjacent conveyors remain clear. Assembly arms move toward the edge of their existing footprint to shorten their reach. Remote machinery remains unconnected.

Placement previews use the same mount calculation. Picking the head or its service cabinet selects the same owned machine. No saved machine coordinates, belt tiles, ownership, production balance or routing rules are rewritten. This is a correction to real 3D geometry and its connection to the existing simulation, not a replacement background image.

The floor grid now matches the rectangular building instead of extending outside its walls.

Validation: 207 test files / 2,149 tests passed. New tests cover adjacency, route isolation, orientation, station separation and unchanged saved coordinates. Production build and final typecheck passed. Browser captures produced no page errors; the floor capture was visually inspected. Captures are in `artifacts/factory-machine-mounts/`; the previous matching viewport is in `artifacts/factory-continuation/after/`. These use staged companies and Chromium software rendering. The game-dev CLI/adapter is unavailable, so the existing Playwright capture harness is used; no device-performance claim is made.
