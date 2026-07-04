import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  castBetaCommunityVote,
  getBetaCommunitySnapshot,
  submitBetaCommunityReview,
} from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { SAVVY_SCOUT } from '../../config/savvyScoutBranding';
import { SavvyPointsIcon } from '../rewards/SavvyPointsIcon';
import '../../styles/CommunityVoteFeedback.css';

const SCOUT_IMG = '/assets/perk-machine/savvy-scout-alive.png';

const FALLBACK_SNAPSHOT = {
  betaMode: true,
  rewards: { voteSavvy: 15, reviewSavvy: 25 },
  scoutLines: [
    'Operator, every vote helps improve the Savvy Universe.',
    'Your feedback today builds tomorrow\'s features.',
  ],
  topics: [
    { id: 'quick_snipes_improvements', label: 'Quick Snipes Improvements', emoji: '⚡', votes: 0, voted: false },
    { id: 'better_ai_best_moves', label: 'Better AI Best Moves', emoji: '🎯', votes: 0, voted: false },
    { id: 'new_events', label: 'New Events', emoji: '🎉', votes: 0, voted: false },
    { id: 'perk_machine_rewards', label: 'Perk Machine Rewards', emoji: '🎰', votes: 0, voted: false },
    { id: 'savvy_scout_flight', label: 'Savvy Scout Flight Updates', emoji: '✈️', votes: 0, voted: false },
    { id: 'founding_tester_rewards', label: 'Founding Tester Rewards', emoji: '🏅', votes: 0, voted: false },
    { id: 'savvy_shop_integration', label: 'SavvyShop Integration', emoji: '🛍️', votes: 0, voted: false },
    { id: 'savvy_trip_preview', label: 'SavvyTrip Preview', emoji: '🌍', votes: 0, voted: false },
    { id: 'new_calling_cards', label: 'New Calling Cards', emoji: '🎴', votes: 0, voted: false },
    { id: 'profile_customization', label: 'Profile Customization', emoji: '👤', votes: 0, voted: false },
  ],
  shippedItems: [
    { id: 'nav_redesign', label: 'Navigation redesigned' },
    { id: 'qs_before_auctions', label: 'Quick Snipes moved before Auctions' },
    { id: 'best_move_default', label: 'Search defaults to Best Move' },
    { id: 'mobile_popups', label: 'Improved mobile popups' },
    { id: 'event_notifications', label: 'Better event notifications' },
    { id: 'faster_alerts', label: 'Faster alerts' },
  ],
  stats: {
    totalBetaTesters: 0,
    votesCast: 0,
    bugsFixed: 47,
    suggestionsImplemented: 6,
    averageRating: 0,
    reviewCount: 0,
  },
};

function StatCard({ label, value, pct, tone }) {
  return (
    <div className={`cvf-stat cvf-stat--${tone}`}>
      <div className="cvf-stat__value">{value}</div>
      <div className="cvf-stat__label">{label}</div>
      <div className="cvf-stat__bar" aria-hidden>
        <motion.div
          className="cvf-stat__fill"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function StarRating({ value, onChange, disabled }) {
  return (
    <div className="cvf-stars" role="radiogroup" aria-label="Rate today's experience">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={`cvf-star${value >= n ? ' is-on' : ''}`}
          disabled={disabled}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function CommunityVoteFeedbackSection() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scoutIdx, setScoutIdx] = useState(0);
  const [status, setStatus] = useState('');
  const [voteBusy, setVoteBusy] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [enjoyed, setEnjoyed] = useState('');
  const [improve, setImprove] = useState('');
  const [reportBug, setReportBug] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBetaCommunitySnapshot();
      setSnapshot(data?.topics ? data : FALLBACK_SNAPSHOT);
    } catch {
      setSnapshot(FALLBACK_SNAPSHOT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, user?.id]);

  useEffect(() => {
    const lines = snapshot?.scoutLines?.length ? snapshot.scoutLines : FALLBACK_SNAPSHOT.scoutLines;
    const id = window.setInterval(() => setScoutIdx((n) => (n + 1) % lines.length), 5200);
    return () => window.clearInterval(id);
  }, [snapshot?.scoutLines]);

  const data = snapshot || FALLBACK_SNAPSHOT;
  const maxVotes = useMemo(
    () => Math.max(1, ...(data.topics || []).map((t) => t.votes || 0)),
    [data.topics]
  );
  const scoutLine = (data.scoutLines || FALLBACK_SNAPSHOT.scoutLines)[scoutIdx % (data.scoutLines?.length || 1)];

  const handleVote = async (topicId) => {
    if (!user) {
      setStatus('Log in to vote and earn Savvy.');
      return;
    }
    setVoteBusy(topicId);
    setStatus('');
    try {
      const res = await castBetaCommunityVote(topicId);
      if (res?.snapshot) setSnapshot(res.snapshot);
      else await load();
      if (res?.reward?.amount) {
        setStatus(`Vote recorded! +${res.reward.amount} Savvy added to your wallet.`);
      } else {
        setStatus('Vote recorded — thanks for shaping Final10!');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not record vote.';
      setStatus(msg);
    } finally {
      setVoteBusy(null);
    }
  };

  const handleReview = async (e) => {
    e.preventDefault();
    if (!user) {
      setStatus('Log in to submit a review and earn Savvy.');
      return;
    }
    if (!rating) {
      setStatus('Select a star rating first.');
      return;
    }
    setReviewBusy(true);
    setStatus('');
    try {
      const res = await submitBetaCommunityReview({ rating, enjoyed, improve, reportBug });
      if (res?.snapshot) setSnapshot(res.snapshot);
      else await load();
      setEnjoyed('');
      setImprove('');
      setReportBug('');
      setRating(0);
      if (res?.reward?.amount) {
        setStatus(`Thanks, Operator! +${res.reward.amount} Savvy for your feedback.`);
      } else {
        setStatus('Thanks — your review helps build tomorrow\'s features.');
      }
    } catch (err) {
      setStatus(err?.response?.data?.message || 'Could not submit review.');
    } finally {
      setReviewBusy(false);
    }
  };

  if (loading && !snapshot) {
    return (
      <section className="cvf-section home-card" aria-labelledby="cvf-title">
        <p className="cvf-loading">Loading community hub…</p>
      </section>
    );
  }

  const reviewedToday = Boolean(data.user?.reviewedToday);
  const voteReward = data.rewards?.voteSavvy ?? 15;
  const reviewReward = data.rewards?.reviewSavvy ?? 25;

  return (
    <section className="cvf-section" id="help-shape-final10" aria-labelledby="cvf-title">
      <div className="cvf-you-asked home-card">
        <div className="cvf-you-asked__head">
          <span className="cvf-you-asked__icon" aria-hidden>🛠</span>
          <h3 className="cvf-you-asked__title">You Asked. We Built.</h3>
        </div>
        <ul className="cvf-you-asked__list">
          {(data.shippedItems || []).slice(0, 6).map((item) => (
            <li key={item.id}>
              <span className="cvf-you-asked__check" aria-hidden>✔️</span>
              {item.label}
            </li>
          ))}
        </ul>
        <p className="cvf-you-asked__thanks">
          Thanks to the Founding Testers for helping shape Final10.
        </p>
      </div>

      <header className="cvf-header">
        <div className="cvf-header__copy">
          <p className="cvf-kicker">Founding Tester Program</p>
          <h2 id="cvf-title" className="cvf-title">🗳️ Help Shape Final10</h2>
          <p className="cvf-subtitle">
            Your feedback directly influences what we build next. Vote on features, review updates,
            and earn Savvy for participating.
          </p>
        </div>
        <div className="cvf-scout-bubble">
          <img src={SCOUT_IMG} alt="" className="cvf-scout-bubble__img" />
          <p className="cvf-scout-bubble__line">
            <strong>{SAVVY_SCOUT.shortTitle}:</strong> {scoutLine}
          </p>
        </div>
      </header>

      {status ? (
        <p className="cvf-status" role="status">{status}</p>
      ) : null}

      <div className="cvf-grid">
        <section className="cvf-panel home-card" aria-labelledby="cvf-vote-title">
          <div className="cvf-panel__head">
            <h3 id="cvf-vote-title" className="cvf-panel__title">Feature Voting</h3>
            <span className="cvf-reward-pill">
              <SavvyPointsIcon size={14} /> +{voteReward} per vote
            </span>
          </div>
          <p className="cvf-panel__hint">One vote per topic — pick what ships next.</p>
          <div className="cvf-vote-grid">
            {(data.topics || []).map((topic) => {
              const pct = Math.round(((topic.votes || 0) / maxVotes) * 100);
              return (
                <button
                  key={topic.id}
                  type="button"
                  className={`cvf-vote-card${topic.voted ? ' is-voted' : ''}`}
                  disabled={topic.voted || voteBusy === topic.id}
                  onClick={() => void handleVote(topic.id)}
                >
                  <span className="cvf-vote-card__emoji" aria-hidden>{topic.emoji}</span>
                  <span className="cvf-vote-card__label">{topic.label}</span>
                  <span className="cvf-vote-card__count">{topic.votes || 0} votes</span>
                  <span className="cvf-vote-card__bar" aria-hidden>
                    <span className="cvf-vote-card__fill" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="cvf-vote-card__cta">
                    {topic.voted ? 'Voted ✓' : voteBusy === topic.id ? 'Voting…' : 'Cast vote'}
                  </span>
                </button>
              );
            })}
          </div>
          {!user ? (
            <p className="cvf-login-hint">
              <Link to="/login">Log in</Link> to vote and earn Savvy.
            </p>
          ) : null}
        </section>

        <section className="cvf-panel home-card" aria-labelledby="cvf-review-title">
          <div className="cvf-panel__head">
            <h3 id="cvf-review-title" className="cvf-panel__title">Beta Reviews</h3>
            <span className="cvf-reward-pill">
              <SavvyPointsIcon size={14} /> +{reviewReward} daily
            </span>
          </div>
          <p className="cvf-panel__hint">How was today&apos;s experience?</p>
          <form className="cvf-review-form" onSubmit={(e) => void handleReview(e)}>
            <StarRating value={rating} onChange={setRating} disabled={reviewedToday || reviewBusy} />
            <label className="cvf-field">
              <span>What did you enjoy?</span>
              <textarea
                rows={2}
                value={enjoyed}
                onChange={(e) => setEnjoyed(e.target.value)}
                disabled={reviewedToday || reviewBusy}
                placeholder="Best move picks, alerts, events…"
                maxLength={2000}
              />
            </label>
            <label className="cvf-field">
              <span>What should we improve?</span>
              <textarea
                rows={2}
                value={improve}
                onChange={(e) => setImprove(e.target.value)}
                disabled={reviewedToday || reviewBusy}
                placeholder="Friction, missing features, polish…"
                maxLength={2000}
              />
            </label>
            <label className="cvf-field">
              <span>Report a bug (optional)</span>
              <textarea
                rows={2}
                value={reportBug}
                onChange={(e) => setReportBug(e.target.value)}
                disabled={reviewedToday || reviewBusy}
                placeholder="Steps to reproduce…"
                maxLength={2000}
              />
            </label>
            {reviewedToday ? (
              <p className="cvf-reviewed-today">You already reviewed today — see you tomorrow, Operator.</p>
            ) : (
              <button type="submit" className="home-cta home-cta--primary cvf-submit" disabled={reviewBusy}>
                {reviewBusy ? 'Submitting…' : 'Submit Review & Earn Savvy'}
              </button>
            )}
          </form>
        </section>
      </div>

      <section className="cvf-stats home-card" aria-labelledby="cvf-stats-title">
        <h3 id="cvf-stats-title" className="cvf-panel__title">Community Results</h3>
        <div className="cvf-stats__grid">
          <StatCard
            label="Total Beta Testers"
            value={(data.stats?.totalBetaTesters ?? 0).toLocaleString()}
            pct={Math.min(100, (data.stats?.totalBetaTesters || 0) / 10)}
            tone="purple"
          />
          <StatCard
            label="Votes Cast"
            value={(data.stats?.votesCast ?? 0).toLocaleString()}
            pct={Math.min(100, ((data.stats?.votesCast || 0) / Math.max(1, data.stats?.totalBetaTesters || 1)) * 100)}
            tone="gold"
          />
          <StatCard
            label="Bugs Fixed"
            value={(data.stats?.bugsFixed ?? 0).toLocaleString()}
            pct={Math.min(100, (data.stats?.bugsFixed || 0) / 2)}
            tone="cyan"
          />
          <StatCard
            label="Suggestions Shipped"
            value={(data.stats?.suggestionsImplemented ?? 0).toLocaleString()}
            pct={Math.min(100, (data.stats?.suggestionsImplemented || 0) * 12)}
            tone="emerald"
          />
          <StatCard
            label="Average Rating"
            value={data.stats?.averageRating ? `${data.stats.averageRating} ★` : '—'}
            pct={(data.stats?.averageRating || 0) * 20}
            tone="rose"
          />
        </div>
      </section>

      <section className="cvf-built home-card" aria-labelledby="cvf-built-title">
        <h3 id="cvf-built-title" className="cvf-panel__title">Built With You</h3>
        <p className="cvf-panel__hint">Community requests that already shipped.</p>
        <ol className="cvf-timeline">
          {(data.shippedItems || []).map((item) => (
            <li key={item.id} className="cvf-timeline__item">
              <span className="cvf-timeline__check" aria-hidden>✅</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
