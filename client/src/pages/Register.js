// client/src/pages/Register.js
import React, { useEffect, useState } from 'react';
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
import LoadingState from '../components/ui/states/LoadingState';

export default function Register() {
  const { register, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [qs] = useSearchParams();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    username: '', firstName: '', lastName: '',
    email: '', password: '', referralCode: ''
  });

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
    setErr('');
    setBusy(true);
    try {
      const attributionPayload = buildSignupAttributionPayload();
      const payload = attributionPayload
        ? { ...form, attribution: attributionPayload }
        : form;
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
      {/* FINAL10 APP Logo */}
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
        <input className="w-full p-3 rounded bg-gray-900" placeholder="Username" name="username" id="username"
               value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/>
        <div className="grid grid-cols-2 gap-3">
          <input className="p-3 rounded bg-gray-900" placeholder="First name" name="firstName" id="firstName"
                 value={form.firstName} onChange={e=>setForm({...form, firstName:e.target.value})}/>
          <input className="p-3 rounded bg-gray-900" placeholder="Last name" name="lastName" id="lastName"
                 value={form.lastName} onChange={e=>setForm({...form, lastName:e.target.value})}/>
        </div>
        <input className="w-full p-3 rounded bg-gray-900" placeholder="Email" name="email" id="email"
               value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
        <input className="w-full p-3 rounded bg-gray-900" placeholder="Password" type="password" name="password" id="password"
               value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
        <input className="w-full p-3 rounded bg-gray-900" placeholder="Referral code (optional)" name="referralCode" id="referralCode"
               value={form.referralCode} onChange={e=>setForm({...form, referralCode:e.target.value})}/>
        <button
          type="submit"
          disabled={busy}
          className="w-full p-3 rounded bg-yellow-400 text-black font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      {busy ? (
        <div className="mt-4 flex justify-center">
          <LoadingState variant="inline" label="Creating your account…" />
        </div>
      ) : null}
      <p className="mt-3 text-sm text-gray-400">Already have an account? <Link className="underline" to="/login">Login</Link></p>
      <AuthDebugFooter />
    </div>
  );
}


