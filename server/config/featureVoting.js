/**
 * Feature Voting (Home page) — single source of truth for vote rewards.
 * Fixed Savvy amount; not multiplier-eligible (UI: "+15 per vote").
 */
const FEATURE_VOTE_REWARD_SAVVY = 15;
const FEATURE_VOTE_REWARD_TYPE = 'feature_vote_reward';
const FEATURE_VOTE_REWARD_SOURCE = 'home_feature_voting';

function featureVoteIdempotencyKey(userId, topicId) {
  return `${FEATURE_VOTE_REWARD_TYPE}:${String(userId)}:${String(topicId)}`;
}

/** @deprecated Use featureVoteIdempotencyKey — legacy beta_community_vote ledger keys */
function legacyFeatureVoteIdempotencyKey(userId, topicId) {
  return `beta_community_vote:${String(userId)}:${String(topicId)}`;
}

function resolveFeatureVoteRewardSavvy(configRewards) {
  const configured = configRewards?.voteSavvy;
  if (configured != null && Number.isFinite(Number(configured))) {
    return Math.max(0, Math.round(Number(configured)));
  }
  return FEATURE_VOTE_REWARD_SAVVY;
}

module.exports = {
  FEATURE_VOTE_REWARD_SAVVY,
  FEATURE_VOTE_REWARD_TYPE,
  FEATURE_VOTE_REWARD_SOURCE,
  featureVoteIdempotencyKey,
  legacyFeatureVoteIdempotencyKey,
  resolveFeatureVoteRewardSavvy,
};
