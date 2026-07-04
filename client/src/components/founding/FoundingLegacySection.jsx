import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyFoundingLegacy } from '../../lib/api';
import FoundingBetaCallingCard from './FoundingBetaCallingCard';
import '../../styles/FoundingLegacySection.css';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function FoundingLegacySection({ username }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    void getMyFoundingLegacy()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const legacy = data?.legacy;
  if (!legacy?.hasSlot) return null;

  return (
    <section className="flegacy home-card" aria-labelledby="flegacy-title">
      <div className="flegacy__head">
        <div>
          <p className="flegacy__kicker">Founding Legacy</p>
          <h2 id="flegacy-title" className="flegacy__title">🏛 Your Founder Status</h2>
        </div>
        <Link to="/founding-hall" className="flegacy__hall-link">
          View Founding Hall →
        </Link>
      </div>

      <div className="flegacy__grid">
        <FoundingBetaCallingCard
          founderNumber={legacy.founderNumber}
          username={legacy.username || username}
          joinedAt={legacy.joinedAt}
          programCompleted={legacy.programCompleted}
        />

        <div className="flegacy__stats">
          <div className="flegacy__stat">
            <span className="flegacy__stat-label">Founder Number</span>
            <strong>#{String(legacy.founderNumber).padStart(3, '0')}</strong>
          </div>
          <div className="flegacy__stat">
            <span className="flegacy__stat-label">Beta Join Date</span>
            <strong>{formatDate(legacy.joinedAt)}</strong>
          </div>
          <div className="flegacy__stat">
            <span className="flegacy__stat-label">Founding Tester Progress</span>
            <strong>
              {legacy.missionsCompleted} / {legacy.missionCount} Missions
            </strong>
          </div>
          <div className="flegacy__stat">
            <span className="flegacy__stat-label">Mission Completion</span>
            <strong>{legacy.programCompleted ? 'Legacy Complete' : 'In Progress'}</strong>
          </div>
          <div className="flegacy__stat">
            <span className="flegacy__stat-label">Legacy Rewards</span>
            <strong>{legacy.legacyRewardsGranted ? 'Unlocked' : 'Complete 7/7 to unlock'}</strong>
          </div>
          <div className="flegacy__perks">
            <p className="flegacy__perks-title">Exclusive Founder Perks</p>
            <ul>
              <li>🏆 Permanent Founder Calling Card</li>
              <li>🎖 Exclusive Founder Emblem</li>
              <li>💜 Exclusive Profile Border</li>
              <li>⭐ Legacy Badge</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flegacy__future">
        <h3>Future Founder Benefits</h3>
        <p className="flegacy__future-note">
          As the Savvy Universe grows, Founder Calling Cards may unlock opportunities such as:
        </p>
        <ul>
          <li>Early access to future beta apps</li>
          <li>Invitations to exclusive Savvy events</li>
          <li>Founder-only livestreams and community sessions</li>
          <li>Early access to limited-edition merchandise</li>
          <li>Priority testing opportunities for new features</li>
        </ul>
        <p className="flegacy__future-foot">These benefits will expand as the Savvy Universe grows.</p>
      </div>
    </section>
  );
}
