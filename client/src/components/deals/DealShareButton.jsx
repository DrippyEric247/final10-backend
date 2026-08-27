import React from 'react';
import { Share2 } from 'lucide-react';
import { useDealShare } from '../../hooks/useDealShare';
import '../../styles/DealShareButton.css';

/**
 * Shared deal share control for every deal card surface.
 * @param {object} props
 * @param {object} props.deal
 * @param {string} [props.shareSource]
 * @param {string} [props.className]
 * @param {string} [props.label]
 * @param {boolean} [props.compact]
 * @param {boolean} [props.iconOnly]
 * @param {(result: object) => void} [props.onShared]
 */
export default function DealShareButton({
  deal,
  shareSource = 'share',
  className = '',
  label = 'Share',
  compact = false,
  iconOnly = false,
  onShared,
}) {
  const { shareDeal, sharing } = useDealShare({ shareSource });

  return (
    <button
      type="button"
      className={`deal-share-btn ${compact ? 'deal-share-btn--compact' : ''} ${className}`.trim()}
      disabled={sharing || !deal}
      aria-label={iconOnly ? 'Share deal' : undefined}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const result = await shareDeal(deal, { shareSource });
        onShared?.(result);
      }}
    >
      <Share2 size={compact ? 14 : 16} aria-hidden />
      {!iconOnly ? <span>{sharing ? 'Sharing…' : label}</span> : null}
    </button>
  );
}
