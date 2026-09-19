// The office camera rig: parallax + WASD orbit/dolly, idle breathing drift (suppressed under
// Reduce Motion) and the settle path that stops writing the camera once it has come to rest.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { roomScaleFor } from "./officeConfig.ts";

// Build mode lifts the camera to a higher, more overhead angle so the whole floor grid is
// readable; otherwise it's the cozy parallax view. WASD lets the player drive the view:
// A/D orbit around the room, W/S zoom in/out, Q/E (or R/F) raise/lower the eye height.
const CAM_ZOOM_MIN = -6;
const CAM_ZOOM_MAX = 13;
// Seconds of no input (no movement key, no pointer travel) before the idle "breathing" camera drift
// ramps in. Kept generous so it never fights an active viewer — it's a screensaver for an office
// left alone, and collapses back to zero the instant the controls are touched (so `settled` fires).
const IDLE_DRIFT_DELAY = 6;
// Shared camera dolly offset (in the same units as baseR): written by both the W/S keys and the
// pinch-to-zoom handler, read by CameraRig every frame. A plain module singleton (no React state) so
// the render loop stays allocation-free and the DOM touch handler can drive it without re-renders.
// Mirrors the hqReaction event-bus pattern used elsewhere in this scene.
let camZoomOffset = 0;
function getCamZoom(): number { return camZoomOffset; }
function setCamZoom(v: number): void { camZoomOffset = Math.max(CAM_ZOOM_MIN, Math.min(CAM_ZOOM_MAX, v)); }

export function CameraRig({ build = false, facilityTier = 1, still = false }: { build?: boolean; facilityTier?: number; still?: boolean }) {
  const { camera, pointer } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 1.5, 0), []);
  const keys = useRef<Set<string>>(new Set());
  const orbit = useRef({ yaw: 0, lift: 0 }); // player camera offsets (zoom lives in the shared singleton)
  const lastPointer = useRef({ x: 0, y: 0 }); // for the settle check
  const idleT = useRef(0); // seconds since the last input — drives the idle breathing drift

  // Each mode (decorate vs. normal) has its own default framing, so reset the dolly when the mode
  // flips, otherwise a big pinch-out in Decorate would leave the normal office zoomed out too.
  useEffect(() => { setCamZoom(0); }, [build]);

  useEffect(() => {
    const MOVE = new Set(["w", "a", "s", "d", "q", "e", "r", "f"]);
    const typing = () => {
      const el = document.activeElement;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
    };
    const down = (ev: KeyboardEvent) => {
      const key = ev.key.toLowerCase();
      if (!MOVE.has(key) || typing()) return;
      keys.current.add(key);
    };
    const up = (ev: KeyboardEvent) => keys.current.delete(ev.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useFrame((st, dt) => {
    // Apply held keys to the orbit offsets (frame-rate independent).
    const ks = keys.current;
    const o = orbit.current;
    const rotSpd = dt * 1.5;
    const zoomSpd = dt * 6;
    const liftSpd = dt * 5;
    if (ks.has("a")) o.yaw -= rotSpd;
    if (ks.has("d")) o.yaw += rotSpd;
    if (ks.has("w")) setCamZoom(getCamZoom() - zoomSpd); // closer
    if (ks.has("s")) setCamZoom(getCamZoom() + zoomSpd); // farther
    if (ks.has("q") || ks.has("r")) o.lift = Math.min(7, o.lift + liftSpd); // higher
    if (ks.has("e") || ks.has("f")) o.lift = Math.max(-3, o.lift - liftSpd); // lower

    // Input detection (also drives the settle saver below). Any held movement key or pointer travel
    // counts as active use and zeroes the idle timer. (`pointer` is the live object from useThree.)
    const keyHeld = ks.size > 0;
    const pointerStill =
      Math.abs(pointer.x - lastPointer.current.x) < 1e-4 && Math.abs(pointer.y - lastPointer.current.y) < 1e-4;
    lastPointer.current.x = pointer.x;
    lastPointer.current.y = pointer.y;
    if (keyHeld || !pointerStill) idleT.current = 0; else idleT.current += dt;

    // Idle breathing drift: after IDLE_DRIFT_DELAY of no input, add a very slow yaw/height sway so an
    // unattended office feels alive. The offset is EXACTLY zero until then (ramped in over ~3s), so the
    // `settled` early-return below still fires the instant the camera reaches its resting pose after any
    // interaction — the drift only spends frames once the viewer has truly walked away, and collapses
    // back to zero (letting the camera re-settle) the moment the controls are touched again.
    // `still` (Reduce Motion) pins the drift OFF. This is the one animation in the office that moves
    // the whole viewport, which is what prefers-reduced-motion is actually about — the rest of the
    // scene's life is small, object-scale fidgeting that stays. Zeroing driftK here (rather than
    // skipping the block) keeps the `settled` early-return below working exactly as it did.
    const driftK = still ? 0 : Math.max(0, Math.min(1, (idleT.current - IDLE_DRIFT_DELAY) / 3));
    let driftYaw = 0, driftLift = 0;
    if (driftK > 0) {
      const e = st.clock.elapsedTime;
      driftYaw = Math.sin(e * 0.13) * 0.018 * driftK;
      driftLift = Math.sin(e * 0.09) * 0.14 * driftK;
    }

    const k = Math.min(1, dt * 2.5);
    // Decorate view was framed close (baseR ≈ 10.6) for precise placement, but that cropped the
    // room's edges off-screen (and the shop panel hides the front row), so furniture near the walls
    // was unreachable. Pull back + raise the angle so the WHOLE grid sits in the visible area above
    // the panel; W/S (or a pinch, if added) still let you dolly in for fine placement.
    const px = build ? 9.5 : 15.5;
    const py = build ? 13.6 : 13.0;
    const pz = build ? 12.5 : 17.5;
    const ty = build ? 0.5 : 0.7;

    // Convert the base offset to an orbit (radius + azimuth) so A/D rotates around the room
    // and W/S dollies in/out, while pointer parallax + smoothing are preserved. The radius scales
    // with the facility so a bigger office (Studio/Campus) is framed whole, not cropped.
    const baseR = Math.hypot(px, pz) * roomScaleFor(facilityTier);
    const r = Math.max(4, baseR + getCamZoom());
    const ang = Math.atan2(px, pz) + o.yaw + driftYaw;
    const desiredX = Math.sin(ang) * r + pointer.x * (build ? 0.5 : 1.3);
    const desiredZ = Math.cos(ang) * r;
    const desiredY = Math.max(1.2, py + o.lift + driftLift - pointer.y * (build ? 0.3 : 0.9));

    // Settle: if no movement key is held, the pointer hasn't moved, and we're already within
    // epsilon of where we want to be, stop writing camera.position/lookAt to save battery. When the
    // idle drift is active `desired` keeps moving, so this naturally stays awake to animate it; the
    // moment input resumes, driftYaw/driftLift return to 0 and the camera settles as before.
    const dx = desiredX - camera.position.x;
    const dy = desiredY - camera.position.y;
    const dz = desiredZ - camera.position.z;
    const settled = dx * dx + dy * dy + dz * dz < 1e-6 && Math.abs(ty - target.y) < 1e-3;
    if (!keyHeld && pointerStill && settled) return;

    camera.position.x += dx * k;
    camera.position.y += dy * k;
    camera.position.z += dz * k;
    target.y += (ty - target.y) * k;
    camera.lookAt(target);
  });
  return null;
}

// Pinch-to-zoom: a two-finger gesture on the canvas dollies the camera in/out via the shared zoom
// offset. Single-finger gestures are untouched (they still pan / drag furniture). Listeners are
// non-passive so the pinch can preventDefault the browser's native page zoom; only acts on exactly
// two active touches, so it never fights a one-finger drag.
export function PinchZoom() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    let active = false;
    let startDist = 0;
    let startZoom = 0;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        active = true;
        startDist = dist(e.touches);
        startZoom = getCamZoom();
      }
    };
    const move = (e: TouchEvent) => {
      if (!active || e.touches.length !== 2) return;
      e.preventDefault(); // own the pinch, stop the page's native zoom/scroll under it
      const d = dist(e.touches);
      // Spreading the fingers (d > startDist) reduces the offset → camera dollies closer (zoom in);
      // pinching together pushes it farther (zoom out). 0.04 maps finger travel to a comfortable range.
      setCamZoom(startZoom + (startDist - d) * 0.04);
    };
    const end = (e: TouchEvent) => { if (e.touches.length < 2) active = false; };
    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [gl]);
  return null;
}
