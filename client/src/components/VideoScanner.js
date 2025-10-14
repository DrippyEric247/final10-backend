import React, { useState } from "react";
import { api } from "../lib/api";

export default function VideoScanner() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const scan = async (e) => {
    e.preventDefault();
    setError(""); setResults(null); setLoading(true);
    try {
      // backend endpoint:
      // GET /api/scanner/video?url=...
      const { data } = await api.get("/scanner/video", { params: { url } });
      // expected shape: { products: [{title,image,price,url,auctionId,platform,confidence}], framesAnalyzed }
      setResults(data);
    } catch (err) {
      console.error('Video scan error:', err);
      setError(err?.response?.data?.message || err?.message || "Video scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="feed-wrap">
      <header className="feed-header">
        <h1>AI Video Scanner</h1>
        <p className="muted">Paste a TikTok/IG/YouTube link to detect products and jump into auctions.</p>
      </header>

      <form onSubmit={scan} className="scan-form">
        <input
          className="input"
          name="videoUrl"
          id="video-url"
          type="url"
          placeholder="https://www.tiktok.com/@user/video/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button className="btn btn-primary" disabled={loading || !url}>
          {loading ? "Scanning…" : "Scan Video"}
        </button>
      </form>

      {error && <div className="feed-status error">{error}</div>}

      {results && (
        <>
          <div className="feed-status">
            Frames analyzed: {results.framesAnalyzed ?? "—"}
          </div>
          <div className="feed-grid">
            {(results.products || []).map((p, i) => (
              <article key={i} className="card">
                <div className="thumb">
                  <img src={p.image || "/placeholder.png"} alt={p.title} loading="lazy" />
                  {p.platform && <span className="chip">{p.platform}</span>}
                  {p.confidence && (
                    <span className="chip chip-score">{Math.round(p.confidence * 100)}%</span>
                  )}
                </div>
                <div className="meta">
                  <h3 className="title">{p.title}</h3>
                  <div className="row">
                    <span className="price">{p.price ? `$${p.price}` : "—"}</span>
                  </div>
                </div>
                <div className="actions">
                  {p.auctionId ? (
                    <a className="btn btn-primary" href={`/auctions/${p.auctionId}`}>Open Auction</a>
                  ) : p.url ? (
                    <a className="btn btn-primary" href={p.url} target="_blank" rel="noreferrer">Open</a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

