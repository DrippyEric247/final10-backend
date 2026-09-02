const { getServerCommitSha, getServerCommitShaShort } = require('./deploySha');

function buildSpinFailureDiagnostics(err) {
  const stack = typeof err?.stack === 'string' ? err.stack : null;
  let file = null;
  let line = null;
  if (stack) {
    const frame = stack.split('\n').find((l) => l.includes('/server/') || l.includes('\\server\\'));
    if (frame) {
      const match =
        frame.match(/\((.+):(\d+):(\d+)\)/) ||
        frame.match(/at (.+):(\d+):(\d+)/);
      if (match) {
        file = match[1];
        line = Number(match[2]);
      }
    }
  }

  return {
    serverCommitSha: getServerCommitSha(),
    serverCommitShaShort: getServerCommitShaShort(),
    exceptionName: err?.name || null,
    exceptionMessage: err?.message || null,
    stackTrace: stack,
    file,
    line,
  };
}

function attachSpinFailureFields(target, err, trace, spinTraceId) {
  const resolvedTraceId = err?.spinTraceId || spinTraceId;
  const diagnostics = buildSpinFailureDiagnostics(err);

  target.spinTraceId = resolvedTraceId;
  target.failedStage = err?.failedStage || null;
  target.lastOkStage = err?.lastOkStage || trace?.getLastOkStage?.() || null;
  target.rewardId = err?.rewardId || null;
  target.rewardType = err?.rewardType || null;
  target.grantHandler = err?.grantHandler || null;
  target.failedField = err?.field || null;
  target.serverCommitSha = diagnostics.serverCommitSha;
  target.serverCommitShaShort = diagnostics.serverCommitShaShort;
  target.exceptionName = diagnostics.exceptionName;
  target.exceptionMessage = diagnostics.exceptionMessage;
  target.stackTrace = diagnostics.stackTrace;
  target.file = diagnostics.file;
  target.line = diagnostics.line;

  return target;
}

module.exports = {
  buildSpinFailureDiagnostics,
  attachSpinFailureFields,
};
