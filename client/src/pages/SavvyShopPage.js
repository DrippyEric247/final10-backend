import React, { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  getSavvyShopPublic,
  postSavvyShopEngage,
  getSavvyShopPosts,
  postSavvyShopPostEngage,
} from "../lib/api";
import FollowButton from "../components/social/FollowButton";
import { useAuth } from "../context/AuthContext";
import { emitPowerToast } from "../lib/final10PowerFeedback";
import LoadingState from "../components/ui/states/LoadingState";
import EmptyState from "../components/ui/states/EmptyState";
import ErrorState from "../components/ui/states/ErrorState";
import "../styles/SavvyShop.css";

function getShopEngageFp() {
  try {
    let fp = sessionStorage.getItem("f10_shop_fp");
    if (!fp) {
      fp = `fp_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      sessionStorage.setItem("f10_shop_fp", fp);
    }
    return fp;
  } catch {
    return "";
  }
}

function toastEngageRewards(res) {
  const n = Number(res?.rewards);
  if (!Number.isFinite(n) || n <= 0) return;
  const hints = Array.isArray(res?.hints) ? res.hints.filter(Boolean) : [];
  const praise = hints.length ? hints.join(" · ") : null;
  emitPowerToast(n, praise);
}

function formatMoney(currency, n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(x);
  } catch {
    return `${currency} ${Math.round(x)}`;
  }
}

const BADGE_LABEL = {
  top_seller: "Top Seller",
  trending_creator: "Trending Creator",
};

export default function SavvyShopPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth() || {};
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("store");
  const [feedSort, setFeedSort] = useState("new");
  const [feedPosts, setFeedPosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedErr, setFeedErr] = useState(null);
  const [feedRetry, setFeedRetry] = useState(0);
  const viewedProductIdsRef = useRef(new Set());
  const viewedPostIdsRef = useRef(new Set());

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setErr(null);
    getSavvyShopPublic(slug)
      .then((d) => {
        if (!cancel) setData(d);
      })
      .catch((e) => {
        if (!cancel) setErr(e?.response?.data?.message || "Shop not found.");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug || !data?.products?.length) return;
    const fp = getShopEngageFp();
    const camp =
      searchParams.get("camp") ||
      searchParams.get("campaign") ||
      searchParams.get("campaignHashtag") ||
      "";
    const campaignHashtag = camp ? String(camp) : undefined;

    for (const p of data.products) {
      const id = p.id;
      if (!id) continue;
      const sid = String(id);
      if (viewedProductIdsRef.current.has(sid)) continue;
      viewedProductIdsRef.current.add(sid);
      void postSavvyShopEngage(slug, id, { type: "view", fp, campaignHashtag }).then(toastEngageRewards);
    }
  }, [slug, data, searchParams]);

  useEffect(() => {
    if (!slug || tab !== "feed") return;
    let cancel = false;
    setFeedLoading(true);
    setFeedErr(null);
    getSavvyShopPosts(slug, { sort: feedSort })
      .then((d) => {
        if (!cancel) setFeedPosts(Array.isArray(d?.posts) ? d.posts : []);
      })
      .catch(() => {
        if (!cancel) {
          setFeedPosts([]);
          setFeedErr("Could not load posts.");
        }
      })
      .finally(() => {
        if (!cancel) setFeedLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [slug, tab, feedSort, feedRetry]);

  useEffect(() => {
    if (!slug || tab !== "feed" || !feedPosts?.length) return;
    const fp = getShopEngageFp();
    for (const post of feedPosts) {
      const id = post.id;
      if (!id) continue;
      const sid = String(id);
      if (viewedPostIdsRef.current.has(sid)) continue;
      viewedPostIdsRef.current.add(sid);
      void postSavvyShopPostEngage(slug, id, { type: "view", fp }).then(toastEngageRewards);
    }
  }, [slug, tab, feedPosts]);

  if (loading) {
    return (
      <div className="savvy-shop-page">
        <LoadingState label="Loading storefront…" className="savvy-shop-state" />
      </div>
    );
  }

  if (err || !data?.shop) {
    return (
      <div className="savvy-shop-page">
        <ErrorState
          className="savvy-shop-state"
          title="Shop unavailable"
          description={err || "This shop is not available."}
          action={
            <Link to="/" className="btn btn-primary">
              Back home
            </Link>
          }
        />
      </div>
    );
  }

  const { shop, products, creatorStats } = data;
  const ownerId = shop.owner?.id ? String(shop.owner.id) : "";
  const isSelf = user && ownerId && String(user.id) === ownerId;

  const campaignHashtagForEngage = (() => {
    const camp =
      searchParams.get("camp") ||
      searchParams.get("campaign") ||
      searchParams.get("campaignHashtag") ||
      "";
    return camp ? String(camp) : undefined;
  })();

  const sendProductEngage = (productId, type) => {
    const fp = getShopEngageFp();
    void postSavvyShopEngage(slug, productId, {
      type,
      fp,
      campaignHashtag: campaignHashtagForEngage,
    }).then(toastEngageRewards);
  };

  const sendPostEngage = (postId, type) => {
    const fp = getShopEngageFp();
    void postSavvyShopPostEngage(slug, postId, { type, fp }).then((res) => {
      toastEngageRewards(res);
      if (res?.counted && res?.engagement) {
        setFeedPosts((prev) =>
          prev.map((p) => (String(p.id) === String(postId) ? { ...p, engagement: res.engagement } : p))
        );
      }
    });
  };

  const openProductFromPost = (post, engageType = "shop") => {
    const pid = post.product?.id;
    if (!pid || !post.product?.dealUrl) return;
    const fp = getShopEngageFp();
    void postSavvyShopPostEngage(slug, post.id, { type: engageType, fp }).then(toastEngageRewards);
    void postSavvyShopEngage(slug, pid, {
      type: "click",
      fp,
      campaignHashtag: campaignHashtagForEngage,
    }).then(toastEngageRewards);
    window.open(post.product.dealUrl, "_blank", "noopener,noreferrer");
  };
  const displayName =
    [shop.owner?.firstName, shop.owner?.lastName].filter(Boolean).join(" ").trim() ||
    shop.owner?.username ||
    "Creator";

  return (
    <div className="savvy-shop-page">
      <header className="savvy-shop-hero">
        <div className="savvy-shop-brand">
          <p style={{ margin: "0 0 4px", fontSize: "0.72rem", color: "#94a3b8", fontWeight: 800 }}>
            Savvy Shop
            {shop.creatorAccessBand === "elite" ? (
              <span className="savvy-shop-elite-chip" title="Elite creator — full payouts & Savvy">
                Elite
              </span>
            ) : null}
          </p>
          <h1>{shop.storeName}</h1>
          {shop.brandTagline ? <p className="savvy-shop-tagline">{shop.brandTagline}</p> : null}
          {shop.bio ? <p className="savvy-shop-bio">{shop.bio}</p> : null}
        </div>
        <div className="savvy-shop-meta">
          <div className="savvy-shop-savvy-pill">
            {Number(shop.owner?.savvyPoints || 0).toLocaleString()} Savvy Points (creator)
          </div>
          <div className="savvy-shop-savvy-pill" style={{ borderColor: "rgba(129,140,248,0.35)", color: "#c4b5fd" }}>
            +{Number(shop.totalShopSavvyEarned || 0).toLocaleString()} Savvy from this shop
          </div>
          <p className="savvy-shop-earn-note">
            {shop.defaultCommissionPct}% commission on qualified sales — you move money, we connect the
            deal. Inventory-free.
          </p>
          {shop.shopConversion ? (
            <div className="savvy-shop-conversion-strip" role="note">
              <span className="savvy-shop-conversion-strip-line">{shop.shopConversion.headline}</span>
              <span className="savvy-shop-conversion-strip-sub">{shop.shopConversion.sub}</span>
            </div>
          ) : null}
          <div className="savvy-shop-badges">
            {(shop.badges || []).map((b) => (
              <span key={b} className="savvy-shop-badge">
                {BADGE_LABEL[b] || b}
              </span>
            ))}
          </div>
          <div className="savvy-shop-follow-row">
            <span className="savvy-shop-followers">
              {Number(shop.followers || 0).toLocaleString()} followers
            </span>
            {user && ownerId && !isSelf ? (
              <FollowButton targetUserId={ownerId} size="sm" />
            ) : null}
            {isSelf ? (
              <Link to="/savvy-shop/studio" className="savvy-shop-btn savvy-shop-btn--ghost">
                Edit shop
              </Link>
            ) : null}
          </div>
          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>@{shop.owner?.username}</span>
        </div>
      </header>

      {creatorStats ? (
        <section className="savvy-shop-profile-stats" aria-label="Creator stats">
          <div className="savvy-shop-profile-stat">
            <span className="savvy-shop-profile-stat-label">Sales logged</span>
            <strong>{Number(creatorStats.totalSalesReported || 0).toLocaleString()}</strong>
          </div>
          <div className="savvy-shop-profile-stat">
            <span className="savvy-shop-profile-stat-label">Savvy Points</span>
            <strong>{Number(creatorStats.totalSavvyPoints || 0).toLocaleString()}</strong>
          </div>
          <div className="savvy-shop-profile-stat">
            <span className="savvy-shop-profile-stat-label">Posts</span>
            <strong>{Number(creatorStats.contentPostCount || 0).toLocaleString()}</strong>
          </div>
          {creatorStats.topProduct ? (
            <div className="savvy-shop-profile-stat savvy-shop-profile-stat--wide">
              <span className="savvy-shop-profile-stat-label">Top pick</span>
              <strong className="savvy-shop-profile-top-title">{creatorStats.topProduct.title}</strong>
              {creatorStats.topProduct.flipScore != null ? (
                <span className="savvy-shop-profile-top-flip">
                  Flip {Number(creatorStats.topProduct.flipScore).toFixed(1)}
                </span>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="savvy-shop-tabs" role="tablist" aria-label="Shop sections">
        <button
          type="button"
          className={`savvy-shop-tab ${tab === "store" ? "savvy-shop-tab--active" : ""}`}
          role="tab"
          aria-selected={tab === "store"}
          onClick={() => setTab("store")}
        >
          Store
        </button>
        <button
          type="button"
          className={`savvy-shop-tab ${tab === "feed" ? "savvy-shop-tab--active" : ""}`}
          role="tab"
          aria-selected={tab === "feed"}
          onClick={() => setTab("feed")}
        >
          Feed
        </button>
      </div>

      {tab === "feed" ? (
        <div className="savvy-shop-feed">
          <div className="savvy-shop-feed-toolbar">
            <label className="savvy-shop-feed-sort">
              <span>Sort</span>
              <select value={feedSort} onChange={(e) => setFeedSort(e.target.value)}>
                <option value="trending">Trending</option>
                <option value="new">New</option>
                <option value="flip">High Flip Score</option>
              </select>
            </label>
          </div>
          {feedLoading ? (
            <LoadingState variant="inline" label="Loading picks…" className="savvy-shop-state savvy-shop-state--inline" />
          ) : null}
          {feedErr ? (
            <ErrorState
              className="savvy-shop-state savvy-shop-state--inline"
              title="Couldn't load posts"
              description={feedErr}
              onRetry={() => setFeedRetry((n) => n + 1)}
            />
          ) : null}
          {!feedLoading && !feedErr && !feedPosts?.length ? (
            <EmptyState
              className="savvy-shop-state savvy-shop-state--inline"
              title="No posts yet"
              description="This creator is building the money lane — check back soon."
            />
          ) : null}
          <div className="savvy-shop-feed-list">
            {feedPosts.map((post) => {
              const eng = post.engagement || {};
              const creatorLabel =
                [post.creator?.firstName, post.creator?.lastName].filter(Boolean).join(" ").trim() ||
                post.creator?.username ||
                "Creator";
              return (
                <article key={post.id} className="savvy-shop-post-card">
                  <header className="savvy-shop-post-head">
                    <div className="savvy-shop-post-creator">
                      <span className="savvy-shop-post-creator-name">{creatorLabel}</span>
                      <span className="savvy-shop-post-handle">@{post.creator?.username}</span>
                    </div>
                    <span className="savvy-shop-post-meta">
                      {Number(eng.viewCount || 0).toLocaleString()} views · {Number(eng.likeCount || 0).toLocaleString()}{" "}
                      likes · {Number(eng.saveCount || 0).toLocaleString()} saves
                    </span>
                  </header>
                  {post.imageUrl ? (
                    <img className="savvy-shop-post-img" src={post.imageUrl} alt="" loading="lazy" />
                  ) : null}
                  <p className="savvy-shop-post-caption">{post.caption}</p>
                  {post.hashtags?.length ? (
                    <div className="savvy-shop-tags savvy-shop-post-tags">
                      {post.hashtags.map((t) => (
                        <span key={t} className="savvy-shop-tag">
                          #{t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {post.product ? (
                    <div className="savvy-shop-post-product">
                      {post.product.imageUrl ? (
                        <img src={post.product.imageUrl} alt="" className="savvy-shop-post-product-img" />
                      ) : (
                        <div className="savvy-shop-post-product-img savvy-shop-post-product-img--ph" aria-hidden />
                      )}
                      <div>
                        <p className="savvy-shop-post-product-title">{post.product.title}</p>
                        <p className="savvy-shop-post-product-price">
                          {formatMoney(post.product.currency, post.product.displayPrice)}
                          {post.product.flipScore != null ? (
                            <span className="savvy-shop-post-flip">
                              {" "}
                              · Flip {Number(post.product.flipScore).toFixed(1)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  <div className="savvy-shop-post-actions">
                    <button
                      type="button"
                      className="savvy-shop-btn savvy-shop-btn--ghost"
                      onClick={() => openProductFromPost(post, "shop")}
                    >
                      View product
                    </button>
                    <button
                      type="button"
                      className="savvy-shop-btn savvy-shop-btn--primary"
                      onClick={() => openProductFromPost(post, "shop")}
                    >
                      Shop now
                    </button>
                    <button
                      type="button"
                      className="savvy-shop-btn savvy-shop-btn--ghost"
                      onClick={() => sendPostEngage(post.id, "like")}
                    >
                      Like
                    </button>
                    <button
                      type="button"
                      className="savvy-shop-btn savvy-shop-btn--ghost"
                      onClick={() => sendPostEngage(post.id, "save")}
                    >
                      Save
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : !products?.length ? (
        <EmptyState
          className="savvy-shop-state"
          title="Fresh picks on the way"
          description="This storefront is still stocking up — check back soon."
        />
      ) : (
        <div className="savvy-shop-grid">
          {products.map((p) => (
            <article key={p.id} className="savvy-shop-card">
              {p.imageUrl ? (
                <img className="savvy-shop-card-img" src={p.imageUrl} alt="" loading="lazy" />
              ) : (
                <div className="savvy-shop-card-img" aria-hidden />
              )}
              <div className="savvy-shop-card-body">
                <h2 className="savvy-shop-card-title">{p.title}</h2>
                {p.subtitle ? <p className="savvy-shop-card-sub">{p.subtitle}</p> : null}
                <div className="savvy-shop-metrics">
                  <span>
                    Price: <strong>{formatMoney(p.currency, p.displayPrice)}</strong>
                  </span>
                  {p.estimatedProfit != null && Number.isFinite(p.estimatedProfit) ? (
                    <span>
                      Est. profit: <strong>+{formatMoney(p.currency, p.estimatedProfit)}</strong>
                    </span>
                  ) : null}
                  {p.flipScore != null ? (
                    <span>
                      Flip Score: <strong>{Number(p.flipScore).toFixed(1)}</strong>
                    </span>
                  ) : null}
                  {p.savvyPotentialEstimate != null ? (
                    <span>
                      Savvy upside: <strong>up to +{p.savvyPotentialEstimate}</strong>
                    </span>
                  ) : null}
                  {p.engagement ? (
                    <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                      {Number(p.engagement.viewCount || 0).toLocaleString()} views ·{" "}
                      {Number(p.engagement.clickCount || 0).toLocaleString()} clicks ·{" "}
                      {Number(p.engagement.saveCount || 0).toLocaleString()} saves
                    </span>
                  ) : null}
                </div>
                {p.hashtags?.length ? (
                  <div className="savvy-shop-tags">
                    {p.hashtags.map((t) => (
                      <span key={t} className="savvy-shop-tag">
                        #{t}
                      </span>
                    ))}
                  </div>
                ) : null}
                {p.whyBuy ? (
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "#94a3b8", fontWeight: 800 }}>
                      Why this is a good buy
                    </p>
                    <p className="savvy-shop-why">{p.whyBuy}</p>
                  </div>
                ) : null}
                {p.videoUrl ? (
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b" }}>
                    Short video: coming soon — link saved for your next drop.
                  </p>
                ) : null}
                <div className="savvy-shop-cta-row">
                  <a
                    className="savvy-shop-btn savvy-shop-btn--primary"
                    href={p.dealUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => sendProductEngage(p.id, "click")}
                  >
                    Shop this item
                  </a>
                  <a
                    className="savvy-shop-btn savvy-shop-btn--ghost"
                    href={p.dealUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => sendProductEngage(p.id, "click")}
                  >
                    View deal
                  </a>
                  <button
                    type="button"
                    className="savvy-shop-btn savvy-shop-btn--ghost"
                    onClick={() => sendProductEngage(p.id, "save")}
                  >
                    Save pick
                  </button>
                  <Link className="savvy-shop-btn savvy-shop-btn--accent" to="/seller-trends">
                    Earn with this
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p style={{ marginTop: 28, fontSize: "0.76rem", color: "#64748b", textAlign: "center" }}>
        Curated by {displayName}. Final10 routes you to live asks — you ship the hustle, not the boxes.
      </p>
    </div>
  );
}
