import React, { useState } from 'react';
import { CAMO_ASSET_PLACEHOLDER } from '../../config/camoAssets';

/**
 * Camo render frame. Always `object-fit: contain` so apparel is never cropped,
 * lazy by default, and degrades to a camo-tinted glyph when art is missing.
 *
 * @param {object} props
 * @param {string} props.src
 * @param {string} props.alt
 * @param {string} [props.accentColor] used by the fallback + load shimmer
 * @param {string} [props.glyph] emoji shown when the image can't load
 * @param {'lazy'|'eager'} [props.loading]
 * @param {string} [props.className]
 * @param {boolean} [props.dimmed] locked treatment
 */
export default function CamoImage({
  src,
  alt,
  accentColor = '#a855f7',
  glyph = '🎖️',
  loading = 'lazy',
  className = '',
  dimmed = false,
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const showFallback = failed || !src || src === CAMO_ASSET_PLACEHOLDER;

  return (
    <div
      className={`f10-camo-img ${dimmed ? 'f10-camo-img--dim' : ''} ${className}`.trim()}
      style={{ '--camo-accent': accentColor }}
    >
      {showFallback ? (
        <div className="f10-camo-img__fallback" aria-hidden>
          <span className="f10-camo-img__glyph">{glyph}</span>
        </div>
      ) : (
        <>
          {!loaded ? <div className="f10-camo-img__shimmer" aria-hidden /> : null}
          <img
            src={src}
            alt={alt}
            loading={loading}
            decoding="async"
            className={`f10-camo-img__img ${loaded ? 'is-loaded' : ''}`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </>
      )}
    </div>
  );
}
