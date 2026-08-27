import React, { useId, useState } from 'react';
import type { SellerTrustEvidence as SellerTrustEvidencePayload } from '../../lib/sellerTrustEvidence';
import {
  EVIDENCE_STATE_LABEL,
  RISK_LEVEL_LABEL,
  sellerTrustEvidenceSummary,
} from '../../lib/sellerTrustEvidence';
import type { TrustScoreResult } from '../../types/trustScore';
import { buildSellerTrustEvidence } from '../../lib/sellerTrustEvidence';
import '../../styles/SellerTrustEvidence.css';

export type SellerTrustEvidenceProps = {
  evidence?: SellerTrustEvidencePayload | null;
  listing?: Record<string, unknown> | null;
  trust?: TrustScoreResult | null;
  compact?: boolean;
  className?: string;
  showDetailsToggle?: boolean;
  /** Show expandable "Why this matters" in compact mode. */
  showWhyToggle?: boolean;
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

function RemarkBadge({ label, explanation }: { label: string; explanation: string }) {
  return (
    <span className="seller-trust-evidence__badge" title={explanation}>
      {label}
    </span>
  );
}

export default function SellerTrustEvidence({
  evidence,
  listing,
  trust,
  compact = false,
  className = '',
  showDetailsToggle = true,
  showWhyToggle = true,
}: SellerTrustEvidenceProps) {
  const panelId = useId();
  const whyId = useId();
  const [open, setOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const resolved = resolveEvidence(evidence, listing, trust);
  const summary = sellerTrustEvidenceSummary(resolved);
  const hasPositive =
    resolved.positiveFeedbackPercent != null || resolved.feedbackCount != null;
  const stateClass = `seller-trust-evidence--${resolved.evidenceState.toLowerCase()}`;
  const riskClass = `seller-trust-evidence--risk-${resolved.riskLevel.replace(/_/g, '-')}`;
  const badgeRemarks = resolved.final10Remarks.filter((r) =>
    [
      'NEW_SELLER',
      'ESTABLISHED_SELLER',
      'TOP_RATED_SELLER',
      'LIMITED_EVIDENCE',
      'NO_RETURNS',
      'RETURNS_ACCEPTED',
      'LOW_FEEDBACK_COUNT',
    ].includes(r.code)
  );

  return (
    <section
      className={`seller-trust-evidence ${stateClass} ${riskClass}${compact ? ' seller-trust-evidence--compact' : ''} ${className}`.trim()}
      aria-label={`Seller reputation — ${EVIDENCE_STATE_LABEL[resolved.evidenceState]}`}
    >
      {!compact ? (
        <h3 className="seller-trust-evidence__section-title">Seller reputation</h3>
      ) : (
        <div className="seller-trust-evidence__header">
          <span className="seller-trust-evidence__label">Seller</span>
        </div>
      )}

      <div className="seller-trust-evidence__marketplace">
        {hasPositive ? (
          <>
            <span className="seller-trust-evidence__check" aria-hidden>
              ✓
            </span>
            <div className="seller-trust-evidence__rating-block">
              {resolved.marketplaceRating.display ? (
                <span className="seller-trust-evidence__rating-primary">
                  {resolved.marketplaceRating.display}
                </span>
              ) : null}
              {resolved.feedbackCount != null ? (
                <span className="seller-trust-evidence__rating-count">
                  {resolved.feedbackCount.toLocaleString()} ratings
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <span className="seller-trust-evidence__summary seller-trust-evidence__summary--muted">
            Seller reputation unavailable
          </span>
        )}
        <span className="seller-trust-evidence__attrib">eBay seller feedback</span>
      </div>

      {badgeRemarks.length > 0 ? (
        <div className="seller-trust-evidence__badges" aria-label="Final10 seller notes">
          {badgeRemarks.map((r) => (
            <RemarkBadge key={r.code} label={r.label} explanation={r.explanation} />
          ))}
        </div>
      ) : null}

      {resolved.riskLevel !== 'unknown' ? (
        <div className="seller-trust-evidence__risk" title={resolved.riskReasons.join(' • ')}>
          <span className="seller-trust-evidence__risk-label">
            {RISK_LEVEL_LABEL[resolved.riskLevel]}
          </span>
          {!compact && resolved.riskReasons.length ? (
            <ul className="seller-trust-evidence__risk-reasons">
              {resolved.riskReasons.slice(0, 4).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <p className="seller-trust-evidence__final10">
        <span className="seller-trust-evidence__final10-label">Final10 note:</span>{' '}
        {resolved.final10Note}
      </p>

      {compact && showWhyToggle ? (
        <>
          <button
            type="button"
            className="seller-trust-evidence__why-toggle"
            aria-expanded={whyOpen}
            aria-controls={whyId}
            onClick={() => setWhyOpen((v) => !v)}
          >
            {whyOpen ? 'Hide' : 'Why this matters'}
          </button>
          {whyOpen ? (
            <p id={whyId} className="seller-trust-evidence__why-body">
              {resolved.final10Note}
              {resolved.materialConcerns.length
                ? ` ${resolved.materialConcerns[0]}`
                : ''}
            </p>
          ) : null}
        </>
      ) : null}

      {resolved.listingConcerns.length > 0 ? (
        <div className="seller-trust-evidence__listing-note" role="note">
          <span className="seller-trust-evidence__listing-label">Deal note:</span>{' '}
          {resolved.listingConcerns[0]}
        </div>
      ) : null}

      {showDetailsToggle && !compact ? (
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
                    <li>Seller reputation unavailable</li>
                  )}
                </ul>
              </div>
              <div className="seller-trust-evidence__details-section">
                <h4>Final10 notes</h4>
                {resolved.final10Remarks.length ? (
                  <ul className="seller-trust-evidence__remarks-list">
                    {resolved.final10Remarks.map((r) => (
                      <li key={r.code}>
                        <strong>{r.label}</strong> — {r.explanation}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{resolved.final10Note}</p>
                )}
              </div>
              {resolved.materialConcerns.length ? (
                <div className="seller-trust-evidence__details-section">
                  <h4>Material concerns</h4>
                  <ul>
                    {resolved.materialConcerns.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
                performance. Marketplace reputation comes from eBay; Final10 adds context only.
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Screen-reader summary for compact cards */}
      {compact ? <span className="sr-only">{summary}</span> : null}
    </section>
  );
}

export function sellerTrustEvidenceFromTrust(
  listing: Record<string, unknown>,
  trust: TrustScoreResult
): SellerTrustEvidencePayload {
  return buildSellerTrustEvidence(listing, trust);
}

/** Compact trust row for tight deal cards. */
export function CompactSellerTrust(props: Omit<SellerTrustEvidenceProps, 'compact'>) {
  return <SellerTrustEvidence {...props} compact showDetailsToggle={false} showWhyToggle />;
}
