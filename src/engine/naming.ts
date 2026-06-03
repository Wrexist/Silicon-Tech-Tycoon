// Smart product naming — recognizes a sequence number anywhere in a name (digits, number
// words, or Roman numerals) and returns the next in the series, matching the original style.
// "Aurora Two" → "Aurora Three" · "Aurora 2" → "Aurora 3" · "Mark IV" → "Mark V" · "Nova" → "Nova 2".

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty",
];

function applyCase(template: string, value: string): string {
  if (template === template.toUpperCase() && template !== template.toLowerCase()) return value.toUpperCase();
  if (template[0] === template[0]?.toUpperCase()) return value[0].toUpperCase() + value.slice(1);
  return value;
}

function wordToNum(w: string): number | null {
  const i = WORDS.indexOf(w.toLowerCase());
  return i >= 0 ? i : null;
}
function numToWord(n: number): string | null {
  return n >= 0 && n < WORDS.length ? WORDS[n] : null;
}

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];
function isRoman(s: string): boolean {
  return /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i.test(s) && s.length > 0;
}
function romanToNum(s: string): number {
  const map: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  const u = s.toLowerCase();
  let total = 0;
  for (let i = 0; i < u.length; i++) {
    const cur = map[u[i]];
    const next = map[u[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}
function numToRoman(n: number): string {
  let out = "";
  let v = n;
  for (const [val, sym] of ROMAN) {
    while (v >= val) { out += sym; v -= val; }
  }
  return out;
}

/** Suggest the next product name in a series. */
export function suggestNextName(prev: string): string {
  const name = (prev ?? "").trim();
  if (!name) return "Aurora One";

  // 1) the last run of digits anywhere in the name → increment in place
  if (/\d/.test(name)) {
    return name.replace(/(\d+)(?=\D*$)/, (m) => String(parseInt(m, 10) + 1));
  }

  // 2) scan words from the end for a number-word or Roman numeral
  const parts = name.split(/(\s+)/); // keep separators
  for (let i = parts.length - 1; i >= 0; i--) {
    const tok = parts[i];
    if (/^\s+$/.test(tok) || tok === "") continue;
    const wn = wordToNum(tok);
    if (wn !== null) {
      const next = numToWord(wn + 1);
      parts[i] = next ? applyCase(tok, next) : String(wn + 1);
      return parts.join("");
    }
    if (isRoman(tok)) {
      parts[i] = applyCase(tok, numToRoman(romanToNum(tok) + 1));
      return parts.join("");
    }
    break; // only consider the last meaningful word
  }

  // 3) no number anywhere → start a series
  return `${name} 2`;
}
