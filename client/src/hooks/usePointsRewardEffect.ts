import { usePointsRewardContext } from "../context/PointsRewardContext";

export function usePointsRewardEffect() {
  const { showPointsReward } = usePointsRewardContext();
  return { showPointsReward };
}

