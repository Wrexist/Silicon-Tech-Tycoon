import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CircuitBoard, CircleX, Cpu, Layers, RotateCcw, Sparkles, Trophy, TrendingUp } from "lucide-react";
import { GameProvider, useGame } from "./state/useGame.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { Hud } from "./components/Hud.tsx";
import { BottomNav, type Tab } from "./components/BottomNav.tsx";
import { Coach } from "./components/Coach.tsx";
import { ToastHost } from "./design/toast.tsx";
import { GainFX } from "./design/GainFX.tsx";
import { SoundFX } from "./design/SoundFX.tsx";
import { haptic } from "./design/haptics.ts";
import { sfx } from "./design/sound.ts";
import { Sheet, useDialogFocus } from "./design/primitives.tsx";
import { Settings } from "./screens/Settings.tsx";
import { Button, Card } from "./design/primitives.tsx";
import { AnimatedMoney } from "./design/AnimatedNumber.tsx";
import { format, type Money } from "./engine/money.ts";
import type { Product } from "./engine/types.ts";
import { canAdvance, ipoValuation, legacyBonus, industryRank, rdRpCostFor, researchedTier, type GameState } from "./state/gameState.ts";
import { CATEGORY_LIST, COMPONENT_LINES, maxTier } from "./engine/catalogs.ts";
import { eraName } from "./engine/eras.ts";
import { RESEARCH_PROJECTS } from "./engine/research.ts";
import { HQ } from "./screens/HQ.tsx";
import { DesignLab } from "./screens/DesignLab.tsx";
import { Research } from "./screens/Research.tsx";
import { Market } from "./screens/Market.tsx";
import { Company } from "./screens/Company.tsx";
import "./App.css";

/** Returns true when the player has enough RP to unlock at least one component tier or
 *  research project in the current era — used to badge the R&D nav item. */
function hasAffordableResearch(state: GameState): boolean {
  const rp = Math.floor(state.researchPoints);
  if (rp <= 0) return false;
  const kinds = Object.keys(COMPONENT_LINES) as (keyof typeof COMPONENT_LINES)[];
  for (const kind of kinds) {
    const cur = researchedTier(state, kind);
    if (cur >= maxTier(kind)) continue;
    const cost = rdRpCostFor(state, kind);
    if (cost !== null && rp >= cost) return true;
  }
  return RESEARCH_PROJECTS.some(
    (p) => p.era <= state.era && !state.completedProjects.includes(p.id) && rp >= p.rpCost,
  );
}

const TAB_TITLE: Record<Tab, string> = {
  hq: "Silicon",
  design: "Design Lab",
  research: "Research",
  market: "Market",
  company: "Company",
};
const TAB_TINT: Partial<Record<Tab, string>> = {
  design: "var(--fn-design)",
  research: "var(--fn-eng)",
  market: "var(--fn-mkt)",
};

export function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <AppShell />
      </GameProvider>
    </ErrorBoundary>
  );
}

function AppShell() {
  const { state, offline, clearOffline } = useGame();
  const [tab, setTab] = useState<Tab>("hq");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ipoSeen, setIpoSeen] = useState(false);
  // seenEraModal is initialized to the current era so loading an existing save never re-shows
  // modals for eras already reached. When era advances during play it becomes > seenEraModal.
  const [seenEraModal, setSeenEraModal] = useState(state.era);
  // Transient "design a successor" seed — set from a launched product's detail sheet, consumed by
  // the Design Lab on the next render, then cleared. Lives in React (never persisted) so it's a
  // pure UI hand-off and survives no reloads.
  const [successorSeed, setSuccessorSeed] = useState<Product | null>(null);
  const designSuccessor = (p: Product) => {
    setSuccessorSeed(p);
    setTab("design");
  };
  // Allow the IPO celebration to show again after a New Game+ (wentPublic resets to false).
  useEffect(() => {
    if (!state.wentPublic) setIpoSeen(false);
  }, [state.wentPublic]);

  if (!state.onboarded) return <Onboarding onStart={() => setTab("design")} />;

  return (
    <div className="app">
      <Hud onSettings={() => setSettingsOpen(true)} />
      <main className="app__main">
        <h1 className="app__title" style={TAB_TINT[tab] ? { color: TAB_TINT[tab] } : undefined}>{TAB_TITLE[tab]}</h1>
        {/* Screen-level boundary: a crash in one screen shows an inline card here while the HUD +
            bottom nav stay usable. Keyed by tab so navigating away clears a crashed screen. The
            top-level boundary in App() remains the last resort. */}
        <ErrorBoundary key={tab} fallback={<ScreenError onHome={() => setTab("hq")} />}>
          {tab === "hq" && <HQ onNavigate={setTab} />}
          {tab === "design" && <DesignLab seed={successorSeed} onSeedConsumed={() => setSuccessorSeed(null)} onNavigate={setTab} />}
          {tab === "research" && <Research onNavigate={setTab} />}
          {tab === "market" && <Market onDesignSuccessor={designSuccessor} onOpenDesignLab={() => setTab("design")} />}
          {tab === "company" && <Company onNavigate={setTab} />}
        </ErrorBoundary>
        <div className="app__spacer" />
      </main>

      <Coach tab={tab} onNavigate={setTab} />

      <BottomNav
        active={tab}
        onChange={setTab}
        badge={{
          hq: canAdvance(state) || !!state.pendingChoice || state.ready.length > 0,
          research: hasAffordableResearch(state),
          company: state.candidates.length > 0 && (state.candidatesExpire - state.week) <= 3,
        }}
      />

      <GainFX />
      <SoundFX />
      <ToastHost />
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <Settings onClose={() => setSettingsOpen(false)} />
      </Sheet>
      {offline && <OfflineSheet weeks={offline.weeks} gain={offline.gain} onClose={clearOffline} />}
      {state.era > seenEraModal && !state.wentPublic && !state.bankrupt && (
        <EraModal era={state.era} onDismiss={() => setSeenEraModal(state.era)} />
      )}
      {state.wentPublic && !ipoSeen && <IpoOverlay onDismiss={() => setIpoSeen(true)} />}
      {state.bankrupt && <BankruptOverlay />}
    </div>
  );
}

// Inline fallback for the screen-level boundary. Premium, never blank: a Card with a glyph, short
// copy, and two recoveries — reload the whole app, or jump back to a known-good screen (HQ).
function ScreenError({ onHome }: { onHome: () => void }) {
  return (
    <Card variant="inset" className="app__screen-error">
      <div className="app__screen-error-glyph" aria-hidden>
        <AlertTriangle size={26} strokeWidth={2} />
      </div>
      <h2 className="app__screen-error-title">This screen hit a snag</h2>
      <p className="app__screen-error-text">
        Something on this screen stopped responding. Your company is safe — head back and try again.
      </p>
      <div className="app__screen-error-actions">
        <Button variant="secondary" onClick={onHome}>Back to HQ</Button>
        <Button variant="tertiary" onClick={() => window.location.reload()}>
          <RotateCcw size={15} /> Reload
        </Button>
      </div>
    </Card>
  );
}

const ERA_TAGLINES: Record<number, string> = {
  2: "You've outgrown the garage. Now build the team.",
  3: "The whole industry is watching. Shape the platform.",
  4: "The frontier of silicon. Lead the AI revolution.",
};
const ERA_ICONS: Partial<Record<number, ReturnType<typeof TrendingUp>>> = {
  2: <TrendingUp size={28} strokeWidth={2.2} />,
  3: <Layers size={28} strokeWidth={2.2} />,
  4: <Cpu size={28} strokeWidth={2.2} />,
};

function EraModal({ era, onDismiss }: { era: number; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const newCats = CATEGORY_LIST.filter((c) => c.unlockEra === era);
  const newProjects = RESEARCH_PROJECTS.filter((p) => p.era === era);
  const newCompTiers = Object.values(COMPONENT_LINES).reduce(
    (n, line) => n + line.tiers.filter((t) => t.era === era).length,
    0,
  );

  return (
    <div className="era-modal">
      <div
        ref={ref}
        className="era-modal__inner"
        role="dialog"
        aria-modal="true"
        aria-labelledby="era-modal-title"
        tabIndex={-1}
      >
        <div className="era-modal__glyph" aria-hidden>
          {ERA_ICONS[era] ?? <Sparkles size={28} strokeWidth={2.2} />}
        </div>
        <div className="era-modal__badge">Era {era}</div>
        <h2 className="era-modal__title" id="era-modal-title">{eraName(era)}</h2>
        <p className="era-modal__tag">{ERA_TAGLINES[era] ?? "A new chapter begins."}</p>

        {newCats.length > 0 && (
          <Card variant="inset" className="era-modal__section">
            <p className="era-modal__section-label">New product categories</p>
            <div className="era-modal__chips">
              {newCats.map((c) => (
                <span key={c.id} className="era-modal__chip">{c.displayName}</span>
              ))}
            </div>
          </Card>
        )}

        {newProjects.length > 0 && (
          <Card variant="inset" className="era-modal__section">
            <p className="era-modal__section-label">New R&D projects unlocked</p>
            <div className="era-modal__projects">
              {newProjects.map((p) => (
                <div key={p.id} className="era-modal__project">
                  <span className="era-modal__project-name">{p.name}</span>
                  <span className="era-modal__project-blurb">{p.blurb}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {newCompTiers > 0 && (
          <Card variant="inset" className="era-modal__section">
            <p className="era-modal__section-label">{newCompTiers} new component tier{newCompTiers !== 1 ? "s" : ""} available</p>
            <p className="era-modal__comp-hint">Head to Research to unlock higher-spec parts and push your products to the next level.</p>
          </Card>
        )}

        <Button block onClick={() => { haptic.success(); sfx("era"); onDismiss(); }}>Let's go →</Button>
      </div>
    </div>
  );
}

function IpoOverlay({ onDismiss }: { onDismiss: () => void }) {
  const { state, prestige } = useGame();
  const ref = useRef<HTMLDivElement>(null);
  const rank = industryRank(state);
  const nextBonus = legacyBonus(state.legacy + 1);
  useDialogFocus(ref, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);
  return (
    <div className="ipo">
      <div
        ref={ref}
        className="ipo__inner"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ipo-title"
        tabIndex={-1}
      >
        <div className="ipo__glyph" aria-hidden><TrendingUp size={30} strokeWidth={2.2} /></div>
        <h2 className="ipo__title" id="ipo-title">You went public</h2>
        <p className="ipo__text">
          {state.legacy > 0 ? `Empire #${state.legacy + 1} ` : "Your company "}reached the top.
        </p>
        <div className="ipo__stats">
          <Card variant="inset" className="ipo__stat">
            <span className="app__offline-label">IPO valuation</span>
            <span className="app__offline-value rounded tnum">{format(ipoValuation(state))}</span>
          </Card>
          <Card variant="inset" className="ipo__stat">
            <span className="app__offline-label">Industry rank</span>
            <span className="app__offline-value rounded tnum">
              {rank === 1 ? <><Trophy size={16} style={{ verticalAlign: "middle" }} aria-hidden /> #1</> : `#${rank}`}
            </span>
          </Card>
        </div>
        <Card variant="inset" className="ipo__legacy">
          <span className="ipo__legacy-head">New Game+ legacy bonus — your next company starts with</span>
          <div className="ipo__legacy-grid">
            <span className="ipo__legacy-item"><b>+{format(nextBonus.cash)}</b> cash</span>
            <span className="ipo__legacy-item"><b>+{nextBonus.reputation}</b> reputation</span>
            <span className="ipo__legacy-item"><b>+{nextBonus.fans.toLocaleString()}</b> fans</span>
            <span className="ipo__legacy-item"><b>+{nextBonus.rp}</b> research</span>
          </div>
        </Card>
        <p className="ipo__sub">
          Each empire you build leaves a bigger legacy — found your next one stronger, or keep
          building this one.
        </p>
        <Button block onClick={() => { haptic.success(); sfx("era"); prestige(); }}>Start New Game+ (Legacy {state.legacy + 1})</Button>
        <Button block variant="tertiary" onClick={() => { haptic.light(); onDismiss(); }}>Keep building</Button>
      </div>
    </div>
  );
}

function Onboarding({ onStart }: { onStart: () => void }) {
  const { markOnboarded, setCompanyName } = useGame();
  const [name, setName] = useState("");
  return (
    <div className="onboard">
      <div className="onboard__inner">
        <div className="onboard__logo"><CircuitBoard size={48} strokeWidth={1.8} /></div>
        <h1 className="onboard__title">Silicon</h1>
        <p className="onboard__tag">Design tech. Time the market. Build an empire.</p>
        <div className="onboard__steps">
          <Step n="1" title="Design a device" text="Pick components, a finish, and a price. Watch it render live." />
          <Step n="2" title="Read the market" text="Build toward what consumers want — and launch before the trend shifts." />
          <Step n="3" title="Reinvest & grow" text="Fund R&D, hire a team, and expand from a garage to a global brand." />
        </div>
        <label className="onboard__name-label" htmlFor="onboard-name">Name your company</label>
        <input
          id="onboard-name"
          className="onboard__name"
          value={name}
          maxLength={18}
          placeholder="Silicon"
          aria-label="Company name"
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          block
          onClick={() => {
            haptic.success();
            sfx("confirm");
            if (name.trim()) setCompanyName(name);
            markOnboarded();
            onStart();
          }}
        >
          Found {name.trim() || "Silicon"}
        </Button>
      </div>
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="onboard__step">
      <span className="onboard__step-n">{n}</span>
      <div>
        <div className="onboard__step-title">{title}</div>
        <div className="onboard__step-text">{text}</div>
      </div>
    </div>
  );
}

function OfflineSheet({ weeks, gain, onClose }: { weeks: number; gain: Money; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="ds-sheet-scrim" onClick={onClose}>
      <div
        ref={ref}
        className="ds-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ds-sheet__grab" aria-hidden />
        <h2 className="app__sheet-title" id="offline-title">While you were away</h2>
        <p className="app__sheet-text">
          {weeks} {weeks === 1 ? "week" : "weeks"} passed. Your products kept selling.
        </p>
        <Card variant="inset" className="app__offline-card">
          <span className="app__offline-label">Net change</span>
          <AnimatedMoney value={gain} sign className="app__offline-value rounded" />
        </Card>
        <Button block onClick={() => { haptic.success(); sfx("cash"); onClose(); }}>Continue</Button>
      </div>
    </div>
  );
}

function diagnoseFailure(state: GameState): string[] {
  const { launched, staff, building } = state;
  const hits = launched.filter((lp) => lp.verdict === "hit" || lp.verdict === "solid").length;
  const flops = launched.filter((lp) => lp.verdict === "flop").length;
  const totalMade = launched.reduce((s, lp) => s + (lp.plannedUnits ?? 0), 0);
  const totalSold = launched.reduce((s, lp) => s + lp.unitsSold, 0);
  const tips: string[] = [];

  if (launched.length === 0 && building.length === 0) {
    tips.push("No product launched before cash ran out — fixed costs burn even at day one. Aim to ship your first device within the first 8 weeks.");
  } else if (launched.length === 0 && building.length > 0) {
    tips.push("Ran out of cash mid-build. Production locks up cash before revenue arrives — use a smaller run size and watch your runway in the Build Wizard's review step.");
  } else if (flops === launched.length && launched.length >= 2) {
    tips.push("Every launch flopped. Check the Market tab for rising demand trends and keep an eye on rival scores before finalising specs.");
  } else if (hits === 0 && launched.length >= 1) {
    tips.push("No hits yet. Target rising market stats in the Design Lab and price close to the fair-value estimate to improve your launch score.");
  }

  if (totalMade > 150 && totalSold < totalMade * 0.45 && tips.length < 2) {
    tips.push("More than half of manufactured units went unsold — cash trapped in inventory. Stick to the 'Recommended' run size and start small.");
  } else if (staff.length >= 3 && launched.length <= 1 && tips.length < 2) {
    tips.push("Payroll grew faster than revenue. Keep the team at 1–2 people until a product is generating steady income.");
  } else if (staff.length >= 2 && hits === 0 && tips.length < 2) {
    tips.push("Payroll needs hits to cover it. Prioritise one well-designed launch before expanding the team.");
  }

  return tips;
}

function BankruptOverlay() {
  const { state, restart } = useGame();
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true);
  const bestRevProduct = state.launched.reduce<{ product: { name: string }; revenueToDate: number } | null>(
    (top, lp) => (top == null || lp.revenueToDate > top.revenueToDate ? lp : top),
    null,
  );
  const hitsCount = state.launched.filter((lp) => lp.verdict === "hit" || lp.verdict === "solid").length;
  const diagnosis = diagnoseFailure(state);
  return (
    <div className="bankrupt">
      <div
        ref={ref}
        className="bankrupt__inner"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bankrupt-title"
        tabIndex={-1}
      >
        <div className="bankrupt__glyph" aria-hidden><CircleX size={30} strokeWidth={2} /></div>
        <h2 className="bankrupt__title" id="bankrupt-title">Out of cash</h2>
        <p className="bankrupt__text">
          {state.companyName} ran out of money. Every empire starts somewhere.
        </p>
        <div className="bankrupt__postmortem">
          <div className="bankrupt__pm-row">
            <span className="bankrupt__pm-label">Survived</span>
            <span className="bankrupt__pm-val tnum">{state.week} weeks</span>
          </div>
          <div className="bankrupt__pm-row">
            <span className="bankrupt__pm-label">Revenue earned</span>
            <span className="bankrupt__pm-val tnum">{format(state.cumulativeRevenue)}</span>
          </div>
          {state.launched.length > 0 && (
            <div className="bankrupt__pm-row">
              <span className="bankrupt__pm-label">Products shipped</span>
              <span className="bankrupt__pm-val tnum">{state.launched.length} ({hitsCount} hits)</span>
            </div>
          )}
          {bestRevProduct && (
            <div className="bankrupt__pm-row">
              <span className="bankrupt__pm-label">Best product</span>
              <span className="bankrupt__pm-val">{bestRevProduct.product.name}</span>
            </div>
          )}
        </div>
        {diagnosis.length > 0 && (
          <div className="bankrupt__diagnosis">
            <p className="bankrupt__diag-label">What went wrong</p>
            {diagnosis.map((d, i) => (
              <p key={i} className="bankrupt__diag-tip">{d}</p>
            ))}
          </div>
        )}
        <Button block onClick={() => { haptic.medium(); sfx("confirm"); restart(); }}>Start a new company</Button>
      </div>
    </div>
  );
}
