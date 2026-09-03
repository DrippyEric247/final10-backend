/**
 * Savvy Watch — live stream participation rewards (V1).
 * Rewards verified event participation, NOT guaranteed YouTube watch time.
 */
const crypto = require('crypto');

const SAVVY_WATCH_REWARD_SOURCES = Object.freeze([
  'savvy_watch',
  'savvy_watch_join',
  'savvy_watch_checkpoint',
  'savvy_watch_live_code',
  'savvy_watch_competition',
  'savvy_watch_host_award',
]);

const EVENT_STATUSES = Object.freeze([
  'draft',
  'scheduled',
  'live',
  'ended',
  'archived',
  'cancelled',
]);

const SESSION_STATUSES = Object.freeze(['active', 'inactive', 'completed', 'flagged']);

const COMPETITION_TYPES = Object.freeze(['vehicle', 'crew', 'photo', 'drift', 'custom']);

const VOTING_MODES = Object.freeze(['community', 'host', 'hybrid']);

const COMPETITION_STATUSES = Object.freeze([
  'draft',
  'entries_open',
  'entries_closed',
  'voting_open',
  'voting_closed',
  'results_locked',
  'cancelled',
]);

const DEFAULT_CHECKPOINTS = Object.freeze([
  { id: 'join', label: 'Join Event', requiredSeconds: 0, savvyReward: 5, kind: 'join' },
  { id: '15min', label: '15 Min Verified Participation', requiredSeconds: 900, savvyReward: 10, kind: 'presence' },
  { id: '30min', label: '30 Min Verified Participation', requiredSeconds: 1800, savvyReward: 15, kind: 'presence' },
  { id: '60min', label: '60 Min Verified Participation', requiredSeconds: 3600, savvyReward: 25, kind: 'presence' },
  { id: '90min', label: '90 Min Verified Participation', requiredSeconds: 5400, savvyReward: 25, kind: 'presence' },
  { id: 'complete', label: 'Event Completion', requiredSeconds: 0, savvyReward: 20, kind: 'completion' },
]);

const DEFAULT_MAX_SAVVY_PER_VIEWER = 100;

const HEARTBEAT_INTERVAL_SEC = 45;
const HEARTBEAT_GRACE_SEC = 120;
const BACKGROUND_PAUSE_AFTER_SEC = 90;

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

function isSavvyWatchEnabled() {
  return envFlag('SAVVY_WATCH_ENABLED', false);
}

function isSavvyWatchAdminOnly() {
  return envFlag('SAVVY_WATCH_ADMIN_ONLY', true);
}

function generateEventId() {
  return `sw_${crypto.randomBytes(8).toString('hex')}`;
}

function generateLiveCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return out;
}

function normalizeAttributionSource(src) {
  const allowed = new Set([
    'stream-qr',
    'youtube-description',
    'pinned-comment',
    'discord',
    'tiktok',
    'instagram',
    'direct',
    'unknown',
  ]);
  const key = String(src || 'unknown').trim().toLowerCase().slice(0, 64);
  return allowed.has(key) ? key : 'unknown';
}

module.exports = {
  SAVVY_WATCH_REWARD_SOURCES,
  EVENT_STATUSES,
  SESSION_STATUSES,
  COMPETITION_TYPES,
  VOTING_MODES,
  COMPETITION_STATUSES,
  DEFAULT_CHECKPOINTS,
  DEFAULT_MAX_SAVVY_PER_VIEWER,
  HEARTBEAT_INTERVAL_SEC,
  HEARTBEAT_GRACE_SEC,
  BACKGROUND_PAUSE_AFTER_SEC,
  isSavvyWatchEnabled,
  isSavvyWatchAdminOnly,
  generateEventId,
  generateLiveCode,
  normalizeAttributionSource,
};
