/**
 * Final10 Live Event activation profiles — icon, audio, colors, copy, particles.
 * Each event type loads its profile from this map; add MP3s under public/audio/events/.
 */

import { EVENT_AUDIO } from './eventActivationAudio';

export const EVENT_ACTIVATION_PROFILES = Object.freeze({
  double_points: {
    eventKey: 'double_points',
    audioKey: 'double_points',
    theme: 'gold',
    color: '#fcd34d',
    glowColor: 'rgba(252, 211, 77, 0.65)',
    particleClass: 'gold',
    headline: '⚡ DOUBLE POINTS ACTIVE',
    idleCta: 'Tap to Activate',
    activatedTitle: 'Double Points Activated',
    activatedMessage: 'Earn 2× Savvy on qualifying actions while the event is live.',
    audioFallbackMs: 4200,
    vibrationPattern: [35, 25, 55],
  },
  triple_points: {
    eventKey: 'triple_points',
    audioKey: 'triple_points',
    theme: 'purple',
    color: '#c084fc',
    glowColor: 'rgba(168, 85, 247, 0.6)',
    particleClass: 'purple',
    headline: '⚡ TRIPLE POINTS ACTIVE',
    idleCta: 'Tap to Activate',
    activatedTitle: 'Triple Points Activated',
    activatedMessage: 'Earn 3× Savvy on qualifying actions while the event is live.',
    audioFallbackMs: 4200,
    vibrationPattern: [40, 30, 70],
  },
  savvy_sale: {
    eventKey: 'savvy_sale',
    audioKey: 'savvy_sale',
    theme: 'red',
    color: '#f87171',
    glowColor: 'rgba(239, 68, 68, 0.55)',
    particleClass: 'red',
    headline: '🔥 SAVVY SALE ACTIVE',
    idleCta: 'Tap to Activate',
    activatedTitle: 'Savvy Sale Activated',
    activatedMessage: 'Your Savvy goes further during select redemption windows.',
    audioFallbackMs: 4200,
    vibrationPattern: [30, 20, 45],
  },
  max_supply_drop: {
    eventKey: 'max_supply_drop',
    audioKey: 'max_supply_drop',
    theme: 'blue',
    color: '#60a5fa',
    glowColor: 'rgba(59, 130, 246, 0.55)',
    particleClass: 'blue',
    headline: '📦 MAX SUPPLY DROP',
    idleCta: 'Tap to Activate',
    activatedTitle: 'Max Supply Drop Activated',
    activatedMessage: 'Rare rewards may appear while this drop window is live.',
    audioFallbackMs: 4200,
    vibrationPattern: [45, 35, 60],
  },
});

export function getEventActivationProfile(event) {
  const key = String(event?.audioKey || event?.eventKey || event?.iconKey || '').trim();
  const profile = EVENT_ACTIVATION_PROFILES[key];
  if (profile) return { ...profile, audioSrc: EVENT_AUDIO[key] || null };
  return {
    eventKey: key,
    audioKey: key,
    theme: event?.theme || 'gold',
    color: '#818cf8',
    glowColor: 'rgba(129, 140, 248, 0.5)',
    particleClass: 'gold',
    headline: `${event?.title || 'Live Event'}`.toUpperCase(),
    idleCta: 'Tap to Activate',
    activatedTitle: `${event?.title || 'Event'} Activated`,
    activatedMessage: event?.detailBody || event?.subtitle || '',
    audioFallbackMs: 3500,
    vibrationPattern: [30, 20, 40],
    audioSrc: EVENT_AUDIO[key] || null,
  };
}

export function triggerActivationHaptic(pattern) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(Array.isArray(pattern) ? pattern : [30, 20, 40]);
  } catch {
    /* ignore */
  }
}
