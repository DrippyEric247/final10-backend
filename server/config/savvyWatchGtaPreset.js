/**
 * Reusable GTA Car Meet preset — values are templates, not hardcoded platform logic.
 */
const { DEFAULT_CHECKPOINTS, DEFAULT_MAX_SAVVY_PER_VIEWER } = require('./savvyWatchConfig');

const GTA_CAR_MEET_PRESET = Object.freeze({
  slug: 'gta-car-meet-001',
  title: 'Savvy Watch — GTA Car Meet',
  description:
    'Join the live GTA V car meet on Savvy Watch. Earn Savvy through verified event participation, enter competitions, and vote for Best Build, Cleanest BMW, and more.',
  streamCategory: 'gta_car_meet',
  platform: 'youtube',
  rewardRules: {
    checkpoints: DEFAULT_CHECKPOINTS,
    maxSavvyPerViewer: DEFAULT_MAX_SAVVY_PER_VIEWER,
    label: 'Verified Event Participation',
  },
  rewardBudget: 50000,
  viewerCap: null,
  competitions: [
    {
      slug: 'best-build',
      title: 'Best Build',
      description: 'Community vote for the best overall vehicle build.',
      type: 'vehicle',
      votingMode: 'community',
      maxEntriesPerUser: 1,
      voteLimitPerUser: 1,
      moderationRequired: true,
      rewardConfig: { winnerSavvy: 250, runnerUpSavvy: 0 },
    },
    {
      slug: 'cleanest-bmw',
      title: 'Cleanest BMW',
      description: 'Vote for the BMW with the cleanest overall build.',
      type: 'vehicle',
      votingMode: 'community',
      eligibleMake: 'BMW',
      maxEntriesPerUser: 1,
      voteLimitPerUser: 1,
      moderationRequired: true,
      rewardConfig: { winnerSavvy: 250, runnerUpSavvy: 0 },
    },
    {
      slug: 'best-crew-entrance',
      title: 'Best Crew Entrance',
      description: 'Best crew/team entrance moment of the night.',
      type: 'crew',
      votingMode: 'hybrid',
      hostWeight: 0.5,
      maxEntriesPerUser: 1,
      voteLimitPerUser: 1,
      moderationRequired: true,
      rewardConfig: { winnerSavvy: 300, runnerUpSavvy: 0 },
    },
    {
      slug: 'drift-winner',
      title: 'Drift Winner',
      description: 'Host-judged drift winner.',
      type: 'drift',
      votingMode: 'host',
      maxEntriesPerUser: 1,
      voteLimitPerUser: 0,
      moderationRequired: true,
      rewardConfig: { winnerSavvy: 250, runnerUpSavvy: 0 },
    },
    {
      slug: 'photo-of-the-night',
      title: 'Photo of the Night',
      description: 'Community vote for the best event photo.',
      type: 'photo',
      votingMode: 'community',
      maxEntriesPerUser: 1,
      voteLimitPerUser: 1,
      moderationRequired: true,
      rewardConfig: { winnerSavvy: 200, runnerUpSavvy: 50 },
    },
  ],
});

module.exports = { GTA_CAR_MEET_PRESET };
