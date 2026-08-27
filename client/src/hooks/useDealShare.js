import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import {
  getDealShareText,
  getDealShareTitle,
  getDealShareUrl,
  resolveDealIdFromListing,
  sanitizeDealShareSource,
} from '../lib/dealShareUrl';
import { recordScoutMissionAction } from '../lib/savvyScoutMissions';

async function trackDealShareEvent(dealId, eventType, shareSource) {
  if (!dealId) return;
  try {
    await api.post(`/deals/${encodeURIComponent(dealId)}/events`, {
      eventType,
      shareSource: sanitizeDealShareSource(shareSource),
    });
  } catch {
    /* analytics must not block share UX */
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

/**
 * Universal deal share hook — Web Share API with clipboard fallback.
 */
export function useDealShare({ shareSource = 'share' } = {}) {
  const [sharing, setSharing] = useState(false);

  const shareDeal = useCallback(
    async (deal, options = {}) => {
      const src = sanitizeDealShareSource(options.shareSource || shareSource);
      const url = getDealShareUrl(deal, src);
      const dealId = resolveDealIdFromListing(deal);
      if (!url || !dealId) {
        toast.error('This deal cannot be shared yet.');
        return { ok: false, reason: 'missing_id' };
      }

      setSharing(true);
      try {
        await trackDealShareEvent(dealId, 'deal_share_clicked', src);

        const title = getDealShareTitle(deal);
        const text = getDealShareText(deal);

        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          try {
            await navigator.share({ title, text, url });
            await trackDealShareEvent(dealId, 'deal_link_copied', 'web-share');
            recordScoutMissionAction('share_deal', {
              listingId: dealId,
              shareSource: src,
            });
            return { ok: true, method: 'web-share', url };
          } catch (err) {
            if (err?.name === 'AbortError') return { ok: false, reason: 'aborted' };
          }
        }

        await copyText(url);
        await trackDealShareEvent(dealId, 'deal_link_copied', 'copy');
        toast.success('Deal link copied');
        recordScoutMissionAction('share_deal', {
          listingId: dealId,
          shareSource: src,
        });
        return { ok: true, method: 'clipboard', url };
      } catch (err) {
        console.error('[deal-share]', err);
        toast.error('Could not share this deal.');
        return { ok: false, reason: 'error' };
      } finally {
        setSharing(false);
      }
    },
    [shareSource]
  );

  return { shareDeal, sharing };
}

export { trackDealShareEvent };
