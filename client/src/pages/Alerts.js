import React, { useEffect, useState } from 'react';
import { getAlerts, createAlert, toggleAlert, deleteAlert } from '../lib/api';

export default function Alerts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    keywords: '',
    maxPrice: '',
    minConfidence: 70,
    sources: ['ebay'],
  });

  const load = async () => {
    try {
      setLoading(true);
      const data = await getAlerts();
      setItems(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean),
        maxPrice: form.maxPrice ? Number(form.maxPrice) : undefined,
        minConfidence: Number(form.minConfidence) || 70,
        sources: form.sources, // keep defaults for now
      };
      await createAlert(payload);
      setForm({ name: '', keywords: '', maxPrice: '', minConfidence: 70, sources: ['ebay'] });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (id) => { await toggleAlert(id); await load(); };
  const onDelete = async (id) => { await deleteAlert(id); await load(); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0b0b] to-[#121212] text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-extrabold mb-6">Deal Alerts</h1>
        <p className="text-gray-400 mb-8">Get notified when items that match your rules pop up.</p>

        {/* Create form */}
        <form onSubmit={onSubmit} className="card bg-gray-900/60 border border-yellow-500/20 rounded-xl p-6 mb-10 grid grid-cols-1 md:grid-cols-4 gap-4">
          {error && <div className="md:col-span-4 text-red-400 text-sm">{error}</div>}

          <div className="md:col-span-2">
            <label className="block text-sm text-gray-300 mb-1">Alert name</label>
            <input className="input-primary w-full" name="name" value={form.name} onChange={onChange} placeholder="e.g. iPhone 14 under $500" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-300 mb-1">Keywords (comma separated)</label>
            <input className="input-primary w-full" name="keywords" value={form.keywords} onChange={onChange} placeholder="iphone, 14, unlocked" />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Max price (optional)</label>
            <input className="input-primary w-full" type="number" name="maxPrice" value={form.maxPrice} onChange={onChange} placeholder="500" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Min confidence</label>
            <input className="input-primary w-full" type="number" min="0" max="100" name="minConfidence" value={form.minConfidence} onChange={onChange} />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button disabled={saving} className="btn-ghost bg-gradient-to-r from-purple-600 to-yellow-500 rounded-lg px-6 py-3 font-semibold">
              {saving ? 'Saving…' : 'Create alert'}
            </button>
          </div>
        </form>

        {/* List */}
        <div className="grid md:grid-cols-2 gap-4">
          {loading ? (
            <div className="text-gray-400">Loading alerts…</div>
          ) : items.length === 0 ? (
            <div className="text-gray-400">No alerts yet — create your first one above.</div>
          ) : (
            items.map((a, index) => (
              <div key={`alert-${a._id || index}-${index}`} className="bg-gray-900/60 border border-gray-700 rounded-xl p-5 flex items-start justify-between">
                <div>
                  <div className="font-semibold text-lg">{a.name}</div>
                  <div className="text-gray-400 text-sm mt-1">
                    {a.keywords?.join(', ')} {a.maxPrice ? `• ≤ $${a.maxPrice}` : ''} • min {a.minConfidence}% • {a.sources?.join(', ')}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {a.isActive ? 'Active' : 'Paused'} • Updated {new Date(a.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onToggle(a._id)} className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm">
                    {a.isActive ? 'Pause' : 'Resume'}
                  </button>
                  <button onClick={() => onDelete(a._id)} className="px-3 py-2 rounded bg-red-600 hover:bg-red-500 text-sm">
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}




































