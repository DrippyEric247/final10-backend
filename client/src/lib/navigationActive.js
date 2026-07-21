/** Shared nav active-state helpers for primary nav and More menu links. */

export function normalizeNavHash(hash) {
  if (!hash) return '';
  return hash.startsWith('#') ? hash : `#${hash}`;
}

export function isNavActive(pathname, hash, search, item) {
  const path = item.path;
  const normalizedHash = normalizeNavHash(hash);
  const itemSearch = item.search || '';

  if (item.hash) {
    return pathname === path && normalizedHash === normalizeNavHash(item.hash);
  }

  if (itemSearch) {
    if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
    const params = new URLSearchParams(search || '');
    const expected = new URLSearchParams(
      itemSearch.startsWith('?') ? itemSearch.slice(1) : itemSearch
    );
    for (const [key, value] of expected.entries()) {
      if (params.get(key) !== value) return false;
    }
    return true;
  }

  if (path === '/') return pathname === '/';

  const pathMatches = pathname === path || pathname.startsWith(`${path}/`);
  if (!pathMatches) return false;

  if (path === '/win-feed' && normalizedHash === '#community-hub') {
    return false;
  }

  if (path === '/auctions' && (search || '').includes('watchlist=1')) {
    return false;
  }

  return true;
}
