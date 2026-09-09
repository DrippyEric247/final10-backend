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
  'savvy_watch_live_welcome_bonus',
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

const LIVE_WELCOME_BONUS_AMOUNT = 500;
const LIVE_WELCOME_BONUS_SOURCE = 'stream-qr';
const HOMEPAGE_LIVE_ATTRIBUTION_SOURCE = 'homepage-live';
const PRODUCTION_WATCH_BASE_URL = 'https://final10.app';

/** Public-facing lifecycle phases mapped from persisted event.status */
const PUBLIC_LIFECYCLE_PHASES = Object.freeze({
  STARTING_SOON: 'starting_soon',
  LIVE: 'live',
  ENDED: 'ended',
});

/** Statuses visible on the public /watch/:slug page */
const PUBLICLY_VISIBLE_EVENT_STATUSES = Object.freeze(['scheduled', 'live', 'ended', 'archived']);

const EVENT_STATUS_TRANSITIONS = Object.freeze({
  draft: ['scheduled', 'cancelled'],
  scheduled: ['live', 'cancelled'],
  live: ['ended'],
  ended: ['archived'],
  archived: [],
  cancelled: [],
});

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
    'homepage-live',
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

function isStreamQrAttribution(src) {
  return normalizeAttributionSource(src) === LIVE_WELCOME_BONUS_SOURCE;
}

function sanitizeEventSlug(slug) {
  const s = String(slug || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(s)) {
    throw new Error('Invalid event slug');
  }
  return s;
}

function getSavvyWatchPublicBaseUrl() {
  const raw =
    process.env.SAVVY_WATCH_PUBLIC_URL ||
    process.env.CLIENT_URL ||
    process.env.FRONTEND_URL ||
    PRODUCTION_WATCH_BASE_URL;
  return String(raw).replace(/\/$/, '');
}

function buildEventThumbnailUrl(event) {
  if (!event) return null;
  const meta = event.meta || {};
  const custom = typeof meta.thumbnailUrl === 'string' ? meta.thumbnailUrl.trim() : '';
  if (custom) return custom;
  const videoId = String(event.youtubeVideoId || '').trim();
  if (videoId) return `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
  return null;
}

function buildSavvyWatchJoinUrl(slug, { source = LIVE_WELCOME_BONUS_SOURCE, useSourceParam = true } = {}) {
  const safeSlug = sanitizeEventSlug(slug);
  const base = getSavvyWatchPublicBaseUrl();
  const param = useSourceParam ? 'source' : 'src';
  return `${base}/watch/${encodeURIComponent(safeSlug)}?${param}=${encodeURIComponent(source)}`;
}

function isPubliclyVisibleEventStatus(status) {
  return PUBLICLY_VISIBLE_EVENT_STATUSES.includes(String(status || '').toLowerCase());
}

function getPublicLifecyclePhase(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'scheduled') return PUBLIC_LIFECYCLE_PHASES.STARTING_SOON;
  if (normalized === 'live') return PUBLIC_LIFECYCLE_PHASES.LIVE;
  if (normalized === 'ended' || normalized === 'archived') return PUBLIC_LIFECYCLE_PHASES.ENDED;
  return null;
}

function canTransitionEventStatus(fromStatus, toStatus) {
  const from = String(fromStatus || '').toLowerCase();
  const to = String(toStatus || '').toLowerCase();
  const allowed = EVENT_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

function getPublicLifecycleLabel(status) {
  const phase = getPublicLifecyclePhase(status);
  if (phase === PUBLIC_LIFECYCLE_PHASES.STARTING_SOON) return 'STARTING SOON';
  if (phase === PUBLIC_LIFECYCLE_PHASES.LIVE) return 'LIVE';
  if (phase === PUBLIC_LIFECYCLE_PHASES.ENDED) return 'ENDED';
  return String(status || '').toUpperCase();
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
  isStreamQrAttribution,
  sanitizeEventSlug,
  getSavvyWatchPublicBaseUrl,
  buildSavvyWatchJoinUrl,
  LIVE_WELCOME_BONUS_AMOUNT,
  LIVE_WELCOME_BONUS_SOURCE,
  HOMEPAGE_LIVE_ATTRIBUTION_SOURCE,
  buildEventThumbnailUrl,
  PRODUCTION_WATCH_BASE_URL,
  PUBLIC_LIFECYCLE_PHASES,
  PUBLICLY_VISIBLE_EVENT_STATUSES,
  EVENT_STATUS_TRANSITIONS,
  isPubliclyVisibleEventStatus,
  getPublicLifecyclePhase,
  getPublicLifecycleLabel,
  canTransitionEventStatus,
};
