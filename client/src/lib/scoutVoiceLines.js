/**
 * Savvy Scout voice line catalog — fixed triggers + suggested copy.
 * Lines with `src` play the official recorded voice; others use TTS + robot layer.
 */

export const SCOUT_AUDIO = Object.freeze({
  voiceSample: '/audio/scout/savvy-scout-transit-voice.mp3',
  movement: '/audio/scout/robot-movement.mp3',
});

export const SCOUT_VOICE_EVENT = 'f10:scout-voice-line';
export const SCOUT_VOICE_STATE_EVENT = 'f10:scout-voice-state';

/** @typedef {keyof typeof SCOUT_VOICE_LINES} ScoutVoiceLineKey */

export const SCOUT_VOICE_LINES = Object.freeze({
  greeting: {
    text: 'Savvy Scout reporting. What opportunity are we hunting today?',
    src: SCOUT_AUDIO.voiceSample,
  },
  scanning: {
    text: 'Scanning marketplaces.',
  },
  best_move: {
    text: 'Target acquired. This is my Best Move.',
  },
  low_competition: {
    text: 'Competition appears low.',
  },
  alert_created: {
    text: "Alert activated. I'll keep watch.",
  },
  no_deal: {
    text: "Nothing strong enough yet. Let's keep scouting.",
  },
  mission_complete: {
    text: 'Mission complete. Well hunted.',
  },
  reward_confirmed: {
    text: 'Reward confirmed.',
  },
  double_points: {
    text: 'Double Points are now active.',
  },
  triple_points: {
    text: 'Triple Points activated.',
  },
  savvy_sale: {
    text: 'Savvy Sale is now live.',
  },
  supply_drop: {
    text: 'Supply Drop detected.',
  },
  win: {
    text: 'Another found. Another win. Stay Savvy.',
  },
  event_summary: {
    text: 'Another found. Another win. Stay Savvy.',
  },
  battle_pass_boost: {
    text: 'Battle Pass XP boost activated.',
  },
  savvy_level_boost: {
    text: 'Savvy Level XP boost online. Keep earning.',
  },
  free_spin_added: {
    text: 'Free spin added. The Perk Machine is ready.',
  },
});

const EVENT_AUDIO_TO_VOICE = Object.freeze({
  double_points: 'double_points',
  triple_points: 'triple_points',
  savvy_sale: 'savvy_sale',
  max_supply_drop: 'supply_drop',
});

/**
 * @param {ScoutVoiceLineKey} lineKey
 * @param {{ text?: string, src?: string, interrupt?: boolean }} [overrides]
 */
export function playScoutVoiceLine(lineKey, overrides = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(SCOUT_VOICE_EVENT, {
      detail: { lineKey, ...overrides },
    })
  );
}

/**
 * Map live event audio keys to scout voice lines.
 * @param {string} audioKey
 * @returns {ScoutVoiceLineKey|null}
 */
export function scoutVoiceLineForEventAudio(audioKey) {
  return EVENT_AUDIO_TO_VOICE[String(audioKey || '').trim()] || null;
}

/**
 * Infer a canned line from an assistant answer when possible.
 * @param {object|null|undefined} answer
 * @returns {ScoutVoiceLineKey|null}
 */
export function resolveVoiceLineFromAnswer(answer) {
  if (!answer) return null;
  const verdict = String(answer.verdict?.label || '').toLowerCase();
  const reason = String(answer.reason || '').toLowerCase();

  if (verdict.includes('best move')) return 'best_move';
  if (answer.kind === 'monitoring' || verdict.includes('monitoring')) return 'alert_created';
  if (answer.kind === 'weak_board') return 'no_deal';
  if (/low competition/.test(reason)) return 'low_competition';
  if (/nothing strong|no exact match|no strong/.test(reason)) return 'no_deal';
  return null;
}
