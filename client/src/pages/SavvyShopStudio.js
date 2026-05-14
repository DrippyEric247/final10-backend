import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getMySavvyShop,
  saveMySavvyShop,
  addSavvyShopProduct,
  deleteSavvyShopProduct,
  reportSavvyShopSale,
  createSavvyShopPost,
} from "../lib/api";
import { emitPowerToast } from "../lib/final10PowerFeedback";
import "../styles/SavvyShop.css";

const emptyPostForm = {
  caption: "",
  imageUrl: "",
  productId: "",
  hashtags: "",
};

const emptyProduct = {
  title: "",
  dealUrl: "",
  imageUrl: "",
  currency: "USD",
  displayPrice: "",
  estimatedProfit: "",
  flipScore: "",
  whyBuy: "",
  hashtags: "",
  kind: "external_link",
};

export default function SavvyShopStudio() {
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState({
    storeName: "",
    slug: "",
    brandTagline: "",
    bio: "",
    published: false,
    badgeTopSeller: false,
    badgeTrending: false,
    defaultCommissionPct: "5",
  });
  const [productForm, setProductForm] = useState(emptyProduct);
  const [postForm, setPostForm] = useState(emptyPostForm);
  const [reportedSaleIds, setReportedSaleIds] = useState(() => new Set());
  const [creatorMonetization, setCreatorMonetization] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const d = await getMySavvyShop();
      const s = d.shop;
      const plist = d.products || [];
      if (d.creatorMonetization) setCreatorMonetization(d.creatorMonetization);
      setProducts(plist);
      setReportedSaleIds(
        new Set(
          plist
            .filter((p) => Array.isArray(p.milestonesGranted) && p.milestonesGranted.includes("sale_v1"))
            .map((p) => String(p._id))
        )
      );
      setShop(s);
      if (s) {
        setForm({
          storeName: s.storeName || "",
          slug: s.slug || "",
          brandTagline: s.brandTagline || "",
          bio: s.bio || "",
          published: Boolean(s.published),
          badgeTopSeller: (s.badges || []).includes("top_seller"),
          badgeTrending: (s.badges || []).includes("trending_creator"),
          defaultCommissionPct: String(s.defaultCommissionPct ?? 5),
        });
      }
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not load your shop.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveShop = async (e) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      const badges = [];
      if (form.badgeTopSeller) badges.push("top_seller");
      if (form.badgeTrending) badges.push("trending_creator");
      const { shop: next, creatorMonetization: cm } = await saveMySavvyShop({
        storeName: form.storeName.trim(),
        slug: form.slug.trim() || undefined,
        brandTagline: form.brandTagline.trim(),
        bio: form.bio.trim(),
        published: form.published,
        badges,
        defaultCommissionPct: Number(form.defaultCommissionPct) || 5,
      });
      setShop(next);
      if (cm) setCreatorMonetization(cm);
      setMsg("Saved. Publish when you are ready to go live.");
    } catch (e) {
      setErr(e?.response?.data?.message || "Save failed.");
    }
  };

  const addProduct = async (e) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      const payload = {
        title: productForm.title.trim(),
        dealUrl: productForm.dealUrl.trim(),
        imageUrl: productForm.imageUrl.trim() || undefined,
        currency: productForm.currency.trim() || "USD",
        displayPrice: productForm.displayPrice ? Number(productForm.displayPrice) : 0,
        estimatedProfit: productForm.estimatedProfit ? Number(productForm.estimatedProfit) : null,
        flipScore: productForm.flipScore ? Number(productForm.flipScore) : null,
        whyBuy: productForm.whyBuy.trim(),
        hashtags: productForm.hashtags,
        kind: productForm.kind === "final10_flip" ? "final10_flip" : "external_link",
      };
      const { product, rewardHints, savvyAwarded } = await addSavvyShopProduct(payload);
      setProducts((prev) => [...prev, product]);
      setProductForm(emptyProduct);
      const earned = Number(savvyAwarded);
      if (Number.isFinite(earned) && earned > 0) {
        const praise =
          Array.isArray(rewardHints) && rewardHints.length ? rewardHints.filter(Boolean).join(" · ") : null;
        emitPowerToast(earned, praise);
      }
      setMsg("Product live — quality picks and real engagement earn Savvy (daily cap on free accounts).");
      void load();
    } catch (e) {
      const code = e?.response?.data?.code;
      const m = e?.response?.data?.message;
      if (e?.response?.status === 403 && code === "SAVVY_SHOP_PRODUCT_CAP") {
        setErr(m || "Product limit reached for your plan.");
      } else {
        setErr(m || "Could not add product.");
      }
    }
  };

  const reportSale = async (productId) => {
    setMsg(null);
    setErr(null);
    try {
      const r = await reportSavvyShopSale(productId);
      if (r.locked || r.eliteRequired) {
        const line = Array.isArray(r.rewardHints) ? r.rewardHints.filter(Boolean).join(" — ") : "";
        setMsg(line || "Upgrade to Elite to unlock payouts.");
        void load();
        return;
      }
      const earned = Number(r.savvyAwarded ?? r.awarded);
      if (Number.isFinite(earned) && earned > 0) {
        const praise =
          Array.isArray(r.rewardHints) && r.rewardHints.length ? r.rewardHints.filter(Boolean).join(" · ") : null;
        emitPowerToast(earned, praise);
        setReportedSaleIds((prev) => new Set(prev).add(String(productId)));
        setMsg("Sale recorded — Savvy added for this pick.");
      } else {
        setMsg("No new Savvy for this sale (already counted or cap reached).");
      }
      void load();
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not record sale.");
    }
  };

  const addPost = async (e) => {
    e.preventDefault();
    if (!shop) return;
    setMsg(null);
    setErr(null);
    if (!postForm.productId) {
      setErr("Pick a product to attach.");
      return;
    }
    try {
      const { savvyAwarded } = await createSavvyShopPost({
        caption: postForm.caption.trim(),
        imageUrl: postForm.imageUrl.trim() || undefined,
        productId: postForm.productId,
        hashtags: postForm.hashtags,
      });
      const earned = Number(savvyAwarded);
      if (Number.isFinite(earned) && earned > 0) {
        emitPowerToast(earned, "Post live — keep it sharp, earn Savvy on engagement.");
      }
      setPostForm(emptyPostForm);
      setMsg("Post published to your public feed.");
      void load();
    } catch (ex) {
      setErr(ex?.response?.data?.message || "Could not publish post.");
    }
  };

  const removeProduct = async (id) => {
    if (!window.confirm("Remove this pick from your shop?")) return;
    setErr(null);
    try {
      await deleteSavvyShopProduct(id);
      setProducts((prev) => prev.filter((p) => String(p._id) !== String(id)));
      setMsg("Removed.");
    } catch (e) {
      setErr(e?.response?.data?.message || "Delete failed.");
    }
  };

  if (loading) {
    return (
      <div className="savvy-shop-studio">
        <p className="savvy-shop-empty">Opening your studio…</p>
      </div>
    );
  }

  const mon = creatorMonetization;
  const atProductCap =
    mon?.maxProducts != null && products.length >= mon.maxProducts;

  return (
    <div className="savvy-shop-studio">
      <h1>My Savvy Shop</h1>
      <p className="savvy-shop-studio-lead">
        Drop deals and links you believe in — no inventory, no shipping stack. You earn Savvy when you post,
        and commission rails land next. Keep it creator-first: sharp picks, honest “why buy,” clean CTAs.
      </p>
      {mon ? (
        <div className={`savvy-shop-tier-banner savvy-shop-tier-banner--${mon.band || "free"}`}>
          {mon.isElite ? (
            <p>
              <strong>Elite creator</strong> — unlimited listings, full Savvy (including sales), hashtag multipliers,
              payouts, and Savvy Shop placement.
            </p>
          ) : mon.isPaidSubscriber ? (
            <p>
              <strong>Savvy+ subscriber</strong> — up to {mon.maxProducts} products and a higher daily Savvy cap.{" "}
              {mon.copy?.upgradeEarn}{" "}
              <Link to="/premium">{mon.copy?.eliteTapIn}</Link>
            </p>
          ) : (
            <p>
              <strong>Starter storefront</strong> — up to {mon.maxProducts} products (no sale Savvy or payouts).{" "}
              {mon.copy?.upgradeStartEarning}{" "}
              <Link to="/premium">{mon.copy?.unlockStore}</Link>
            </p>
          )}
        </div>
      ) : null}

      {mon && !mon.isElite ? (
        <p className="savvy-shop-savvy-teaser" role="note">
          {mon.copy?.missedSavvy ?? "You're missing +85 Savvy Points"} on Elite-only boosts (hashtags, viral lane,
          high-Flip bonuses).
        </p>
      ) : null}

      <section className="savvy-shop-payout-panel" aria-labelledby="payout-heading">
        <h2 id="payout-heading">Earnings &amp; payouts</h2>
        {mon?.isElite ? (
          <p className="savvy-shop-payout-elite">
            Elite payout rails and withdrawals ship next — you stay first in the settlement queue.{" "}
            <span className="savvy-shop-muted">Dashboard hooks land here.</span>
          </p>
        ) : (
          <div className="savvy-shop-payout-locked">
            <p className="savvy-shop-blur-money" aria-hidden>
              ${Number(mon?.teaser?.potentialPayoutUsd ?? 120).toLocaleString()} potential
            </p>
            <p>{mon?.copy?.elitePayoutTeaser}</p>
            <p>{mon?.copy?.elitePayoutUnlock}</p>
            <Link to="/premium" className="savvy-shop-tier-cta">
              🚀 Ready to start earning for real?
            </Link>
          </div>
        )}
      </section>

      <section className="savvy-shop-analytics-preview" aria-labelledby="analytics-heading">
        <h2 id="analytics-heading">Store analytics</h2>
        <div className={mon?.isElite ? "savvy-shop-analytics-body" : "savvy-shop-analytics-body savvy-shop-analytics-blur"}>
          <div className="savvy-shop-analytics-row">
            <span>7d views</span>
            <strong>2,840</strong>
          </div>
          <div className="savvy-shop-analytics-row">
            <span>Hashtag lift</span>
            <strong>+18%</strong>
          </div>
          <div className="savvy-shop-analytics-row">
            <span>Click heat</span>
            <strong>Top 12% cohort</strong>
          </div>
        </div>
        {!mon?.isElite ? (
          <p className="savvy-shop-analytics-upsell">
            🔥 This product made creators $2,340 this week — <Link to="/premium">{mon?.copy?.eliteTapIn}</Link>
          </p>
        ) : null}
      </section>

      {msg ? (
        <p className="savvy-shop-msg savvy-shop-msg--ok" role="status">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="savvy-shop-msg savvy-shop-msg--err" role="alert">
          {err}
        </p>
      ) : null}

      <form className="savvy-shop-form" onSubmit={saveShop}>
        <label>
          Store name
          <input
            required
            minLength={2}
            value={form.storeName}
            onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
            placeholder="e.g. North Star Picks"
          />
        </label>
        <label>
          Shop URL slug (optional — auto if blank)
          <input
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder="letters-numbers-dashes"
          />
        </label>
        {shop?.slug ? (
          <p className="savvy-shop-live-url">
            Storefront: <Link to={`/shop/${shop.slug}`}>Open /shop/{shop.slug} →</Link>
          </p>
        ) : null}
        <label>
          Brand line
          <input
            value={form.brandTagline}
            onChange={(e) => setForm((f) => ({ ...f, brandTagline: e.target.value }))}
            placeholder="What you stand for in one line"
          />
        </label>
        <label>
          Bio
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder="Tell fans how you hunt deals…"
          />
        </label>
        <label>
          Default commission % (shown on storefront)
          <input
            type="number"
            min={0}
            max={50}
            value={form.defaultCommissionPct}
            onChange={(e) => setForm((f) => ({ ...f, defaultCommissionPct: e.target.value }))}
          />
        </label>
        <div className="savvy-shop-form-row">
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
            />
            Published (public storefront)
          </label>
        </div>
        <div className="savvy-shop-form-row">
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.badgeTopSeller}
              onChange={(e) => setForm((f) => ({ ...f, badgeTopSeller: e.target.checked }))}
            />
            Top Seller badge
          </label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.badgeTrending}
              onChange={(e) => setForm((f) => ({ ...f, badgeTrending: e.target.checked }))}
            />
            Trending Creator badge
          </label>
        </div>
        <button type="submit" className="savvy-shop-btn savvy-shop-btn--primary">
          Save storefront
        </button>
      </form>

      {!shop ? (
        <p style={{ margin: "16px 0", fontSize: "0.86rem", color: "#94a3b8" }}>
          Save your storefront above to open product slots — you can still preview payouts and analytics while you
          set up.
        </p>
      ) : null}

      {shop ? (
        <>
      <h2 style={{ fontSize: "1.1rem", margin: "0 0 10px", color: "#e2e8f0" }}>Add a product</h2>
      <p style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "#94a3b8" }}>
        Paste any marketplace URL or a Final10 flip-style link. You are the curator — we never hold stock.
      </p>
      {mon?.maxProducts != null ? (
        <p style={{ margin: "0 0 10px", fontSize: "0.8rem", color: "#cbd5e1" }}>
          Shelf: {products.length} / {mon.maxProducts} products
          {atProductCap ? (
            <span style={{ color: "#fca5a5", fontWeight: 800 }}> — cap reached</span>
          ) : null}
        </p>
      ) : mon?.isElite ? (
        <p style={{ margin: "0 0 10px", fontSize: "0.8rem", color: "#86efac" }}>
          Elite shelf: unlimited products
        </p>
      ) : null}
      <form className="savvy-shop-form" onSubmit={addProduct}>
        <label>
          Title
          <input
            required
            value={productForm.title}
            onChange={(e) => setProductForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label>
          Deal URL
          <input
            required
            value={productForm.dealUrl}
            onChange={(e) => setProductForm((f) => ({ ...f, dealUrl: e.target.value }))}
            placeholder="https://…"
          />
        </label>
        <label>
          Image URL (optional)
          <input
            value={productForm.imageUrl}
            onChange={(e) => setProductForm((f) => ({ ...f, imageUrl: e.target.value }))}
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            Currency
            <input
              value={productForm.currency}
              onChange={(e) => setProductForm((f) => ({ ...f, currency: e.target.value }))}
            />
          </label>
          <label>
            Price
            <input
              type="number"
              min={0}
              step={0.01}
              value={productForm.displayPrice}
              onChange={(e) => setProductForm((f) => ({ ...f, displayPrice: e.target.value }))}
            />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            Est. profit (optional)
            <input
              type="number"
              step={0.01}
              value={productForm.estimatedProfit}
              onChange={(e) => setProductForm((f) => ({ ...f, estimatedProfit: e.target.value }))}
            />
          </label>
          <label>
            Flip Score (0–10, optional)
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={productForm.flipScore}
              onChange={(e) => setProductForm((f) => ({ ...f, flipScore: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Source
          <select
            value={productForm.kind}
            onChange={(e) => setProductForm((f) => ({ ...f, kind: e.target.value }))}
            style={{ padding: 10, borderRadius: 10, background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155" }}
          >
            <option value="external_link">My link / marketplace</option>
            <option value="final10_flip">Final10-style flip (tighter Savvy estimate)</option>
          </select>
        </label>
        <label>
          Hashtags (comma or # separated)
          <input
            value={productForm.hashtags}
            onChange={(e) => setProductForm((f) => ({ ...f, hashtags: e.target.value }))}
            placeholder="sneakers, flip, under-retail"
          />
        </label>
        <label>
          Why this is a good buy
          <textarea
            value={productForm.whyBuy}
            onChange={(e) => setProductForm((f) => ({ ...f, whyBuy: e.target.value }))}
            placeholder="Your take — fast sell-through, margin, hype, whatever backs the pick."
          />
        </label>
        <button
          type="submit"
          className="savvy-shop-btn savvy-shop-btn--accent"
          disabled={atProductCap}
          title={atProductCap ? "Upgrade for more slots" : undefined}
        >
          {atProductCap ? "Shelf full — upgrade for more" : "Post product (+Savvy)"}
        </button>
      </form>

      {products.length > 0 ? (
        <>
          <h2 style={{ fontSize: "1.1rem", margin: "28px 0 10px", color: "#e2e8f0" }}>Feed post</h2>
          <p style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "#94a3b8" }}>
            Short caption + optional image. Tied to a shelf pick — drives views and shop clicks without building a
            social app.
          </p>
          <form className="savvy-shop-form" onSubmit={addPost}>
            <label>
              Attach product
              <select
                required
                value={postForm.productId}
                onChange={(e) => setPostForm((f) => ({ ...f, productId: e.target.value }))}
                style={{ padding: 10, borderRadius: 10, background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155" }}
              >
                <option value="">Select…</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Caption
              <textarea
                required
                minLength={4}
                value={postForm.caption}
                onChange={(e) => setPostForm((f) => ({ ...f, caption: e.target.value }))}
                placeholder="Why this pick is printing — tight, money-first."
              />
            </label>
            <label>
              Image URL (optional)
              <input
                value={postForm.imageUrl}
                onChange={(e) => setPostForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://…"
              />
            </label>
            <label>
              Hashtags
              <input
                value={postForm.hashtags}
                onChange={(e) => setPostForm((f) => ({ ...f, hashtags: e.target.value }))}
                placeholder="savvyfinds, sneakers"
              />
            </label>
            <button type="submit" className="savvy-shop-btn savvy-shop-btn--primary">
              Publish to feed (+Savvy)
            </button>
          </form>
        </>
      ) : null}

      <h2 style={{ fontSize: "1.1rem", margin: "24px 0 10px", color: "#e2e8f0" }}>Your shelf</h2>
      {!products.length ? (
        <p className="savvy-shop-empty">No products yet — add your first money link above.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {products.map((p) => (
            <li
              key={p._id}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(71,85,105,0.55)",
                background: "rgba(15,23,42,0.75)",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <strong style={{ color: "#f1f5f9" }}>{p.title}</strong>
                <div style={{ fontSize: "0.76rem", color: "#94a3b8", marginTop: 4 }}>{p.dealUrl}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="savvy-shop-btn savvy-shop-btn--accent"
                  disabled={reportedSaleIds.has(String(p._id))}
                  onClick={() => reportSale(p._id)}
                >
                  {reportedSaleIds.has(String(p._id)) ? "Sale logged" : "I closed a sale"}
                </button>
                <button
                  type="button"
                  className="savvy-shop-btn savvy-shop-btn--ghost"
                  onClick={() => removeProduct(p._id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
        </>
      ) : null}
    </div>
  );
}
