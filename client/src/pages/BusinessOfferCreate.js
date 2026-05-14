import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import businessOffersService from "../services/businessOffersService";

const CATEGORIES = ["electronics", "gaming", "sneakers", "fashion", "home", "auto"];
const TIERS = ["basic", "boosted", "featured"];

export default function BusinessOfferCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: "",
    logo: "",
    offerTitle: "",
    category: "electronics",
    rewardAmount: 60,
    dailyBudget: 30,
    totalBudget: 200,
    promotionTier: "basic",
  });

  const createMutation = useMutation({
    mutationFn: businessOffersService.createOffer,
    onSuccess: () => navigate("/business-offers"),
  });

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const onSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      rewardAmount: Number(form.rewardAmount),
      dailyBudget: Number(form.dailyBudget),
      totalBudget: Number(form.totalBudget),
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white pt-20">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-300 via-purple-300 to-fuchsia-300 bg-clip-text text-transparent">
          Create Savvy Offer
        </h1>
        <p className="text-gray-400 mt-2">Launch a promoted offer and reward users for engagement.</p>

        <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-purple-500/30 bg-gray-800/70 p-5 space-y-4">
          {[
            ["businessName", "Business name"],
            ["logo", "Logo URL"],
            ["offerTitle", "Offer title"],
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-sm text-gray-300">{label}</span>
              <input
                value={form[key]}
                onChange={(e) => onChange(key, e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white"
                required={key !== "logo"}
              />
            </label>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-gray-300">Category</span>
              <select
                value={form.category}
                onChange={(e) => onChange("category", e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-gray-300">Promotion tier</span>
              <select
                value={form.promotionTier}
                onChange={(e) => onChange("promotionTier", e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white"
              >
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-gray-300">Reward amount (Savvy)</span>
              <input type="number" min="0" value={form.rewardAmount} onChange={(e) => onChange("rewardAmount", e.target.value)} className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white" />
            </label>
            <label className="block">
              <span className="text-sm text-gray-300">Daily budget ($)</span>
              <input type="number" min="1" value={form.dailyBudget} onChange={(e) => onChange("dailyBudget", e.target.value)} className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm text-gray-300">Total budget ($)</span>
              <input type="number" min="1" value={form.totalBudget} onChange={(e) => onChange("totalBudget", e.target.value)} className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white" />
            </label>
          </div>

          <button type="submit" disabled={createMutation.isPending} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold hover:bg-indigo-500 disabled:opacity-60">
            {createMutation.isPending ? "Creating..." : "Launch Offer"}
          </button>
        </form>
      </div>
    </div>
  );
}

