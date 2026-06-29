import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Final10Slogan from '../branding/Final10Slogan';
import { getDonationLinks, hasAnyDonationLink } from '../../config/donationConfig';
import {
  HOME_HERO,
  HOME_MISSION,
  HOME_VISION,
  MARKETPLACE_ROADMAP,
  MEET_SAVVY_SCOUT,
  WHY_FINAL10,
  HOME_CLOSING_LINE,
  DONATION_COPY,
  DONATION_IMPACT,
  DONATION_BUTTONS,
  SUPPORTER_REWARDS,
  FEEDBACK_COPY,
} from '../../config/homeLandingContent';
import { saveDonationFeedback } from '../../lib/donationFeedbackStorage';
import DonationSuccessModal from './DonationSuccessModal';
import '../../styles/HomeLanding.css';

const SCOUT_IMG = '/assets/perk-machine/savvy-scout-alive.png';

/**
 * @param {{ user?: { firstName?: string } | null }} props
 */
export default function HomeLandingSections({ user }) {
  const links = useMemo(() => getDonationLinks(), []);
  const donationsEnabled = hasAnyDonationLink(links);
  const showSuccessPreview = process.env.NODE_ENV !== 'production';

  const [feedback, setFeedback] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    const result = saveDonationFeedback(feedback);
    if (result.ok) {
      setFeedback('');
      setFeedbackStatus('Thanks! Your message was saved and helps shape Final10.');
    } else {
      setFeedbackStatus(result.error || 'Could not save message.');
    }
  };

  const renderDonationButton = (btn) => {
    const href = links[btn.linkKey];
    if (href) {
      return (
        <a
          key={btn.id}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="home-donation-btn"
        >
          <span className="home-donation-btn__emoji" aria-hidden>{btn.emoji}</span>
          <span className="home-donation-btn__label">{btn.label}</span>
          {btn.amount ? <span className="home-donation-btn__amount">{btn.amount}</span> : null}
        </a>
      );
    }
    return (
      <button key={btn.id} type="button" className="home-donation-btn home-donation-btn--soon" disabled>
        <span className="home-donation-btn__emoji" aria-hidden>{btn.emoji}</span>
        <span className="home-donation-btn__label">{btn.label}</span>
        <span className="home-donation-btn__amount">Coming Soon</span>
      </button>
    );
  };

  return (
    <div className="home-landing">
      {/* Hero */}
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero__kicker">FINAL10 · BETA</div>
        {user?.firstName ? (
          <p className="home-hero__welcome-back">Welcome back, {user.firstName}.</p>
        ) : null}
        <h1 id="home-hero-title" className="home-hero__title">{HOME_HERO.title}</h1>
        <p className="home-hero__subtitle">{HOME_HERO.subtitle}</p>
        <Final10Slogan variant="hero" className="home-hero__slogan" />
        <div className="home-hero__badges">
          <span className="home-badge home-badge--live">eBay · Live Beta</span>
          <span className="home-badge">Beta is free</span>
        </div>
        <div className="home-hero__actions">
          {!user ? (
            <>
              <Link to="/register" className="home-cta home-cta--primary">Get Started Free</Link>
              <Link to="/login" className="home-cta home-cta--ghost">Log In</Link>
            </>
          ) : (
            <>
              <Link to="/auctions" className="home-cta home-cta--primary">Hunt Deals</Link>
              <Link to="/events" className="home-cta home-cta--ghost">Events Hub</Link>
            </>
          )}
        </div>
      </section>

      {/* Mission + Vision */}
      <div className="home-mission-grid">
        <section className="home-card" aria-labelledby="home-mission-title">
          <h2 id="home-mission-title" className="home-card__title">{HOME_MISSION.title}</h2>
          <p className="home-card__body">{HOME_MISSION.body}</p>
        </section>
        <section className="home-card" aria-labelledby="home-vision-title">
          <h2 id="home-vision-title" className="home-card__title">{HOME_VISION.title}</h2>
          <p className="home-card__body">{HOME_VISION.body}</p>
        </section>
      </div>

      {/* Marketplace roadmap */}
      <section className="home-card home-roadmap" aria-labelledby="home-roadmap-title">
        <h2 id="home-roadmap-title" className="home-card__title">Marketplace Roadmap</h2>
        <ul className="home-roadmap__list">
          {MARKETPLACE_ROADMAP.map((item) => (
            <li
              key={item.name}
              className={`home-roadmap__item${item.status === 'live' ? ' is-live' : ''}`}
            >
              <span className="home-roadmap__name">{item.name}</span>
              <span className="home-roadmap__status">{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Meet Savvy Scout */}
      <section className="home-card home-scout" aria-labelledby="home-scout-title">
        <div className="home-scout__content">
          <h2 id="home-scout-title" className="home-card__title">{MEET_SAVVY_SCOUT.title}</h2>
          <p className="home-card__body">{MEET_SAVVY_SCOUT.body}</p>
        </div>
        <img src={SCOUT_IMG} alt="" className="home-scout__img" />
      </section>

      {/* Why Final10 */}
      <section className="home-card" aria-labelledby="home-why-title">
        <h2 id="home-why-title" className="home-card__title">Why Final10?</h2>
        <ul className="home-why__grid">
          {WHY_FINAL10.map((item) => (
            <li key={item} className="home-why__item">{item}</li>
          ))}
        </ul>
      </section>

      {/* Donation */}
      <section className="home-card home-donation" aria-labelledby="home-donation-title">
        <h2 id="home-donation-title" className="home-card__title home-card__title--heart">
          ❤️ {DONATION_COPY.title}
        </h2>
        <p className="home-donation__subtitle">{DONATION_COPY.subtitle}</p>
        <p className="home-card__body">{DONATION_COPY.body}</p>
        <p className="home-card__body home-card__body--dim">{DONATION_COPY.bodyExtra}</p>

        <ul className="home-donation__impact">
          {DONATION_IMPACT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="home-donation__buttons">
          {DONATION_BUTTONS.map(renderDonationButton)}
        </div>

        {!donationsEnabled ? (
          <p className="home-donation__config-note">
            Donation links are being configured. Beta remains completely free.
          </p>
        ) : null}

        <p className="home-donation__free-note">{DONATION_COPY.freeNote}</p>

        {/* Supporter rewards */}
        <div className="home-rewards">
          <h3 className="home-rewards__title">💜 {SUPPORTER_REWARDS.title}</h3>
          <p className="home-rewards__intro">{SUPPORTER_REWARDS.intro}</p>
          <div className="home-rewards__tiers">
            {SUPPORTER_REWARDS.tiers.map((tier) => (
              <div key={tier.id} className="home-rewards__tier">
                <div className="home-rewards__tier-head">
                  <strong>{tier.min}</strong>
                  <span>{tier.name}</span>
                </div>
                <ul>
                  {tier.perks.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="home-rewards__disclaimer">{SUPPORTER_REWARDS.disclaimer}</p>
        </div>

        {/* Feedback */}
        <form className="home-feedback" onSubmit={handleFeedbackSubmit}>
          <label htmlFor="home-donation-feedback" className="home-feedback__label">
            💬 {FEEDBACK_COPY.label}
          </label>
          <textarea
            id="home-donation-feedback"
            className="home-feedback__input"
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={FEEDBACK_COPY.placeholder}
            maxLength={2000}
          />
          <p className="home-feedback__helper">{FEEDBACK_COPY.helper}</p>
          {feedbackStatus ? (
            <p className="home-feedback__status" role="status">{feedbackStatus}</p>
          ) : null}
          <button type="submit" className="home-cta home-cta--ghost home-feedback__submit">
            Send Message
          </button>
        </form>

        {showSuccessPreview ? (
          <div className="home-donation__preview">
            <button
              type="button"
              className="home-cta home-cta--ghost"
              onClick={() => setShowSuccessModal(true)}
            >
              Preview Donation Success (Dev)
            </button>
            <Link to="/donation/success?preview=1" className="home-donation__preview-link">
              Open success page
            </Link>
          </div>
        ) : null}
      </section>

      <p className="home-closing">{HOME_CLOSING_LINE}</p>

      {showSuccessModal ? (
        <DonationSuccessModal onClose={() => setShowSuccessModal(false)} />
      ) : null}
    </div>
  );
}
