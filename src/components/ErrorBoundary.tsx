// Catches any render/runtime error so a single bug can never white-screen the whole app.
// With a `fallback`, it degrades gracefully (e.g. 3D → 2D scene) instead of the reset card.
// Otherwise it shows the full error + stack with a one-tap "Copy" so it can be pasted into a report.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { CircleX, Copy, RotateCcw } from "lucide-react";
import { Button } from "../design/primitives.tsx";
import { clearSave } from "../state/persistence.ts";

interface State {
  error: Error | null;
  componentStack: string;
  copied: boolean;
  confirmReset: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, State> {
  state: State = { error: null, componentStack: "", copied: false, confirmReset: false };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? "" });
    // eslint-disable-next-line no-console
    console.error("App crashed:", error, info.componentStack);
  }

  /** A single self-contained report string the player can paste anywhere. */
  report(): string {
    const e = this.state.error;
    return [
      `Silicon: Tech Tycoon — error report`,
      `When: ${new Date().toISOString()}`,
      `Page: ${typeof location !== "undefined" ? location.href : "?"}`,
      `UA: ${typeof navigator !== "undefined" ? navigator.userAgent : "?"}`,
      ``,
      `Error: ${e?.name ?? "Error"}: ${e?.message ?? String(e)}`,
      ``,
      `Stack:`,
      e?.stack ?? "(no stack)",
      ``,
      `Component stack:${this.state.componentStack || " (none)"}`,
    ].join("\n");
  }

  copy = async () => {
    const text = this.report();
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Clipboard blocked — select the <pre> so the player can copy manually.
      const pre = document.getElementById("eb-report");
      if (pre) {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    const e = this.state.error;
    return (
      <div className="eb">
        <div className="eb__inner">
          <div className="eb__glyph"><CircleX size={30} strokeWidth={2} /></div>
          <h2 className="eb__title">Something went wrong</h2>
          <p className="eb__text">An unexpected error occurred. Copy the details below and paste them into a report.</p>

          <div className="eb__error">{e?.name ?? "Error"}: {e?.message ?? String(e)}</div>

          <pre id="eb-report" className="eb__report">{this.report()}</pre>

          <Button block onClick={this.copy}>
            <Copy size={15} /> {this.state.copied ? "Copied!" : "Copy error details"}
          </Button>
          <Button block variant="secondary" onClick={() => window.location.reload()}>Reload</Button>
          {/* Destroying the save needs a second tap — a crash screen is exactly where a panicked
              player taps fast, and Reload alone fixes most transient errors. */}
          {this.state.confirmReset ? (
            <>
              <p className="eb__text">This deletes your company permanently. Try Reload first.</p>
              <Button block variant="destructive" onClick={() => { clearSave(); window.location.reload(); }}>
                <RotateCcw size={15} /> Yes, delete the save
              </Button>
              <Button block variant="tertiary" onClick={() => this.setState({ confirmReset: false })}>Cancel</Button>
            </>
          ) : (
            <Button block variant="tertiary" onClick={() => this.setState({ confirmReset: true })}>
              <RotateCcw size={15} /> Reset company
            </Button>
          )}
        </div>
      </div>
    );
  }
}
