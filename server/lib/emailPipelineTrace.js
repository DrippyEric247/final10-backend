/**
 * Step-by-step email pipeline tracing for alert/test diagnostics.
 * Pass trace from caller; each step is logged + returned in API response.
 */
const { auditEmailPipelineStep } = require('../services/auditLogger');

function createEmailPipelineTrace() {
  const steps = [];

  function step(name, meta = {}) {
    const row = {
      step: name,
      at: new Date().toISOString(),
      elapsedMs: steps.length ? Date.now() - Date.parse(steps[0].at) : 0,
      ...meta,
    };
    steps.push(row);
    console.log(`[emailPipeline] ${name}`, JSON.stringify(meta));
    auditEmailPipelineStep(name, meta);
    return row;
  }

  function lastStep() {
    return steps.length ? steps[steps.length - 1] : null;
  }

  function stopReason() {
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      const s = steps[i];
      if (s.step === 'email_pipeline_success' || s.sent === true) return null;
      if (s.step === 'email_stop' || s.step === 'send_mail_stop' || s.step === 'email_pipeline_failed') {
        return s.reason || s.step;
      }
      if (s.ok === false && s.reason) return s.reason;
      if (s.sent === false) return s.reason || 'send_failed';
    }
    return steps.length ? 'incomplete' : 'not_started';
  }

  return { steps, step, lastStep, stopReason };
}

module.exports = { createEmailPipelineTrace };
