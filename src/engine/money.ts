// Money — integer CENTS, never floating dollars. A branded number so it can't be
// accidentally mixed with raw quantities. Exact rounding; big-number display formatting.

export type Money = number & { readonly __brand: "Money" };

/** Construct Money from a dollar amount (rounds to the nearest cent). */
export function dollars(amount: number): Money {
  const v = Math.round(amount * 100);
  return (Number.isFinite(v) ? v : 0) as Money;
}

/** Construct Money directly from an integer number of cents. */
export function cents(n: number): Money {
  const v = Math.round(n);
  return (Number.isFinite(v) ? v : 0) as Money;
}

export const ZERO = 0 as Money;

export function add(a: Money, b: Money): Money {
  const v = a + b;
  return (Number.isFinite(v) ? v : 0) as Money;
}
export function sub(a: Money, b: Money): Money {
  const v = a - b;
  return (Number.isFinite(v) ? v : 0) as Money;
}
/** Multiply money by a unit-less scalar (e.g. a sales multiplier), rounding to cents. */
export function scale(a: Money, factor: number): Money {
  const v = Math.round(a * factor);
  return (Number.isFinite(v) ? v : 0) as Money;
}
export function gte(a: Money, b: Money): boolean {
  return a >= b;
}

export function toDollars(a: Money): number {
  return a / 100;
}

const UNITS: { value: number; suffix: string }[] = [
  { value: 1e12, suffix: "T" },
  { value: 1e9, suffix: "B" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" },
];

/**
 * Compact display: $1.23K / $4.56M / $7.89B / $1.2T. Below $10K shows exact dollars.
 * Always includes the sign for negatives. Pure string, no DOM.
 */
export function format(a: Money, opts: { sign?: boolean } = {}): string {
  const d = a / 100;
  if (!Number.isFinite(d)) return "$0";
  const neg = d < 0;
  const abs = Math.abs(d);
  let body: string;
  if (abs < 1000) {
    body = `$${abs.toFixed(abs < 100 && abs % 1 !== 0 ? 2 : 0)}`;
  } else if (abs < 10_000) {
    body = `$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  } else {
    const unit = UNITS.find((u) => abs >= u.value) ?? UNITS[UNITS.length - 1];
    const scaled = abs / unit.value;
    const str = scaled.toFixed(2).replace(/\.?0+$/, ""); // strip trailing zeros + dot
    body = `$${str}${unit.suffix}`;
  }
  if (neg) return `-${body}`;
  return opts.sign ? `+${body}` : body;
}

/** Compact money for goal cards and tight stats (e.g. "$3.2M", "$45k", "$320"). Input is whole
 *  DOLLARS, not cents. One shared formatter so the same figure can't render "$3M" on the Research
 *  roadmap and "$3.2M" on the HQ era card — every screen now agrees on rounding. */
export function formatShortDollars(dollars: number): string {
  if (!Number.isFinite(dollars)) return "$0";
  const abs = Math.abs(dollars);
  const sign = dollars < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

/**
 * Compact display for a raw COUNT (fans, units): 250 / 12.5k / 2.3M / 1.2B / 3.4T. Below 1,000
 * shows the exact integer with thousands separators. One shared formatter so fans/units agree on
 * every screen and, crucially, ROLL OVER past a million — the hand-rolled `(n/1000).toFixed(1)k`
 * formatters this replaces rendered a 2M fanbase as "2000.0k". Lowercase 'k' matches
 * `formatShortDollars`; ICU-independent (no Intl compact dependency) and boundary-safe (999,950
 * promotes to "1M", never "1000.0k"). Pure string, no DOM.
 */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  let abs = Math.abs(n);
  if (abs < 1000) return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
  const suffixes = ["", "k", "M", "B", "T"];
  let tier = 0;
  while (abs >= 1000 && tier < suffixes.length - 1) { abs /= 1000; tier++; }
  // If rounding to 1dp pushes the mantissa to 1000 (e.g. 999,950 → "1000.0k"), promote a tier.
  if (Math.round(abs * 10) / 10 >= 1000 && tier < suffixes.length - 1) { abs /= 1000; tier++; }
  const str = (Math.round(abs * 10) / 10).toFixed(1).replace(/\.0$/, "");
  return `${sign}${str}${suffixes[tier]}`;
}

/** Sum a list of Money exactly. */
export function sum(list: readonly Money[]): Money {
  let acc = 0;
  for (const m of list) acc += m;
  return acc as Money;
}
