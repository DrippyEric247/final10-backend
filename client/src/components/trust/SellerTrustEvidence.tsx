import React, { useId, useState } from 'react';
import type { SellerTrustEvidence as SellerTrustEvidencePayload } from '../../lib/sellerTrustEvidence';
import { EVIDENCE_STATE_LABEL, sellerTrustEvidenceSummary } from '../../lib/sellerTrustEvidence';
import type { TrustScoreResult } from '../../types/trustScore';
import { buildSellerTrustEvidence } from '../../lib/sellerTrustEvidence';
import '../../styles/SellerTrustEvidence.css';

export type SellerTrustEvidenceProps = {
  /** Pre-built evidence payload (preferred when server-normalized). */
  evidence?: SellerTrustEvidencePayload | null;
  /** Listing blob — evidence built client-side when `evidence` omitted. */
  listing?: Record<string, unknown> | null;
  /** Optional trust engine output for concern mapping. */
  trust?: TrustScoreResult | null;
  compact?: boolean;
  className?: string;
  showDetailsToggle?: boolean;
};

function resolveEvidence(
  evidence: SellerTrustEvidencePayload | null | undefined,
  listing: Record<string, unknown> | null | undefined,
  trust: TrustScoreResult | null | undefined
): SellerTrustEvidencePayload {
  if (evidence) return evidence;
  const serverEvidence = listing?.sellerEvidence as SellerTrustEvidencePayload | undefined;
  if (serverEvidence && typeof serverEvidence === 'object' && 'evidenceState' in serverEvidence) {
    return serverEvidence;
  }
  return buildSellerTrustEvidence(listing || {}, trust || undefined);
}

export default function SellerTrustEvidence({
  evidence,
  listing,
  trust,
  compact = false,
  className = '',
  showDetailsToggle = true,
}: SellerTrustEvidenceProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const resolved = resolveEvidence(evidence, listing, trust);
  const summary = sellerTrustEvidenceSummary(resolved);
  const hasPositive =
    resolved.positiveFeedbackPercent != null || resolved.feedbackCount != null;
  const stateClass = `seller-trust-evidence--${resolved.evidenceState.toLowerCase()}`;

  return (
    <section
      className={`seller-trust-evidence ${stateClass}${compact ? ' seller-trust-evidence--compact' : ''} ${className}`.trim()}
      aria-label="Seller trust evidence"
    >
      <div className="seller-trust-evidence__header">
        <span className="seller-trust-evidence__label">Seller</span>
        {resolved.isTopRated ? (
          <span className="seller-trust-evidence__top-rated" title="eBay Top Rated Seller">
            Top Rated
          </span>
        ) : null}
      </div>

      <div className="seller-trust-evidence__marketplace">
        {hasPositive ? (
          <>
            <span className="seller-trust-evidence__check" aria-hidden>
              ✓
            </span>
            <span className="seller-trust-evidence__summary">{summary}</span>
          </>
        ) : (
          <span className="seller-trust-evidence__summary seller-trust-evidence__summary--muted">
            Feedback data unavailable
          </span>
        )}
        <span className="seller-trust-evidence__attrib">eBay seller feedback</span>
      </div>

      <p className="seller-trust-evidence__final10">
        <span className="seller-trust-evidence__final10-label">Final10 check:</span>{' '}
        {resolved.final10Note}
      </p>

      {resolved.listingConcerns.length > 0 ? (
        <div className="seller-trust-evidence__listing-note" role="note">
          <span className="seller-trust-evidence__listing-label">Deal note:</span>{' '}
          {resolved.listingConcerns[0]}
        </div>
      ) : null}

      {showDetailsToggle ? (
        <>
          <button
            type="button"
            className="seller-trust-evidence__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide seller trust details' : 'Seller trust details'}
          </button>
          {open ? (
            <div id={panelId} className="seller-trust-evidence__details">
              <div className="seller-trust-evidence__details-section">
                <h4>Marketplace evidence</h4>
                <ul>
                  {resolved.evidence.length ? (
                    resolved.evidence.map((line) => <li key={line}>{line}</li>)
                  ) : (
                    <li>Feedback data unavailable</li>
                  )}
                </ul>
              </div>
              <div className="seller-trust-evidence__details-section">
                <h4>Final10 analysis</h4>
                <p className="seller-trust-evidence__state">
                  Status: {EVIDENCE_STATE_LABEL[resolved.evidenceState]}
                </p>
                {resolved.sellerConcerns.length ? (
                  <ul>
                    {resolved.sellerConcerns.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No major seller concerns detected.</p>
                )}
              </div>
              {resolved.listingConcerns.length ? (
                <div className="seller-trust-evidence__details-section">
                  <h4>Listing / deal notes</h4>
                  <ul>
                    {resolved.listingConcerns.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="seller-trust-evidence__disclaimer">
                Final10 analyzes available marketplace evidence and does not guarantee seller
                performance.
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/** Convenience helper for pages that already have trust evaluation. */
export function sellerTrustEvidenceFromTrust(
  listing: Record<string, unknown>,
  trust: TrustScoreResult
): SellerTrustEvidencePayload {
  return buildSellerTrustEvidence(listing, trust);
}
