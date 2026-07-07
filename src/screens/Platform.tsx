// Platform / OS division (DLC #1, Phase A+B). Surfaces the OS economy that already runs inside the
// engine: your named OS, its tier, the installed base across every device you've shipped, and the
// recurring licensing revenue it already earns — plus the version-release "launch day" lever.
// Tokens + 8pt grid only (RULE #1).
import { useState } from "react";
import {
  Cpu, Layers, Users, BadgeDollarSign, Rocket, FlaskConical, Check, Lock,
  Store, Cloud, Sparkles, ShieldCheck, HeartPulse, Wallet, Music, Globe, Zap,
  Handshake, Crown, TrendingUp, type LucideIcon,
} from "lucide-react";
import { Button, Card, Stat, SectionHeader } from "../design/primitives.tsx";
import { Sparkline } from "../components/charts.tsx";
import { haptic } from "../design/haptics.ts";
import { showToast } from "../design/toast.tsx";
import { sfx } from "../design/sound.ts";
import { Celebration } from "../design/Celebration.tsx";
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
  licenseeHealthOf,
  licenseeMoodOf,
} from "../state/gameState.ts";
import { osReleaseReward, rivalLicenseFee, licenseeStrengthUplift, osSynergyRows, osFeatureById, OS_PHILOSOPHIES, philosophyEffectLabel } from "../engine/platform.ts";
import { format, add, toDollars, type Money } from "../engine/money.ts";
import { CATEGORIES } from "../engine/catalogs.ts";
import { useGame } from "../state/useGame.tsx";
import "./platform.css";

// Map each OS module's icon key (engine stays DOM-free, so it ships a string) to a Lucide glyph.
const FEATURE_ICONS: Record<string, LucideIcon> = {
  Store, Cloud, Sparkles, ShieldCheck, HeartPulse, Layers, Wallet, Music,
};
// OS philosophy icons (same DOM-free string→glyph indirection).
const PHIL_ICONS: Record<string, LucideIcon> = { ShieldCheck, Globe, Zap, Lock };
// Licensee relationship mood → label.
const MOOD_LABEL: Record<string, string> = { happy: "Happy", content: "Content", strained: "Strained", "at-risk": "At risk" };

function fmtBase(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.floor(n / 1_000)}k`; // floor so 999,999 reads "999k", not "1000k"
  return n.toLocaleString();
}

export function PlatformSheet({ onClose }: { onClose: () => void }) {
  const { state, setOsName, releaseOsVersion, licenseOsToRival, revokeOsLicense, installOsFeature, setOsPhilosophy, signLicenseOffer, declineLicenseOffer } = useGame();
  // The inbound contract just signed — captures the terms so the celebration survives the offer
  // clearing from state the instant it's signed.
  const [signed, setSigned] = useState<{ name: string; bonus: Money; royalty: Money; exclusive: boolean } | null>(null);
  const tier = osTierInfo(state);
  const features = osFeatureList(state);
  const ecoBonus = osEcoBonus(state);
  const rp = Math.floor(state.researchPoints);
  // OS-completion celebration: shown when the player builds the LAST remaining module.
  const [celebrate, setCelebrate] = useState(false);
  // OS version-release celebration: captures the launch-day reward so it survives the card swapping
  // to "up to date" the instant the version ships.
  const [released, setReleased] = useState<{ version: number; fans: number; rep: number; base: number } | null>(null);
  const builtCount = features.filter((f) => f.status === "installed").length;
  const totalCount = features.length;
  const allBuilt = builtCount >= totalCount && totalCount > 0;
  const licenseTotal = weeklyLicenseFees(state);
  const base = platformInstalledBase(state);
  const reachDelta = state.osBaseHistory.length >= 2 ? state.osBaseHistory[state.osBaseHistory.length - 1] - state.osBaseHistory[0] : 0;
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

      <Card>
        <SectionHeader title="OS philosophy" accessory={state.osPhilosophy ? "chosen" : "make it yours"} />
        <p className="plat__release-note plat__release-note--muted">
          The soul of {osDisplayName(state)}, a lasting identity that shapes every device you ship. Tap to choose; tap again to clear.
        </p>
        <div className="plat__phils">
          {OS_PHILOSOPHIES.map((p) => {
            const Icon = PHIL_ICONS[p.icon] ?? Sparkles;
            const on = state.osPhilosophy === p.id;
            return (
              <button
                key={p.id}
                className={`plat__phil${on ? " plat__phil--on" : ""}`}
                aria-pressed={on}
                onClick={() => {
                  haptic.light();
                  sfx(on ? "tap" : "confirm");
                  setOsPhilosophy(p.id);
                  if (!on) showToast(`${osDisplayName(state)} is now ${p.name}`, { tone: "positive" });
                }}
              >
                <span className="plat__phil-icon" aria-hidden><Icon size={18} /></span>
                <span className="plat__phil-name">{p.name}{on && <Check size={13} aria-hidden />}</span>
                <span className="plat__phil-tag">{p.tagline}</span>
                <span className="plat__phil-eff tnum">{philosophyEffectLabel(p)}</span>
              </button>
            );
          })}
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
        <SectionHeader title="OS reach" accessory={reachDelta > 0 ? `+${fmtBase(reachDelta)} this period` : undefined} />
        <Sparkline data={state.osBaseHistory} label="Installed base over time" height={56} />
      </Card>

      <Card>
        <SectionHeader title="OS version" accessory={`v${state.osVersion}.0`} />
        {canRelease ? (
          <>
            <p className="plat__release-note">
              Your research has moved ahead of your released OS. Ship <strong>{tier.name} ({tier.tier}.0)</strong> to
              update the whole installed base, a goodwill moment worth <strong>+{reward.fans.toLocaleString()} fans</strong> and reputation.
            </p>
            <Button block onClick={() => {
              haptic.success();
              releaseOsVersion();
              setReleased({ version: tier.tier, fans: reward.fans, rep: reward.reputation, base });
            }}>
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
          launch, lifting its ecosystem and your recurring services. <strong>{rp.toLocaleString()} RP</strong> available.
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
                          setCelebrate(true); // the Celebration overlay fires confetti + sound on mount
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

        <div className="plat__syn-head">
          <span>Synergies</span>
          <span className="plat__syn-hint">pair modules for a bonus</span>
        </div>
        <ul className="plat__syns">
          {osSynergyRows(state.osFeatures).map((s) => (
            <li key={s.id} className={`plat__syn${s.active ? " plat__syn--on" : ""}`}>
              <div className="plat__syn-main">
                <span className="plat__syn-name">
                  {s.active && <Check size={13} aria-hidden />}{s.name}
                </span>
                <span className="plat__syn-blurb">{s.blurb}</span>
                <span className="plat__syn-req">{s.requires.map((id) => osFeatureById(id)?.name ?? id).join(" + ")}</span>
              </div>
              <span className="plat__syn-eff tnum">+{Math.round(s.servicesMult * 100)}% services</span>
            </li>
          ))}
        </ul>
      </Card>

      {state.pendingLicenseOffer && (() => {
        const offer = state.pendingLicenseOffer;
        const cat = CATEGORIES[offer.category].displayName.toLowerCase();
        return (
          <Card className={`plat__offer${offer.exclusive ? " plat__offer--exclusive" : ""}`}>
            <div className="plat__offer-head">
              <span className="plat__offer-glyph" aria-hidden><Handshake size={20} /></span>
              <div className="plat__offer-info">
                <span className="plat__offer-eyebrow">{offer.exclusive ? "Exclusive contract offer" : "Licensing contract offer"}</span>
                <span className="plat__offer-title">{offer.rivalName} wants {osDisplayName(state)}</span>
              </div>
              {offer.exclusive && <span className="plat__offer-badge"><Crown size={12} aria-hidden /> Exclusive</span>}
            </div>
            <p className="plat__offer-sub">
              To ship on their {cat}s over a ~{offer.termWeeks}-week term.
              {offer.exclusive ? ` No other rival may license ${osDisplayName(state)} for ${cat}s while it holds — and they'll compete harder for it.` : " They'll compete a little harder in your shared markets."}
            </p>
            <div className="plat__offer-terms">
              <Stat label="Signing bonus" value={format(offer.signingBonus)} tone="positive" />
              <Stat label="Royalty" value={`${format(offer.royaltyPerWeek)}/wk`} tone="positive" />
            </div>
            <div className="plat__offer-actions">
              <Button
                block
                onClick={() => {
                  const terms = { name: offer.rivalName, bonus: offer.signingBonus, royalty: offer.royaltyPerWeek, exclusive: offer.exclusive };
                  if (signLicenseOffer()) setSigned(terms);
                }}
              >
                Sign · {format(offer.signingBonus)}
              </Button>
              <Button variant="tertiary" onClick={() => { declineLicenseOffer(); showToast("Walked away from the deal", { tone: "neutral" }); }}>Decline</Button>
            </div>
          </Card>
        );
      })()}

      <Card>
        <SectionHeader title="License your OS" accessory={licenseTotal > 0 ? `${format(licenseTotal)}/wk` : undefined} />
        <p className="plat__release-note plat__release-note--muted">
          Rivals pay a weekly fee to run {osDisplayName(state)}, but a licensee competes
          ~+{licenseeStrengthUplift()} stronger in your shared markets. A real bet: reach vs. rivalry.
        </p>
        <ul className="plat__rivals">
          {state.competitors.map((c) => {
            const licensed = state.osLicensees.includes(c.id);
            const fee = rivalLicenseFee(c.reputation, tier.tier);
            const health = licensed ? licenseeHealthOf(state, c.id) : 0;
            const mood = licensed ? licenseeMoodOf(state, c.id) : "happy";
            return (
              <li key={c.id} className={`plat__rival${licensed ? " plat__rival--on" : ""}`}>
                <div className="plat__rival-top">
                  <span className="plat__rival-name">{c.name}</span>
                  <span className="plat__rival-fee tnum">{format(fee)}/wk</span>
                  <Button
                    size="sm"
                    variant={licensed ? "tertiary" : "secondary"}
                    onClick={() => {
                      haptic.light();
                      if (licensed) { revokeOsLicense(c.id); showToast(`${c.name} no longer licenses ${osDisplayName(state)}`, { tone: "neutral" }); }
                      else { licenseOsToRival(c.id); showToast(`${c.name} now licenses ${osDisplayName(state)}, +${format(fee)}/wk, but stronger in your markets`, { tone: "neutral" }); }
                    }}
                  >
                    {licensed ? "Revoke" : "License"}
                  </Button>
                </div>
                {licensed && (
                  <div className="plat__rel">
                    <span className="plat__rel-bar" aria-hidden><i className={`plat__rel-fill plat__rel-fill--${mood}`} style={{ width: `${Math.round(health)}%` }} /></span>
                    <span className={`plat__rel-label plat__rel-label--${mood}`}>{MOOD_LABEL[mood]}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="plat__rel-note">Licensees grow restless if you dominate them too hard. Keep them content, or push for share and risk losing the fees.</p>
      </Card>

      <Button block variant="secondary" onClick={onClose}>Done</Button>

      {signed && (
        <Celebration
          eyebrow={signed.exclusive ? "Exclusive deal signed" : "Contract signed"}
          title={`${signed.name} runs ${osDisplayName(state)}`}
          sub={`They ship your OS on their devices${signed.exclusive ? ", exclusively" : ""}. The signing bonus is in the bank; the royalties roll in every week.`}
          icon={<Handshake size={34} />}
          sound="mastery"
          chips={[
            { icon: <BadgeDollarSign size={14} />, value: format(signed.bonus), label: "signing bonus", sub: "upfront" },
            { icon: <TrendingUp size={14} />, value: `${format(signed.royalty)}/wk`, label: "royalty", sub: "recurring" },
          ]}
          confirmLabel="Excellent"
          onConfirm={() => setSigned(null)}
        />
      )}

      {celebrate && (
        <Celebration
          eyebrow="Platform complete"
          title={`${osDisplayName(state)} is whole`}
          sub="Every capability now ships in your OS, a complete, self-reinforcing platform."
          icon={<Layers size={34} />}
          chips={[
            { icon: <Sparkles size={14} />, value: `+${osEcoBonus(state)}`, label: "ecosystem", sub: "every device" },
            { icon: <BadgeDollarSign size={14} />, value: `×${osServicesMult(state).toFixed(2)}`, label: "services", sub: "recurring" },
          ]}
          confirmLabel="Brilliant"
          onConfirm={() => setCelebrate(false)}
        />
      )}

      {released && (
        <Celebration
          eyebrow="OS released"
          title={`${osDisplayName(state)} ${released.version}.0`}
          sub={`Shipped across your installed base, ${released.base.toLocaleString()} devices update overnight.`}
          icon={<Rocket size={32} />}
          sound="era"
          chips={[
            { icon: <Users size={14} />, value: `+${released.fans.toLocaleString()}`, label: "fans" },
            { icon: <Sparkles size={14} />, value: `+${released.rep}`, label: "reputation" },
          ]}
          confirmLabel="Onwards"
          onConfirm={() => setReleased(null)}
        />
      )}
    </div>
  );
}
