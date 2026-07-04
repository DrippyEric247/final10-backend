import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import '../../styles/best-move-insights.css';

function toSeconds(raw: number | string | undefined): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function isAuctionCountdownUrgent(secondsRemaining?: number | string): boolean {
  const s = toSeconds(secondsRemaining);
  return s != null && s > 0 && s < 600;
}

export function isAuctionCountdownCritical(secondsRemaining?: number | string): boolean {
  const s = toSeconds(secondsRemaining);
  return s != null && s > 0 && s <= 60;
}

/** MM:SS under 1h; HH:MM:SS under 24h; compact days above. */
export function formatAuctionCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s <= 0) return 'Ended';
  if (s >= 86400) {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    return `${d}d ${h}h`;
  }
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export type AuctionCountdownProps = {
  secondsRemaining?: number | string;
  itemKey?: string;
  variant?: 'inline' | 'banner' | 'overlay';
  className?: string;
};

export default function AuctionLiveCountdown({
  secondsRemaining,
  itemKey,
  variant = 'inline',
  className = '',
}: AuctionCountdownProps) {
  const initial = toSeconds(secondsRemaining);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
  }, [itemKey, initial]);

  useEffect(() => {
    if (initial == null) return undefined;
    const id = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [initial, itemKey]);

  const liveSec = useMemo(() => {
    if (initial == null) return null;
    return Math.max(0, initial - elapsed);
  }, [initial, elapsed]);

  if (liveSec == null) return null;

  const label = formatAuctionCountdown(liveSec);
  const underTenMin = liveSec > 0 && liveSec < 600;
  const underSixty = liveSec > 0 && liveSec <= 60;
  const ended = liveSec <= 0;

  const urgency = ended ? 'ended' : underSixty ? 'critical' : underTenMin ? 'urgent' : 'normal';

  return (
    <div
      className={`bm-countdown bm-countdown--${variant} bm-countdown--${urgency} ${className}`.trim()}
      role="timer"
      aria-live={underTenMin ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <Clock className="bm-countdown__icon" aria-hidden />
      <div className="bm-countdown__copy">
        <span className="bm-countdown__label">
          {ended ? 'Auction ended' : underSixty ? 'Closing now' : underTenMin ? 'Ending soon' : 'Time left'}
        </span>
        <span className="bm-countdown__digits">{label}</span>
      </div>
    </div>
  );
}
