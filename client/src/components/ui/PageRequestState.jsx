import React from "react";
import { LoadingState, EmptyState, ErrorState } from "./states";

/**
 * Backwards-compat wrapper. New code should import LoadingState /
 * EmptyState / ErrorState directly from `components/ui/states`.
 */
export default function PageRequestState({
  loading = false,
  loadingLabel,
  loadingVariant = "page",
  error = null,
  empty = false,
  emptyTitle,
  emptyMessage = "Nothing to show yet.",
  emptyAction,
  onRetry,
  retryLabel,
  children,
}) {
  if (loading) return <LoadingState label={loadingLabel} variant={loadingVariant} />;
  if (error)
    return (
      <ErrorState error={error} onRetry={onRetry} retryLabel={retryLabel} />
    );
  if (empty)
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyMessage}
        action={emptyAction}
      />
    );
  return children || null;
}
