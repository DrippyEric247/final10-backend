import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/HomeLanding.css';

const SCOUT_IMG = '/assets/perk-machine/savvy-scout-alive.png';

const DEFAULT_REWARDS = [
  { id: 'badge', icon: '🏅', label: 'Badge Unlocked', sub: 'Beta Supporter Badge' },
  { id: 'border', icon: '🖼️', label: 'Founder Border Added', sub: 'Profile cosmetic' },
  { id: 'card', icon: '🎴', label: 'Calling Card Unlocked', sub: 'Founder Calling Card' },
  { id: 'feedback', icon: '💬', label: 'Feedback delivered', sub: 'Your message reached the team' },
];

/**
 * Post-donation success experience — preview/dev only until payment webhooks exist.
 * @param {{ asPage?: boolean, onClose?: () => void, rewards?: Array<{ id: string, icon: string, label: string, sub?: string }> }} props
 */
export default function DonationSuccessModal({ asPage = false, onClose, rewards = DEFAULT_REWARDS }) {
  const [visibleCards, setVisibleCards] = useState(0);

  useEffect(() => {
    setVisibleCards(0);
    const timers = rewards.map((_, i) =>
      window.setTimeout(() => setVisibleCards(i + 1), 400 + i * 280)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [rewards]);

  const content = (
    <div className={`home-donation-success${asPage ? ' home-donation-success--page' : ''}`}>
      <div className="home-donation-success__sparkles" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="home-donation-success__sparkle" style={{ '--i': i }} />
        ))}
      </div>

      <div className="home-donation-success__card">
        <img src={SCOUT_IMG} alt="" className="home-donation-success__scout" />
        <h2 className="home-donation-success__title">🛩️ Mission Complete!</h2>
        <p className="home-donation-success__message">Thank you for supporting Final10 Beta.</p>
        <p className="home-donation-success__sub">
          Because of supporters like you, we are building the future of smarter shopping.
        </p>

        <div className="home-donation-success__rewards">
          {rewards.map((r, idx) => (
            <div
              key={r.id}
              className={`home-donation-success__reward${idx < visibleCards ? ' is-visible' : ''}`}
            >
              <span className="home-donation-success__reward-icon" aria-hidden>{r.icon}</span>
              <div>
                <strong>{r.label}</strong>
                {r.sub ? <span>{r.sub}</span> : null}
              </div>
            </div>
          ))}
        </div>

        <blockquote className="home-donation-success__scout-line">
          &ldquo;Message received. See you on the next deal!&rdquo;
          <cite>— Savvy Scout</cite>
        </blockquote>

        <div className="home-donation-success__actions">
          <Link to="/" className="home-donation-success__cta">
            Continue to Dashboard
          </Link>
          {!asPage && onClose ? (
            <button type="button" className="home-donation-success__close" onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (asPage) return content;

  return (
    <div className="home-donation-success-overlay" role="dialog" aria-modal="true" aria-label="Donation success">
      {content}
    </div>
  );
}
