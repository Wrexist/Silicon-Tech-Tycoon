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
export function lt(a: Money, b: Money): boolean {
  return a < b;
}
export function isNegative(a: Money): boolean {
  return a < 0;
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

/** Sum a list of Money exactly. */
export function sum(list: readonly Money[]): Money {
  let acc = 0;
  for (const m of list) acc += m;
  return acc as Money;
}
