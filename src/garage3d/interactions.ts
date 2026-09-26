// Tap targets for the office: an employee (→ roster) and the vault/Bank (→ finances). The scene
// keeps the invisible hit meshes; this hook owns the handler wiring so every target stops the
// pointer from reaching the scene behind it and forwards to the host callback.
//
// Item 1 (wave 0): the old always-on "Bank • Tap for finances" pill is gone. A target now reveals
// its prompt only in response to the player — on hover for a real pointer, and on a tap for touch
// (where there is no hover), so discoverability never costs an extra tap. The four states are
// resolved by a pure function (unit-tested): idle = nothing, hover = the pill, selected = the pill
// plus an accent ring (shown while the tap's response is in flight), locked = a desaturated chip
// with no action. No permanent glow lives on anything.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";

export interface HqCallbacks {
  onTapStaff?: (id: string) => void;
  onTapBank?: () => void;
}

/** What an interactive object advertises. `locked` and `upgradeAvailable` are first-class so a
 *  target can express "not yet" and "there is something new here" without a permanent marker. */
export interface InteractionTarget {
  id: string;
  title: string;
  actionLabel: string;
  locked?: boolean;
  upgradeAvailable?: boolean;
}

export type InteractionState = "idle" | "hover" | "selected" | "locked";

/** How long a tap's prompt/ring lingers — long enough to read, short enough to stay out of the way. */
export const PRESS_LINGER_MS = 1400;

/** Pure state resolver. Locked wins (a locked target never advertises an action); a press reads as
 *  SELECTED even while the pointer still hovers, so the tap visibly lands. */
export function interactionStateFor(target: InteractionTarget | null, hoverId: string | null, pressId: string | null): InteractionState {
  if (!target) return "idle";
  if (target.locked) return "locked";
  if (pressId === target.id) return "selected";
  if (hoverId === target.id) return "hover";
  return "idle";
}

/** Touch fires an emulated pointerover on contact; only a real pointing device gets the hover state. */
export function isHoverPointer(pointerType: string | undefined): boolean {
  return pointerType !== "touch";
}

export interface HqInteractions {
  /** Invisible hit mesh of a desk/robot → opens the person's roster card. */
  staffTap: (id: string) => (e: ThreeEvent<MouseEvent>) => void;
  /** The vault → opens the finances popup. */
  bankTap: (e: ThreeEvent<MouseEvent>) => void;
  /** Hover handlers for any target mesh (spread onto the hit mesh). */
  hoverProps: (id: string) => { onPointerOver: (e: ThreeEvent<PointerEvent>) => void; onPointerOut: () => void };
  /** The target whose prompt is live this frame (hover or just-pressed), or null. */
  activeId: string | null;
  /** The target currently showing the SELECTED ring, or null. */
  selectedId: string | null;
}

export function useHqInteractions({ onTapStaff, onTapBank }: HqCallbacks): HqInteractions {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pressId, setPressId] = useState<string | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flash = useCallback((id: string) => {
    setPressId(id);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPressId((p) => (p === id ? null : p)), PRESS_LINGER_MS);
  }, []);

  const hoverProps = useCallback(
    (id: string) => ({
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        if (!isHoverPointer(e.nativeEvent.pointerType)) return;
        setHoverId(id);
      },
      onPointerOut: () => setHoverId((h) => (h === id ? null : h)),
    }),
    [],
  );

  const staffTap = useCallback(
    (id: string) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      flash(id);
      onTapStaff?.(id);
    },
    [flash, onTapStaff],
  );
  const bankTap = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      flash("bank");
      onTapBank?.();
    },
    [flash, onTapBank],
  );

  return { staffTap, bankTap, hoverProps, activeId: pressId ?? hoverId, selectedId: pressId };
}
