// Temporary auth rollout debug — remove once live login/signup verified.
import React, { useEffect, useState } from 'react';
import { getApiBaseUrl, getApiOrigin } from '../../lib/runtimeApi';
import { getAuthProviders } from '../../lib/api';

function readBundleScript() {
  if (typeof document === 'undefined') return '';
  const el =
    document.querySelector('script[src*="/static/js/main."]') ||
    document.querySelector('script[src*="main"]');
  return el?.getAttribute('src') || '';
}

export default function AuthDebugFooter() {
  const [providers, setProviders] = useState(null);
  const bundle = readBundleScript();

  useEffect(() => {
    const apiBase = getApiBaseUrl();
    const apiOrigin = getApiOrigin();
    // eslint-disable-next-line no-console
    console.info('[Final10 auth debug]', { apiBase, apiOrigin, bundle });
    getAuthProviders()
      .then((p) => setProviders(p))
      .catch(() => setProviders({ google: false, apple: false, error: true }));
  }, [bundle]);

  return (
    <footer
      className="mt-8 pt-3 border-t border-dashed border-white/15 text-[10px] leading-relaxed text-gray-500 font-mono"
      aria-label="Auth deployment debug"
    >
      <div className="text-gray-400 font-semibold uppercase tracking-wide mb-1">Auth debug</div>
      <div>API base: {getApiBaseUrl() || '(not configured)'}</div>
      <div>API origin: {getApiOrigin() || '(not configured)'}</div>
      <div>JS bundle: {bundle || 'unknown'}</div>
      <div>
        OAuth providers:{' '}
        {providers == null
          ? 'loading…'
          : `google=${String(providers.google)} apple=${String(providers.apple)}`}
      </div>
    </footer>
  );
}
