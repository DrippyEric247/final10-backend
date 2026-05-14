import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getSellerTrendAlerts,
  getTrendCoverage,
  subscribeToTrendUpdates,
  type SellerTrendAlert,
} from "../../lib/sellerTrendEngine";
import { getFreeAlertCap, isPremiumSeller } from "../../lib/sellerPremium";
import "../../styles/SellerTrendIntel.css";

export type SellerTrendAlertsProps = {
  /** Cap the alerts shown in this surface. Free tier is clamped to 3. */
  limit?: number;
  /** Hide the upsell footer (useful on the dashboard's own page). */
  hideUpsell?: boolean;
  className?: string;
};

/**
 * In-app alert feed. Reads purely from the real trend engine — renders
 * nothing (not even a skeleton) when there isn't enough signal yet.
 * That's the "do not overwhelm new sellers" rule in practice.
 */
export default function SellerTrendAlerts({
  limit,
  hideUpsell = false,
  className = "",
}: SellerTrendAlertsProps) {
  const [alerts, setAlerts] = useState<SellerTrendAlert[]>(() => getSellerTrendAlerts());
  const [coverage, setCoverage] = useState(() => getTrendCoverage());

  useEffect(() => {
    const refresh = () => {
      setAlerts(getSellerTrendAlerts());
      setCoverage(getTrendCoverage());
    };
    const unsub = subscribeToTrendUpdates(refresh);
    // Periodic recompute for time-sensitive "best window" labels.
    const t = window.setInterval(refresh, 60 * 1000);
    return () => {
      unsub();
      window.clearInterval(t);
    };
  }, []);

  const pro = isPremiumSeller();
  const effectiveCap = Math.min(
    alerts.length,
    limit ?? (pro ? alerts.length : getFreeAlertCap())
  );
  const visible = alerts.slice(0, effectiveCap);
  const clipped = alerts.length - visible.length;

  if (!coverage.hasEnoughData) {
    return (
      <aside className={`seller-trend-alerts seller-trend-alerts--empty ${className}`}>
        <div className="seller-trend-alerts-empty-title">
          No hot lanes yet
        </div>
        <div className="seller-trend-alerts-empty-body">
          We only ping you when real money signals show up. Browse and save a bit — the next alert could
          be your cue to list.
        </div>
      </aside>
    );
  }

  if (visible.length === 0) {
    return (
      <aside className={`seller-trend-alerts seller-trend-alerts--empty ${className}`}>
        <div className="seller-trend-alerts-empty-title">
          Quiet stretch — for now
        </div>
        <div className="seller-trend-alerts-empty-body">
          Nothing’s screaming “list this” in the last few hours. Check back soon; windows open fast.
        </div>
      </aside>
    );
  }

  return (
    <aside className={`seller-trend-alerts ${className}`} aria-label="Seller trend alerts">
      <header className="seller-trend-alerts-header">
        <span className="seller-trend-alerts-eyebrow">Money signals</span>
        <Link to="/seller-trends" className="seller-trend-alerts-link">
          Open full map →
        </Link>
      </header>

      <ul className="seller-trend-alerts-list">
        {visible.map((a) => (
          <li key={a.id} className="seller-trend-alert">
            <div className="seller-trend-alert-headline">
              {a.headline}
              <span className="seller-trend-alert-delta" aria-hidden>
                {formatDelta(a.trend.delta)}
              </span>
            </div>
            <div className="seller-trend-alert-detail">{a.detail}</div>
          </li>
        ))}
      </ul>

      {!hideUpsell && clipped > 0 ? (
        <div className="seller-trend-alerts-upsell">
          {clipped} more money signal{clipped === 1 ? "" : "s"} locked behind{" "}
          <strong>Seller Pro</strong>.
        </div>
      ) : null}
    </aside>
  );
}

function formatDelta(delta: number): string {
  if (!Number.isFinite(delta)) return "";
  if (delta >= 1) return "+100%+";
  if (delta <= 0) return "";
  return `+${Math.round(delta * 100)}%`;
}
