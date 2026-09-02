/**
 * Forensic trace logging for Perk Machine spins.
 * Format: [PERK_SPIN][PM-<ts>-<id>][STAGE]
 * Never log credentials, tokens, or passwords.
 */
const crypto = require('crypto');

function createSpinTraceId() {
  const ts = Date.now();
  const short = crypto.randomBytes(3).toString('hex');
  return `PM-${ts}-${short}`;
}

function formatMongooseErrorDetails(err) {
  if (!err?.errors || typeof err.errors !== 'object') return null;
  return Object.entries(err.errors).map(([path, detail]) => ({
    path,
    kind: detail?.kind,
    message: detail?.message,
    value: detail?.value,
    enumValues: detail?.properties?.enumValues || null,
  }));
}

function formatMongoErrorFields(err) {
  if (!err) return null;
  const out = {};
  if (err.code != null) out.code = err.code;
  if (err.codeName) out.codeName = err.codeName;
  if (err.keyPattern) out.keyPattern = err.keyPattern;
  if (err.keyValue) out.keyValue = err.keyValue;
  return Object.keys(out).length ? out : null;
}

function createSpinTracer(spinTraceId) {
  const id = spinTraceId || createSpinTraceId();
  let lastOkStage = null;

  function prefix(stage) {
    return `[PERK_SPIN][${id}][${stage}]`;
  }

  function log(stage, payload = {}) {
    // eslint-disable-next-line no-console
    console.log(prefix(stage), JSON.stringify({ spinTraceId: id, ...payload }));
  }

  function logOk(stage, payload = {}) {
    lastOkStage = stage;
    log(`${stage}_OK`, payload);
  }

  function logStart(stage, payload = {}) {
    log(`${stage}_START`, payload);
  }

  function logError(stage, err, extra = {}) {
    console.error(prefix('ERROR'), JSON.stringify({
      spinTraceId: id,
      stage,
      lastOkStage,
      errorName: err?.name || null,
      errorMessage: err?.message || String(err),
      errorCode: err?.code || null,
      validationDetails: formatMongooseErrorDetails(err),
      mongoError: formatMongoErrorFields(err),
      stack: err?.stack || null,
      ...extra,
    }));
  }

  /** Run an async stage with START / OK / ERROR logging. Rethrows on failure. */
  async function runStage(stage, fn, startPayload = {}) {
    logStart(stage, startPayload);
    try {
      const result = await fn();
      logOk(stage, typeof result === 'object' && result !== null ? result : {});
      return result;
    } catch (err) {
      logError(stage, err, startPayload);
      err.spinTraceId = id;
      err.failedStage = stage;
      err.lastOkStage = lastOkStage;
      throw err;
    }
  }

  /** Run a sync stage with START / OK / ERROR logging. */
  function runStageSync(stage, fn, startPayload = {}) {
    logStart(stage, startPayload);
    try {
      const result = fn();
      logOk(stage, typeof result === 'object' && result !== null ? result : {});
      return result;
    } catch (err) {
      logError(stage, err, startPayload);
      err.spinTraceId = id;
      err.failedStage = stage;
      err.lastOkStage = lastOkStage;
      throw err;
    }
  }

  async function validateUserDoc(user, label = 'USER') {
    if (!user || typeof user.validate !== 'function') return;
    logStart(`${label}_VALIDATE`);
    try {
      await user.validate();
      logOk(`${label}_VALIDATE`, { model: 'User' });
    } catch (err) {
      logError(`${label}_VALIDATE`, err, { model: 'User' });
      err.spinTraceId = id;
      err.failedStage = `${label}_VALIDATE`;
      err.lastOkStage = lastOkStage;
      throw err;
    }
  }

  return {
    spinTraceId: id,
    getLastOkStage: () => lastOkStage,
    log,
    logOk,
    logStart,
    logError,
    runStage,
    runStageSync,
    validateUserDoc,
  };
}

module.exports = {
  createSpinTraceId,
  createSpinTracer,
  formatMongooseErrorDetails,
  formatMongoErrorFields,
};
