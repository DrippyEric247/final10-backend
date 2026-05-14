import { isSoundMuted } from "./savvyWalletSound";

let ctx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

function tone(freq, t0, dur, gain, type = "sine") {
  const c = getCtx();
  if (!c || isSoundMuted()) return;
  try {
    if (c.state === "suspended") void c.resume();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch {
    /* ignore */
  }
}

/** Soft whoosh at reveal start */
export function playCallingCardUnlockIntro() {
  const c = getCtx();
  if (!c || isSoundMuted()) return;
  try {
    if (c.state === "suspended") void c.resume();
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(180, t0);
    o.frequency.exponentialRampToValueAtTime(420, t0 + 0.22);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.04, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + 0.32);
  } catch {
    /* ignore */
  }
}

/** @param {'common'|'rare'|'epic'|'legendary'|'exclusive'} rarity */
export function playCallingCardUnlockResolve(rarity) {
  const c = getCtx();
  if (!c || isSoundMuted()) return;
  const t0 = c.currentTime;
  const r = String(rarity || "common").toLowerCase();
  if (r === "legendary" || r === "exclusive") {
    tone(392, t0, 0.12, 0.065);
    tone(523, t0 + 0.1, 0.14, 0.06);
    tone(659, t0 + 0.2, 0.2, 0.055, "triangle");
    return;
  }
  if (r === "epic") {
    tone(330, t0, 0.1, 0.055);
    tone(494, t0 + 0.09, 0.16, 0.05);
    return;
  }
  if (r === "rare") {
    tone(349, t0, 0.1, 0.045);
    tone(440, t0 + 0.08, 0.14, 0.04);
    return;
  }
  tone(330, t0, 0.08, 0.035);
  tone(392, t0 + 0.07, 0.12, 0.03);
}
