// client/src/pages/Login.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Final10Logo from '../components/Final10Logo';
import Final10Slogan from '../components/branding/Final10Slogan';
import SocialAuthButtons from '../components/auth/SocialAuthButtons';
import AuthDebugFooter from '../components/auth/AuthDebugFooter';
import { claimDailyLogin } from '../lib/api';
import { recordDailyLogin } from '../lib/final10PowerEngine';
import { recordBattlePassXp } from '../lib/battlePassEngine';
import { triggerDailyLoginReward, triggerStreakReward } from '../lib/rewardEngine';
import { notifyWalletFromLegacyReward } from '../lib/pointsEngine';
import { SAVVY_AUTH_REFRESH_REQUEST } from '../store/savvyStore';
import { hasCompletedOnboarding, onboardingUserId } from '../lib/onboardingPreferences';
import { parseApiError } from '../lib/apiErrorParsing';

export default function Login() {
  const { login, refreshProfile } = useAuth();
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
      const signedInUser = await login({ email: form.email.trim(), password: form.password });
      const loginPower = recordDailyLogin();
      try {
        const claim = await claimDailyLogin();
        const added = Number(claim?.added ?? claim?.savvyPointsEarned);
        if (Number.isFinite(added) && added > 0) {
          recordBattlePassXp('daily_login');
          triggerDailyLoginReward(undefined, claim.reward);
          notifyWalletFromLegacyReward({ amount: added, source: 'daily_login' });
          await refreshProfile();
          try {
            window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
          } catch {
            /* ignore */
          }
        }
        if (claim?.granted && !claim?.alreadyClaimed) {
          nav(
            hasCompletedOnboarding(onboardingUserId(signedInUser))
              ? '/daily-streak'
              : '/onboarding/preferences',
            {
              replace: true,
              state: {
                streakClaim: {
                  scoutMessage: claim.scoutMessage,
                  grants: claim.grants,
                  shieldUsed: claim.shieldUsed,
                  hiddenAchievements: claim.hiddenAchievements,
                  comeback: claim.comeback,
                },
              },
            }
          );
          return;
        }
      } catch {
        /* already claimed or network — wallet stays on server balance */
      }
      if (loginPower.changed) {
        triggerStreakReward(loginPower.streakDays);
      }
      nav(
        hasCompletedOnboarding(onboardingUserId(signedInUser)) ? '/' : '/onboarding/preferences',
        { replace: true }
      );
    } catch (e) {
      const { message } = parseApiError(e);
      setErr(message || 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="text-center mb-8 mt-4">
        <Final10Logo size="large" showTaglines={true} />
        <Final10Slogan variant="auth" />
      </div>

      <h1 className="text-3xl font-bold mb-4 text-center">Welcome Back</h1>

      <SocialAuthButtons mode="login" />

      {err ? (
        <div className="mb-3 rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
          {err}
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-3" autoComplete="on">
        <div>
          <label htmlFor="email" className="block text-sm text-[var(--f10-text-dim)] mb-1">
            Email
          </label>
          <input
            className="input"
            placeholder="you@example.com"
            type="email"
            name="email"
            id="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm text-[var(--f10-text-dim)] mb-1">
            Password
          </label>
          <input
            className="input"
            placeholder="Your password"
            type="password"
            name="password"
            id="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />
        </div>
        <p className="text-right text-sm">
          <Link
            className="inline-flex items-center text-purple-300 underline underline-offset-2 hover:text-purple-200 font-medium"
            to="/forgot-password"
          >
            Forgot Password?
          </Link>
        </p>
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
          aria-busy={busy}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-3 text-sm text-[var(--f10-text-dim)]">
        No account? <Link className="underline text-purple-300" to="/register">Sign up</Link>
      </p>
      <AuthDebugFooter />
    </div>
  );
}
