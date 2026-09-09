const {
  normalizeAttributionSource,
  generateLiveCode,
  isSavvyWatchEnabled,
  isSavvyWatchAdminOnly,
  canUserParticipateInSavvyWatch,
} = require('../config/savvyWatchConfig');
const { GTA_CAR_MEET_PRESET } = require('../config/savvyWatchGtaPreset');

describe('savvyWatch config', () => {
  test('normalizeAttributionSource accepts known sources without affecting semantics', () => {
    expect(normalizeAttributionSource('stream-qr')).toBe('stream-qr');
    expect(normalizeAttributionSource('homepage-live')).toBe('homepage-live');
    expect(normalizeAttributionSource('DISCORD')).toBe('discord');
    expect(normalizeAttributionSource('unknown-source')).toBe('unknown');
  });

  test('generateLiveCode produces non-sequential alphanumeric codes', () => {
    const a = generateLiveCode(8);
    const b = generateLiveCode(8);
    expect(a).toHaveLength(8);
    expect(b).toHaveLength(8);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Z2-9]+$/);
  });

  test('GTA preset includes five configurable competitions', () => {
    expect(GTA_CAR_MEET_PRESET.competitions).toHaveLength(5);
    expect(GTA_CAR_MEET_PRESET.competitions.map((c) => c.slug)).toEqual([
      'best-build',
      'cleanest-bmw',
      'best-crew-entrance',
      'drift-winner',
      'photo-of-the-night',
    ]);
  });

  test('feature flag defaults to disabled', () => {
    const prev = process.env.SAVVY_WATCH_ENABLED;
    delete process.env.SAVVY_WATCH_ENABLED;
    expect(isSavvyWatchEnabled()).toBe(false);
    process.env.SAVVY_WATCH_ENABLED = prev;
  });

  test('admin-only defaults to true and public participation requires explicit false', () => {
    const prevEnabled = process.env.SAVVY_WATCH_ENABLED;
    const prevAdminOnly = process.env.SAVVY_WATCH_ADMIN_ONLY;
    process.env.SAVVY_WATCH_ENABLED = 'true';
    delete process.env.SAVVY_WATCH_ADMIN_ONLY;
    expect(isSavvyWatchAdminOnly()).toBe(true);
    process.env.SAVVY_WATCH_ADMIN_ONLY = 'false';
    expect(isSavvyWatchAdminOnly()).toBe(false);
    expect(canUserParticipateInSavvyWatch({ role: 'user' })).toBe(true);
    process.env.SAVVY_WATCH_ENABLED = prevEnabled;
    process.env.SAVVY_WATCH_ADMIN_ONLY = prevAdminOnly;
  });
});
