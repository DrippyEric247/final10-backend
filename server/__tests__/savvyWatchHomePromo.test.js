const {
  HOMEPAGE_LIVE_ATTRIBUTION_SOURCE,
  buildEventThumbnailUrl,
  buildSavvyWatchJoinUrl,
  normalizeAttributionSource,
  isStreamQrAttribution,
} = require('../config/savvyWatchConfig');
const {
  getLiveSavvyWatchHomePromo,
  serializeLivePromoEvent,
} = require('../services/savvyWatchService');
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

const SavvyWatchEvent = require('../models/SavvyWatchEvent');
const SavvyWatchSession = require('../models/SavvyWatchSession');

describe('Savvy Watch homepage live promo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SAVVY_WATCH_ENABLED = 'true';
    SavvyWatchSession.countDocuments.mockResolvedValue(12);
  });

  afterEach(() => {
    delete process.env.SAVVY_WATCH_ENABLED;
  });

  test('returns live:false when Savvy Watch is disabled', async () => {
    process.env.SAVVY_WATCH_ENABLED = 'false';
    const result = await getLiveSavvyWatchHomePromo();
    expect(result.live).toBe(false);
    expect(result.reason).toBe('disabled');
    expect(SavvyWatchEvent.find).not.toHaveBeenCalled();
  });

  test('returns live:false when no events are live', async () => {
    SavvyWatchEvent.find.mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: async () => [],
        }),
      }),
    });
    const result = await getLiveSavvyWatchHomePromo();
    expect(result.live).toBe(false);
  });

  test('returns primary live event with homepage-live join path', async () => {
    const liveEvent = {
      eventId: 'sw_gta',
      slug: 'gta-car-meet-001',
      title: 'GTA Car Meet',
      hostDisplayName: 'EricIsGaming',
      status: 'live',
      actualStartAt: new Date('2026-09-08T22:00:00Z'),
      youtubeVideoId: 'abc123xyz',
    };
    SavvyWatchEvent.find.mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: async () => [liveEvent],
        }),
      }),
    });

    const result = await getLiveSavvyWatchHomePromo();
    expect(result.live).toBe(true);
    expect(result.primary.title).toBe('GTA Car Meet');
    expect(result.primary.hostDisplayName).toBe('EricIsGaming');
    expect(result.primary.joinPath).toBe('/watch/gta-car-meet-001?source=homepage-live');
    expect(result.primary.thumbnailUrl).toBe('https://img.youtube.com/vi/abc123xyz/hqdefault.jpg');
    expect(result.moreCount).toBe(0);
  });

  test('prefers most recently started live event and reports additional live count', async () => {
    SavvyWatchEvent.find.mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: async () => [
            {
              eventId: 'sw_new',
              slug: 'newer-live',
              title: 'Newer Live',
              status: 'live',
              actualStartAt: new Date('2026-09-08T23:00:00Z'),
            },
            {
              eventId: 'sw_old',
              slug: 'older-live',
              title: 'Older Live',
              status: 'live',
              actualStartAt: new Date('2026-09-08T21:00:00Z'),
            },
          ],
        }),
      }),
    });

    const result = await getLiveSavvyWatchHomePromo();
    expect(result.primary.slug).toBe('newer-live');
    expect(result.moreCount).toBe(1);
  });

  test('buildEventThumbnailUrl prefers meta.thumbnailUrl then YouTube', () => {
    expect(buildEventThumbnailUrl({ meta: { thumbnailUrl: 'https://cdn.example/thumb.jpg' } }))
      .toBe('https://cdn.example/thumb.jpg');
    expect(buildEventThumbnailUrl({ youtubeVideoId: 'vid123' }))
      .toBe('https://img.youtube.com/vi/vid123/hqdefault.jpg');
    expect(buildEventThumbnailUrl({})).toBeNull();
  });

  test('serializeLivePromoEvent builds join URL with homepage-live source', () => {
    delete process.env.SAVVY_WATCH_PUBLIC_URL;
    const promo = serializeLivePromoEvent({
      eventId: 'sw_gta',
      slug: 'gta-car-meet-001',
      title: 'GTA Car Meet',
      hostDisplayName: 'EricIsGaming',
    });
    expect(promo.joinPath).toBe('/watch/gta-car-meet-001?source=homepage-live');
    expect(promo.joinUrl).toBe('https://final10.app/watch/gta-car-meet-001?source=homepage-live');
    expect(HOMEPAGE_LIVE_ATTRIBUTION_SOURCE).toBe('homepage-live');
    expect(normalizeAttributionSource('homepage-live')).toBe('homepage-live');
    expect(buildSavvyWatchJoinUrl('gta-car-meet-001', { source: 'homepage-live' }))
      .toBe('https://final10.app/watch/gta-car-meet-001?source=homepage-live');
  });

  test('homepage-live attribution does not qualify for QR welcome bonus', async () => {
    const user = { _id: '507f1f77bcf86cd799439011' };
    const result = await claimLiveWelcomeBonus(user, 'gta-car-meet-001', { source: 'homepage-live' });
    expect(result.awarded).toBe(false);
    expect(result.reason).toBe('SOURCE_NOT_ELIGIBLE');
    expect(isStreamQrAttribution('homepage-live')).toBe(false);
  });
});
