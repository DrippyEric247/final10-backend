import React, { useCallback, useState } from 'react';
import {
  adminAddBetaCommunityTopic,
  adminUpdateBetaCommunityConfig,
  getAdminMembershipFeedback,
  getBetaCommunitySnapshot,
} from '../../lib/api';

export default function BetaCommunityAdminPanel() {
  const [snapshot, setSnapshot] = useState(null);
  const [membershipFeedback, setMembershipFeedback] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [newTopicLabel, setNewTopicLabel] = useState('');
  const [newTopicEmoji, setNewTopicEmoji] = useState('✨');
  const [newShippedLabel, setNewShippedLabel] = useState('');
  const [voteSavvy, setVoteSavvy] = useState(15);
  const [reviewSavvy, setReviewSavvy] = useState(25);
  const [bugsFixed, setBugsFixed] = useState(47);

  const load = useCallback(async () => {
    try {
      const [data, feedback] = await Promise.all([
        getBetaCommunitySnapshot(),
        getAdminMembershipFeedback(40),
      ]);
      setSnapshot(data);
      setMembershipFeedback(feedback?.items || []);
      setVoteSavvy(data?.rewards?.voteSavvy ?? 15);
      setReviewSavvy(data?.rewards?.reviewSavvy ?? 25);
      setBugsFixed(data?.stats?.bugsFixed ?? 47);
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Failed to load beta community config.');
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const saveRewards = async () => {
    setBusy(true);
    setMsg('');
    try {
      const data = await adminUpdateBetaCommunityConfig({
        rewards: { voteSavvy: Number(voteSavvy), reviewSavvy: Number(reviewSavvy) },
        stats: { bugsFixed: Number(bugsFixed) },
      });
      setSnapshot(data);
      setMsg('Rewards and stats updated.');
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const addTopic = async () => {
    if (!newTopicLabel.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      const data = await adminAddBetaCommunityTopic({
        label: newTopicLabel.trim(),
        emoji: newTopicEmoji || '✨',
      });
      setSnapshot(data);
      setNewTopicLabel('');
      setMsg('Topic added.');
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Could not add topic.');
    } finally {
      setBusy(false);
    }
  };

  const addShipped = async () => {
    if (!newShippedLabel.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      const prev = snapshot?.shippedItems || [];
      const data = await adminUpdateBetaCommunityConfig({
        shippedItems: [
          { id: `shipped_${Date.now()}`, label: newShippedLabel.trim(), shippedAt: new Date().toISOString() },
          ...prev,
        ],
      });
      setSnapshot(data);
      setNewShippedLabel('');
      setMsg('Shipped item added to "You Asked. We Built."');
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Could not add shipped item.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card border border-violet-400/35 bg-violet-500/5 space-y-4">
      <div>
        <p className="text-xs font-black tracking-[0.16em] uppercase text-violet-200">
          Beta Community
        </p>
        <h2 className="text-lg font-bold text-white mt-1">Vote &amp; Feedback Admin</h2>
        <p className="text-sm text-gray-300 mt-1">
          Manage feature vote topics, shipped items, and Savvy reward amounts for the Home beta section.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-sm text-gray-300">
          Vote Savvy
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-gray-600 bg-black/40 px-3 py-2 text-white"
            value={voteSavvy}
            onChange={(e) => setVoteSavvy(e.target.value)}
          />
        </label>
        <label className="text-sm text-gray-300">
          Review Savvy
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-gray-600 bg-black/40 px-3 py-2 text-white"
            value={reviewSavvy}
            onChange={(e) => setReviewSavvy(e.target.value)}
          />
        </label>
        <label className="text-sm text-gray-300">
          Bugs Fixed (display)
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-gray-600 bg-black/40 px-3 py-2 text-white"
            value={bugsFixed}
            onChange={(e) => setBugsFixed(e.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        disabled={busy}
        onClick={() => void saveRewards()}
      >
        Save rewards &amp; stats
      </button>

      <div className="border-t border-white/10 pt-4 space-y-2">
        <p className="text-sm font-bold text-white">Add vote topic</p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Feature label"
            className="flex-1 min-w-[180px] rounded-lg border border-gray-600 bg-black/40 px-3 py-2 text-white text-sm"
            value={newTopicLabel}
            onChange={(e) => setNewTopicLabel(e.target.value)}
          />
          <input
            type="text"
            placeholder="Emoji"
            className="w-16 rounded-lg border border-gray-600 bg-black/40 px-3 py-2 text-white text-sm"
            value={newTopicEmoji}
            onChange={(e) => setNewTopicEmoji(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-fuchsia-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
            disabled={busy}
            onClick={() => void addTopic()}
          >
            Add topic
          </button>
        </div>
      </div>

      <div className="border-t border-white/10 pt-4 space-y-2">
        <p className="text-sm font-bold text-white">Add shipped item (&quot;You Asked. We Built.&quot;)</p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="e.g. Faster alerts"
            className="flex-1 min-w-[200px] rounded-lg border border-gray-600 bg-black/40 px-3 py-2 text-white text-sm"
            value={newShippedLabel}
            onChange={(e) => setNewShippedLabel(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
            disabled={busy}
            onClick={() => void addShipped()}
          >
            Add shipped
          </button>
        </div>
      </div>

      {snapshot?.topics?.length ? (
        <p className="text-xs text-gray-400">
          Active topics: {snapshot.topics.length} · Votes cast: {snapshot.stats?.votesCast ?? 0}
        </p>
      ) : null}

      <div className="border-t border-white/10 pt-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-white">Membership feedback (recent)</p>
          <button
            type="button"
            className="text-xs font-bold text-violet-300 hover:text-violet-100"
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
        {membershipFeedback.length ? (
          <ul className="max-h-64 overflow-y-auto space-y-2 text-sm">
            {membershipFeedback.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-gray-200"
              >
                <p className="text-xs text-gray-400">
                  {item.type === 'vote_intent' ? '🗳 Vote intent' : '💬 Suggestion'} ·{' '}
                  {item.username || 'Tester'} ·{' '}
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">No membership suggestions yet.</p>
        )}
      </div>

      {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}
    </section>
  );
}
