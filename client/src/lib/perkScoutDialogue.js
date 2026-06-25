/**
 * Contextual Savvy Scout dialogue for the Perk Machine.
 */

export function resolvePerkScoutMessage({
  reelPhase = 'idle',
  displayRewards = [],
  subscriptionLabel = 'Free',
  error = '',
  eggPulseTier = null,
  hovering = false,
}) {
  if (error && String(error).toLowerCase().includes('not enough savvy')) {
    return '💰 Stack more Savvy or grab your free daily spin, Operator.';
  }

  if (eggPulseTier === 'legendary') {
    return '⚡ That Legendary Egg might be worth holding onto.';
  }

  if (hovering && (reelPhase === 'idle' || reelPhase === 'complete')) {
    return "🤖 Operator... she's ready.";
  }

  if (reelPhase === 'complete' && displayRewards.length > 0) {
    const legendary = displayRewards.some(
      (r) => r.rarity === 'legendary' || r.eggTier === 'legendary'
    );
    const hasEgg = displayRewards.some((r) => r.type === 'egg');
    const hasRare = displayRewards.some((r) => r.rarity === 'rare' || r.rarity === 'legendary');

    if (legendary) {
      return '🎉 Operator... that\'s one of the rarest drops we\'ve seen.';
    }
    if (hasEgg) {
      return '🥚 Nice! That egg looks promising...';
    }
    if (hasRare) {
      return '⚡ Rare drop detected. Savvy Scout approves.';
    }
    if (displayRewards.some((r) => r.type === 'savvy')) {
      return '💰 Remember, duplicates can be exchanged for Savvy.';
    }
    return 'Nice pull, Operator. Savvy Scout found something useful.';
  }

  if (subscriptionLabel === 'Pro' || subscriptionLabel === 'Premium') {
    return '👑 Your perks are changing my abilities. Looking good, Operator.';
  }

  return '🎰 Machine calibrated. Pick your spin.';
}

/** True when animations should hide the dialogue bubble. */
export function isPerkScoutAnimationBusy(reelPhase, eggPulseTier) {
  return reelPhase === 'spinning' || reelPhase === 'revealing' || Boolean(eggPulseTier);
}

const CORNERS = ['br', 'bl', 'tr', 'tl'];

function rectsOverlap(a, b, padding = 8) {
  return !(
    a.right + padding < b.left ||
    a.left - padding > b.right ||
    a.bottom + padding < b.top ||
    a.top - padding > b.bottom
  );
}

/**
 * Pick a corner that avoids overlapping protected UI rects inside the machine panel.
 */
export function pickScoutCorner(floaterEl, panelEl, protectedSelectors) {
  if (!floaterEl || !panelEl) return 'br';

  const protectedEls = [];
  if (Array.isArray(protectedSelectors)) {
    for (const sel of protectedSelectors) {
      panelEl.querySelectorAll(sel).forEach((n) => protectedEls.push(n));
    }
  }

  const protectedRects = protectedEls
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);

  if (!protectedRects.length) return 'br';

  const originalClass = floaterEl.className;
  floaterEl.setAttribute('data-corner-probe', 'true');

  let bestCorner = 'br';
  let bestScore = Infinity;

  for (const corner of CORNERS) {
    floaterEl.className = `perk-scout-floater perk-scout-floater--${corner} perk-scout-floater--open`;

    const bubble = floaterEl.querySelector('.perk-scout-floater__bubble-wrap');
    const avatar = floaterEl.querySelector('.perk-scout-floater__avatar');
    const probeRects = [floaterEl, bubble, avatar]
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect());

    let overlapArea = 0;
    for (const probe of probeRects) {
      for (const blocked of protectedRects) {
        if (rectsOverlap(probe, blocked)) {
          const w = Math.min(probe.right, blocked.right) - Math.max(probe.left, blocked.left);
          const h = Math.min(probe.bottom, blocked.bottom) - Math.max(probe.top, blocked.top);
          if (w > 0 && h > 0) overlapArea += w * h;
        }
      }
    }

    const cornerBias = corner === 'br' ? 0 : 80;
    const score = overlapArea + cornerBias;
    if (score < bestScore) {
      bestScore = score;
      bestCorner = corner;
    }
  }

  floaterEl.className = originalClass;
  floaterEl.removeAttribute('data-corner-probe');
  return bestCorner;
}
