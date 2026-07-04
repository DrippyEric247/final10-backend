/**
 * Complete email send tracing — logs exact FROM/TO/subject, Resend key metadata,
 * whether Resend.send() ran, and the full Resend response (no shortening).
 */

function cloneForLog(value) {
  if (value == null) return null;
  if (value instanceof Error) {
    const out = {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
    for (const key of Object.getOwnPropertyNames(value)) {
      if (!(key in out)) out[key] = value[key];
    }
    return out;
  }
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, v) => {
        if (v instanceof Error) {
          return { name: v.name, message: v.message, stack: v.stack };
        }
        return v;
      })
    );
  } catch {
    return String(value);
  }
}

function describeResendApiKeyEnv() {
  const key = String(process.env.RESEND_API_KEY || '').trim();
  return {
    environmentVariable: 'RESEND_API_KEY',
    isLoaded: Boolean(key),
    keyPrefix: key ? key.slice(0, 12) : null,
    keyLength: key.length,
    keySuffix: key.length > 4 ? key.slice(-4) : null,
  };
}

function logEmailSendTrace(phase, payload = {}) {
  const line = {
    phase,
    at: new Date().toISOString(),
    ...payload,
  };
  console.log(`[email-send-trace] ${phase}`, JSON.stringify(line, null, 2));
}

function buildSendAttemptMeta({ context, from, to, subject, extra = {} }) {
  return {
    context: context || 'email_send',
    from: from ?? null,
    to: to ?? null,
    subject: subject ?? null,
    resendApiKey: describeResendApiKeyEnv(),
    ...extra,
  };
}

module.exports = {
  cloneForLog,
  describeResendApiKeyEnv,
  logEmailSendTrace,
  buildSendAttemptMeta,
};
