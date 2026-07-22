/** Profile XP recap audio placeholders — replace paths when final assets ship. */
export const PROFILE_XP_AUDIO = Object.freeze({
  xp_count_loop: '/audio/progression/xp-count-loop.mp3',
  xp_bar_fill: '/audio/progression/xp-bar-fill.mp3',
  level_up: '/audio/progression/level-up.mp3',
  milestone_unlock: '/audio/progression/milestone-unlock.mp3',
  reward_reveal: '/audio/progression/reward-reveal.mp3',
});

export function playProfileXpAudio(key, { volume = 0.55 } = {}) {
  if (typeof window === 'undefined') return;
  const src = PROFILE_XP_AUDIO[key];
  if (!src) return;
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    void audio.play().catch(() => {});
  } catch {
    /* ignore missing assets */
  }
}
