import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getCreatorCurated,
  getCreatorProfile,
} from "../lib/api";
import RecommendedByCreatorTag from "../components/listings/RecommendedByCreatorTag";
import ListingCardImage from "../components/listings/ListingCardImage";
import "../styles/CreatorLanding.css";

type CreatorProfile = {
  handle: string;
  firstName: string | null;
  lastName: string | null;
  followers: number;
  referredUsers: number;
};

type CuratedItem = {
  _id: string;
  title?: string;
  imageUrl?: string;
  currentBid?: number;
  endTime?: string;
  recommendedBy?: string;
};

/**
 * Public-facing creator landing page mounted at /c/:handle.
 *
 * The deep link is also captured by lib/attribution on App load so anything
 * the visitor does next (signup, action) is attributed to this creator.
 */
export default function CreatorLanding() {
  const { handle } = useParams<{ handle: string }>();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [curated, setCurated] = useState<CuratedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getCreatorProfile(handle), getCreatorCurated(handle)])
      .then(([p, c]) => {
        if (cancelled) return;
        setProfile(p);
        setCurated(Array.isArray(c?.curated) ? c.curated : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || err?.message || "Could not load creator");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (loading) {
    return <div className="creator-landing-loading">Loading @{handle}…</div>;
  }
  if (error || !profile) {
    return (
      <div className="creator-landing-error">
        Couldn't load this creator. <Link to="/">Go home</Link>
      </div>
    );
  }

  return (
    <div className="creator-landing">
      <header className="creator-landing-header">
        <div className="creator-landing-handle">@{profile.handle}</div>
        <div className="creator-landing-name">
          {[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Creator"}
        </div>
        <div className="creator-landing-stats">
          <span><strong>{profile.followers.toLocaleString()}</strong> followers</span>
          <span><strong>{profile.referredUsers.toLocaleString()}</strong> joined through them</span>
        </div>
        <div className="creator-landing-cta">
          <Link to="/register" className="btn btn-primary">
            Join through @{profile.handle}
          </Link>
          <Link to="/auctions" className="btn btn-ghost">
            See the Best Move
          </Link>
        </div>
      </header>

      <section className="creator-landing-section">
        <div className="creator-landing-section-title">Curated by @{profile.handle}</div>
        {curated.length === 0 ? (
          <div className="creator-landing-empty">
            No curated picks yet — check back soon.
          </div>
        ) : (
          <div className="creator-landing-grid">
            {curated.map((item) => (
              <article key={item._id} className="creator-landing-card">
                {item.imageUrl ? (
                  <ListingCardImage
                    item={item}
                    alt={item.title || "Listing"}
                    aspectRatio="1 / 1"
                    borderRadius="12px"
                  />
                ) : (
                  <div className="creator-landing-card-placeholder">🏷️</div>
                )}
                <div className="creator-landing-card-meta">
                  <div className="creator-landing-card-title">{item.title || "Listing"}</div>
                  <div className="creator-landing-card-price">
                    {typeof item.currentBid === "number" ? `$${item.currentBid.toLocaleString()}` : "—"}
                  </div>
                  <RecommendedByCreatorTag creatorHandle={profile.handle} compact />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
