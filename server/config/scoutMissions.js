/**
 * Server-authoritative Savvy Scout mission rewards (amounts + idempotency cadence).
 * Must stay in sync with client/src/lib/savvyScoutMissions.js SCOUT_MISSION_CATALOG ids.
 */

const SCOUT_MISSIONS = Object.freeze({
  save_deal: { title: 'Save this deal', rewardSavvy: 10, cadence: 'daily', once: false },
  add_watchlist: { title: 'Watch a deal', rewardSavvy: 5, cadence: 'daily', once: false },
  share_deal: { title: 'Share a deal', rewardSavvy: 15, cadence: 'weekly', once: false },
  first_alert: { title: 'Create your first alert', rewardSavvy: 25, cadence: 'one_time', once: true },
  three_alerts: { title: 'Create 3 alerts', rewardSavvy: 50, cadence: 'weekly', once: false },
  travel_profile: { title: 'Complete travel profile', rewardSavvy: 50, cadence: 'one_time', once: true },
  save_destination: { title: 'Save a destination', rewardSavvy: 15, cadence: 'weekly', once: false },
  first_listing: { title: 'Create first listing', rewardSavvy: 100, cadence: 'one_time', once: true },
  seller_profile: { title: 'Complete seller profile', rewardSavvy: 50, cadence: 'one_time', once: true },
  earn_100_today: { title: 'Earn 100 Savvy today', rewardSavvy: 25, cadence: 'daily', once: false },
  battle_pass_tier: { title: 'Reach next Battle Pass tier', rewardSavvy: 50, cadence: 'seasonal', once: false },
  post_savvy_win: { title: 'Post a Savvy Win', rewardSavvy: 100, cadence: 'weekly', once: false },
  share_savvywin_proof: { title: 'Share #SavvyWin proof', rewardSavvy: 250, cadence: 'seasonal', once: false },
  scan_deal: { title: 'Run the scanner', rewardSavvy: 15, cadence: 'daily', once: false },
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

function periodKeyForMission(mission, clientPeriodKey) {
  const key = String(clientPeriodKey || '').trim();
  if (key) return key.slice(0, 64);
  return cadenceKey(mission.cadence);
}

module.exports = {
  SCOUT_MISSIONS,
  getMissionById,
  cadenceKey,
  periodKeyForMission,
};
