/**
 * Client-side audit logging for Quick Snipes, Best Move, onboarding, and API failures.
 * Logs to console in all envs; forwards summaries to analytics when available.
 */

const PREFIX = '[F10Audit]';

function emit(event, payload = {}) {
  const row = {
    ts: new Date().toISOString(),
    event,
    ...payload,
  };
  // eslint-disable-next-line no-console
  console.info(PREFIX, event, row);
  try {
    import('./analytics').then((m) => {
      if (typeof m.trackEvent === 'function') {
        m.trackEvent(`audit_${event}`, { ...payload, audit: true });
      }
    }).catch(() => {});
  } catch {
    /* ignore */
  }
  return row;
}

export function auditQuickSnipes(payload = {}) {
  return emit('quick_snipes', payload);
}

export function auditBestMove(payload = {}) {
  return emit('best_move', payload);
}

export function auditOnboarding(payload = {}) {
  return emit('onboarding', payload);
}

export function auditAlertAction(payload = {}) {
  return emit('alert_action', payload);
}

export function auditRewardAction(payload = {}) {
  return emit('reward_action', payload);
}

export function auditApiFailure(payload = {}) {
  return emit('api_failure', payload);
}
