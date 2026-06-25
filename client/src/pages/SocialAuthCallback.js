// client/src/pages/SocialAuthCallback.js
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Final10Logo from '../components/Final10Logo';
import Final10Slogan from '../components/branding/Final10Slogan';
import LoadingState from '../components/ui/states/LoadingState';
import { claimDailyLogin } from '../lib/api';
import { hasCompletedOnboarding, onboardingUserId } from '../lib/onboardingPreferences';
import { SAVVY_AUTH_REFRESH_REQUEST } from '../store/savvyStore';

/**
 * Landing route the backend redirects to after Google/Apple sign-in:
 *   /auth/social?token=<jwt>&provider=google
 * On error the backend instead redirects to /login?error=..., so this page only
 * handles the success path (and defensively bounces back to /login otherwise).
 */
export default function SocialAuthCallback() {
  const { completeSocialLogin, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [qs] = useSearchParams();
  const [err, setErr] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = qs.get('token');
    const provider = qs.get('provider') || 'social';

    if (!token) {
      nav('/login?error=social_auth_failed', { replace: true });
      return;
    }

    (async () => {
      try {
        const signedInUser = await completeSocialLogin(token);

        // Best-effort daily login reward, same as email login.
        try {
          const claim = await claimDailyLogin();
          const added = Number(claim?.added ?? claim?.savvyPointsEarned);
          if (Number.isFinite(added) && added > 0) {
            await refreshProfile();
            try {
              window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* already claimed or offline — balance stays server-authoritative */
        }

        const done = hasCompletedOnboarding(onboardingUserId(signedInUser));
        nav(done ? '/' : '/onboarding/preferences', { replace: true });
      } catch {
        setErr(`We couldn’t finish signing you in with ${provider}. Please try again.`);
        window.setTimeout(() => nav('/login?error=social_auth_failed', { replace: true }), 1800);
      }
    })();
  }, [qs, completeSocialLogin, refreshProfile, nav]);

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="text-center mb-10 mt-4">
        <Final10Logo size="large" showTaglines={true} />
        <Final10Slogan variant="auth" />
      </div>
      {err ? (
        <div
          className="rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-sm text-red-200 text-center"
          role="alert"
        >
          {err}
        </div>
      ) : (
        <div className="flex justify-center">
          <LoadingState variant="inline" label="Finishing sign-in…" />
        </div>
      )}
    </div>
  );
}
