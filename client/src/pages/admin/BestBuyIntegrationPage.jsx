import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasAdminRole } from '../../lib/adminAccess';
import {
  compareMarketplaceCandidates,
  fetchBestBuyIntegrationStatus,
  searchBestBuyIntegration,
  testBestBuyConnection,
} from '../../lib/bestBuyIntegrationApi';
import '../../styles/best-buy-integration.css';

const DEFAULT_QUERY = 'Samsung Odyssey G7';

function formatMoney(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function BestBuyIntegrationPage() {
  const { user, loading } = useAuth();
  const show = hasAdminRole(user);
  const [status, setStatus] = useState(null);
  const [connection, setConnection] = useState(null);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [searchResult, setSearchResult] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    const data = await fetchBestBuyIntegrationStatus();
    setStatus(data);
  }, []);

  React.useEffect(() => {
    if (!show) return;
    loadStatus().catch((err) => setError(err?.message || 'Failed to load status.'));
  }, [show, loadStatus]);

  const runConnectionTest = async () => {
    setBusy('connection');
    setError('');
    try {
      const result = await testBestBuyConnection();
      setConnection(result);
      await loadStatus();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Connection test failed.');
    } finally {
      setBusy('');
    }
  };

  const runSearch = async () => {
    setBusy('search');
    setError('');
    try {
      const result = await searchBestBuyIntegration(query.trim());
      setSearchResult(result);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Search failed.');
    } finally {
      setBusy('');
    }
  };

  const runCompare = async () => {
    setBusy('compare');
    setError('');
    try {
      const result = await compareMarketplaceCandidates({ q: query.trim() });
      setCompareResult(result);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Compare failed.');
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="bb-int-page">
        <p>Loading…</p>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="bb-int-page">
        <p>Admin access required.</p>
        <Link to="/">Home</Link>
      </div>
    );
  }

  return (
    <div className="bb-int-page">
      <header className="bb-int-header">
        <Link to="/admin" className="bb-int-back">
          ← Admin Hub
        </Link>
        <h1>Best Buy Integration</h1>
        <p className="bb-int-sub">
          Phase 1 — official Best Buy API via Final10 backend. Final10 is the app; Best Buy is the
          marketplace source.
        </p>
        <div className="bb-int-attribution" aria-label="Best Buy attribution">
          <img
            src="https://developer.bestbuy.com/images/bestbuy-logo.png"
            alt="Best Buy"
            className="bb-int-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span>Product data from Best Buy Developer API</span>
        </div>
      </header>

      {error ? <div className="bb-int-alert">{error}</div> : null}

      <section className="bb-int-panel">
        <h2>API status</h2>
        <dl className="bb-int-meta">
          <div>
            <dt>Configured</dt>
            <dd>{status?.configured ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt>Enabled</dt>
            <dd>{status?.enabled ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt>Search cache TTL</dt>
            <dd>{status?.cacheTtls?.searchMs ? `${Math.round(status.cacheTtls.searchMs / 60000)} min` : '—'}</dd>
          </div>
        </dl>
        <button type="button" className="bb-int-btn" disabled={busy === 'connection'} onClick={runConnectionTest}>
          {busy === 'connection' ? 'Testing…' : 'Test connection'}
        </button>
        {connection ? (
          <p className={`bb-int-note ${connection.ok ? 'bb-int-note--ok' : 'bb-int-note--warn'}`}>
            {connection.message}
            {connection.sampleSku ? ` (sample SKU ${connection.sampleSku})` : ''}
          </p>
        ) : null}
      </section>

      <section className="bb-int-panel">
        <h2>Search Best Buy</h2>
        <div className="bb-int-search-row">
          <input
            className="bb-int-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Example: Samsung Odyssey G7"
            aria-label="Best Buy search query"
          />
          <button type="button" className="bb-int-btn" disabled={!query.trim() || busy === 'search'} onClick={runSearch}>
            {busy === 'search' ? 'Searching…' : 'Search Best Buy'}
          </button>
          <button type="button" className="bb-int-btn bb-int-btn--secondary" disabled={!query.trim() || busy === 'compare'} onClick={runCompare}>
            {busy === 'compare' ? 'Comparing…' : 'Compare vs eBay'}
          </button>
        </div>
        {searchResult ? (
          <p className="bb-int-note">
            Results: {searchResult.total ?? searchResult.items?.length ?? 0} · Cache{' '}
            {searchResult.cache?.hit ? 'HIT' : 'MISS'}
            {searchResult.cache?.deduped ? ' (deduped)' : ''}
          </p>
        ) : null}
      </section>

      {searchResult?.items?.length ? (
        <section className="bb-int-panel">
          <h2>Normalized products</h2>
          <ul className="bb-int-grid">
            {searchResult.items.map((item) => (
              <li key={item.marketplaceListingId || item.sku} className="bb-int-card">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="bb-int-card-img" />
                ) : (
                  <div className="bb-int-card-img bb-int-card-img--placeholder">No image</div>
                )}
                <div className="bb-int-card-body">
                  <h3>{item.title}</h3>
                  <p>
                    SKU {item.sku} · {item.model || '—'}
                  </p>
                  <p>UPC: {item.upc || '—'}</p>
                  <p>
                    New: {formatMoney(item.price)} · {item.availability}
                  </p>
                  <p className="bb-int-key">Key: {item.canonicalProductKey || '—'}</p>
                  {item.openBoxOffers?.length ? (
                    <ul className="bb-int-openbox">
                      {item.openBoxOffers.map((ob) => (
                        <li key={ob.marketplaceListingId}>
                          {ob.conditionLabel}: {formatMoney(ob.price)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="bb-int-muted">No Open Box offers</p>
                  )}
                  {item.productUrl ? (
                    <a href={item.productUrl} target="_blank" rel="noreferrer" className="bb-int-link">
                      View on Best Buy
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {compareResult ? (
        <section className="bb-int-panel">
          <h2>Normalized comparison (Best Move V2 prep)</h2>
          <p className="bb-int-note">
            Anchor: {compareResult.anchor?.title || '—'} · Best Buy {compareResult.providers?.bestbuy?.status} · eBay{' '}
            {compareResult.providers?.ebay?.status}
          </p>
          <div className="bb-int-compare-table">
            <div className="bb-int-compare-row bb-int-compare-head">
              <span>Source</span>
              <span>Price</span>
              <span>Identity match</span>
            </div>
            {compareResult.bestBuy?.new?.map((row) => (
              <div key={row.marketplaceListingId} className="bb-int-compare-row">
                <span>BEST BUY NEW</span>
                <span>{formatMoney(row.price)}</span>
                <span>PASS (anchor)</span>
              </div>
            ))}
            {compareResult.bestBuy?.openBox?.map((row) => (
              <div key={row.marketplaceListingId} className="bb-int-compare-row">
                <span>BEST BUY OPEN BOX ({row.conditionLabel})</span>
                <span>{formatMoney(row.price)}</span>
                <span>PASS (anchor)</span>
              </div>
            ))}
            {compareResult.ebay?.candidates?.slice(0, 8).map((row) => (
              <div key={row.marketplaceListingId} className="bb-int-compare-row">
                <span>{row.listingType === 'ebay_auction' ? 'EBAY AUCTION' : 'EBAY BUY IT NOW'}</span>
                <span>{formatMoney(row.price)}</span>
                <span>{row.identityMatch ? 'PASS' : 'FAIL'}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
