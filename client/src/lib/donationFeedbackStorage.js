/**
 * Local feedback storage until a donation-comment API exists.
 * TODO: POST to backend when donation feedback endpoint is available.
 */

const STORAGE_KEY = 'f10_donation_feedback_messages';
const MAX_MESSAGES = 50;

export function saveDonationFeedback(message) {
  const trimmed = String(message || '').trim();
  if (!trimmed) return { ok: false, error: 'Message is empty.' };

  try {
    const existing = loadDonationFeedback();
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message: trimmed.slice(0, 2000),
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...existing].slice(0, MAX_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return { ok: true, entry };
  } catch {
    return { ok: false, error: 'Could not save message locally.' };
  }
}

export function loadDonationFeedback() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
