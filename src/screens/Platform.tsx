// Platform / OS division (DLC #1, Phase A+B). Surfaces the OS economy that already runs inside the
// engine: your named OS, its tier, the installed base across every device you've shipped, and the
// recurring licensing revenue it already earns — plus the version-release "launch day" lever.
// Tokens + 8pt grid only (RULE #1).
import { Cpu, Layers, Users, BadgeDollarSign, Rocket } from "lucide-react";
import { Button, Card, Stat, SectionHeader } from "../design/primitives.tsx";
import { haptic } from "../design/haptics.ts";
import {
  osDisplayName,
  osTierInfo,
  platformInstalledBase,
  canReleaseOsVersion,
  weeklyEcosystemRevenue,
} from "../state/gameState.ts";
import { osReleaseReward } from "../engine/platform.ts";
import { format } from "../engine/money.ts";
import { useGame } from "../state/useGame.tsx";
import "./platform.css";

function fmtBase(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString();
}

export function PlatformSheet({ onClose }: { onClose: () => void }) {
  const { state, setOsName, releaseOsVersion } = useGame();
  const tier = osTierInfo(state);
  const base = platformInstalledBase(state);
  const weekly = weeklyEcosystemRevenue(state);
  const canRelease = canReleaseOsVersion(state);
  const reward = osReleaseReward(base);

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
          <Stat label="Licensing income" value={`${format(weekly)}/wk`} tone="positive" hint="Recurring ecosystem-service revenue from your installed base" />
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

      <Button block variant="secondary" onClick={onClose}>Done</Button>
    </div>
  );
}
