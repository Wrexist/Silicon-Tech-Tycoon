// The Company Overview hero: the company's own 3D office, framed with the era + name over a gradient
// scrim. It mounts the EXISTING Garage3D (the same scene HQ renders) rather than a second renderer,
// and degrades to the latest product's DeviceRenderer when WebGL is unavailable or the scene throws.
// Styles live in screens/company.css (`.co-hero`) because the hero is used only there.
import { lazy, Suspense, useState } from "react";
import { Building2 } from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import { useLayoutMode } from "../design/layout.ts";
import { isDarkTheme, useReducedMotionLive, webglSupported } from "../garage3d/support.ts";
import type { GameState } from "../state/gameState.ts";

const Garage3D = lazy(() => import("../garage3d/Garage3D.tsx").then((m) => ({ default: m.Garage3D })));

export function HeroFrame({ state }: { state: GameState }) {
  const reducedMotion = useReducedMotionLive();
  const use3d = webglSupported();
  // The hero is DECORATIVE, and the HQ office already holds a live WebGL context (it is deliberately
  // kept mounted to preserve it). A second concurrent context is what this app's own history shows
  // fails on memory-constrained phones, so the live canvas is gated to tablet/wide — phones get the
  // device render or the building glyph, which is also the fallback if the context is lost.
  const mode = useLayoutMode();
  const [lostContext, setLostContext] = useState(false);
  const canRender3d = use3d && mode !== "phone" && !lostContext;
  const hasProduction =
    state.building.length > 0 || state.launched.some((l) => l.weeksElapsed < l.weeklyUnits.length);
  const latest = state.launched[0]?.product ?? null;

  const fallback = latest ? (
    <div className="co-hero__fallback">
      <DeviceRenderer product={latest} size={120} idle />
    </div>
  ) : (
    <div className="co-hero__fallback co-hero__fallback--empty" aria-hidden>
      <Building2 size={40} strokeWidth={1.5} />
    </div>
  );

  return (
    <section className="co-hero" aria-label={`${state.companyName}, era ${state.era}`}>
      <div className="co-hero__scene">
        {canRender3d ? (
          <ErrorBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
              <Garage3D
                staff={state.staff}
                staffCount={state.staff.length}
                facilityTier={state.facilityTier}
                hasProduction={hasProduction}
                upgrades={state.upgrades}
                companyName={state.companyName}
                dark={isDarkTheme()}
                still={reducedMotion}
                // the hero is decorative; a still scene avoids a second live WebGL loop
                paused
                roomStyle={state.roomStyle}
                desktops={state.desktops}
                height="100%"
                onContextLost={() => setLostContext(true)}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          fallback
        )}
      </div>
      <div className="co-hero__scrim" aria-hidden />
      <div className="co-hero__meta">
        <span className="co-hero__eyebrow">Era {state.era}</span>
        <h2 className="co-hero__name">{state.companyName}</h2>
      </div>
    </section>
  );
}
