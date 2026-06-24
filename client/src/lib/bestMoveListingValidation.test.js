import {
  isEbaySearchOrBrowseUrl,
  isDirectEbayItemUrl,
  resolveListingImageUrl,
  validateBestMoveListing,
  titleMatchesCategory,
} from './bestMoveListingValidation';
import {
  getCategoryFallbackQueries,
  pickCategoryFallbackQuery,
  normalizeBestMoveCategory,
} from './bestMoveFallbackConfig';

const validItem = {
  title: 'Sony PlayStation 5 Console Disc Edition',
  buyNowPrice: 449.99,
  imageUrl: 'https://i.ebayimg.com/images/g/abc123/s-l1600.jpg',
  itemWebUrl: 'https://www.ebay.com/itm/123456789',
  trustScore: 82,
};

describe('bestMoveListingValidation', () => {
  test('rejects eBay search URLs', () => {
    expect(isEbaySearchOrBrowseUrl('https://www.ebay.com/sch/i.html?_nkw=ps5')).toBe(true);
    expect(isEbaySearchOrBrowseUrl('https://www.ebay.com/b/Video-Games-Consoles/139971/bn_711')).toBe(true);
    expect(isDirectEbayItemUrl('https://www.ebay.com/itm/123456789')).toBe(true);
    expect(isDirectEbayItemUrl('https://www.ebay.com/sch/i.html?_nkw=ps5')).toBe(false);
  });

  test('accepts valid Best Move listing', () => {
    const result = validateBestMoveListing(validItem, { category: 'gaming', log: false });
    expect(result.valid).toBe(true);
  });

  test('rejects missing image', () => {
    const result = validateBestMoveListing(
      { ...validItem, imageUrl: '/fallback.png' },
      { log: false }
    );
    expect(result.reasons).toContain('missing_image');
  });

  test('resolves gallery and thumbnail images', () => {
    const url = resolveListingImageUrl({
      galleryURL: 'https://i.ebayimg.com/images/g/gallery/s-l500.jpg',
      thumbnailImages: [{ imageUrl: 'https://i.ebayimg.com/images/g/thumb/s-l225.jpg' }],
    });
    expect(url).toMatch(/^https:\/\/i\.ebayimg\.com/);
  });

  test('category title hints', () => {
    expect(titleMatchesCategory('BMW scan tool OBD2', 'auto')).toBe(true);
    expect(titleMatchesCategory('PlayStation 5 console', 'gaming')).toBe(true);
    expect(titleMatchesCategory('PlayStation 5 console', 'auto')).toBe(false);
  });
});

describe('bestMoveFallbackConfig', () => {
  test('gaming can fallback to PS5', () => {
    const queries = getCategoryFallbackQueries('gaming');
    expect(queries[0]).toMatch(/playstation|ps5/i);
  });

  test('auto does not fallback to PS5', () => {
    const queries = getCategoryFallbackQueries('auto');
    expect(queries.join(' ')).not.toMatch(/playstation|ps5/i);
    expect(queries[0]).toMatch(/scanner|wrench|jack|bmw|socket/i);
  });

  test('home does not fallback to PS5', () => {
    const queries = getCategoryFallbackQueries('home');
    expect(queries.join(' ')).not.toMatch(/playstation|ps5/i);
  });

  test('pickCategoryFallbackQuery stays in category', () => {
    const auto = pickCategoryFallbackQuery('auto', 'bmw parts', 0);
    expect(auto.category).toBe('auto');
    expect(auto.query).toMatch(/scanner|wrench|jack|bmw|socket/i);

    const home = pickCategoryFallbackQuery('home-tech', 'desk setup', 0);
    expect(home.category).toBe('home');
  });

  test('normalizeBestMoveCategory maps aliases', () => {
    expect(normalizeBestMoveCategory('home-tech')).toBe('home');
    expect(normalizeBestMoveCategory('bmw-parts')).toBe('auto');
    expect(normalizeBestMoveCategory('tech')).toBe('electronics');
  });
});
