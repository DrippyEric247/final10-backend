// client/src/pages/ForgotPassword.js
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Final10Logo from '../components/Final10Logo';
import Final10Slogan from '../components/branding/Final10Slogan';
import LoadingState from '../components/ui/states/LoadingState';
import { requestPasswordReset } from '../lib/api';
import { parseApiError } from '../lib/apiErrorParsing';
import AuthDebugFooter from '../components/auth/AuthDebugFooter';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      const { message } = parseApiError(e);
      setErr(message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="text-center mb-10 mt-4">
        <Final10Logo size="large" showTaglines={true} />
        <Final10Slogan variant="auth" />
      </div>

      <h1 className="text-3xl font-bold mb-2 text-center">Forgot Password</h1>
      <p className="text-sm text-gray-400 text-center mb-6">
        Enter your email and Savvy Scout will send reset instructions.
      </p>

      {sent ? (
        <div
          className="rounded-lg border border-emerald-500/35 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100"
          role="status"
        >
          If an account exists, we sent reset instructions.
        </div>
      ) : (
        <>
          {err ? (
            <div
              className="mb-3 rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-sm text-red-200"
              role="alert"
            >
              {err}
            </div>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-3">
            <label htmlFor="forgot-email" className="block text-sm text-gray-300">
              Email
            </label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full p-3 rounded bg-gray-900"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="w-full p-3 rounded bg-purple-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          {busy ? (
            <div className="mt-4 flex justify-center">
              <LoadingState variant="inline" label="Sending reset link…" />
            </div>
          ) : null}
        </>
      )}

      <p className="mt-6 text-sm text-gray-400 text-center">
        <Link className="underline text-purple-300" to="/login">
          Back to login
        </Link>
      </p>
      <AuthDebugFooter />
    </div>
  );
}
