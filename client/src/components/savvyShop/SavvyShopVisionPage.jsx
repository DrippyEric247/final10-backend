import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { submitBetaSavvyShopFeedback } from '../../lib/api';
import { SAVVY_SCOUT } from '../../config/savvyScoutBranding';
import { FINAL10_OFFICIAL_SLOGAN } from '../../config/final10Branding';
import {
  SAVVY_SHOP_CLOSING_LINES,
  SAVVY_SHOP_FUTURE_PARTNERS,
  SAVVY_SHOP_SCOUT_LINES,
  SAVVY_SHOP_VISION_CARDS,
  SAVVY_SHOP_VISION_HERO,
  SAVVY_SHOP_WHERE_TO_SHOP,
} from '../../lib/savvyShopVisionContent';
import '../../styles/SavvyShopVision.css';

const SCOUT_IMG = '/assets/perk-machine/savvy-scout-alive.png';

function scrollToId(id) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * @param {{ onOpenStudio?: () => void; studioOpen?: boolean }} props
 */
export default function SavvyShopVisionPage({ onOpenStudio, studioOpen = false }) {
  const { user } = useAuth();
  const [scoutIdx, setScoutIdx] = useState(0);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const id = window.setInterval(
      () => setScoutIdx((n) => (n + 1) % SAVVY_SHOP_SCOUT_LINES.length),
      5200
    );
    return () => window.clearInterval(id);
  }, []);

  const handleSuggest = async (e) => {
    e.preventDefault();
    if (!user) {
      setStatus('Log in to submit Savvy Shop feedback.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const res = await submitBetaSavvyShopFeedback({ type: 'suggestion', message: suggestion });
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
        await submitBetaSavvyShopFeedback({
          type: 'vote_intent',
          message: 'Opened Savvy Shop feature voting from My Savvy Shop vision page.',
        });
      } catch {
        /* best-effort */
      }
    }
    window.location.href = '/#help-shape-final10';
  };

  const handleShopCta = (card) => {
    if (card.scrollTo) {
      scrollToId(card.scrollTo);
      return;
    }
  };

  return (
    <div className="ssv-page">
      <motion.header
        className="ssv-hero home-card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="ssv-hero__copy">
          <p className="ssv-kicker">Savvy Universe · Beta Vision</p>
          <h1 className="ssv-hero__title">{SAVVY_SHOP_VISION_HERO.title}</h1>
          <p className="ssv-hero__subtitle">{SAVVY_SHOP_VISION_HERO.subtitle}</p>
          <p className="ssv-hero__body">{SAVVY_SHOP_VISION_HERO.body}</p>
        </div>
        <div className="ssv-scout">
          <img src={SCOUT_IMG} alt="" className="ssv-scout__img" />
          <p className="ssv-scout__line">
            <strong>{SAVVY_SCOUT.shortTitle}:</strong> {SAVVY_SHOP_SCOUT_LINES[scoutIdx]}
          </p>
        </div>
      </motion.header>

      <div className="ssv-vision-grid">
        {SAVVY_SHOP_VISION_CARDS.map((card, idx) => (
          <motion.article
            key={card.id}
            className={`ssv-vision-card home-card ssv-vision-card--${card.tone}`}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.42, delay: idx * 0.06 }}
          >
            <h2 className="ssv-vision-card__title">
              <span aria-hidden>{card.emoji}</span> {card.title}
            </h2>
            {card.body ? <p className="ssv-vision-card__body">{card.body}</p> : null}
            {card.intro ? <p className="ssv-vision-card__intro">{card.intro}</p> : null}
            {card.bullets ? (
              <ul className="ssv-vision-card__list">
                {card.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
            {card.outro ? <p className="ssv-vision-card__outro">{card.outro}</p> : null}
          </motion.article>
        ))}
      </div>

      <section className="ssv-where" aria-labelledby="ssv-where-title">
        <h2 id="ssv-where-title" className="ssv-section-title">
          Where Should I Shop?
        </h2>
        <div className="ssv-where-grid">
          {SAVVY_SHOP_WHERE_TO_SHOP.map((card, idx) => (
            <motion.article
              key={card.id}
              className={`ssv-where-card home-card ssv-where-card--${card.tone}`}
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.4, delay: idx * 0.07 }}
            >
              <h3 className="ssv-where-card__title">
                <span aria-hidden>{card.emoji}</span> {card.title}
              </h3>
              <p className="ssv-where-card__label">{card.bestForLabel}</p>
              {card.intro ? <p className="ssv-where-card__intro">{card.intro}</p> : null}
              {card.compareLabel ? <p className="ssv-where-card__label">{card.compareLabel}</p> : null}
              <ul className="ssv-where-card__list">
                {card.bullets.map((b) => (
                  <li key={b}>✔ {b}</li>
                ))}
              </ul>
              {card.outro ? <p className="ssv-where-card__outro">{card.outro}</p> : null}
              {card.to ? (
                <Link to={card.to} className="home-cta home-cta--primary ssv-where-card__cta">
                  {card.cta}
                </Link>
              ) : (
                <button
                  type="button"
                  className="home-cta home-cta--primary ssv-where-card__cta"
                  onClick={() => handleShopCta(card)}
                >
                  {card.cta}
                </button>
              )}
            </motion.article>
          ))}
        </div>
      </section>

      <section className="ssv-partners" id="savvy-shop-partners" aria-labelledby="ssv-partners-title">
        <h2 id="ssv-partners-title" className="ssv-section-title">
          Future Partners
        </h2>
        <div className="ssv-partners-grid">
          {SAVVY_SHOP_FUTURE_PARTNERS.map((p, idx) => (
            <motion.div
              key={p.label}
              className="ssv-partner-card home-card"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: idx * 0.04 }}
            >
              <span className="ssv-partner-card__emoji" aria-hidden>
                {p.emoji}
              </span>
              <p className="ssv-partner-card__label">{p.label}</p>
              <p className="ssv-partner-card__soon">Coming to the Savvy Universe</p>
            </motion.div>
          ))}
        </div>
        {onOpenStudio ? (
          <p className="ssv-studio-hint">
            Creators can preview the beta studio now.{' '}
            <button type="button" className="ssv-studio-link" onClick={onOpenStudio}>
              {studioOpen ? 'Hide Creator Studio' : 'Open Creator Studio'}
            </button>
          </p>
        ) : null}
      </section>

      <motion.div
        className="ssv-beta-notice home-card"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <h3 className="ssv-beta-notice__title">🧪 Founding Tester Notice</h3>
        <p className="ssv-beta-notice__body">
          You&apos;re helping shape My Savvy Shop before launch. Vote on features. Suggest improvements.
          Tell us what kinds of stores you&apos;d like to see join first.
        </p>
        <div className="ssv-actions">
          <button type="button" className="home-cta home-cta--primary ssv-btn" onClick={() => void handleVoteClick()}>
            🗳 Vote
          </button>
          <button
            type="button"
            className="home-cta home-cta--ghost ssv-btn"
            onClick={() => setShowSuggest((v) => !v)}
          >
            💬 Suggest a Feature
          </button>
        </div>
        {showSuggest ? (
          <form className="ssv-suggest-form" onSubmit={(e) => void handleSuggest(e)}>
            <label htmlFor="ssv-suggestion" className="ssv-suggest-label">
              What stores or features should My Savvy Shop launch with?
            </label>
            <textarea
              id="ssv-suggestion"
              rows={4}
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Store types, rewards, AI shopping features…"
              maxLength={4000}
              disabled={busy}
            />
            <button type="submit" className="home-cta home-cta--primary ssv-btn" disabled={busy}>
              {busy ? 'Saving…' : 'Submit Suggestion'}
            </button>
            {!user ? (
              <p className="ssv-login-hint">
                <Link to="/login">Log in</Link> to save your suggestion for the team.
              </p>
            ) : null}
          </form>
        ) : null}
        {status ? (
          <p className="ssv-status" role="status">
            {status}
          </p>
        ) : null}
      </motion.div>

      <footer className="ssv-footer">
        <div className="ssv-footer__lines">
          {SAVVY_SHOP_CLOSING_LINES.map((line) => (
            <p key={line} className="ssv-footer__line">
              {line}
            </p>
          ))}
        </div>
        <p className="ssv-footer__slogan">{FINAL10_OFFICIAL_SLOGAN}</p>
      </footer>
    </div>
  );
}
