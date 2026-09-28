/** "a Board Press" / "an Assembly Arm" / "an AR headset" — the indefinite article for a player-facing
 *  noun. Vowel-sound heuristic: a leading vowel letter, or an acronym whose first letter is SAID with
 *  a vowel sound ("an LCD", "an SSD", "an AR …"). Good enough for the game's own catalogue names. */
export function withArticle(noun: string): string {
  const w = noun.trim();
  const acronym = /^[A-Z]{2,}\b/.test(w);
  const vowelSound = acronym ? /^[AEFHILMNORSX]/.test(w) : /^[aeiou]/i.test(w);
  return `${vowelSound ? "an" : "a"} ${w}`;
}

/** A category's display name as a noun inside a sentence: lower-case except acronyms ("AR"), and a
 *  plural category reads as one item ("a pair of AR glasses"), so "A breakout ar glasses" and
 *  "launches into Phone." can't happen. Pure string. */
export function categoryNoun(displayName: string): string {
  const noun = displayName
    .split(" ")
    .map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase()))
    .join(" ");
  return /glasses$/i.test(noun) ? `pair of ${noun}` : noun;
}
