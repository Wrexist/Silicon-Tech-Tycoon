import { useEffect, useState } from "react";
import { AlertTriangle, CircuitBoard, CircleX, RotateCcw, TrendingUp } from "lucide-react";
import { GameProvider, useGame } from "./state/useGame.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { Hud } from "./components/Hud.tsx";
import { BottomNav, type Tab } from "./components/BottomNav.tsx";
import { Coach } from "./components/Coach.tsx";
import { ToastHost } from "./design/toast.tsx";
import { GainFX } from "./design/GainFX.tsx";
import { SoundFX } from "./design/SoundFX.tsx";
import { Sheet } from "./design/primitives.tsx";
import { Settings } from "./screens/Settings.tsx";
import { Button, Card } from "./design/primitives.tsx";
import { AnimatedMoney } from "./design/AnimatedNumber.tsx";
import { format, type Money } from "./engine/money.ts";
import { canAdvance, ipoValuation } from "./state/gameState.ts";
import { HQ } from "./screens/HQ.tsx";
import { DesignLab } from "./screens/DesignLab.tsx";
import { Research } from "./screens/Research.tsx";
import { Market } from "./screens/Market.tsx";
import { Company } from "./screens/Company.tsx";
import "./App.css";

const TAB_TITLE: Record<Tab, string> = {
  hq: "Silicon",
  design: "Design Lab",
  research: "Research & Development",
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
          {tab === "design" && <DesignLab />}
          {tab === "research" && <Research />}
          {tab === "market" && <Market />}
          {tab === "company" && <Company />}
        </ErrorBoundary>
        <div className="app__spacer" />
      </main>

      <Coach tab={tab} onNavigate={setTab} />

      <BottomNav
        active={tab}
        onChange={setTab}
        badge={{ hq: canAdvance(state) }}
      />

      <GainFX />
      <SoundFX />
      <ToastHost />
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <Settings onClose={() => setSettingsOpen(false)} />
      </Sheet>
      {offline && <OfflineSheet weeks={offline.weeks} gain={offline.gain} onClose={clearOffline} />}
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

function IpoOverlay({ onDismiss }: { onDismiss: () => void }) {
  const { state, prestige } = useGame();
  return (
    <div className="ipo">
      <div className="ipo__inner">
        <div className="ipo__glyph"><TrendingUp size={30} strokeWidth={2.2} /></div>
        <h2 className="ipo__title">You went public</h2>
        <p className="ipo__text">
          {state.legacy > 0 ? `Empire #${state.legacy + 1} ` : "Your company "}reached the top.
        </p>
        <Card variant="inset" className="app__offline-card">
          <span className="app__offline-label">IPO valuation</span>
          <span className="app__offline-value rounded tnum">{format(ipoValuation(state))}</span>
        </Card>
        <p className="ipo__sub">
          Start <b>New Game+</b> to found your next company with a permanent legacy bonus, or keep
          building this one.
        </p>
        <Button block onClick={prestige}>Start New Game+ (Legacy {state.legacy + 1})</Button>
        <Button block variant="tertiary" onClick={onDismiss}>Keep building</Button>
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
  return (
    <div className="ds-sheet-scrim" onClick={onClose}>
      <div className="ds-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ds-sheet__grab" />
        <h2 className="app__sheet-title">While you were away</h2>
        <p className="app__sheet-text">
          {weeks} {weeks === 1 ? "week" : "weeks"} passed. Your products kept selling.
        </p>
        <Card variant="inset" className="app__offline-card">
          <span className="app__offline-label">Net change</span>
          <AnimatedMoney value={gain} sign className="app__offline-value rounded" />
        </Card>
        <Button block onClick={onClose}>Continue</Button>
      </div>
    </div>
  );
}

function BankruptOverlay() {
  const { state, restart } = useGame();
  return (
    <div className="bankrupt">
      <div className="bankrupt__inner">
        <div className="bankrupt__glyph"><CircleX size={30} strokeWidth={2} /></div>
        <h2 className="bankrupt__title">Out of cash</h2>
        <p className="bankrupt__text">
          The company ran out of money in week {state.week}. Every empire starts somewhere — try again.
        </p>
        <Button block onClick={restart}>Start a new company</Button>
      </div>
    </div>
  );
}
