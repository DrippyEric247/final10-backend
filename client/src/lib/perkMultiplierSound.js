/**
 * Unlock chime when a 2× Multiplier tile activates on the Perk Machine.
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

function tone(freq, start, duration, gain = 0.07, type = 'sine') {
  const c = getCtx();
  if (!c || isSoundMuted()) return;
  try {
    if (c.state === 'suspended') void c.resume();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + duration);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime + start);
    o.stop(c.currentTime + start + duration + 0.04);
  } catch {
    /* ignore */
  }
}

export function playMultiplierSound(factor = 2) {
  if (isSoundMuted()) return;
  const base = factor >= 8 ? 520 : factor >= 4 ? 480 : 440;
  tone(base, 0, 0.08, 0.065);
  tone(base * 1.25, 0.09, 0.1, 0.075);
  tone(base * 1.5, 0.2, 0.12, 0.08, 'triangle');
  if (factor >= 4) {
    tone(base * 2, 0.34, 0.16, 0.07, 'triangle');
  }
  if (factor >= 8) {
    tone(base * 2.5, 0.5, 0.2, 0.09, 'square');
  }
}
