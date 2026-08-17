/**
 * Easter Egg Challenge registry — placeholder/test challenges stay admin-only.
 */

const EASTER_CHALLENGE_REWARDS = Object.freeze({
  savvyMin: 5000,
  savvyMax: 10000,
});

/** Active challenge definitions. Do not expose adminOnly challenges in public UI. */
const EASTER_CHALLENGES = Object.freeze([
  {
    id: 'wave3_placeholder',
    displayName: 'Operator Signal (Test)',
    description: 'Complete 3 qualifying Perk Machine spins within the challenge window.',
    adminOnly: true,
    durationMs: 24 * 60 * 60 * 1000,
    objective: { type: 'perk_spins', target: 3 },
    rewards: {
      savvy: 5000,
      emblemId: null,
      callingCardId: null,
      outfitId: null,
    },
  },
]);

function getEasterChallengeById(id) {
  return EASTER_CHALLENGES.find((c) => c.id === String(id || '').trim()) || null;
}

function getPublicEasterChallenges() {
  return EASTER_CHALLENGES.filter((c) => !c.adminOnly);
}

module.exports = {
  EASTER_CHALLENGE_REWARDS,
  EASTER_CHALLENGES,
  getEasterChallengeById,
  getPublicEasterChallenges,
};
