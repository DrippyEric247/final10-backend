/**
 * Optional development diagnostics (no-op in production build).
 * @param {string} context
 * @param {Record<string, unknown>} info
 */
export function devDiagApiFailure(context, info = {}) {
  if (process.env.NODE_ENV !== "development") return;
  // eslint-disable-next-line no-console
  console.warn(`[Final10 API] ${context}`, info);
}
