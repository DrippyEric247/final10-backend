import React from 'react';
import { motion } from 'framer-motion';
import '../../styles/FoundingBetaCallingCard.css';

function padFounder(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 1) return '—';
  return String(num).padStart(3, '0');
}

function formatJoinDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
}

/**
 * @param {{
 *   founderNumber?: number;
 *   username?: string;
 *   joinedAt?: string;
 *   programCompleted?: boolean;
 *   compact?: boolean;
 *   onClick?: () => void;
 * }} props
 */
export default function FoundingBetaCallingCard({
  founderNumber,
  username = 'Founder',
  joinedAt,
  programCompleted = false,
  compact = false,
  onClick,
}) {
  const numberLabel = padFounder(founderNumber);

  return (
    <motion.div
      className={`fbc-card${compact ? ' fbc-card--compact' : ''}${onClick ? ' fbc-card--clickable' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="fbc-card__glow" aria-hidden />
      <div className="fbc-card__particles" aria-hidden>
        <span /><span /><span /><span />
      </div>
      <span className="fbc-card__ribbon">Beta Founder</span>
      <div className="fbc-card__brand">🌌 Savvy Universe</div>
      <p className="fbc-card__founder">🏆 Founder #{numberLabel}</p>
      <p className="fbc-card__user">👤 {username}</p>
      <p className="fbc-card__joined">📅 Joined Beta {formatJoinDate(joinedAt)}</p>
      <p className="fbc-card__badge">⭐ Founding Tester Badge</p>
      {programCompleted ? (
        <p className="fbc-card__legacy">Legacy Complete</p>
      ) : (
        <p className="fbc-card__legacy fbc-card__legacy--pending">Founding Tester in progress</p>
      )}
    </motion.div>
  );
}
