import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, BadgeDollarSign, CircuitBoard, CircleX, Copy, Cpu, Crown, Factory, FlaskConical, Home, Layers, RotateCcw, Sparkles, TrendingUp, Trophy, Users } from "lucide-react";
import { GameProvider, useGame } from "./state/useGame.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { Hud, SpeedDial } from "./components/Hud.tsx";
import { Bank } from "./components/Bank.tsx";
import { BottomNav, type Tab } from "./components/BottomNav.tsx";
import { Coach } from "./components/Coach.tsx";
import { ResultCard } from "./components/ResultCard.tsx";
import { ToastHost, showToast } from "./design/toast.tsx";
import { haptic } from "./design/haptics.ts";
import { GainFX } from "./design/GainFX.tsx";
import { Confetti } from "./design/Confetti.tsx";
import { LaunchReveal } from "./components/LaunchReveal.tsx";
import { ReadyToLaunch } from "./components/ReadyToLaunch.tsx";
import { RivalStrike } from "./components/RivalStrike.tsx";
import { AwardsCeremonyOverlay } from "./components/AwardsCeremony.tsx";
import { Celebration } from "./design/Celebration.tsx";
import { SoundFX } from "./design/SoundFX.tsx";
import { Sheet, useDialogFocus } from "./design/primitives.tsx";
import { registerAppOverlay } from "./design/overlayGuard.ts";
import { Settings } from "./screens/Settings.tsx";
import { ProgressSheet } from "./screens/Progress.tsx";
import { ScenariosSheet } from "./screens/Scenarios.tsx";
import { Button, Card } from "./design/primitives.tsx";
import { AnimatedMoney } from "./design/AnimatedNumber.tsx";
import { format, toDollars, type Money } from "./engine/money.ts";
import { campaignEpilogue } from "./engine/epilogue.ts";
import type { Product } from "./engine/types.ts";
import { canAdvance, ipoValuation, legacyBonus, industryRank, researchReady, type GameState } from "./state/gameState.ts";
import { nextPerk } from "./engine/perks.ts";
import { CATEGORY_LIST } from "./engine/catalogs.ts";
import { eraName } from "./engine/eras.ts";
import { RESEARCH_PROJECTS } from "./engine/research.ts";
import { HQ } from "./screens/HQ.tsx";
import { DesignLab } from "./screens/DesignLab.tsx";
import { Research } from "./screens/Research.tsx";
import { Market } from "./screens/Market.tsx";
import { Company } from "./screens/Company.tsx";
import "./App.css";

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
  const { state, offline, clearOffline, tabBlocked, takeOverHere } = useGame();
  const [tab, setTab] = useState<Tab>("hq");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  // Which view the Progress sheet opens on — "challenges" when HQ's daily-challenge card deep-links.
  const [progressView, setProgressView] = useState<"hub" | "challenges">("hub");
  const openProgress = (view: "hub" | "challenges" = "hub") => {
    setProgressView(view);
    setProgressOpen(true);
  };
  const [bankOpen, setBankOpen] = useState(false);
  // Initialized to wentPublic so loading a save that already IPO'd never replays the takeover —
  // same guard the era modal uses below. It only fires when wentPublic flips DURING play.
  const [ipoSeen, setIpoSeen] = useState(state.wentPublic);
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
  // Transient "open this product's post-mortem" hand-off — set by the launch reveal's
  // "See the full breakdown" action, consumed by Market on mount (same pattern as successorSeed).
  const [marketFocusId, setMarketFocusId] = useState<string | null>(null);
  // Which living scene the Office screen shows — the office or the manufacturing floor.
  const [hqWorld, setHqWorld] = useState<"office" | "factory">("office");
  const seeBreakdown = (productId: string) => {
    setMarketFocusId(productId);
    setTab("market");
  };
  // Allow the IPO celebration to show again after a New Game+ (wentPublic resets to false).
  useEffect(() => {
    if (!state.wentPublic) setIpoSeen(false);
  }, [state.wentPublic]);

  // The first ship silently unlocks half the meta-game (Progress hub, stock market, financing,
  // morale, daily challenges). Say so ONCE — deferred so the launch reveal + verdict own the
  // moment and this lands as the "what's next" beat after the confetti settles.
  const hasShippedNow = state.launched.length >= 1 || state.legacy > 0;
  const announcedUnlocks = useRef(hasShippedNow); // pre-shipped saves don't get re-told
  useEffect(() => {
    if (!hasShippedNow || announcedUnlocks.current) return;
    // Mark inside the timeout, not before it — so a StrictMode mount/cleanup/remount (which fires
    // the effect twice with the same ref) doesn't consume the announcement on the discarded pass.
    const t = setTimeout(() => {
      announcedUnlocks.current = true;
      showToast("New unlocked: Progress hub (trophy), stock market & financing", { tone: "positive", glyph: <Trophy size={15} /> });
    }, 4200);
    return () => clearTimeout(t);
  }, [hasShippedNow]);

  if (!state.onboarded) return <Onboarding onStart={() => setTab("design")} />;

  // Progress hub (achievements/scenarios/challenges/museum) is surfaced once the player has shipped
  // their first product — same first-ship gate the meta-layer always used, just hoisted to the HUD.
  const hasShipped = hasShippedNow;

  return (
    <div className="app">
      <Hud
        onSettings={() => setSettingsOpen(true)}
        onOpenBank={() => setBankOpen(true)}
        onOpenProgress={hasShipped ? () => openProgress() : undefined}
      />
      <main className="app__main">
        {/* HQ stays MOUNTED across tabs (hidden, not unmounted) so its WebGL office keeps its
            GPU context instead of tearing it down + re-creating it on every visit — that churn
            is what made the 3D office fail on memory-constrained mobile browsers. Its render
            loop pauses while hidden (active={false}), so there's no battery cost off-screen. */}
        <div className="app__screen" hidden={tab !== "hq"}>
          {/* World tabs beside the company name — swap the living scene between the office
              and the manufacturing floor (FACTORY_WORLD_PLAN.md P1). */}
          <div className="app__titlerow">
            <h1 className="app__title">{state.companyName || TAB_TITLE.hq}</h1>
            <div className="worldtabs" role="group" aria-label="Headquarters world">
              <button
                className={`worldtabs__tab${hqWorld === "office" ? " worldtabs__tab--on" : ""}`}
                aria-pressed={hqWorld === "office"}
                onClick={() => { haptic.light(); setHqWorld("office"); }}
              >
                <Home size={14} aria-hidden /> Office
              </button>
              <button
                className={`worldtabs__tab${hqWorld === "factory" ? " worldtabs__tab--on" : ""}`}
                aria-pressed={hqWorld === "factory"}
                onClick={() => { haptic.light(); setHqWorld("factory"); }}
              >
                <Factory size={14} aria-hidden /> Factory
              </button>
            </div>
          </div>
          <ErrorBoundary fallback={<ScreenError onHome={() => setTab("hq")} />}>
            <HQ onNavigate={setTab} onOpenBank={() => setBankOpen(true)} onOpenChallenges={() => openProgress("challenges")} onViewFactory={() => { setHqWorld("factory"); haptic.light(); }} active={tab === "hq"} world={hqWorld} />
          </ErrorBoundary>
        </div>
        {/* The other screens are light (no WebGL), so they keep the snappy keyed remount that
            replays the `app__screen` enter animation on each navigation. */}
        {tab !== "hq" && (
          <div className="app__screen" key={tab}>
            <h1 className="app__title" style={TAB_TINT[tab] ? { color: TAB_TINT[tab] } : undefined}>{TAB_TITLE[tab]}</h1>
            <ErrorBoundary fallback={<ScreenError onHome={() => setTab("hq")} />}>
              {tab === "design" && <DesignLab seed={successorSeed} onSeedConsumed={() => setSuccessorSeed(null)} />}
              {tab === "research" && <Research onNavigate={setTab} />}
              {tab === "market" && (
                <Market
                  onDesignSuccessor={designSuccessor}
                  onOpenDesignLab={() => setTab("design")}
                  focusProductId={marketFocusId}
                  onFocusConsumed={() => setMarketFocusId(null)}
                />
              )}
              {tab === "company" && <Company />}
            </ErrorBoundary>
          </div>
        )}
        <div className="app__spacer" />
      </main>

      <Coach tab={tab} onNavigate={setTab} />

      {/* Thumb-reachable speed control, post-tutorial. Hidden on Design (the build wizard owns the
          bottom band there) and during the tutorial (the controls stay in the top HUD then). */}
      {state.tutorialDone && tab !== "design" && <SpeedDial />}

      <BottomNav
        active={tab}
        onChange={setTab}
        badge={{ hq: canAdvance(state), research: researchReady(state) }}
      />

      <GainFX />
      <Confetti />
      <ReadyToLaunch />
      <RivalStrike />
      <AwardsCeremonyOverlay />
      <LaunchReveal onSeeBreakdown={seeBreakdown} />
      <SoundFX />
      <ToastHost />
      <Bank open={bankOpen} onClose={() => setBankOpen(false)} />
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <Settings onClose={() => setSettingsOpen(false)} />
      </Sheet>
      <Sheet open={progressOpen} onClose={() => setProgressOpen(false)}>
        <ProgressSheet onClose={() => setProgressOpen(false)} initialView={progressView} />
      </Sheet>
      {offline && <OfflineSheet weeks={offline.weeks} gain={offline.gain} topProduct={offline.topProduct} onClose={clearOffline} />}
      {state.era > seenEraModal && !state.wentPublic && !state.bankrupt && (
        <EraModal era={state.era} onDismiss={() => setSeenEraModal(state.era)} />
      )}
      {state.wentPublic && !ipoSeen && <IpoOverlay onDismiss={() => setIpoSeen(true)} />}
      {state.bankrupt && <BankruptOverlay />}
      {tabBlocked && <TabBlockedOverlay onTakeOver={takeOverHere} />}
    </div>
  );
}

/** Shown when ANOTHER tab/window claimed this save: this tab is frozen (no sim, no saves) so the
 *  two contexts can't clobber each other's progress. Reloading boots from the freshest save and
 *  claims play back here. */
function TabBlockedOverlay({ onTakeOver }: { onTakeOver: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true);
  return (
    <div className="tabswap">
      <div
        ref={ref}
        className="tabswap__inner"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tabswap-title"
        tabIndex={-1}
      >
        <div className="tabswap__glyph" aria-hidden><Copy size={30} strokeWidth={2} /></div>
        <h2 className="tabswap__title" id="tabswap-title">Playing in another window</h2>
        <p className="tabswap__text">
          Your company is now running in a different tab or window, so this one is paused —
          running both at once would overwrite your progress.
        </p>
        <Button block onClick={onTakeOver}>
          <RotateCcw size={15} /> Play here instead
        </Button>
      </div>
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
        Something on this screen stopped responding. Your company is safe. Head back and try again.
      </p>
      <div className="app__screen-error-actions">
        <Button variant="secondary" onClick={onHome}>Back to Office</Button>
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
  useEffect(() => registerAppOverlay(), []); // lower layers (Factory mode) defer Escape to this modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const newCats = CATEGORY_LIST.filter((c) => c.unlockEra === era);
  const newProjects = RESEARCH_PROJECTS.filter((p) => p.era === era);

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

        <Button block onClick={onDismiss}>Let's go <ArrowRight size={16} aria-hidden /></Button>
      </div>
    </div>
  );
}

function IpoOverlay({ onDismiss }: { onDismiss: () => void }) {
  const { state, prestige } = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  // The reset is reframed as a triumphant ascension: confirming New Game+ first shows a celebratory
  // "legacy forged" moment (the inherited power), and only its confirm actually founds the next run.
  const [forging, setForging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const rank = industryRank(state);
  const nextBonus = legacyBonus(state.legacy + 1);
  const nextFounderPerk = nextPerk(state.legacy);
  useDialogFocus(ref, true);
  useEffect(() => registerAppOverlay(), []); // lower layers (Factory mode) defer Escape to this overlay
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
              {rank === 1 ? (
                <span className="ipo__rank-first">#1 <Trophy size={16} aria-hidden /></span>
              ) : `#${rank}`}
            </span>
          </Card>
        </div>
        <p className="ipo__epilogue">
          {campaignEpilogue({
            companyName: state.companyName,
            reputation: state.reputation,
            rank,
            valuationDollars: toDollars(ipoValuation(state)),
            products: state.launched.length,
            fans: state.fans,
            legacy: state.legacy,
          })}
        </p>
        <Card variant="inset" className="ipo__legacy">
          <span className="ipo__legacy-head">New Game+ legacy bonus, your next company starts with</span>
          <div className="ipo__legacy-grid">
            <span className="ipo__legacy-item"><b>+{format(nextBonus.cash)}</b> cash</span>
            <span className="ipo__legacy-item"><b>+{nextBonus.reputation}</b> reputation</span>
            <span className="ipo__legacy-item"><b>+{nextBonus.fans.toLocaleString()}</b> fans</span>
            <span className="ipo__legacy-item"><b>+{nextBonus.rp}</b> research</span>
          </div>
          {nextFounderPerk && (
            <span className="ipo__legacy-perk">
              New founder perk, <b>{nextFounderPerk.name}</b>: {nextFounderPerk.description}
            </span>
          )}
        </Card>
        <p className="ipo__sub">
          Each empire you build leaves a bigger legacy. Found your next one stronger, or keep
          building this one.
        </p>
        {confirmReset ? (
          <div className="ipo__confirm">
            <span className="ipo__confirm-text">Retire {state.companyName} and start fresh? This run ends now.</span>
            <Button block variant="destructive" onClick={() => setForging(true)}>Yes, start New Game+</Button>
            <Button block variant="tertiary" onClick={() => setConfirmReset(false)}>Back</Button>
          </div>
        ) : (
          <>
            <Button block onClick={() => setConfirmReset(true)}>Start New Game+ (Legacy {state.legacy + 1})</Button>
            <Button block variant="tertiary" onClick={onDismiss}>Keep building</Button>
          </>
        )}
      </div>

      {forging && (
        <Celebration
          eyebrow={`Legacy ${state.legacy + 1} forged`}
          title={`Empire #${state.legacy + 2} awaits`}
          sub={
            nextFounderPerk
              ? `Your legacy carries forward. New founder perk, ${nextFounderPerk.name}: ${nextFounderPerk.description}`
              : "Your legacy carries forward. Found your next company stronger than the last."
          }
          icon={<Crown size={32} />}
          tone="positive"
          chips={[
            { icon: <BadgeDollarSign size={14} />, value: `+${format(nextBonus.cash)}`, label: "starting cash" },
            { icon: <Sparkles size={14} />, value: `+${nextBonus.reputation}`, label: "reputation" },
            { icon: <Users size={14} />, value: `+${nextBonus.fans.toLocaleString()}`, label: "fans" },
            { icon: <FlaskConical size={14} />, value: `+${nextBonus.rp}`, label: "research" },
          ]}
          confirmLabel="Found the next empire"
          onConfirm={prestige}
          secondaryLabel="Not yet"
          onSecondary={() => setForging(false)}
        />
      )}
    </div>
  );
}

function Onboarding({ onStart }: { onStart: () => void }) {
  const { markOnboarded, setCompanyName } = useGame();
  const [name, setName] = useState("");
  const [scenariosOpen, setScenariosOpen] = useState(false);
  const found = () => {
    if (name.trim()) setCompanyName(name);
    markOnboarded();
    onStart();
  };
  return (
    <div className="onboard">
      <div className="onboard__scroll">
        <div className="onboard__inner">
          <div className="onboard__logo"><CircuitBoard size={48} strokeWidth={1.8} /></div>
          <h1 className="onboard__title">Silicon</h1>
          <p className="onboard__tag">Design tech. Time the market. Build an empire.</p>
          <div className="onboard__steps">
            <Step n="1" title="Design a device" text="Pick components, a finish, and a price. Watch it render live." />
            <Step n="2" title="Read the market" text="Build toward what consumers want, and launch before the trend shifts." />
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
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="done"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") found(); }}
          />
          <Button block onClick={found}>
            Found {name.trim() || "Silicon"}
          </Button>
          <button className="onboard__scenario-link" onClick={() => setScenariosOpen(true)}>
            Or take on a scenario
          </button>
        </div>
      </div>
      <Sheet open={scenariosOpen} onClose={() => setScenariosOpen(false)}>
        <ScenariosSheet onClose={() => setScenariosOpen(false)} />
      </Sheet>
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

function OfflineSheet({ weeks, gain, topProduct, onClose }: { weeks: number; gain: Money; topProduct: { name: string; units: number } | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true);
  useEffect(() => registerAppOverlay(), []); // lower layers (Factory mode) defer Escape to this sheet
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
        {topProduct && (
          <Card variant="inset" className="app__offline-card">
            <span className="app__offline-label">Best seller while away</span>
            <span className="app__offline-hero">
              {topProduct.name}<span className="app__offline-units tnum"> · {topProduct.units.toLocaleString()} units</span>
            </span>
          </Card>
        )}
        <Button block onClick={onClose}>Continue</Button>
      </div>
    </div>
  );
}

function diagnoseFailure(state: GameState): string[] {
  const { launched, staff } = state;
  const hits = launched.filter((lp) => lp.verdict === "hit" || lp.verdict === "solid").length;
  const totalMade = launched.reduce((s, lp) => s + (lp.plannedUnits ?? 0), 0);
  const totalSold = launched.reduce((s, lp) => s + lp.unitsSold, 0);
  const tips: string[] = [];

  if (launched.length === 0) {
    tips.push("No product launched before cash ran out, fixed costs burn even without a team. Get to market in the first 10 weeks.");
  } else if (hits === 0 && launched.length >= 2) {
    tips.push("All launches flopped. Check the Market tab for rising trends and watch the competition landscape before designing.");
  }

  if (totalMade > 150 && totalSold < totalMade * 0.45 && tips.length < 2) {
    tips.push("More than half of manufactured units went unsold, that's cash locked in inventory. Use 'Recommended' run sizes and plan small early.");
  } else if (staff.length >= 4 && launched.length <= 1 && tips.length < 2) {
    tips.push("Payroll grew faster than revenue. Keep the team lean (1–2 people) until at least one product is generating consistent income.");
  }

  return tips;
}

function BankruptOverlay() {
  const { state, restart } = useGame();
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true);
  const [showCard, setShowCard] = useState(false);
  const bestRevProduct = state.launched.reduce<{ product: { name: string }; revenueToDate: number } | null>(
    (top, lp) => (top == null || lp.revenueToDate > top.revenueToDate ? lp : top),
    null,
  );
  const hitsCount = state.launched.filter((lp) => lp.verdict === "hit" || lp.verdict === "solid").length;
  const diagnosis = diagnoseFailure(state);
  if (showCard) {
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
          <h2 className="bankrupt__title" id="bankrupt-title">Your story</h2>
          <ResultCard state={state} result={null} variant="postmortem" />
          <Button block variant="secondary" onClick={() => setShowCard(false)}>Back</Button>
          <Button block onClick={restart}>Start a new company</Button>
        </div>
      </div>
    );
  }
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
        <Button block variant="secondary" onClick={() => setShowCard(true)}>
          <Sparkles size={15} /> View shareable card
        </Button>
        <Button block onClick={restart}>Start a new company</Button>
      </div>
    </div>
  );
}
