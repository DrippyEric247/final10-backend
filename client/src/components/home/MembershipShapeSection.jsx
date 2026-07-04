import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { submitBetaMembershipFeedback } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { SAVVY_SCOUT } from '../../config/savvyScoutBranding';
import {
  MEMBERSHIP_CLOSING_LINES,
  MEMBERSHIP_SCOUT_LINES,
  MEMBERSHIP_TABLE_ROWS,
  MEMBERSHIP_TIER_PHILOSOPHY,
} from '../../lib/membershipShapeContent';
import '../../styles/MembershipShapeSection.css';

const SCOUT_IMG = '/assets/perk-machine/savvy-scout-alive.png';

function scrollToMembershipVotes() {
  const el = document.getElementById('help-shape-final10');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      const vote = document.getElementById('cvf-vote-title');
      vote?.focus?.();
    }, 420);
  }
}

export default function MembershipShapeSection() {
  const { user } = useAuth();
  const [scoutIdx, setScoutIdx] = useState(0);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const id = window.setInterval(
      () => setScoutIdx((n) => (n + 1) % MEMBERSHIP_SCOUT_LINES.length),
      5400
    );
    return () => window.clearInterval(id);
  }, []);

  const handleSuggest = async (e) => {
    e.preventDefault();
    if (!user) {
      setStatus('Log in to submit membership feedback.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const res = await submitBetaMembershipFeedback({ type: 'suggestion', message: suggestion });
      setSuggestion('');
      setShowSuggest(false);
      setStatus(res?.message || 'Thanks — your suggestion was saved for the team.');
    } catch (err) {
      setStatus(err?.response?.data?.message || 'Could not save suggestion.');
    } finally {
      setBusy(false);
    }
  };

  const handleVoteClick = async () => {
    if (user) {
      try {
        await submitBetaMembershipFeedback({
          type: 'vote_intent',
          message: 'Opened membership feature voting from Help Shape Final10 Memberships.',
        });
      } catch {
        /* best-effort analytics */
      }
    }
    scrollToMembershipVotes();
  };

  return (
    <section className="mship-section" aria-labelledby="mship-title">
      <motion.div
        className="mship-beta-banner home-card"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.45 }}
      >
        <span className="mship-beta-banner__icon" aria-hidden>🌌</span>
        <div>
          <p className="mship-beta-banner__title">This is Beta.</p>
          <p className="mship-beta-banner__body">
            Every feature, every membership, and every reward is still being shaped with help from
            our Founding Testers. Your feedback today helps define the future of the Savvy Universe.
          </p>
        </div>
      </motion.div>

      <header className="mship-header">
        <div>
          <p className="mship-kicker">Founding Tester Preview</p>
          <h2 id="mship-title" className="mship-title">🚀 Help Shape Final10 Memberships</h2>
          <p className="mship-subtitle">
            You&apos;re helping build Final10. Test every feature, compare the planned memberships,
            and tell us what you&apos;d like to see before launch.
          </p>
        </div>
        <div className="mship-scout">
          <img src={SCOUT_IMG} alt="" className="mship-scout__img" />
          <p className="mship-scout__line">
            <strong>{SAVVY_SCOUT.shortTitle}:</strong> {MEMBERSHIP_SCOUT_LINES[scoutIdx]}
          </p>
        </div>
      </header>

      <motion.div
        className="mship-table-wrap home-card"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.5, delay: 0.05 }}
      >
        <div className="mship-table-scroll">
          <table className="mship-table">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col" className="mship-col-free">🟢 Free</th>
                <th scope="col" className="mship-col-premium">🟣 Premium</th>
                <th scope="col" className="mship-col-pro">🟡 Pro</th>
              </tr>
            </thead>
            <tbody>
              {MEMBERSHIP_TABLE_ROWS.map((row, idx) => (
                <motion.tr
                  key={row.feature}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: idx * 0.03 }}
                >
                  <th scope="row">{row.feature}</th>
                  <td className="mship-col-free">{row.free}</td>
                  <td className="mship-col-premium">{row.premium}</td>
                  <td className="mship-col-pro">{row.pro}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mship-table-note">Planned tiers — pricing and limits may change during beta.</p>
      </motion.div>

      <div className="mship-philosophy-grid">
        {MEMBERSHIP_TIER_PHILOSOPHY.map((tier, idx) => (
          <motion.article
            key={tier.id}
            className={`mship-tier-card home-card mship-tier-card--${tier.tone}`}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.42, delay: idx * 0.08 }}
          >
            <h3 className="mship-tier-card__title">
              <span aria-hidden>{tier.emoji}</span> {tier.title}
            </h3>
            <p className="mship-tier-card__body">{tier.body}</p>
          </motion.article>
        ))}
      </div>

      <motion.div
        className="mship-beta-notice home-card"
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <h3 className="mship-beta-notice__title">🧪 Beta Feedback Wanted</h3>
        <p className="mship-beta-notice__body">
          These memberships are still being refined. Vote on features, suggest improvements, and help
          us build the best value before launch.
        </p>
        <div className="mship-actions">
          <button type="button" className="home-cta home-cta--primary mship-btn" onClick={() => void handleVoteClick()}>
            🗳 Vote on Membership Features
          </button>
          <button
            type="button"
            className="home-cta home-cta--ghost mship-btn"
            onClick={() => setShowSuggest((v) => !v)}
          >
            💬 Suggest an Improvement
          </button>
        </div>
        {showSuggest ? (
          <form className="mship-suggest-form" onSubmit={(e) => void handleSuggest(e)}>
            <label htmlFor="mship-suggestion" className="mship-suggest-label">
              What would you change about Free, Premium, or Pro?
            </label>
            <textarea
              id="mship-suggestion"
              rows={4}
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Pricing, feature limits, what belongs in each tier…"
              maxLength={4000}
              disabled={busy}
            />
            <button type="submit" className="home-cta home-cta--primary mship-btn" disabled={busy}>
              {busy ? 'Saving…' : 'Submit Suggestion'}
            </button>
            {!user ? (
              <p className="mship-login-hint">
                <Link to="/login">Log in</Link> to save your suggestion for the team.
              </p>
            ) : null}
          </form>
        ) : null}
        {status ? <p className="mship-status" role="status">{status}</p> : null}
      </motion.div>

      <footer className="mship-footer">
        <ul className="mship-footer__lines">
          {MEMBERSHIP_CLOSING_LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mship-footer__cta">
          Help us build the smartest shopping membership before launch.
        </p>
      </footer>
    </section>
  );
}
