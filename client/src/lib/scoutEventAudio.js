/**
 * Lightweight Savvy Scout event sounds (no external assets).
 */

import { isSoundMuted } from './savvyWalletSound';

let ctx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

function tone(freq, duration, gain = 0.055, type = 'sine', delay = 0) {
  const c = getCtx();
  if (!c || isSoundMuted()) return;
  try {
    if (c.state === 'suspended') void c.resume();
    const start = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    o.connect(g);
    g.connect(c.destination);
    o.start(start);
    o.stop(start + duration + 0.02);
  } catch {
    /* ignore */
  }
}

/** Scout intercept / milestone unlock cue */
export function playScoutMilestoneSound() {
  tone(392, 0.08, 0.05);
  tone(523, 0.1, 0.06, 'triangle', 0.07);
  tone(659, 0.12, 0.065, 'sine', 0.16);
}

/** Reward claimed / crate opened */
export function playScoutRewardSound() {
  tone(440, 0.07, 0.05);
  tone(554, 0.09, 0.06, 'triangle', 0.06);
  tone(880, 0.14, 0.07, 'sine', 0.14);
}
