import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PartyPanel from '../components/party/PartyPanel';
import { useParty } from '../context/PartyContext';

/**
 * PartyPage — landing for Squad Sync.
 *
 * If a :partyId is in the URL (`/party/:id`) the user will attempt to join
 * that party (subject to eligibility checks on the server). Otherwise they
 * see their current party or the create-party screen.
 */
export default function PartyPage() {
  const { id } = useParams();
  const { party, joinParty, refresh, loading } = useParty();

  useEffect(() => {
    if (!id || loading) return;
    if (party && String(party.partyId) === String(id)) return;
    joinParty(id).catch(() => {
      refresh();
    });
  }, [id, loading, party, joinParty, refresh]);

  return <PartyPanel />;
}
