import { useEffect, useState } from "react";
import {
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
} from "lucide-react";
import { Button, Sheet } from "../design/primitives.tsx";
import { showToast } from "../design/toast.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { format, toDollars } from "../engine/money.ts";
import { netWorth } from "../state/gameState.ts";
import { setSettings, useSettings, type ThemePref } from "../state/settings.ts";
import { hasSandboxEntitlement } from "../state/entitlements.ts";
import { getSandboxProduct, iapAvailable, purchaseSandbox, restoreSandbox, IAP_ENTITLEMENT_EVENT, type ProductInfo } from "../state/iap.ts";
import { useGame } from "../state/useGame.tsx";
import "./settings.css";

const THEMES: { id: ThemePref; label: string; Icon: typeof Sun }[] = [
  { id: "system", label: "System", Icon: Monitor },
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
];

export function Settings({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const { state, restart, unlockPlatform } = useGame();
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
            <span className="set__company-stat"><span className="set__company-stat-label">Net worth</span>{toDollars(net) > 0 ? format(net) : "—"}</span>
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
        <Row icon={<Boxes size={18} />} label="3D headquarters" sub="Real-time 3D office. Off uses the lighter 2D scene.">
          <Switch label="3D headquarters" on={settings.garage3d} onChange={(v) => { setSettings({ garage3d: v }); sfx("toggle"); }} />
        </Row>
        <Row icon={<Volume2 size={18} />} label="Sound effects">
          <Switch label="Sound effects" on={settings.sound} onChange={(v) => { setSettings({ sound: v }); if (v) sfx("toggle"); }} />
        </Row>
        <Row icon={<Smartphone size={18} />} label="Haptics">
          <Switch label="Haptics" on={settings.haptics} onChange={(v) => { setSettings({ haptics: v }); if (v) haptic.light(); }} />
        </Row>
      </div>

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
          <div className="set__confirm">
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

      <p className="set__about">Silicon: Tech Tycoon · v1.0.0</p>
      <Button block onClick={onClose}>Done</Button>

      <Sheet open={importOpen} onClose={() => setImportOpen(false)}>
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
            Importing replaces your current company. This can't be undone — export a backup first if
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
    /* download unsupported — the clipboard copy still gives the player their backup */
  }
}

/** Creative mode — the single v1 IAP. Locked behind a one-time purchase (the device-level
 *  entitlement); once owned, a free toggle activates/deactivates it for the current game. */
function CreativeModeGroup() {
  const { state, setSandboxActive } = useGame();
  const [owned, setOwned] = useState(() => hasSandboxEntitlement());
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getSandboxProduct().then((p) => { if (live) setProduct(p); });
    return () => { live = false; };
  }, []);

  // Out-of-band approvals (Ask-to-Buy / Family Sharing) grant the entitlement from a native
  // callback; refresh the owned state live so the toggle appears without needing a remount.
  useEffect(() => {
    const refresh = () => setOwned(hasSandboxEntitlement());
    window.addEventListener(IAP_ENTITLEMENT_EVENT, refresh);
    return () => window.removeEventListener(IAP_ENTITLEMENT_EVENT, refresh);
  }, []);

  async function buy() {
    if (busy) return;
    setBusy(true);
    const res = await purchaseSandbox();
    setBusy(false);
    if (res.status === "purchased") {
      setOwned(true);
      setSandboxActive(true);
      haptic.success();
      sfx("confirm");
      showToast("Creative Mode unlocked", { tone: "positive" });
    } else if (res.status === "pending") {
      // Ask-to-Buy / SCA: the charge is awaiting approval. It'll unlock automatically once it
      // clears (the native transaction listener grants the entitlement).
      showToast(res.message ?? "Purchase pending approval.", { tone: "neutral" });
    } else if (res.status !== "cancelled") {
      haptic.error();
      showToast(res.message ?? "Purchase unavailable right now.", { tone: "negative" });
    }
  }

  async function restore() {
    const res = await restoreSandbox();
    if (res.restored) {
      setOwned(true);
      haptic.success();
      showToast("Purchases restored — Creative Mode unlocked.", { tone: "positive" });
    } else {
      showToast("No previous purchases found.", { tone: "neutral" });
    }
  }

  // Unwired native build: no working purchase path, so don't show a buy button that dead-ends
  // (App Review tests every visible IAP entry point). Owners who already hold the entitlement
  // (e.g. granted by a future wired build) still get their toggle.
  if (!owned && !iapAvailable()) return null;

  return (
    <div className="set__group">
      <span className="set__group-label">Creative Mode</span>
      {owned ? (
        <Row
          icon={<Sparkles size={18} />}
          label="Sandbox mode"
          sub={state.sandboxUnlocked ? "Active — unlimited funds & research. Design freely." : "Owned. Toggle on to design without limits — unlimited money & research."}
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
              <span className="set__row-sub">Design freely with no financial limits — an unlimited cash floor so you can never go bankrupt.</span>
            </div>
          </div>
          <Button block onClick={buy} disabled={busy}>
            {busy ? "…" : `Unlock · ${product?.price ?? "$2.99"}`}
          </Button>
          <button className="set__restore" onClick={restore}>Restore purchase</button>
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

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      className={`set__switch${on ? " set__switch--on" : ""}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => { haptic.light(); onChange(!on); }}
    >
      <span className="set__switch-knob" />
    </button>
  );
}
