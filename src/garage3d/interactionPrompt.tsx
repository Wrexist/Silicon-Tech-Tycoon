// The office interaction prompt — the ONE floating chip a target shows while the player is engaging
// it (hover, or the moment after a tap on touch). Extracted from Garage3D so the scene file does not
// grow. Colours are scene-constant like the old label pill: it must read dark-on-white over the 3D
// room in both app themes, so it can't ride the theme ink tokens. Interaction blue is the game's
// accent; the locked chip desaturates the same dot to grey.
import { Html } from "@react-three/drei";
import { interactionStateFor, type InteractionState, type InteractionTarget } from "./interactions.ts";

const CHIP_BG = "rgba(255,255,255,0.94)";
const CHIP_INK = "#1a1d23";
const CHIP_INK_SOFT = "#6b7280";
const ACCENT = "#3b82f6"; // interaction blue — the same accent the builder uses for selection
const LOCKED = "#9aa0a6";

export function InteractionPrompt({ pos, title, action, state }: { pos: [number, number, number]; title: string; action: string; state: InteractionState }) {
  if (state === "idle") return null;
  const dot = state === "locked" ? LOCKED : ACCENT;
  return (
    <Html position={pos} center zIndexRange={[25, 0]} style={{ pointerEvents: "none", userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", background: CHIP_BG, borderRadius: 999, boxShadow: "0 1px 6px rgba(40,60,90,0.18)", whiteSpace: "nowrap", backdropFilter: "blur(4px)", transform: "translateY(-140%)", fontFamily: "system-ui,-apple-system,sans-serif", opacity: state === "locked" ? 0.75 : 1 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />
        <span style={{ fontSize: "var(--fs-micro)", fontWeight: 700, color: CHIP_INK, lineHeight: 1.2 }}>{title}</span>
        <span style={{ fontSize: "var(--fs-nano)", fontWeight: 600, color: CHIP_INK_SOFT, lineHeight: 1.2 }}>{state === "locked" ? "Locked" : action}</span>
      </div>
    </Html>
  );
}

/** The one-line call site form: resolves the target's state and renders the chip + ring for it, so
 *  the scene only carries a single element per interactive object. */
export function TargetPrompt({ pos, target, activeId, selectedId, r }: { pos: [number, number, number]; target: InteractionTarget; activeId: string | null; selectedId: string | null; r?: number }) {
  const state = interactionStateFor(target, activeId, selectedId);
  return (
    <>
      <InteractionPrompt pos={pos} title={target.title} action={target.actionLabel} state={state} />
      <SelectionRing state={state} r={r} />
    </>
  );
}

/** The SELECTED state's accent outline: a thin ring on the floor under the target. Rendered only
 *  while the state is selected, so nothing glows at rest. */
export function SelectionRing({ state, r = 0.8 }: { state: InteractionState; r?: number }) {
  if (state !== "selected") return null;
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}>
      <ringGeometry args={[r, r + 0.06, 40]} />
      <meshBasicMaterial color={ACCENT} transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}
