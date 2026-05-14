import React, { useCallback, useMemo, useState } from "react";
import { getBestListingImageUrl } from "../../lib/listingImageUrl";
import "../../styles/ListingCardImage.css";

const PLACEHOLDER = "https://via.placeholder.com/960/960/111827/A78BFA?text=Final10";

export type ListingCardImageProps = {
  item?: unknown;
  /** When set, overrides URL resolution from `item`. */
  src?: string;
  alt?: string;
  aspectRatio?: string;
  borderRadius?: string;
  fallbackSrc?: string;
  frameClassName?: string;
  imgClassName?: string;
};

/**
 * Listing hero image: best-resolution URL, fixed aspect frame, lazy load, light enhancement for tiny sources.
 */
export default function ListingCardImage({
  item,
  src,
  alt = "",
  aspectRatio = "4 / 3",
  borderRadius = "12px",
  fallbackSrc = PLACEHOLDER,
  frameClassName = "",
  imgClassName = "",
}: ListingCardImageProps) {
  const [failed, setFailed] = useState(false);
  const [lowResBoost, setLowResBoost] = useState(false);

  const resolved = useMemo(() => {
    if (failed) return fallbackSrc;
    if (typeof src === "string" && src.trim()) return src.trim();
    return getBestListingImageUrl(item) || fallbackSrc;
  }, [item, src, failed, fallbackSrc]);

  const onLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const w = el.naturalWidth;
    if (Number.isFinite(w) && w > 0 && w < 300) {
      setLowResBoost(true);
    }
  }, []);

  return (
    <div
      className={`f10-listing-img-frame ${frameClassName}`.trim()}
      style={{
        aspectRatio,
        borderRadius,
      }}
    >
      <img
        src={resolved}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`f10-listing-img ${lowResBoost ? "f10-listing-img--lowsrc" : ""} ${imgClassName}`.trim()}
        onLoad={onLoad}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
