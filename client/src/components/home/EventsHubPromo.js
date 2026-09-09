import React from 'react';
import { Link } from 'react-router-dom';
import { useSavvyWatchLivePromo } from '../../hooks/useSavvyWatchLivePromo';
import SavvyWatchLiveHomePromo from './SavvyWatchLiveHomePromo';

export default function EventsHubPromo({ user }) {
  const { promo, loading } = useSavvyWatchLivePromo();

  if (loading) return null;

  if (promo?.live && promo?.primary) {
    return <SavvyWatchLiveHomePromo promo={promo} />;
  }

  if (!user) return null;

  return (
    <p className="events-hint" style={{ marginBottom: '1rem' }}>
      🎪 Live events, drops, and Scout Support —{' '}
      <Link to="/events" style={{ color: '#c4b5fd', fontWeight: 600 }}>
        open Events Hub
      </Link>
    </p>
  );
}
