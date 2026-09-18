// The Company Overview hero: the company's own 3D office, framed with the era + name over a gradient
// scrim. It mounts the EXISTING Garage3D (the same scene HQ renders) rather than a second renderer,
// and degrades to the latest product's DeviceRenderer when WebGL is unavailable or the scene throws.
// Styles live in screens/company.css (`.co-hero`) because the hero is used only there.
import { lazy, Suspense } from "react";
import { Building2 } from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import { isDarkTheme, useReducedMotionLive, webglSupported } from "../garage3d/support.ts";
import type { GameState } from "../state/gameState.ts";

const Garage3D = lazy(() => import("../garage3d/Garage3D.tsx").then((m) => ({ default: m.Garage3D })));

export function HeroFrame({ state }: { state: GameState }) {
  const reducedMotion = useReducedMotionLive();
  const use3d = webglSupported();
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
        {use3d ? (
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
                roomStyle={state.roomStyle}
                desktops={state.desktops}
                height="100%"
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
