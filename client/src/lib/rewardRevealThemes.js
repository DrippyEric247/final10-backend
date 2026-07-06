/**
 * Per-reward reveal theming for the Perk Machine.
 *
 * Calling cards get the full-screen unlock ceremony. Every other reward type
 * gets its own themed reveal overlay (color, icon, copy) via this resolver so
 * a spin never feels generic.
 */

const EGG_THEME = {
  common: { accent: "#94a3b8", label: "Common Egg" },
  rare: { accent: "#38bdf8", label: "Rare Egg" },
  epic: { accent: "#c084fc", label: "Epic Egg" },
  legendary: { accent: "#fbbf24", label: "Legendary Egg" },
  mythic: { accent: "#f472b6", label: "Mythic Egg" },
  extraFreeSpin: { accent: "#34d399", label: "Extra Free Spin" },
};

function rarityRank(rarity) {
  switch (String(rarity || "").toLowerCase()) {
    case "legendary":
    case "mythic":
      return 5;
    case "epic":
      return 4;
    case "rare":
      return 3;
    case "uncommon":
      return 2;
    default:
      return 1;
  }
}

/**
 * Resolve a themed reveal for a single reward, or null when the reward has its
 * own dedicated reveal elsewhere (calling cards, scout tickets, plain savvy).
 *
 * `mode` is the *baseline* intensity:
 *   - "cinematic" → full-screen ceremony (big moments)
 *   - "quick"     → fast ~1s glow-and-fly chip (keeps grinding fast)
 * A first-time-ever unlock can still be promoted to cinematic by the caller.
 *
 * @returns {{key:string, icon:string, eyebrow:string, title:string, subtitle:string, accent:string, tier:string, mode:('cinematic'|'quick')}|null}
 */
export function resolveRewardReveal(reward) {
  if (!reward || reward.multiplierRole) return null;
  const type = reward.type;

  if (type === "egg") {
    const tier = reward.eggTier || "common";
    const theme = EGG_THEME[tier] || EGG_THEME.common;
    const qty = Number(reward.eggsGranted || reward.quantity) || 1;
    const big = tier === "legendary" || tier === "mythic";
    return {
      key: `egg-${tier}`,
      icon: tier === "extraFreeSpin" ? "🎰" : "🥚",
      eyebrow: tier === "extraFreeSpin" ? "Free Spin Earned" : "Egg Secured",
      title: reward.label || theme.label,
      subtitle:
        tier === "extraFreeSpin"
          ? "A bonus spin is ready in your machine."
          : `Added to your hatchery${qty > 1 ? ` ×${qty}` : ""}.`,
      accent: theme.accent,
      tier: big ? "legendary" : tier === "epic" ? "epic" : "rare",
      mode: big ? "cinematic" : "quick",
    };
  }

  if (type === "token") {
    const isXp = reward.tokenKey === "battlePassXp15";
    return {
      key: `token-${reward.tokenKey || "boost"}`,
      icon: isXp ? "⚡" : "✨",
      eyebrow: "Boost Token",
      title: reward.label || (isXp ? "1.5× Battle Pass XP Token" : "1.5× Savvy Token"),
      subtitle: "Added to your inventory.",
      accent: isXp ? "#38bdf8" : "#a78bfa",
      tier: "rare",
      mode: "quick",
    };
  }

  if (type === "savvy_multiplier" || type === "multiplier_2x") {
    return {
      key: "multiplier",
      icon: "⭐",
      eyebrow: "Multiplier",
      title: reward.label || "2× Multiplier",
      subtitle: "Doubled the other rewards in this spin.",
      accent: "#fbbf24",
      tier: "epic",
      mode: "quick",
    };
  }

  if (type === "streak_shield") {
    return {
      key: "streak-shield",
      icon: "🛡️",
      eyebrow: "Streak Shield",
      title: reward.label || "Streak Shield",
      subtitle: "Added to your inventory.",
      accent: "#34d399",
      tier: "rare",
      mode: "quick",
    };
  }

  if (type === "supply_drop") {
    return {
      key: "supply-drop",
      icon: "📦",
      eyebrow: "Supply Drop",
      title: reward.supplyDropLabel || reward.label || "Supply Drop",
      subtitle: "Claim your bonus reward from the drop.",
      accent: "#fb923c",
      tier: "epic",
      mode: "cinematic",
    };
  }

  if (type === "scout_upgrade") {
    return {
      key: "scout-upgrade",
      icon: "🤖",
      eyebrow: "Scout Upgrade",
      title: reward.label || "Savvy Scout Upgrade",
      subtitle: "Your Savvy Scout just leveled up.",
      accent: "#fde047",
      tier: "legendary",
      mode: "cinematic",
    };
  }

  return null;
}

/**
 * Pick the single most exciting reward from a spin to feature in the themed
 * reveal overlay (calling cards / tickets / savvy handle their own reveals).
 */
export function pickHeroReveal(rewards = []) {
  let best = null;
  let bestScore = -1;
  for (const reward of rewards) {
    const theme = resolveRewardReveal(reward);
    if (!theme) continue;
    const typeBoost =
      reward.type === "supply_drop" || reward.type === "scout_upgrade"
        ? 6
        : reward.type === "egg"
          ? rarityRank(reward.eggTier)
          : reward.type === "token"
            ? 3
            : reward.type === "streak_shield"
              ? 2
              : 1;
    if (typeBoost > bestScore) {
      bestScore = typeBoost;
      best = theme;
    }
  }
  return best;
}
