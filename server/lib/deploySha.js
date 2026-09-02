/**
 * Resolve deployed Git commit SHA from Railway / CI environment variables.
 */
function resolveDeployGitSha() {
  return (
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.RAILWAY_GIT_SHA ||
    process.env.GIT_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    null
  );
}

function getServerCommitSha() {
  const sha = resolveDeployGitSha();
  return sha ? String(sha).trim() : null;
}

function getServerCommitShaShort() {
  const sha = getServerCommitSha();
  return sha ? sha.slice(0, 7) : null;
}

module.exports = {
  resolveDeployGitSha,
  getServerCommitSha,
  getServerCommitShaShort,
};
