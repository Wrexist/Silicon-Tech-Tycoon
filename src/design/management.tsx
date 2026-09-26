import { useState, type ReactNode } from "react";
import { Users, FlaskConical } from "lucide-react";
import type { StaffRole } from "../engine/types.ts";

/** Small illustrations are supplementary: the adjacent native text always carries meaning. */
export function GameArt({ asset, className = "" }: { asset: string; className?: string }) {
  const [failedAsset, setFailedAsset] = useState<string | null>(null);
  const Fallback = asset.startsWith("research-") ? FlaskConical : Users;
  return failedAsset === asset ? <span className={`game-art game-art--fallback ${className}`} aria-hidden><Fallback size={24} /></span>
    : <img className={`game-art ${className}`} src={`${import.meta.env.BASE_URL}art/redesign/${asset}.webp`} alt="" width={72} height={72} loading="lazy" onError={() => setFailedAsset(asset)} />;
}

export function RolePortrait({ role }: { role: StaffRole }) {
  return <GameArt asset={`robot-${role === "hr" ? "marketer" : role === "researcher" ? "engineer" : role}`} />;
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="mg-metrics">{children}</div>;
}

export function Metric({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "positive" | "negative" }) {
  return <div className={`mg-metric${tone ? ` mg-metric--${tone}` : ""}`}><span>{label}</span><strong className="tnum">{value}</strong>{hint && <small>{hint}</small>}</div>;
}

export function ProgressMeter({ label, value }: { label: string; value: number }) {
  const percent = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return <div className="mg-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><span style={{ width: `${percent}%` }} /></div>;
}
