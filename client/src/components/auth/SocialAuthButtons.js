// client/src/components/auth/SocialAuthButtons.js
import React, { useEffect, useState } from 'react';
import { getAuthProviders } from '../../lib/api';
import { buildAuthUrl } from '../../lib/runtimeApi';

const OAUTH_ERROR_COPY = {
  cancelled: 'Sign-in was cancelled. Want to try again?',
  missing_code: "We didn't get a response from the provider. Please try again.",
  google_not_configured:
    'Google sign-in is not configured yet on the server. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL on Railway.',
  apple_not_configured:
    'Apple sign-in is not configured yet on the server. Add APPLE_* env vars on Railway (see SOCIAL_AUTH_SETUP.md).',
  google_auth_failed: 'Google sign-in failed. Please try again or use email.',
  apple_auth_failed: 'Apple sign-in failed. Please try again or use email.',
  google_start_failed: "Couldn't start Google sign-in. Please try again.",
  apple_start_failed: "Couldn't start Apple sign-in. Please try again.",
  social_auth_failed: 'Social sign-in failed. Please try again or use email.',
};

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg width="17" height="20" viewBox="0 0 17 20" aria-hidden="true" fill="currentColor">
      <path d="M14.06 10.6c-.02-2.05 1.67-3.03 1.75-3.08-0.95-1.39-2.43-1.58-2.96-1.6-1.26-.13-2.46.74-3.1.74-.64 0-1.63-.72-2.68-.7-1.38.02-2.65.8-3.36 2.04-1.43 2.49-.37 6.17 1.03 8.19.68.99 1.5 2.1 2.57 2.06 1.03-.04 1.42-.67 2.67-.67 1.24 0 1.6.67 2.69.65 1.11-.02 1.81-1.01 2.49-2 .78-1.15 1.11-2.26 1.13-2.32-.02-.01-2.17-.83-2.19-3.3zM12.03 4.6c.57-.69.95-1.65.85-2.6-.82.03-1.81.54-2.39 1.23-.52.61-.98 1.59-.86 2.52.91.07 1.84-.46 2.4-1.15z" />
    </svg>
  );
}

/**
 * Google + Apple sign-in buttons — always visible on Login/Register.
 * Backend `/api/auth/providers` indicates whether OAuth is fully configured;
 * buttons still link to the OAuth start routes so users get a clear setup error
 * if env vars are missing on Railway.
 */
export default function SocialAuthButtons({ mode = 'login' }) {
  const [providers, setProviders] = useState({ google: false, apple: false, loaded: false });
  const [oauthError, setOauthError] = useState('');

  useEffect(() => {
    let active = true;
    getAuthProviders()
      .then((p) => {
        if (active) setProviders({ ...p, loaded: true });
      })
      .catch(() => {
        if (active) setProviders({ google: false, apple: false, loaded: true });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('error');
    if (code) {
      setOauthError(OAUTH_ERROR_COPY[code] || OAUTH_ERROR_COPY.social_auth_failed);
    }
  }, []);

  const googleUrl = buildAuthUrl('google');
  const appleUrl = buildAuthUrl('apple');
  const verb = mode === 'signup' ? 'Sign up' : 'Continue';
  const needsSetup = providers.loaded && !providers.google && !providers.apple;

  return (
    <div className="mb-5">
      {oauthError ? (
        <div
          className="mb-3 rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          {oauthError}
        </div>
      ) : null}

      <div className="space-y-3">
        {googleUrl ? (
          <a
            href={googleUrl}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 font-semibold text-gray-800 shadow-sm transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-400/60"
          >
            <GoogleGlyph />
            <span>{verb} with Google</span>
          </a>
        ) : null}

        {appleUrl ? (
          <a
            href={appleUrl}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/15 bg-black px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400/60"
          >
            <AppleGlyph />
            <span>{verb} with Apple</span>
          </a>
        ) : null}
      </div>

      {needsSetup ? (
        <p className="mt-2 text-center text-xs text-amber-200/90">
          Social sign-in buttons are visible; server OAuth env vars are not set yet. Use email
          below, or ask admin to configure Google/Apple on Railway.
        </p>
      ) : null}

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-wide text-gray-400">or continue with email</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
    </div>
  );
}
