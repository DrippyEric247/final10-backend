import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { SavvyPointsIcon } from "../rewards/SavvyPointsIcon";
import "../../styles/SocialControls.css";

type WeeklyStat = {
  handle: string;
  weekKey: string;
  savvyEarned: number;
  winsCount: number;
  bestMovesFollowed: number;
};

type Compare = {
  weekKey: string;
  me: WeeklyStat;
  them: WeeklyStat;
  delta: {
    savvyEarned: number;
    winsCount: number;
    bestMovesFollowed: number;
  };
};

type WeeklyCompareCardProps = {
  /** User id of the person to compare against (the "them" side). */
  targetUserId: string;
};

/**
 * Side-by-side card comparing the authed user's weekly Savvy / wins to
 * another user's. Used on profile pages and creator showcases.
 */
export default function WeeklyCompareCard({ targetUserId }: WeeklyCompareCardProps) {
  const [data, setData] = useState<Compare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get(`/users/${targetUserId}/weekly-compare`)
      .then(({ data }) => {
        if (!cancelled) setData(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Could not load compare");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  if (loading) {
    return (
      <div className="weekly-compare weekly-compare--loading" aria-busy>
        Loading weekly compare…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="weekly-compare weekly-compare--error">
        {error || "Compare unavailable"}
      </div>
    );
  }

  const { me, them, delta, weekKey } = data;
  const meAhead = (key: keyof Compare["delta"]) => delta[key] > 0;

  return (
    <div className="weekly-compare" aria-label="Weekly Savvy / wins compare">
      <header className="weekly-compare-header">
        <div className="weekly-compare-title">This week</div>
        <div className="weekly-compare-week">{weekKey}</div>
      </header>

      <div className="weekly-compare-grid">
        <div className="weekly-compare-row">
          <div className="weekly-compare-label">
            <SavvyPointsIcon size={18} /> Savvy earned
          </div>
          <div className="weekly-compare-numbers">
            <span className={meAhead("savvyEarned") ? "is-up" : ""}>
              {me.savvyEarned.toLocaleString()}
            </span>
            <span className="weekly-compare-vs">vs</span>
            <span className={!meAhead("savvyEarned") && delta.savvyEarned !== 0 ? "is-up" : ""}>
              {them.savvyEarned.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="weekly-compare-row">
          <div className="weekly-compare-label">🏆 Wins</div>
          <div className="weekly-compare-numbers">
            <span className={meAhead("winsCount") ? "is-up" : ""}>
              {me.winsCount}
            </span>
            <span className="weekly-compare-vs">vs</span>
            <span className={!meAhead("winsCount") && delta.winsCount !== 0 ? "is-up" : ""}>
              {them.winsCount}
            </span>
          </div>
        </div>

        <div className="weekly-compare-row">
          <div className="weekly-compare-label">🎯 Best Moves followed</div>
          <div className="weekly-compare-numbers">
            <span className={meAhead("bestMovesFollowed") ? "is-up" : ""}>
              {me.bestMovesFollowed}
            </span>
            <span className="weekly-compare-vs">vs</span>
            <span className={!meAhead("bestMovesFollowed") && delta.bestMovesFollowed !== 0 ? "is-up" : ""}>
              {them.bestMovesFollowed}
            </span>
          </div>
        </div>
      </div>

      <footer className="weekly-compare-footer">
        <span>You: <strong>@{me.handle}</strong></span>
        <span>Them: <strong>@{them.handle}</strong></span>
      </footer>
    </div>
  );
}
