/**
 * Pick the highest-quality listing image URL from common eBay / Final10 item shapes.
 * Prefers larger eBay picture sizes (s-l####) and explicit largeUrl / imageUrl fields.
 *
 * Future: optional edge AI upscale when `LISTING_IMAGE_AI_UPSCALE_ENABLED` is true.
 */
export const LISTING_IMAGE_AI_UPSCALE_ENABLED = false as const;

type UnknownRecord = Record<string, unknown>;

function pushUrl(out: Set<string>, raw: unknown) {
  if (typeof raw !== "string") return;
  const t = raw.trim();
  if (t && /^https?:\/\//i.test(t)) out.add(t);
}

function collectImageUrlsFromObject(obj: UnknownRecord | null | undefined, out: Set<string>) {
  if (!obj) return;
  pushUrl(out, obj.imageUrl);
  pushUrl(out, obj.largeUrl);
  pushUrl(out, obj.url);
  pushUrl(out, obj.href);
  pushUrl(out, obj.galleryURL);
}

/** eBay static gallery URLs use segments like `s-l500.jpg`; larger number → larger image. */
export function scoreListingImageUrl(url: string): number {
  const m = url.match(/s-l(\d{2,5})\b/i);
  if (m) return parseInt(m[1], 10);
  const w = url.match(/[?&]w=(\d+)/i);
  if (w) return parseInt(w[1], 10);
  if (/[/_-](\d{3,4})x(\d{3,4})\b/i.test(url)) {
    const mm = url.match(/[/_-](\d{3,4})x(\d{3,4})\b/i);
    if (mm) return Math.max(parseInt(mm[1], 10), parseInt(mm[2], 10));
  }
  return 0;
}

/** Request a larger eBay picture when the URL uses the `s-l###` pattern. */
/** Bump eBay `s-l###` segment toward gallery max (~1600) when still on a thumbnail. */
export function upgradeEbayPictureUrl(url: string): string {
  if (!url || typeof url !== "string") return url;
  return url.replace(/s-l(\d{2,5})\b/gi, (_, size: string) => {
    const n = parseInt(size, 10);
    if (!Number.isFinite(n) || n >= 1600) return `s-l${size}`;
    return "s-l1600";
  });
}

export function getBestListingImageUrl(item: unknown): string {
  if (item == null) return "";
  if (typeof item === "string") {
    const t = item.trim();
    return t && /^https?:\/\//i.test(t) ? upgradeEbayPictureUrl(t) : "";
  }
  if (typeof item !== "object") return "";
  const o = item as UnknownRecord;
  const urls = new Set<string>();

  collectImageUrlsFromObject(o, urls);
  pushUrl(urls, o.galleryURL);

  const img = o.image;
  if (typeof img === "string") pushUrl(urls, img);
  else if (img && typeof img === "object") collectImageUrlsFromObject(img as UnknownRecord, urls);

  const images = o.images;
  if (Array.isArray(images)) {
    for (const entry of images) {
      if (typeof entry === "string") pushUrl(urls, entry);
      else if (entry && typeof entry === "object") {
        collectImageUrlsFromObject(entry as UnknownRecord, urls);
      }
    }
  }

  const list = [...urls];
  if (!list.length) return "";

  let best = list[0];
  let bestScore = scoreListingImageUrl(best);
  for (let i = 1; i < list.length; i += 1) {
    const u = list[i];
    const s = scoreListingImageUrl(u);
    if (s > bestScore || (s === bestScore && u.length > best.length)) {
      best = u;
      bestScore = s;
    }
  }

  return upgradeEbayPictureUrl(best);
}
