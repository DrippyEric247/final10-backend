// client/src/pages/Register.js
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
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
import { buildSignupAttributionPayload, getAttribution } from '../lib/attribution';
import { resetOnboardingForNewAccount, onboardingUserId } from '../lib/onboardingPreferences';
import { ANALYTICS_EVENTS, trackEvent } from '../lib/analytics';
import { parseApiError } from '../lib/apiErrorParsing';
import { isPasswordStrongEnough, scorePasswordStrength } from '../lib/passwordStrength';

const fieldLabelClass = 'block text-sm text-[var(--f10-text-dim)] mb-1';
const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-purple-400'];

export default function Register() {
  const { register, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [qs] = useSearchParams();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    username: '', firstName: '', lastName: '',
    email: '', password: '', confirmPassword: '', referralCode: ''
  });

  const strength = useMemo(() => scorePasswordStrength(form.password), [form.password]);
  const passwordsMatch = form.confirmPassword.length > 0 && form.password === form.confirmPassword;
  const canSubmit =
    Boolean(form.username.trim()) &&
    Boolean(form.firstName.trim()) &&
    Boolean(form.lastName.trim()) &&
    Boolean(form.email.trim()) &&
    isPasswordStrongEnough(form.password) &&
    passwordsMatch &&
    !busy;

  // auto-fill ref/creator code if coming from a deep link or stored attribution
  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.SIGNUP_STARTED, { path: '/register' });
  }, []);

  useEffect(() => {
    const refFromUrl = qs.get('ref');
    const stored = getAttribution();
    const codeFromUrl = qs.get('code') || qs.get('promo');
    const code =
      codeFromUrl ||
      stored?.creatorCode ||
      refFromUrl ||
      stored?.referralCode ||
      '';
    if (code) setForm(f => ({ ...f, referralCode: code }));
  }, [qs]);

  const attribution = getAttribution();

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setErr('');
    setBusy(true);
    try {
      const attributionPayload = buildSignupAttributionPayload();
      const signupPayload = {
        username: form.username.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        referralCode: form.referralCode.trim(),
      };
      const payload = attributionPayload
        ? { ...signupPayload, attribution: attributionPayload }
        : signupPayload;
      const newUser = await register(payload);
      resetOnboardingForNewAccount(onboardingUserId(newUser));
      trackEvent(ANALYTICS_EVENTS.SIGNUP_COMPLETED, { method: 'email' });
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
      } catch {
        /* already claimed */
      }
      if (loginPower.changed) {
        triggerStreakReward(loginPower.streakDays);
      }
      // Every new account starts with category selection — never reuse
      // device-wide guest onboarding flags from prior sessions.
      nav('/onboarding/preferences', { replace: true });
    } catch (e) {
      const { message } = parseApiError(e);
      setErr(message || 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="text-center mb-8">
        <Final10Logo size="large" showTaglines={true} />
      </div>

      <h1 className="text-3xl font-bold mb-2 text-center">Join FINAL10</h1>
      <Final10Slogan variant="auth" className="mb-4" />
      {attribution?.creatorHandle ? (
        <div className="mb-4 p-3 rounded-lg border border-purple-400/40 bg-purple-900/30 text-purple-100 text-sm">
          You're joining through{' '}
          <strong className="text-purple-200">@{attribution.creatorHandle}</strong>
          {attribution.creatorCode ? (
            <>
              {' '}— code{' '}
              <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded">
                {attribution.creatorCode}
              </span>{' '}
              will auto-apply.
            </>
          ) : (
            '. Their picks will be highlighted in your feed.'
          )}
        </div>
      ) : null}
      <SocialAuthButtons mode="signup" />

      {err ? (
        <div className="mb-3 rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
          {err}
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="username" className={fieldLabelClass}>Username</label>
          <input className="input" placeholder="Username" name="username" id="username"
                 value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className={fieldLabelClass}>First name</label>
            <input className="input" placeholder="First name" name="firstName" id="firstName"
                   value={form.firstName} onChange={e=>setForm({...form, firstName:e.target.value})}/>
          </div>
          <div>
            <label htmlFor="lastName" className={fieldLabelClass}>Last name</label>
            <input className="input" placeholder="Last name" name="lastName" id="lastName"
                   value={form.lastName} onChange={e=>setForm({...form, lastName:e.target.value})}/>
          </div>
        </div>
        <div>
          <label htmlFor="email" className={fieldLabelClass}>Email</label>
          <input className="input" placeholder="you@example.com" type="email" name="email" id="email"
                 autoComplete="email"
                 value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
        </div>
        <div>
          <label htmlFor="password" className={fieldLabelClass}>Password</label>
          <input
            className="input"
            placeholder="Create a password (10+ characters)"
            type="password"
            name="password"
            id="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />
          {form.password ? (
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
          <label htmlFor="confirmPassword" className={fieldLabelClass}>Confirm password</label>
          <input
            className="input"
            placeholder="Confirm your password"
            type="password"
            name="confirmPassword"
            id="confirmPassword"
            autoComplete="new-password"
            required
            minLength={10}
            value={form.confirmPassword}
            onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
          />
          {form.confirmPassword && !passwordsMatch ? (
            <p className="mt-1 text-xs text-red-300">Passwords do not match.</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="referralCode" className={fieldLabelClass}>Referral code (optional)</label>
          <input className="input" placeholder="Referral code" name="referralCode" id="referralCode"
                 value={form.referralCode} onChange={e=>setForm({...form, referralCode:e.target.value})}/>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
          aria-busy={busy}
        >
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="mt-3 text-sm text-[var(--f10-text-dim)]">Already have an account? <Link className="underline text-purple-300" to="/login">Login</Link></p>
      <AuthDebugFooter />
    </div>
  );
}
