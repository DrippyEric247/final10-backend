import React, { useEffect, useState } from 'react';
import { getFoundingBetaStatus } from '../../lib/api';

/**
 * Scarcity banner — founders remaining out of 100.
 */
export default function FoundersRemainingBanner({ className = '' }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    void getFoundingBetaStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;

  if (status.complete) {
    return (
      <div className={`rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 ${className}`}>
        {status.message || 'The Founding 100 have been completed. Thank you for helping shape Final10.'}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-violet-400/35 bg-violet-500/10 px-4 py-3 ${className}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-200 m-0">Founders Remaining</p>
      <p className="text-lg font-black text-white m-0 mt-1">
        {status.remaining} / {status.max} Left
      </p>
      <p className="text-xs text-violet-100/85 m-0 mt-1">
        Only {status.remaining} Founder Calling Card{status.remaining === 1 ? '' : 's'} remain.
      </p>
    </div>
  );
}
