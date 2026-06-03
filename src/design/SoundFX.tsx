// Plays sound cues on meaningful state transitions (kept separate from per-tick economy
// so we don't buzz every second). Renders nothing.
import { useEffect, useRef } from "react";
import { Newspaper } from "lucide-react";
import { useGame } from "../state/useGame.tsx";
import { sfx } from "./sound.ts";
import { showToast } from "./toast.tsx";

export function SoundFX() {
  const { state } = useGame();
  const ready = useRef(state.ready.length);
  const era = useRef(state.era);
  const skill = useRef(state.staff.reduce((a, s) => a + s.skill, 0));
  const headcount = useRef(state.staff.length);
  const bankrupt = useRef(state.bankrupt);
  const eventWeek = useRef(state.lastEvent?.week ?? -1);

  useEffect(() => {
    const ev = state.lastEvent;
    if (ev && ev.week !== eventWeek.current) {
      eventWeek.current = ev.week;
      showToast(ev.text, { tone: ev.tone === "negative" ? "negative" : ev.tone === "positive" ? "positive" : "neutral", glyph: <Newspaper size={15} /> });
      sfx(ev.tone === "negative" ? "error" : "rp");
    }
  }, [state.lastEvent]);

  useEffect(() => {
    if (state.ready.length > ready.current) sfx("build");
    ready.current = state.ready.length;
  }, [state.ready.length]);

  useEffect(() => {
    if (state.era > era.current) sfx("era");
    era.current = state.era;
  }, [state.era]);

  useEffect(() => {
    const total = state.staff.reduce((a, s) => a + s.skill, 0);
    // Only a genuine level-up (roster size unchanged), not a hire bumping the total.
    if (total > skill.current && state.staff.length === headcount.current) sfx("levelup");
    skill.current = total;
    headcount.current = state.staff.length;
  }, [state.staff]);

  useEffect(() => {
    if (state.bankrupt && !bankrupt.current) sfx("bankrupt");
    bankrupt.current = state.bankrupt;
  }, [state.bankrupt]);

  return null;
}
