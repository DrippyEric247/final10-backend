export const SAVVY_POINTS_PER_DOLLAR = 100;

export function getDollarValue(points) {
  const p = Number(points);
  if (!Number.isFinite(p) || p <= 0) return 0;
  return p / SAVVY_POINTS_PER_DOLLAR;
}

export function formatDollarValue(pointsOrDollars, alreadyDollars = false) {
  const raw = alreadyDollars ? Number(pointsOrDollars) : getDollarValue(pointsOrDollars);
  const v = Number.isFinite(raw) ? raw : 0;
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

