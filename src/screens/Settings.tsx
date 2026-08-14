import { useEffect, useState } from "react";
import {
  Bell,
  Boxes,
  Check,
  Contrast,
  Download,
  Layers,
  Lock,
  Monitor,
  Moon,
  RotateCcw,
  Sun,
  Upload,
  Volume2,
  Smartphone,
  Sparkles,
  Crown,
  ExternalLink,
  History,
  TrendingUp,
} from "lucide-react";
import { Button, Sheet } from "../design/primitives.tsx";
import { showToast } from "../design/toast.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { format, toDollars, type Money } from "../engine/money.ts";
import { isLocked } from "../state/proGates.ts";
import { agoLabel, listSnapshots, MAX_SNAPSHOTS, SNAPSHOT_EVERY_WEEKS, type SnapshotMeta } from "../state/timeMachine.ts";
import { founderIntentLabel } from "../state/founderIntent.ts";
import { getProRecord } from "../state/pro.ts";
import { netWorth, type InterruptPace } from "../state/gameState.ts";
import { setSettings, useSettings, type ThemePref } from "../state/settings.ts";
import { disableDailyReminders, enableDailyReminders, notificationsAvailable } from "../state/notifications.ts";
import { hasSandboxEntitlement } from "../state/entitlements.ts";
import { IAP_ENTITLEMENT_EVENT } from "../state/iap.ts";
import { manageProSubscription, proPurchasesAvailable, restorePro } from "../state/proStore.ts";
import { openPaywall } from "../state/paywall.ts";
import { useIsPro, useProStatus } from "../state/usePro.ts";
import { useGame } from "../state/useGame.tsx";
import { useReducedMotionLive, webglSupported } from "../garage3d/support.ts";
import "./settings.css";

const THEMES: { id: ThemePref; label: string; Icon: typeof Sun }[] = [
  { id: "system", label: "System", Icon: Monitor },
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
];

// Calm Mode — how often the game may raise opportunistic full-screen cards (rival strikes, eureka
// moments, community asks, regional events, staff moments…). Standard is the built-in cadence;
// Relaxed and Calm widen the shared quiet gap so moments land rarer and each one carries more weight.
const PACES: { id: InterruptPace; label: string; sub: string }[] = [
  { id: "standard", label: "Standard", sub: "The normal flow of moments." },
  { id: "relaxed", label: "Relaxed", sub: "About half as many interruptions." },
  { id: "calm", label: "Calm", sub: "The quietest — roughly a third as many." },
];

export function Settings({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const reducedMotion = useReducedMotionLive();
  const { state, restart, unlockPlatform, setInterruptPace } = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const net = netWorth(state);
  const hits = state.launched.filter((lp) => lp.verdict === "hit" || lp.verdict === "solid").length;
  const hitRate = state.launched.length > 0 ? Math.round((hits / state.launched.length) * 100) : 0;

  return (
    <div className="set">
      <h2 className="set__title">Settings</h2>

      {state.companyName && (
        <div className="set__company">
          <span className="set__company-name">{state.companyName}</span>
          <div className="set__company-stats">
            <span className="set__company-stat"><span className="set__company-stat-label">Week</span>{state.week}</span>
            <span className="set__company-stat"><span className="set__company-stat-label">Products</span>{state.launched.length}</span>
            <span className="set__company-stat"><span className="set__company-stat-label">Hit rate</span>{state.launched.length > 0 ? `${hitRate}%` : "—"}</span>
            <span className="set__company-stat"><span className="set__company-stat-label">Revenue</span>{format(state.cumulativeRevenue)}</span>
            <span className="set__company-stat">
              <span className="set__company-stat-label">Net worth</span>
              {/* Debt-negative net worth is real information — show it red, don't hide it. */}
              <span style={toDollars(net) < 0 ? { color: "var(--negative-text)" } : undefined}>{format(net)}</span>
            </span>
          </div>
        </div>
      )}

      <div className="set__group">
        <span className="set__group-label">Appearance</span>
        <div className="set__seg">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`set__seg-opt${settings.theme === t.id ? " set__seg-opt--on" : ""}`}
              aria-pressed={settings.theme === t.id}
              aria-label={`${t.label} theme`}
              onClick={() => {
                haptic.light();
                sfx("toggle");
                setSettings({ theme: t.id });
              }}
            >
              <t.Icon size={16} /> {t.label}
            </button>
          ))}
        </div>
        <Row icon={<Contrast size={18} />} label="High contrast" sub="Stronger borders, text and focus rings for low-vision readability.">
          <Switch label="High contrast" on={settings.highContrast} onChange={(v) => { setSettings({ highContrast: v }); sfx("toggle"); }} />
        </Row>
      </div>

      <div className="set__group">
        {/* Two OS-level conditions override this switch — Reduce Motion (the 3D office animates
            constantly: the team fidget, lights flicker, the camera drifts) and a GPU with no WebGL2.
            Left unsaid, the control just sat there doing nothing when flipped, which reads as a
            broken switch rather than a respected preference. Say which one is in force. */}
        <Row
          icon={<Boxes size={18} />}
          label="3D headquarters"
          sub={
            !webglSupported()
              ? "This device can't run the 3D office — the 2D scene is always used."
              : reducedMotion
                ? "Reduce Motion is on, so the calmer 2D scene is used."
                : "Real-time 3D office. Off uses the lighter 2D scene."
          }
        >
          <Switch
            label="3D headquarters"
            on={settings.garage3d && !reducedMotion && webglSupported()}
            disabled={reducedMotion || !webglSupported()}
            onChange={(v) => { setSettings({ garage3d: v }); sfx("toggle"); }}
          />
        </Row>
        <Row icon={<Volume2 size={18} />} label="Sound effects">
          <Switch label="Sound effects" on={settings.sound} onChange={(v) => { setSettings({ sound: v }); if (v) sfx("toggle"); }} />
        </Row>
        <Row icon={<Smartphone size={18} />} label="Haptics">
          <Switch label="Haptics" on={settings.haptics} onChange={(v) => { setSettings({ haptics: v }); if (v) haptic.light(); }} />
        </Row>
        {/* Native-only (hidden on web, like the IAP row): one opt-in, event-driven reminder —
            the daily challenge reset. Off by default; no streaks or marketing pings, ever. */}
        {notificationsAvailable() && (
          <Row icon={<Bell size={18} />} label="Daily challenge reminder" sub="One notification at 10:00 when a new challenge is live.">
            <Switch
              label="Daily challenge reminder"
              on={settings.dailyReminder}
              onChange={(v) => {
                sfx("toggle");
                if (!v) { void disableDailyReminders(); return; }
                void enableDailyReminders().then((granted) => {
                  if (!granted) showToast("Notifications are off for Silicon in iOS Settings", { tone: "neutral" });
                });
              }}
            />
          </Row>
        )}
      </div>

      <div className="set__group">
        <span className="set__group-label">Interruptions</span>
        <p className="set__group-note">
          How often the game pauses you with a full-screen moment. Turn it down to keep the focus on
          building — nothing is lost, the rarer moments just carry more weight.
        </p>
        <div className="set__seg" role="group" aria-label="Interruption frequency">
          {PACES.map((p) => {
            const on = (settings.interruptPace ?? "standard") === p.id;
            return (
              <button
                key={p.id}
                className={`set__seg-opt${on ? " set__seg-opt--on" : ""}`}
                aria-pressed={on}
                aria-label={`${p.label} interruptions`}
                onClick={() => {
                  haptic.light();
                  sfx("toggle");
                  setInterruptPace(p.id);
                }}
              >
                <Bell size={16} /> {p.label}
              </button>
            );
          })}
        </div>
        <p className="set__group-note">{PACES.find((p) => p.id === (settings.interruptPace ?? "standard"))?.sub}</p>
      </div>

      <ProGroup />

      <TimeMachineGroup onClose={onClose} />

      <CreativeModeGroup />

      {/* The Platform division is founded in-game as an earned cash milestone (Company tab). In
          Creative mode it can be toggled free for experimentation. */}
      {state.sandboxUnlocked && (
        <div className="set__group">
          <span className="set__group-label">Creative overrides</span>
          <Row icon={<Layers size={18} />} label="Platform Division" sub="Found the OS division for free (Creative only). In normal play you save up to found it from the Company tab.">
            <Switch label="Platform Division" on={state.platformUnlocked} onChange={(v) => { unlockPlatform(v); sfx("toggle"); }} />
          </Row>
        </div>
      )}

      <div className="set__group">
        <span className="set__group-label">Backup</span>
        <p className="set__group-note">
          Your company lives only on this device. Export a backup before switching devices or
          clearing your browser.
        </p>
        <div className="set__pair">
          <ExportButton />
          <Button variant="secondary" onClick={() => { setImportOpen(true); }}>
            <Upload size={16} /> Import save
          </Button>
        </div>
      </div>

      <div className="set__group">
        {confirmReset ? (
          <div className="set__confirm" role="group" aria-label="Confirm starting a new company">
            <span className="set__confirm-text">Start over and lose this company?</span>
            <div className="set__confirm-row">
              <Button variant="tertiary" onClick={() => setConfirmReset(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { restart(); onClose(); }}>Restart</Button>
            </div>
          </div>
        ) : (
          <Button block variant="tertiary" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={16} /> New company
          </Button>
        )}
      </div>

      <p className="set__about">Silicon: Tech Tycoon · v{typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev"}</p>
      <Button block onClick={onClose}>Done</Button>

      <Sheet open={importOpen} onClose={() => setImportOpen(false)} label="Import save">
        <ImportPanel onDone={() => { setImportOpen(false); onClose(); }} onCancel={() => setImportOpen(false)} />
      </Sheet>
    </div>
  );
}

/** Copies the backup string to the clipboard AND offers a file download. */
function ExportButton() {
  const { exportSave } = useGame();
  const [copied, setCopied] = useState(false);

  const run = async () => {
    const data = exportSave();
    // 1) Clipboard with a textarea fallback for browsers/WebViews without the async API.
    const ok = await copyText(data);
    // 2) Always also offer a download so a backup exists even if the clipboard is blocked.
    downloadText(data, `silicon-save-${stamp()}.txt`);
    haptic.success();
    sfx("confirm");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast(ok ? "Backup copied & downloaded" : "Backup downloaded", {
      glyph: <Download size={15} />,
      tone: "positive",
    });
  };

  return (
    <Button onClick={run}>
      {copied ? <Check size={16} /> : <Download size={16} />} {copied ? "Exported" : "Export save"}
    </Button>
  );
}

function ImportPanel({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { importSave } = useGame();
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);

  const apply = () => {
    const ok = importSave(text.trim());
    if (!ok) {
      haptic.error();
      sfx("toggle");
      showToast("That backup couldn't be read", { tone: "negative" });
      setConfirming(false);
      return;
    }
    haptic.success();
    sfx("confirm");
    showToast("Save imported", { glyph: <Check size={15} />, tone: "positive" });
    onDone();
  };

  return (
    <div className="set__import">
      <h2 className="set__import-title">Import save</h2>
      {confirming ? (
        <>
          <p className="set__import-text">
            Importing replaces your current company. This can't be undone. Export a backup first if
            you want to keep it.
          </p>
          <div className="set__pair">
            <Button variant="tertiary" onClick={() => setConfirming(false)}>Back</Button>
            <Button variant="destructive" onClick={apply}>Replace company</Button>
          </div>
        </>
      ) : (
        <>
          <p className="set__import-text">Paste a backup string exported from Silicon.</p>
          <textarea
            className="set__textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="SILICON1:…"
            aria-label="Paste backup string"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            rows={5}
          />
          <div className="set__pair">
            <Button variant="tertiary" onClick={onCancel}>Cancel</Button>
            <Button disabled={!text.trim()} onClick={() => setConfirming(true)}>
              <Upload size={16} /> Import
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- backup helpers ---------- */

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Clipboard write with a hidden-textarea + execCommand fallback. Resolves false if both fail. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Triggers a file download of `text` via a transient object-URL anchor. */
function downloadText(text: string, filename: string): void {
  try {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* download unsupported, the clipboard copy still gives the player their backup */
  }
}

/**
 * Silicon Pro — subscription standing, management, and restore.
 *
 * Apple requires that a subscriber can always see WHAT they're subscribed to and reach a cancel
 * path from inside the app. `manageProSubscription()` opens Apple's own sheet (falling back to the
 * account URL), so cancelling is never more than two taps away. Restore lives here as well as on
 * the paywall, because a returning user who reinstalls looks in Settings first.
 */
function ProGroup() {
  const { pro, line } = useProStatus();
  const [busy, setBusy] = useState(false);
  const onMonthly = pro && getProRecord()?.tier === "monthly";
  const ambition = founderIntentLabel();

  async function restore() {
    if (busy) return;
    setBusy(true);
    // `finally`, not a trailing reset: if restorePro() ever rejects, a trailing setBusy(false) is
    // skipped and the button stays disabled for the life of the sheet.
    try {
      const { restored } = await restorePro();
      if (restored) {
        haptic.success();
        sfx("confirm");
        showToast("Purchases restored — Silicon Pro is active", { tone: "positive" });
      } else {
        showToast("No previous purchases found for this Apple ID.", { tone: "neutral" });
      }
    } catch {
      showToast("Couldn't reach the App Store. Please try again.", { tone: "negative" });
    } finally {
      setBusy(false);
    }
  }

  // A native build with the purchase path deliberately dark: don't render a CTA that dead-ends —
  // App Review taps every visible purchase entry point.
  if (!pro && !proPurchasesAvailable()) return null;

  return (
    <div className="set__group">
      <span className="set__group-label">Silicon Pro</span>
      <Row
        icon={<Crown size={18} />}
        label={pro ? "Subscription" : "Silicon Pro"}
        sub={pro ? line : "The Platform & AI eras, every scenario, New Game+, Creative Mode, the Vault and the Museum."}
      >
        {pro ? <span className="set__pro-badge">Active</span> : null}
      </Row>
      {/* Monthly → Yearly. Offered only to someone already on Monthly, and stated as what it is:
          the same Pro for less money per month. StoreKit treats it as a crossgrade inside the
          subscription group — Apple prorates the remainder, so there is no double charge and no
          need to cancel first. Good for the player and good for retention, which is the only kind
          of upsell worth building. */}
      {pro && onMonthly && (
        <Button
          block
          // `force` is required: openPaywall deliberately short-circuits for subscribers, and this
          // is the one offer that legitimately targets one. Without it the button does nothing.
          onClick={() => { haptic.light(); openPaywall({ reason: "upgradeYearly", force: true }); }}
        >
          <TrendingUp size={16} /> Switch to Yearly and pay less
        </Button>
      )}
      {pro ? (
        <Button block variant="secondary" onClick={() => { haptic.light(); void manageProSubscription(); }}>
          <ExternalLink size={16} /> Manage subscription
        </Button>
      ) : (
        <Button block onClick={() => { haptic.light(); openPaywall({ reason: "onboarding" }); }}>
          <Sparkles size={16} /> See what's in Pro
        </Button>
      )}
      <button className="set__restore" onClick={restore} disabled={busy}>
        {busy ? "Restoring…" : "Restore purchases"}
      </button>
      {/* The ambition stated during founding, kept visible so the founding brief is a thing the
          player set rather than a question that vanished into a sales funnel. */}
      {ambition && <p className="set__group-note">Your founding brief: “{ambition}”</p>}
    </div>
  );
}

/**
 * The Time Machine (Pro) — rolling quarterly snapshots of the campaign, and a way back to any of
 * them. See `state/timeMachine.ts` for why this, of everything in Pro, is the feature that makes a
 * *subscription* make sense for a game: it's an ongoing service rather than a one-off unlock.
 *
 * Locked, it still shows the pitch and stays tappable — a free player should be able to find out
 * what the safety net is before they need it, not after they've lost a twenty-hour company.
 */
function TimeMachineGroup({ onClose }: { onClose: () => void }) {
  const { state, rewindTo } = useGame();
  const pro = useIsPro();
  const locked = isLocked("timeMachine", pro);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>(() => (locked ? [] : listSnapshots()));
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => { if (!locked) setSnapshots(listSnapshots()); }, [locked]);

  if (locked) {
    return (
      <div className="set__group">
        <span className="set__group-label">Time Machine</span>
        <div className="set__row">
          <span className="set__row-icon"><History size={18} /></span>
          <div className="set__row-text">
            <span className="set__row-label">Rewind your company</span>
            <span className="set__row-sub">
              Pro snapshots your company every quarter and keeps the last {MAX_SNAPSHOTS}. One bad
              launch no longer ends the run. Campaign only — scenarios and challenges stay scored on
              their own terms.
            </span>
          </div>
        </div>
        <Button block onClick={() => { haptic.light(); openPaywall({ reason: "timeMachine" }); }}>
          <Crown size={16} /> Unlock with Pro
        </Button>
      </div>
    );
  }

  // A side trip isn't snapshotted, so say why the list looks frozen rather than leaving the player
  // wondering whether the feature is broken.
  const onSideTrip = state.activeScenario != null || state.activeChallenge != null;
  const confirming = confirmId ? snapshots.find((s) => s.id === confirmId) : null;

  return (
    <div className="set__group">
      <span className="set__group-label">Time Machine</span>
      <p className="set__group-note">
        {onSideTrip
          ? "Paused during scenarios and challenges — those are scored runs, so they're played straight through. Your campaign's snapshots are safe and waiting."
          : `A snapshot of your company every ${SNAPSHOT_EVERY_WEEKS} weeks. The last ${MAX_SNAPSHOTS} are kept.`}
      </p>

      {snapshots.length === 0 ? (
        <p className="set__group-note">
          Nothing saved yet — the first snapshot lands at week {SNAPSHOT_EVERY_WEEKS}.
        </p>
      ) : confirming ? (
        <div className="set__confirm" role="group" aria-label="Confirm rewind">
          <span className="set__confirm-text">
            Rewind {confirming.companyName} to week {confirming.week}? Everything since then — {" "}
            {Math.max(0, state.week - confirming.week)} week
            {Math.max(0, state.week - confirming.week) === 1 ? "" : "s"} of play — is replaced. This
            can't be undone.
          </span>
          <div className="set__confirm-row">
            <Button variant="tertiary" onClick={() => setConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                const ok = rewindTo(confirming.id);
                haptic[ok ? "success" : "error"]();
                showToast(
                  ok ? `Rewound to week ${confirming.week}` : "That snapshot couldn't be read",
                  { tone: ok ? "positive" : "negative" },
                );
                setConfirmId(null);
                if (ok) onClose();
              }}
            >
              Rewind
            </Button>
          </div>
        </div>
      ) : (
        <ul className="set__snaps">
          {snapshots.map((s) => (
            <li key={s.id} className="set__snap">
              <span className="set__snap-info">
                <span className="set__snap-week">Week {s.week}</span>
                <span className="set__snap-sub">
                  {s.products} product{s.products === 1 ? "" : "s"} · {format(s.cash as Money)} · {agoLabel(s.savedAt)}
                </span>
              </span>
              <Button size="sm" variant="secondary" onClick={() => { haptic.light(); setConfirmId(s.id); }}>
                <History size={14} /> Rewind
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Creative Mode. Included with Pro; also still owned outright by anyone who bought the standalone
 *  unlock during the paid era — that purchase is honoured forever and is never re-sold to them. */
function CreativeModeGroup() {
  const { state, setSandboxActive } = useGame();
  const pro = useIsPro();
  const [ownedOutright, setOwnedOutright] = useState(() => hasSandboxEntitlement());

  // Out-of-band approvals (Ask-to-Buy / Family Sharing) grant the entitlement from a native
  // callback; refresh live so the toggle appears without needing a remount.
  useEffect(() => {
    const refresh = () => setOwnedOutright(hasSandboxEntitlement());
    window.addEventListener(IAP_ENTITLEMENT_EVENT, refresh);
    return () => window.removeEventListener(IAP_ENTITLEMENT_EVENT, refresh);
  }, []);

  const available = pro || ownedOutright;

  return (
    <div className="set__group">
      <span className="set__group-label">Creative Mode</span>
      {available ? (
        <Row
          icon={<Sparkles size={18} />}
          label="Sandbox mode"
          sub={state.sandboxUnlocked ? "Active, unlimited funds & research. Design freely." : "Toggle on to design without limits, unlimited money & research."}
        >
          <Switch label="Sandbox mode" on={state.sandboxUnlocked} onChange={(v) => { setSandboxActive(v); haptic.light(); sfx("toggle"); }} />
        </Row>
      ) : (
        <>
          {/* full-width description + CTA on its own row: a wide "Unlock" button inline with the
              text squeezed the copy into an unreadable narrow column (same trap as the coach card). */}
          <div className="set__row">
            <span className="set__row-icon"><Lock size={18} /></span>
            <div className="set__row-text">
              <span className="set__row-label">Creative Mode</span>
              <span className="set__row-sub">Design freely with no financial limits: an unlimited cash floor so you can never go bankrupt. Included with Silicon Pro.</span>
            </div>
          </div>
          <Button block onClick={() => { haptic.light(); openPaywall({ reason: "creativeMode", onUnlocked: () => setSandboxActive(true) }); }}>
            <Crown size={16} /> Unlock with Pro
          </Button>
        </>
      )}
    </div>
  );
}

function Row({ icon, label, sub, children }: { icon: React.ReactNode; label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="set__row">
      <span className="set__row-icon">{icon}</span>
      <div className="set__row-text">
        <span className="set__row-label">{label}</span>
        {sub && <span className="set__row-sub">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      className={`set__switch${on ? " set__switch--on" : ""}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      // `disabled` is for a switch the DEVICE is overriding (Reduce Motion, no WebGL2), never for a
      // preference the player could set — its Row always says which override is in force, so this
      // reads as "respected", not "broken".
      disabled={disabled}
      onClick={() => { haptic.light(); onChange(!on); }}
    >
      <span className="set__switch-knob" />
    </button>
  );
}
