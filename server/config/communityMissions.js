/** Community hub social missions — server catalog mirrors client. */

const COMMUNITY_MISSIONS = Object.freeze([
  { id: 'view_todays_story', rewardSavvy: 15, cadence: 'daily' },
  { id: 'like_todays_post', rewardSavvy: 10, cadence: 'daily' },
  { id: 'watch_todays_video', rewardSavvy: 20, cadence: 'daily' },
  { id: 'share_final10_content', rewardSavvy: 25, cadence: 'weekly' },
  { id: 'refer_a_friend', rewardSavvy: 100, cadence: 'weekly' },
]);

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date = new Date()) {
  const d = new Date(date);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function periodKeyForCadence(cadence) {
  return cadence === 'weekly' ? weekKey() : utcDayKey();
}

function findMission(missionId) {
  return COMMUNITY_MISSIONS.find((m) => m.id === String(missionId || '').trim()) || null;
}

module.exports = {
  COMMUNITY_MISSIONS,
  periodKeyForCadence,
  findMission,
};
