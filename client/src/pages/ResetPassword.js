// client/src/pages/ResetPassword.js
import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Final10Logo from '../components/Final10Logo';
import Final10Slogan from '../components/branding/Final10Slogan';
import LoadingState from '../components/ui/states/LoadingState';
import { submitPasswordReset } from '../lib/api';
import { parseApiError } from '../lib/apiErrorParsing';
import { isPasswordStrongEnough, scorePasswordStrength } from '../lib/passwordStrength';
import AuthDebugFooter from '../components/auth/AuthDebugFooter';

const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-purple-400'];

export default function ResetPassword() {
  const [qs] = useSearchParams();
  const token = qs.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const strength = useMemo(() => scorePasswordStrength(password), [password]);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit =
    Boolean(token) &&
    isPasswordStrongEnough(password) &&
    passwordsMatch &&
    !busy;

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setErr('');
    setBusy(true);
    try {
      await submitPasswordReset({ token, password, confirmPassword });
      setDone(true);
    } catch (e) {
      const { message } = parseApiError(e);
      setErr(message || 'Reset failed. Please request a new link.');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto p-6">
        <div className="text-center mb-10 mt-4">
          <Final10Logo size="large" showTaglines={true} />
          <Final10Slogan variant="auth" />
        </div>
        <div
          className="rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-sm text-red-200 text-center"
          role="alert"
        >
          This reset link is invalid. Please request a new one.
        </div>
        <p className="mt-6 text-sm text-gray-400 text-center">
          <Link className="underline text-purple-300" to="/forgot-password">
            Request reset link
          </Link>
        </p>
        <AuthDebugFooter />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="text-center mb-10 mt-4">
        <Final10Logo size="large" showTaglines={true} />
        <Final10Slogan variant="auth" />
      </div>

      <h1 className="text-3xl font-bold mb-2 text-center">Reset Password</h1>
      <p className="text-sm text-gray-400 text-center mb-6">Choose a strong new password for your account.</p>

      {done ? (
        <>
          <div
            className="rounded-lg border border-emerald-500/35 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100 text-center"
            role="status"
          >
            Password reset successful. Please log in.
          </div>
          <p className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-block w-full p-3 rounded bg-purple-500 font-semibold text-center"
            >
              Go to login
            </Link>
          </p>
        </>
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
            <div>
              <label htmlFor="new-password" className="block text-sm text-gray-300 mb-1">
                New password
              </label>
              <input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                className="w-full p-3 rounded bg-gray-900"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {password ? (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Strength</span>
                    <span className="font-semibold text-gray-200">{strength.label}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${STRENGTH_COLORS[strength.score] || 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, strength.score * 25)}%` }}
                    />
                  </div>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {strength.checks.map((c) => (
                      <li key={c.id} className={c.ok ? 'text-emerald-400' : 'text-gray-500'}>
                        {c.ok ? '✓' : '○'} {c.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm text-gray-300 mb-1">
                Confirm password
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                className="w-full p-3 rounded bg-gray-900"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword && !passwordsMatch ? (
                <p className="mt-1 text-xs text-red-300">Passwords do not match.</p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full p-3 rounded bg-yellow-400 text-black font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? 'Updating…' : 'Reset password'}
            </button>
          </form>
          {busy ? (
            <div className="mt-4 flex justify-center">
              <LoadingState variant="inline" label="Updating password…" />
            </div>
          ) : null}
        </>
      )}

      {!done ? (
        <p className="mt-6 text-sm text-gray-400 text-center">
          <Link className="underline text-purple-300" to="/login">
            Back to login
          </Link>
        </p>
      ) : null}
      <AuthDebugFooter />
    </div>
  );
}
