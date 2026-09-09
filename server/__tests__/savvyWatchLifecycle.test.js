const {
  PUBLIC_LIFECYCLE_PHASES,
  getPublicLifecyclePhase,
  getPublicLifecycleLabel,
  isPubliclyVisibleEventStatus,
  canTransitionEventStatus,
  buildSavvyWatchJoinUrl,
} = require('../config/savvyWatchConfig');
const { SavvyWatchError, getPublicEventPage } = require('../services/savvyWatchService');
const { claimLiveWelcomeBonus } = require('../services/savvyWatchLiveWelcomeBonusService');

jest.mock('../models/SavvyWatchEvent', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  updateOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../models/SavvyWatchSession', () => ({
  findOne: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../models/SavvyWatchCompetition', () => ({
  find: jest.fn(() => ({ select: () => ({ lean: async () => [] }) })),
}));

const SavvyWatchEvent = require('../models/SavvyWatchEvent');
const SavvyWatchSession = require('../models/SavvyWatchSession');

describe('Savvy Watch lifecycle config', () => {
  test('maps scheduled/live/ended statuses to public phases', () => {
    expect(getPublicLifecyclePhase('scheduled')).toBe(PUBLIC_LIFECYCLE_PHASES.STARTING_SOON);
    expect(getPublicLifecyclePhase('live')).toBe(PUBLIC_LIFECYCLE_PHASES.LIVE);
    expect(getPublicLifecyclePhase('ended')).toBe(PUBLIC_LIFECYCLE_PHASES.ENDED);
    expect(getPublicLifecyclePhase('archived')).toBe(PUBLIC_LIFECYCLE_PHASES.ENDED);
    expect(getPublicLifecyclePhase('draft')).toBeNull();
  });

  test('public visibility excludes draft and cancelled', () => {
    expect(isPubliclyVisibleEventStatus('scheduled')).toBe(true);
    expect(isPubliclyVisibleEventStatus('live')).toBe(true);
    expect(isPubliclyVisibleEventStatus('ended')).toBe(true);
    expect(isPubliclyVisibleEventStatus('draft')).toBe(false);
    expect(isPubliclyVisibleEventStatus('cancelled')).toBe(false);
  });

  test('labels match admin/public UX', () => {
    expect(getPublicLifecycleLabel('scheduled')).toBe('STARTING SOON');
    expect(getPublicLifecycleLabel('live')).toBe('LIVE');
    expect(getPublicLifecycleLabel('ended')).toBe('ENDED');
  });

  test('validates admin status transitions', () => {
    expect(canTransitionEventStatus('scheduled', 'live')).toBe(true);
    expect(canTransitionEventStatus('live', 'ended')).toBe(true);
    expect(canTransitionEventStatus('scheduled', 'ended')).toBe(false);
    expect(canTransitionEventStatus('ended', 'live')).toBe(false);
  });

  test('QR URL remains unchanged', () => {
    delete process.env.SAVVY_WATCH_PUBLIC_URL;
    delete process.env.CLIENT_URL;
    expect(buildSavvyWatchJoinUrl('gta-car-meet-001', { useSourceParam: true }))
      .toBe('https://final10.app/watch/gta-car-meet-001?source=stream-qr');
  });
});

describe('Savvy Watch public event page lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SavvyWatchSession.countDocuments.mockResolvedValue(3);
  });

  test('scheduled event returns starting soon phase (not event-not-found)', async () => {
    SavvyWatchEvent.findOne.mockResolvedValue({
      eventId: 'sw_test',
      slug: 'gta-car-meet-001',
      title: 'GTA Car Meet',
      status: 'scheduled',
      rewardRules: { checkpoints: [], maxSavvyPerViewer: 100 },
    });

    const page = await getPublicEventPage('gta-car-meet-001');
    expect(page.lifecyclePhase).toBe(PUBLIC_LIFECYCLE_PHASES.STARTING_SOON);
    expect(page.event.lifecycleLabel).toBe('STARTING SOON');
    expect(page.event.slug).toBe('gta-car-meet-001');
  });

  test('draft event returns event-not-found for public viewers', async () => {
    SavvyWatchEvent.findOne.mockResolvedValue({
      eventId: 'sw_draft',
      slug: 'gta-car-meet-001',
      title: 'GTA Car Meet',
      status: 'draft',
    });

    await expect(getPublicEventPage('gta-car-meet-001')).rejects.toBeInstanceOf(SavvyWatchError);
    await expect(getPublicEventPage('gta-car-meet-001')).rejects.toMatchObject({
      code: 'EVENT_NOT_FOUND',
    });
  });

  test('missing slug returns event-not-found', async () => {
    SavvyWatchEvent.findOne.mockResolvedValue(null);
    await expect(getPublicEventPage('missing-slug')).rejects.toMatchObject({
      code: 'EVENT_NOT_FOUND',
    });
  });

  test('live event returns live phase', async () => {
    SavvyWatchEvent.findOne.mockResolvedValue({
      eventId: 'sw_live',
      slug: 'gta-car-meet-001',
      title: 'GTA Car Meet',
      status: 'live',
      rewardRules: { checkpoints: [], maxSavvyPerViewer: 100 },
    });

    const page = await getPublicEventPage('gta-car-meet-001');
    expect(page.lifecyclePhase).toBe(PUBLIC_LIFECYCLE_PHASES.LIVE);
  });

  test('ended event returns ended phase', async () => {
    SavvyWatchEvent.findOne.mockResolvedValue({
      eventId: 'sw_end',
      slug: 'gta-car-meet-001',
      title: 'GTA Car Meet',
      status: 'ended',
      rewardRules: { checkpoints: [], maxSavvyPerViewer: 100 },
    });

    const page = await getPublicEventPage('gta-car-meet-001');
    expect(page.lifecyclePhase).toBe(PUBLIC_LIFECYCLE_PHASES.ENDED);
  });
});
