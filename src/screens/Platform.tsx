// Platform / OS division (DLC #1, Phase A+B). Surfaces the OS economy that already runs inside the
// engine: your named OS, its tier, the installed base across every device you've shipped, and the
// recurring licensing revenue it already earns — plus the version-release "launch day" lever.
// Tokens + 8pt grid only (RULE #1).
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  Cpu, Layers, Users, BadgeDollarSign, Rocket, FlaskConical, Check, Lock,
  Store, Cloud, Sparkles, ShieldCheck, HeartPulse, Wallet, Music, type LucideIcon,
} from "lucide-react";
import { Button, Card, Stat, SectionHeader } from "../design/primitives.tsx";
import { haptic } from "../design/haptics.ts";
import { showToast } from "../design/toast.tsx";
import { sfx } from "../design/sound.ts";
import { emitCelebrate } from "../design/celebrateFx.ts";
import {
  osDisplayName,
  osTierInfo,
  platformInstalledBase,
  canReleaseOsVersion,
  weeklyEcosystemRevenue,
  osFeatureList,
  osEcoBonus,
  osServicesMult,
  weeklyLicenseFees,
} from "../state/gameState.ts";
import { osReleaseReward, rivalLicenseFee, licenseeStrengthUplift } from "../engine/platform.ts";
import { format, add, toDollars } from "../engine/money.ts";
import { useGame } from "../state/useGame.tsx";
import "./platform.css";

// Map each OS module's icon key (engine stays DOM-free, so it ships a string) to a Lucide glyph.
const FEATURE_ICONS: Record<string, LucideIcon> = {
  Store, Cloud, Sparkles, ShieldCheck, HeartPulse, Layers, Wallet, Music,
};

function fmtBase(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.floor(n / 1_000)}k`; // floor so 999,999 reads "999k", not "1000k"
  return n.toLocaleString();
}

export function PlatformSheet({ onClose }: { onClose: () => void }) {
  const { state, setOsName, releaseOsVersion, licenseOsToRival, revokeOsLicense, installOsFeature } = useGame();
  const tier = osTierInfo(state);
  const features = osFeatureList(state);
  const ecoBonus = osEcoBonus(state);
  const rp = Math.floor(state.researchPoints);
  // OS-completion celebration: shown when the player builds the LAST remaining module.
  const [celebrate, setCelebrate] = useState(false);
  const builtCount = features.filter((f) => f.status === "installed").length;
  const totalCount = features.length;
  const allBuilt = builtCount >= totalCount && totalCount > 0;
  const licenseTotal = weeklyLicenseFees(state);
  const base = platformInstalledBase(state);
  const weekly = weeklyEcosystemRevenue(state);
  const canRelease = canReleaseOsVersion(state);
  const reward = osReleaseReward(base);
  // Total OS income = the recurring ecosystem-service revenue from the installed base PLUS the weekly
  // fees from rivals licensing your OS. Surfacing the sum (not just the services line) so the headline
  // reflects the division's full worth; the licensing portion is detailed in its own section below.
  const totalOsIncome = add(weekly, licenseTotal);
  const incomeHint = toDollars(licenseTotal) > 0
    ? `${format(weekly)}/wk services + ${format(licenseTotal)}/wk rival licensing`
    : "Recurring ecosystem-service revenue from your installed base";

  return (
    <div className="plat">
      <div className="plat__head">
        <span className="plat__brand" aria-hidden><Layers size={20} /></span>
        <div>
          <h2 className="plat__title">Platform</h2>
          <p className="plat__sub">Your operating system, across every device you've shipped.</p>
        </div>
      </div>

      <Card>
        <label className="plat__name-label" htmlFor="plat-os-name">OS name</label>
        <input
          id="plat-os-name"
          className="plat__name"
          value={state.osName}
          placeholder={osDisplayName(state)}
          maxLength={22}
          aria-label="Operating system name"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setOsName(e.target.value)}
        />
        <div className="plat__tierline">
          <Cpu size={14} /> {tier.name} · released v{state.osVersion}.0
        </div>
      </Card>

      <div className="plat__stats">
        <Card className="plat__stat-card">
          <Stat label="Installed base" value={fmtBase(base)} tone="accent" hint={`${base.toLocaleString()} devices running ${osDisplayName(state)}`} />
          <Users size={18} className="plat__stat-icon" aria-hidden />
        </Card>
        <Card className="plat__stat-card">
          <Stat label="OS income" value={`${format(totalOsIncome)}/wk`} tone="positive" hint={incomeHint} />
          <BadgeDollarSign size={18} className="plat__stat-icon" aria-hidden />
        </Card>
      </div>

      <Card>
        <SectionHeader title="OS version" accessory={`v${state.osVersion}.0`} />
        {canRelease ? (
          <>
            <p className="plat__release-note">
              Your research has moved ahead of your released OS. Ship <strong>{tier.name} ({tier.tier}.0)</strong> to
              update the whole installed base — a goodwill moment worth <strong>+{reward.fans.toLocaleString()} fans</strong> and reputation.
            </p>
            <Button block onClick={() => { haptic.success(); releaseOsVersion(); }}>
              <Rocket size={15} /> Release {tier.name} {tier.tier}.0
            </Button>
          </>
        ) : (
          <p className="plat__release-note plat__release-note--muted">
            {osDisplayName(state)} is up to date with your research. Advance the Software line in R&D to unlock a new OS version to release.
          </p>
        )}
      </Card>

      <Card>
        <SectionHeader title="OS features" accessory={ecoBonus > 0 ? `+${ecoBonus} ecosystem` : undefined} />
        <p className="plat__release-note plat__release-note--muted">
          Build platform capabilities into {osDisplayName(state)}. Each ships in every device you
          launch — lifting its ecosystem and your recurring services. <strong>{rp.toLocaleString()} RP</strong> available.
        </p>
        <div className={`plat__os-progress${allBuilt ? " plat__os-progress--done" : ""}`}>
          <div className="plat__os-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={totalCount} aria-valuenow={builtCount}>
            <i style={{ width: `${(builtCount / totalCount) * 100}%` }} />
          </div>
          <span className="plat__os-progress-label tnum">
            {allBuilt ? <><Check size={12} /> Complete</> : `${builtCount}/${totalCount} built`}
          </span>
        </div>
        <ul className="plat__feats">
          {features.map((f) => {
            const Icon = FEATURE_ICONS[f.icon] ?? Layers;
            const pct = Math.round(f.servicesMult * 100);
            return (
              <li key={f.id} className={`plat__feat plat__feat--${f.status}`}>
                <span className="plat__feat-icon" aria-hidden><Icon size={18} /></span>
                <div className="plat__feat-main">
                  <span className="plat__feat-name">{f.name}</span>
                  <span className="plat__feat-blurb">{f.blurb}</span>
                  <span className="plat__feat-effect tnum">+{f.ecoBonus} ecosystem · +{pct}% services</span>
                </div>
                <div className="plat__feat-side">
                  {f.status === "installed" ? (
                    <span className="plat__feat-tag plat__feat-tag--on"><Check size={13} /> Built</span>
                  ) : f.status === "locked" ? (
                    <span className="plat__feat-tag"><Lock size={12} /> OS v{f.minVersion}</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={f.status === "unaffordable"}
                      onClick={() => {
                        // Will THIS build complete the platform? (only buildable modules show a button,
                        // so installing one always increments the built count by exactly one.)
                        const willComplete = builtCount + 1 >= totalCount;
                        installOsFeature(f.id);
                        if (willComplete) {
                          haptic.success();
                          sfx("mastery");
                          emitCelebrate();
                          setCelebrate(true);
                        } else {
                          haptic.success();
                          sfx("upgrade");
                          showToast(`${f.name} built into ${osDisplayName(state)}`, { tone: "positive" });
                        }
                      }}
                    >
                      <FlaskConical size={13} /> {f.rpCost} RP
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <SectionHeader title="License your OS" accessory={licenseTotal > 0 ? `${format(licenseTotal)}/wk` : undefined} />
        <p className="plat__release-note plat__release-note--muted">
          Rivals pay a weekly fee to run {osDisplayName(state)} — but a licensee competes
          ~+{licenseeStrengthUplift()} stronger in your shared markets. A real bet: reach vs. rivalry.
        </p>
        <ul className="plat__rivals">
          {state.competitors.map((c) => {
            const licensed = state.osLicensees.includes(c.id);
            const fee = rivalLicenseFee(c.reputation, tier.tier);
            return (
              <li key={c.id} className={`plat__rival${licensed ? " plat__rival--on" : ""}`}>
                <span className="plat__rival-name">{c.name}</span>
                <span className="plat__rival-fee tnum">{format(fee)}/wk</span>
                <Button
                  size="sm"
                  variant={licensed ? "tertiary" : "secondary"}
                  onClick={() => {
                    haptic.light();
                    if (licensed) { revokeOsLicense(c.id); showToast(`${c.name} no longer licenses ${osDisplayName(state)}`, { tone: "neutral" }); }
                    else { licenseOsToRival(c.id); showToast(`${c.name} now licenses ${osDisplayName(state)} — +${format(fee)}/wk, but stronger in your markets`, { tone: "neutral" }); }
                  }}
                >
                  {licensed ? "Revoke" : "License"}
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Button block variant="secondary" onClick={onClose}>Done</Button>

      {celebrate && (
        <OsCompleteCelebration
          osName={osDisplayName(state)}
          eco={osEcoBonus(state)}
          mult={osServicesMult(state)}
          onClose={() => setCelebrate(false)}
        />
      )}
    </div>
  );
}

/** The dopamine payoff: a one-shot, premium celebration when the player completes their OS — every
 *  capability built. Portals to <body> (escapes the sheet's scroll/stacking), confetti fires from
 *  the global bus, and the emblem springs in with a ray burst. Zero image assets — pure vector. */
function OsCompleteCelebration({ osName, eco, mult, onClose }: { osName: string; eco: number; mult: number; onClose: () => void }) {
  const rays = Array.from({ length: 12 });
  return createPortal(
    <div className="osc" role="dialog" aria-modal="true" aria-label="Platform complete" onClick={onClose}>
      <div className="osc__card" onClick={(e) => e.stopPropagation()}>
        <div className="osc__emblem" aria-hidden>
          <span className="osc__rays">
            {rays.map((_, i) => (
              <i key={i} style={{ "--a": `${(360 / rays.length) * i}deg`, "--d": `${i * 28}ms` } as React.CSSProperties} />
            ))}
          </span>
          <span className="osc__disc"><Layers size={34} /></span>
          <span className="osc__seal" aria-hidden><Check size={16} /></span>
        </div>
        <p className="osc__eyebrow">Platform complete</p>
        <h3 className="osc__title">{osName} is whole</h3>
        <p className="osc__sub">Every capability now ships in your OS — a complete, self-reinforcing platform.</p>
        <div className="osc__chips">
          <span className="osc__chip"><Sparkles size={14} /><strong>+{eco}</strong> ecosystem<small>every device</small></span>
          <span className="osc__chip"><BadgeDollarSign size={14} /><strong>×{mult.toFixed(2)}</strong> services<small>recurring</small></span>
        </div>
        <Button block onClick={onClose}><Check size={15} /> Brilliant</Button>
      </div>
    </div>,
    document.body,
  );
}
