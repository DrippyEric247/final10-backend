import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getFoundingHall, getFoundingHallMember } from '../lib/api';
import FoundingBetaCallingCard from '../components/founding/FoundingBetaCallingCard';
import FoundersRemainingBanner from '../components/founding/FoundersRemainingBanner';
import '../styles/FoundingHall.css';

function formatJoined(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function FoundingHall() {
  const [hall, setHall] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFoundingHall();
      setHall(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openMember = async (slot) => {
    if (!slot?.claimed) return;
    try {
      const data = await getFoundingHallMember(slot.slot);
      setSelected(data?.member || null);
    } catch {
      setSelected(null);
    }
  };

  if (loading) {
    return (
      <div className="fh-page">
        <p className="text-slate-400">Loading Founding Hall…</p>
      </div>
    );
  }

  return (
    <div className="fh-page">
      <header className="fh-hero home-card">
        <p className="fh-kicker">Savvy Universe Legacy</p>
        <h1 className="fh-title">🏛 Founding Hall</h1>
        <p className="fh-subtitle">
          The first 100 Founders who helped build Final10 before launch. Legacy, not power — permanent recognition
          across the Savvy Universe.
        </p>
        <FoundersRemainingBanner className="mt-4" />
      </header>

      <section className="fh-grid">
        {(hall?.members || []).map((member, idx) => (
          <motion.button
            key={member.slot}
            type="button"
            className={`fh-slot${member.claimed ? ' fh-slot--claimed' : ' fh-slot--open'}${member.programCompleted ? ' fh-slot--complete' : ''}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.015 }}
            onClick={() => void openMember(member)}
            disabled={!member.claimed}
          >
            <span className="fh-slot__num">#{String(member.slot).padStart(3, '0')}</span>
            {member.claimed ? (
              <>
                <span className="fh-slot__name">{member.username}</span>
                <span className="fh-slot__meta">
                  {member.programCompleted ? '⭐ Legacy Complete' : `${member.missionsCompleted}/${member.missionCount} Missions`}
                </span>
                <span className="fh-slot__joined">Joined {formatJoined(member.joinedAt)}</span>
              </>
            ) : (
              <span className="fh-slot__open">Awaiting Founder</span>
            )}
          </motion.button>
        ))}
      </section>

      <section className="fh-future home-card">
        <h2>Future Founder Benefits</h2>
        <p>As the Savvy Universe grows, Founder Calling Cards may unlock opportunities such as:</p>
        <ul>
          <li>Early access to future beta apps</li>
          <li>Invitations to exclusive Savvy events</li>
          <li>Founder-only livestreams and community sessions</li>
          <li>Early access to limited-edition merchandise</li>
          <li>Priority testing opportunities for new features</li>
        </ul>
        <p className="fh-future__note">These benefits will expand as the Savvy Universe grows.</p>
      </section>

      {selected ? (
        <div className="fh-modal" role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <motion.div
            className="fh-modal__card"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <FoundingBetaCallingCard
              founderNumber={selected.slot}
              username={selected.username}
              joinedAt={selected.joinedAt}
              programCompleted={selected.programCompleted}
            />
            <div className="fh-modal__meta">
              <p>
                <strong>Missions:</strong> {selected.missionsCompleted} / {selected.missionCount}
              </p>
              <p>
                <strong>Status:</strong> {selected.programCompleted ? 'Legacy Complete' : 'In Progress'}
              </p>
              {selected.badges?.length ? (
                <p>
                  <strong>Badges:</strong> {selected.badges.join(', ')}
                </p>
              ) : null}
            </div>
            <button type="button" className="fh-modal__close" onClick={() => setSelected(null)}>
              Close
            </button>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
