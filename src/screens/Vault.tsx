// The Vault — the classified-dossier board (engine/secrets.ts), opened from the Progress hub.
//
// The design job here is restraint: a sealed file must LOOK like it's hiding something worth the
// hunt, without leaking a single word of it. So a sealed card renders a redaction block where its
// codename goes, its tier, and one button — "run down the lead" — and nothing else. A rumoured card
// trades the redaction for the codename and the whisper. Only a decrypted card shows the terms, the
// live progress bar and the reward. An opened file goes gold and states what it granted.
//
// This screen READS the run state and calls exactly two reducers: investigateSecret (buy one stage of
// intel) and markVaultSeen (clear the "new" pips when you leave).
import { useEffect } from "react";
import { ChevronLeft, FileLock2, FileSearch, Lock, Sparkles } from "lucide-react";
import { Button } from "../design/primitives.tsx";
import { format } from "../engine/money.ts";
import {
  SECRET_COUNT,
  STAGE_DECRYPTED,
  STAGE_RUMORED,
  STAGE_SEALED,
  STAGE_UNEARTHED,
  TIER_NAMES,
  TIER_SEALED_COPY,
  secretById,
  type SecretTier,
} from "../engine/secrets.ts";
import { getCodex } from "../state/secretsProfile.ts";
import { vaultCards, vaultSummary } from "../state/gameState.ts";
import { useGame } from "../state/useGame.tsx";
import "./vault.css";

/** A block of redaction glyphs — the visual promise that there IS a name under there. */
function Redacted({ length = 9 }: { length?: number }) {
  return (
    <span className="vlt__redacted" aria-label="Classified">
      {"▓".repeat(length)}
    </span>
  );
}

function TierChip({ tier }: { tier: SecretTier }) {
  return <span className={`vlt__tier vlt__tier--t${tier}`}>{TIER_NAMES[tier]}</span>;
}

export function VaultSheet({ onClose }: { onClose: () => void }) {
  const { state, investigateSecret, markVaultSeen } = useGame();
  const summary = vaultSummary(state);
  const cards = vaultCards(state);
  // Files this founder has opened in a PREVIOUS company: the codex remembers the terms forever, even
  // though the boon itself must be earned again in this run.
  const codex = new Set(getCodex());

  // Looking at the board is what "seeing" a lead means — stamp it on the way out so the badge clears.
  useEffect(() => () => markVaultSeen(), [markVaultSeen]);

  if (!summary.open) {
    return (
      <div className="vlt">
        <button className="vlt__back" onClick={onClose}><ChevronLeft size={16} aria-hidden /> Progress</button>
        <div className="vlt__head">
          <div>
            <h2 className="vlt__title">The Vault</h2>
            <p className="vlt__sub">Sealed until you're a company worth keeping files on.</p>
          </div>
        </div>
        <div className="vlt__shut">
          <span className="vlt__shut-glyph" aria-hidden><Lock size={26} /></span>
          <p className="vlt__shut-copy">
            {summary.enabled
              ? `There are ${SECRET_COUNT} files in here. Ship your first product and the archive opens.`
              : "This company was founded before the archive existed. Your next one will have it."}
          </p>
        </div>
        <Button block variant="secondary" onClick={onClose}>Done</Button>
      </div>
    );
  }

  return (
    <div className="vlt">
      <button className="vlt__back" onClick={onClose}><ChevronLeft size={16} aria-hidden /> Progress</button>

      <div className="vlt__head">
        <div>
          <h2 className="vlt__title">The Vault</h2>
          <p className="vlt__sub">
            Files nobody told you about. Each one opens on a thing you did without being asked — and pays
            for it, permanently.
          </p>
        </div>
        <span className="vlt__count tnum" aria-label={`${summary.found} of ${summary.total} files open`}>
          {summary.found}<span className="vlt__count-total">/{summary.total}</span>
        </span>
      </div>

      {summary.title && (
        <p className="vlt__honorific"><Sparkles size={13} aria-hidden /> {summary.title}</p>
      )}

      <ul className="vlt__list">
        {cards.map((card) => {
          const known = card.stage < STAGE_UNEARTHED && codex.has(card.id);
          const remembered = known ? secretById(card.id) : undefined;
          const open = card.stage === STAGE_UNEARTHED;
          const stateClass = open
            ? " vlt__row--open"
            : card.stage === STAGE_DECRYPTED
              ? " vlt__row--decrypted"
              : card.stage === STAGE_RUMORED
                ? " vlt__row--rumored"
                : " vlt__row--sealed";
          return (
            <li key={card.id} className={`vlt__row${stateClass}`}>
              <div className="vlt__row-top">
                <span className="vlt__row-glyph" aria-hidden>
                  {open ? <FileLock2 size={17} /> : card.stage === STAGE_SEALED ? <Lock size={16} /> : <FileSearch size={17} />}
                </span>
                <span className="vlt__row-name">
                  {card.codename ?? remembered?.codename ?? <Redacted length={card.tier * 3 + 4} />}
                </span>
                {card.isNew && <span className="vlt__new">New</span>}
                {open ? <span className="vlt__open-pill">Opened</span> : <TierChip tier={card.tier} />}
              </div>

              {/* Sealed: one line of atmosphere and nothing that could be mistaken for a hint. */}
              {card.stage === STAGE_SEALED && !known && (
                <p className="vlt__row-sealed-copy">{TIER_SEALED_COPY[card.tier]}</p>
              )}

              {/* Rumoured: the whisper. Evocative, deliberately not actionable. */}
              {card.whisper && card.stage < STAGE_DECRYPTED && (
                <p className="vlt__row-whisper">“{card.whisper}”</p>
              )}

              {/* Remembered from a past company — the codex shows the terms even while it's sealed here. */}
              {known && card.stage < STAGE_DECRYPTED && remembered && (
                <p className="vlt__row-codex">
                  <span className="vlt__row-codex-tag">From your codex</span> {remembered.requirement}
                </p>
              )}

              {/* Decrypted: the terms, the live bar and the named reward. */}
              {card.requirement && <p className="vlt__row-req">{card.requirement}</p>}
              {(card.stage >= STAGE_DECRYPTED || known) && !open && (
                <>
                  <div className="vlt__bar" aria-hidden>
                    <div className="vlt__fill" style={{ width: `${Math.round(card.progress.frac * 100)}%` }} />
                  </div>
                  <span className="vlt__row-progress tnum">
                    {card.progress.have}/{card.progress.need} {card.progress.unit}
                  </span>
                </>
              )}
              {card.rewardLabel && !open && (
                <p className="vlt__row-reward"><Sparkles size={11} aria-hidden /> {card.rewardLabel}</p>
              )}

              {/* Opened: what it granted, stated plainly and permanently. */}
              {open && (
                <p className="vlt__row-granted">
                  <Sparkles size={11} aria-hidden /> {secretById(card.id)?.reward.label}
                </p>
              )}

              {/* The purchasable half of the loop: buy the next stage of the reveal, never the deed. */}
              {card.intelCost != null && (
                <button
                  className="vlt__buy"
                  disabled={!card.intelAffordable}
                  onClick={() => investigateSecret(card.id)}
                >
                  <FileSearch size={13} aria-hidden />
                  {card.stage === STAGE_SEALED ? "Run down the lead" : "Get the file open"}
                  <span className="vlt__buy-cost tnum">{format(card.intelCost)}</span>
                </button>
              )}
              {card.tier === 4 && !open && (
                <p className="vlt__row-nobuy">No amount of money opens this one.</p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="vlt__note">
        Files reveal themselves as you get closer to whatever is inside them. Paying an investigator
        buys you the knowledge early — never the achievement. Opened files reset with a new company,
        but what you learned is remembered forever.
      </p>

      <Button block variant="secondary" onClick={onClose}>Done</Button>
    </div>
  );
}
