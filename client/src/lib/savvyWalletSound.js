/**
 * Lightweight Web Audio “coin” cues — no external assets.
 */

const MUTE_KEY = "f10_savvy_wallet_sound_mute";

export function setSoundMuted(muted) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isSoundMuted() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

let ctx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

function beep(freq, duration, gain = 0.06, type = "sine") {
  const c = getCtx();
  if (!c || isSoundMuted()) return;
  try {
    if (c.state === "suspended") void c.resume();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime);
    o.stop(c.currentTime + duration + 0.02);
  } catch {
    /* ignore */
  }
}

/** @param {'NORMAL'|'GOOD'|'RARE'|'EPIC'|'LEGENDARY'} rarity */
export function playSavvyWalletSound(rarity) {
  if (isSoundMuted()) return;
  switch (rarity) {
    case "LEGENDARY":
      beep(660, 0.09, 0.07);
      window.setTimeout(() => beep(880, 0.1, 0.08), 70);
      window.setTimeout(() => beep(990, 0.14, 0.07, "triangle"), 150);
      break;
    case "EPIC":
      beep(520, 0.08, 0.065);
      window.setTimeout(() => beep(740, 0.11, 0.06), 60);
      break;
    case "RARE":
      beep(440, 0.07, 0.055);
      window.setTimeout(() => beep(620, 0.08, 0.05), 55);
      break;
    case "GOOD":
      beep(380, 0.06, 0.045);
      break;
    default:
      beep(330, 0.05, 0.035);
  }
}

export function playWalletPulse() {
  beep(520, 0.04, 0.03);
}

export function playUiClick() {
  beep(880, 0.025, 0.02);
}
