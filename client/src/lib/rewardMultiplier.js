export const getBundleMultiplier = (bundleCount) => {
  const count = Number(bundleCount) || 0;
  if (count >= 5) return 2;
  if (count >= 3) return 1.5;
  if (count >= 2) return 1.2;
  return 1;
};

export const getWatchlistMultiplier = (watchlistCount) => {
  const count = Number(watchlistCount) || 0;
  if (count >= 10) return 1.8;
  if (count >= 5) return 1.5;
  if (count >= 3) return 1.25;
  if (count >= 1) return 1.1;
  return 1;
};

export const getStreakMultiplier = (streakWeeks) => {
  const weeks = Number(streakWeeks) || 0;
  if (weeks >= 6) return 1.5;
  if (weeks >= 4) return 1.3;
  if (weeks >= 2) return 1.2;
  if (weeks >= 1) return 1.1;
  return 1;
};

export const getMissionMultiplier = (localMissionComplete) => {
  return localMissionComplete ? 2 : 1;
};

export const getPromoMultiplier = (promotedItems) => {
  const count = Number(promotedItems) || 0;
  if (count >= 10) return 1.8;
  if (count >= 5) return 1.4;
  if (count >= 3) return 1.2;
  return 1;
};

export const calculateRewardMultiplier = ({
  bundleCount = 0,
  watchlistCount = 0,
  streakWeeks = 0,
  localMissionComplete = false,
  promotedItems = 0,
}) => {
  const breakdown = {
    bundle: getBundleMultiplier(bundleCount),
    watchlist: getWatchlistMultiplier(watchlistCount),
    streak: getStreakMultiplier(streakWeeks),
    mission: getMissionMultiplier(localMissionComplete),
    promo: getPromoMultiplier(promotedItems),
  };

  const rawBoost =
    breakdown.bundle *
    breakdown.watchlist *
    breakdown.streak *
    breakdown.mission *
    breakdown.promo;

  return {
    totalBoost: Math.min(5, rawBoost),
    breakdown,
  };
};
