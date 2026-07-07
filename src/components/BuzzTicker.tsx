// Industry Buzz ticker — a slim "wire" under the office that cycles authored, live headlines about
// your standing, launches, rivals and platform, so the world feels awake and reacting to you. Pure
// flavour: it reads state through engine/buzz.ts (no economy touch) and just rotates the lines.
import { useEffect, useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { useGame } from "../state/useGame.tsx";
import { industryBuzz, type BuzzInput } from "../engine/buzz.ts";
import {
  industryRank,
  industryLeaderboard,
  companyValuation,
  platformInstalledBase,
  osDisplayName,
} from "../state/gameState.ts";
import { BALANCE } from "../engine/balance.ts";
import { toDollars } from "../engine/money.ts";
import "./buzzTicker.css";

const ROTATE_MS = 4600;

export function BuzzTicker() {
  const { state } = useGame();

  const lines = useMemo(() => {
    const board = industryLeaderboard(state);
    const latest = state.launched[state.launched.length - 1] ?? null;
    const rival = state.rivalReleases[0] ?? null; // rivalReleases is newest-first
    const eraDef = BALANCE.eras.find((e) => e.era === state.era);
    const eraProgress = eraDef && Number.isFinite(eraDef.repToAdvance) && eraDef.repToAdvance > 0
      ? Math.min(1, state.reputation / eraDef.repToAdvance)
      : 0;
    const input: BuzzInput = {
      company: state.companyName || "Your company",
      rank: industryRank(state),
      fieldSize: board.length,
      reputation: state.reputation,
      fans: state.fans,
      listed: state.listed ?? state.wentPublic ?? false,
      eraProgress,
      valuationDollars: toDollars(companyValuation(state)),
      latestLaunch: latest ? { name: latest.product.name, verdict: latest.verdict ?? null } : null,
      latestRival: rival ? { company: rival.rivalName, product: rival.product.name, category: rival.category } : null,
      platformBase: state.platformUnlocked ? platformInstalledBase(state) : 0,
      osName: osDisplayName(state),
      licenseeCount: state.osLicensees.length,
    };
    return industryBuzz(input);
    // Recompute only when a headline-relevant fact moves — not every sim tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.companyName, state.reputation, state.fans, state.era, state.wentPublic, state.listed,
    state.launched.length, state.launched[state.launched.length - 1]?.verdict,
    state.rivalReleases[0]?.product.id, state.platformUnlocked, state.osLicensees.length,
  ]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (lines.length <= 1) return;
    const t = window.setInterval(() => setIdx((i) => i + 1), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [lines.length]);

  if (lines.length === 0) return null;
  const line = lines[idx % lines.length];

  return (
    <div className="buzz" role="status" aria-live="polite" aria-label="Industry buzz">
      <span className="buzz__wire" aria-hidden><Radio size={12} /><span className="buzz__dot" /></span>
      {/* key re-mounts the span on change → replays the slide-in; tone tints the accent */}
      <span key={`${idx}-${line.id}`} className={`buzz__text buzz__text--${line.tone}`}>{line.text}</span>
    </div>
  );
}
