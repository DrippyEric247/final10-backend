const BW = require("../config/buildWars");

/**
 * @param {import('mongoose').LeanDocument<any>} project - ProjectAlert lean doc
 * @param {number} userTotalAlerts - count of user's deal alerts (pushes "alerts usage")
 */
function totalTrackedSavings(project) {
  const items = project.items || [];
  const itemSav = items.reduce((s, i) => s + (Number(i.estimatedSavings) || 0), 0);
  return (Number(project.estimatedBundleSavings) || 0) + itemSav;
}

function linkedAlertCount(project) {
  return (project.items || []).filter((i) => i.linkedAlertId).length;
}

function blendedTrust(project) {
  const items = project.items || [];
  const req = Number(project.trustRequirement) || 0;
  if (!items.length) return req;
  const avgItem = items.reduce((s, i) => s + (Number(i.trustMin) || 0), 0) / items.length;
  return Math.min(100, Math.max(req, avgItem));
}

function savingsScoreComponent(savingsUsd) {
  return Math.min(100, Math.log1p(Math.max(0, savingsUsd)) * 16);
}

function smartBuildScoreComponent(project, userTotalAlerts) {
  const n = (project.items || []).length;
  const linked = linkedAlertCount(project);
  const hasBundle =
    (Number(project.bundleSavingsTarget) > 0 || Number(project.estimatedBundleSavings) > 0) &&
    Number(project.budget) > 0;
  const alertSignal = Math.min(55, linked * 14 + Math.min(25, Number(userTotalAlerts) || 0));
  const multiItem = Math.min(35, Math.max(0, n - 1) * 8);
  const bundleBonus = hasBundle ? 15 : 0;
  return Math.min(100, alertSignal + multiItem + bundleBonus);
}

function trustScoreComponent(trustBlend) {
  return Math.min(100, Math.max(0, trustBlend));
}

function voteScoreComponent(votes) {
  return Math.min(100, (Number(votes) || 0) * 4);
}

/**
 * Final score 0–100 weighted:
 * savings 40%, smart build 30%, trust 20%, community votes 10%
 */
function computeFinalScore(parts) {
  const wS = 0.4;
  const wM = 0.3;
  const wT = 0.2;
  const wV = 0.1;
  return (
    wS * parts.savings +
    wM * parts.smart +
    wT * parts.trust +
    wV * parts.votes
  );
}

function scoreProject(project, { userTotalAlerts = 0, communityVotes = 0 } = {}) {
  const savingsUsd = totalTrackedSavings(project);
  const trustBlend = blendedTrust(project);
  const savings = savingsScoreComponent(savingsUsd);
  const smart = smartBuildScoreComponent(project, userTotalAlerts);
  const trust = trustScoreComponent(trustBlend);
  const votes = voteScoreComponent(communityVotes);
  const finalScore = computeFinalScore({ savings, smart, trust, votes });
  return {
    savingsUsd,
    trustBlend,
    savingsScore: savings,
    smartBuildScore: smart,
    trustScore: trust,
    voteScore: votes,
    finalScore: Math.round(finalScore * 100) / 100,
    linkedAlerts: linkedAlertCount(project),
    itemCount: (project.items || []).length,
  };
}

function validateProjectForEntry(project) {
  const items = project.items || [];
  if (items.length < BW.minItems) {
    return { ok: false, message: `Build needs at least ${BW.minItems} tracked items` };
  }
  const savings = totalTrackedSavings(project);
  if (savings < BW.minSavingsUsd) {
    return { ok: false, message: `Track at least $${BW.minSavingsUsd} in savings on this project` };
  }
  const trust = blendedTrust(project);
  if (trust < BW.minTrustBlend) {
    return { ok: false, message: `Raise trust targets — minimum blended trust is ${BW.minTrustBlend}` };
  }
  const linked = linkedAlertCount(project);
  if (linked < 1) {
    return { ok: false, message: "Link at least one Savvy alert to a part (Create alerts for missing parts)" };
  }
  return { ok: true };
}

function buildTypeLabel(category) {
  const c = String(category || "").toLowerCase();
  if (c.includes("gaming") || c.includes("pc")) return "PC build";
  if (c.includes("auto") || c.includes("bmw") || c.includes("car")) return "Car project";
  if (c.includes("studio")) return "Studio setup";
  if (c.includes("home")) return "Home project";
  return "Custom build";
}

module.exports = {
  totalTrackedSavings,
  linkedAlertCount,
  blendedTrust,
  scoreProject,
  validateProjectForEntry,
  buildTypeLabel,
  computeFinalScore,
};
