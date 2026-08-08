# Camo Locker artwork drop zone

Drop your official renders here. No code changes are required as long as you
follow the filename convention below — the locker resolves paths from
`client/src/config/camoAssets.js`.

## Card image (grid + related items)

```
/assets/camo/<category>/<apparel-folder>/<camo>.png
```

## Large preview / detail image (optional)

Falls back to the card image if absent.

```
/assets/camo/<category>/<apparel-folder>/<camo>-preview.png
```

## Category card hero (optional)

Falls back to the category emoji.

```
/assets/camo/<category>/hero.png
```

## Camo filenames

`woodland`, `tiger`, `arctic`, `gold`, `diamond`, `dark-nebula`

## The 30 starter paths

```
/assets/camo/retail/tshirts/{woodland,tiger,arctic,gold,diamond,dark-nebula}.png
/assets/camo/outdoor/hoodies/{woodland,tiger,arctic,gold,diamond,dark-nebula}.png
/assets/camo/fitness/shorts/{woodland,tiger,arctic,gold,diamond,dark-nebula}.png
/assets/camo/automotive/gloves/{woodland,tiger,arctic,gold,diamond,dark-nebula}.png
/assets/camo/electronics/socks/{woodland,tiger,arctic,gold,diamond,dark-nebula}.png
```

## Image specs

- Transparent PNG (or WebP with an override entry), square or 4:5.
- Export at 2x for retina — e.g. 1200x1200 or 1200x1500.
- Rendered with `object-fit: contain`, so nothing is ever cropped. Leave a small
  margin around the garment.
- Lazy-loaded everywhere except the preview/detail hero.

## Non-conventional paths (CDN, hashes, WebP)

Add an override in `client/src/config/camoAssets.js`:

```js
export const CAMO_ASSET_OVERRIDES = {
  'camo_fitness_dark-nebula_shorts': {
    image: 'https://cdn.savvy.app/camo/fitness-shorts-dark-nebula@2x.webp',
    preview: 'https://cdn.savvy.app/camo/fitness-shorts-dark-nebula-hero@2x.webp',
  },
};
```

Missing art degrades to a camo-tinted glyph tile, so the locker never looks
broken while renders are still in production.
