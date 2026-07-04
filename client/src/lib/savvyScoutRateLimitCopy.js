/** User-facing copy for Savvy Scout status — never expose API paths or dev terms. */

export const SAVVY_SCOUT_SCANNING_TITLE = 'Savvy Scout is scanning...';

export const SAVVY_SCOUT_SCANNING_BODY =
  'Hunting for the best moves across the marketplace.';

/** @deprecated Prefer SAVVY_SCOUT_SCANNING_TITLE for active search UI. */
export const SAVVY_SCOUT_UPDATING_TITLE = SAVVY_SCOUT_SCANNING_TITLE;

/** @deprecated Prefer SAVVY_SCOUT_SCANNING_BODY for active search UI. */
export const SAVVY_SCOUT_UPDATING_BODY = SAVVY_SCOUT_SCANNING_BODY;

export const SAVVY_SCOUT_RETRY_FAILED_BODY =
  "Savvy Scout is still reconnecting. Tap Retry when you're ready.";

export const SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE = SAVVY_SCOUT_UPDATING_BODY;
