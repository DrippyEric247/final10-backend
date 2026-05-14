// client/src/pages/Login.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Final10Logo from '../components/Final10Logo';
import { recordDailyLogin } from '../lib/final10PowerEngine';
import { recordBattlePassXp } from '../lib/battlePassEngine';
import { triggerDailyLoginReward, triggerStreakReward } from '../lib/rewardEngine';
import { hasCompletedOnboarding } from '../lib/onboardingPreferences';
import { parseApiError } from '../lib/apiErrorParsing';
import LoadingState from '../components/ui/states/LoadingState';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      // Current backend contract expects email. If username login is added
      // later, branch here on identifier type and call the matching endpoint.
      await login({ email: form.email.trim(), password: form.password });
      const loginPower = recordDailyLogin();
      if (loginPower.changed) {
        recordBattlePassXp('daily_login');
        triggerDailyLoginReward(20);
        triggerStreakReward(loginPower.streakDays);
      }
      nav(hasCompletedOnboarding() ? '/' : '/onboarding/preferences', { replace: true });
    } catch (e) {
      const { message } = parseApiError(e);
      setErr(message || 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      {/* FINAL10 APP Logo */}
      <div className="text-center mb-12 mt-4">
        <Final10Logo size="large" showTaglines={true} />
      </div>
      
      <h1 className="text-3xl font-bold mb-4 text-center">Welcome Back</h1>
      {err ? (
        <div className="mb-3 rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
          {err}
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-3" autoComplete="on">
        <label htmlFor="email" className="block text-sm text-gray-300">
          Email
        </label>
        <input
          className="w-full p-3 rounded bg-gray-900"
          placeholder="Email"
          type="email"
          name="email"
          id="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
        />
        <input
          className="w-full p-3 rounded bg-gray-900"
          placeholder="Password"
          type="password"
          name="password"
          id="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full p-3 rounded bg-purple-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {busy ? (
        <div className="mt-4 flex justify-center">
          <LoadingState variant="inline" label="Signing you in…" />
        </div>
      ) : null}
      <p className="mt-3 text-sm text-gray-400">No account? <Link className="underline" to="/register">Sign up</Link></p>
    </div>
  );
}


