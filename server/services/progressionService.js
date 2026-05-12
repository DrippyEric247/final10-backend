const {
  buildProgressionPayload,
  processBattlePassEvent,
  initProgressionForUser,
  syncPremiumFromEntitlement,
} = require('./battlePassPersistenceService');

async function processBattlePassActionEvent(userId, seasonId, event, opts) {
  return processBattlePassEvent(userId, seasonId, event, opts || {});
}

async function syncBattlePassPremiumFromEntitlement(userId, opts) {
  return syncPremiumFromEntitlement(userId, opts || {});
}

module.exports = {
  getUserProgressionState: buildProgressionPayload,
  processBattlePassActionEvent,
  initUserProgression: initProgressionForUser,
  syncBattlePassPremiumFromEntitlement,
};
