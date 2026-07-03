/**
 * Server-authoritative Savvy Scout mission rewards (amounts + idempotency cadence).
 * Must stay in sync with client/src/lib/savvyScoutMissions.js SCOUT_MISSION_CATALOG ids.
 */

const SCOUT_MISSIONS = Object.freeze({
  save_deal: { title: 'Save this deal', rewardSavvy: 10, cadence: 'daily', once: false, trigger: 'save_deal', target: 1 },
  add_watchlist: { title: 'Watch a deal', rewardSavvy: 5, cadence: 'daily', once: false, trigger: 'add_watchlist', target: 1 },
  share_deal: { title: 'Share a deal', rewardSavvy: 15, cadence: 'weekly', once: false, trigger: 'share_deal', target: 1 },
  first_alert: { title: 'Create your first alert', rewardSavvy: 25, cadence: 'one_time', once: true, trigger: 'create_alert', target: 1 },
  three_alerts: { title: 'Create 3 alerts', rewardSavvy: 50, cadence: 'weekly', once: false, trigger: 'create_alert', target: 3 },
  travel_profile: { title: 'Complete travel profile', rewardSavvy: 50, cadence: 'one_time', once: true, trigger: 'travel_profile_complete', target: 1 },
  save_destination: { title: 'Save a destination', rewardSavvy: 15, cadence: 'weekly', once: false, trigger: 'save_destination', target: 1 },
  first_listing: { title: 'Create first listing', rewardSavvy: 100, cadence: 'one_time', once: true, trigger: 'create_listing', target: 1 },
  seller_profile: { title: 'Complete seller profile', rewardSavvy: 50, cadence: 'one_time', once: true, trigger: 'seller_profile_complete', target: 1 },
  earn_100_today: { title: 'Earn 100 Savvy today', rewardSavvy: 25, cadence: 'daily', once: false, trigger: 'savvy_earned_today', target: 100 },
  battle_pass_tier: { title: 'Reach next Battle Pass tier', rewardSavvy: 50, cadence: 'seasonal', once: false, trigger: 'battle_pass_tier_up', target: 1 },
  post_savvy_win: { title: 'Post a Savvy Win', rewardSavvy: 100, cadence: 'weekly', once: false, trigger: 'post_win', target: 1 },
  share_savvywin_proof: { title: 'Share #SavvyWin proof', rewardSavvy: 250, cadence: 'seasonal', once: false, trigger: 'share_win_proof', target: 1 },
  scan_deal: { title: 'Run the scanner', rewardSavvy: 15, cadence: 'daily', once: false, trigger: 'scan_complete', target: 1 },
});

/** Maps trusted server / progression event types to scout mission triggers. */
const PROGRESSION_EVENT_TO_SCOUT_TRIGGER = Object.freeze({
  auction_scanned: 'scan_complete',
  buy_now_scanned: 'scan_complete',
  recommended_deal_viewed: 'scan_complete',
});

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date = new Date()) {
  const d = date;
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function cadenceKey(cadence, date = new Date()) {
  if (cadence === 'daily') return utcDayKey(date);
  if (cadence === 'weekly') return weekKey(date);
  if (cadence === 'seasonal') return `season-${date.getFullYear()}`;
  return 'once';
}

function getMissionById(missionId) {
  const id = String(missionId || '').trim();
  if (!id || !SCOUT_MISSIONS[id]) return null;
  return { id, ...SCOUT_MISSIONS[id] };
}

function getMissionsForTrigger(trigger) {
  const t = String(trigger || '').trim();
  if (!t) return [];
  return Object.entries(SCOUT_MISSIONS)
    .filter(([, def]) => def.trigger === t)
    .map(([id, def]) => ({ id, ...def }));
}

/** Server-authoritative period keys — client-supplied keys are ignored (anti-exploit). */
function periodKeyForMission(mission, _clientPeriodKey) {
  return cadenceKey(mission.cadence);
}

module.exports = {
  SCOUT_MISSIONS,
  PROGRESSION_EVENT_TO_SCOUT_TRIGGER,
  getMissionById,
  getMissionsForTrigger,
  cadenceKey,
  periodKeyForMission,
};
