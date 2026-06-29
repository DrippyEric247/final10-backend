/**
 * Unlock chime for Scout Flight Tournament Ticket earned.
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

export function playTournamentTicketUnlockSound() {
  if (isSoundMuted()) return;
  tone(440, 0, 0.1, 0.06);
  tone(554, 0.1, 0.12, 0.07);
  tone(659, 0.22, 0.14, 0.08, 'triangle');
  tone(880, 0.38, 0.2, 0.06, 'triangle');
}
