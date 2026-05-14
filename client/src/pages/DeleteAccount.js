import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteMyAccount } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function DeleteAccount() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canDelete = confirmText.trim().toUpperCase() === "DELETE";

  async function onDelete() {
    if (!canDelete || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      await deleteMyAccount({ confirmation: confirmText.trim() });
      logout();
      navigate("/register", { replace: true });
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to delete account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-200">
        <h1 className="text-3xl font-bold text-white mb-4">Delete Account</h1>
        <p className="text-gray-300 mb-4">
          Deleting your account permanently removes your user profile and related account data from Final10.
          This action cannot be undone.
        </p>
        <p className="text-gray-300 mb-3">Type <strong>DELETE</strong> to confirm.</p>
        <input
          className="w-full p-3 rounded bg-gray-800 border border-gray-700 mb-3"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type DELETE"
        />
        {error ? <p className="text-red-400 mb-3">{error}</p> : null}
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete || submitting}
          className="px-5 py-3 rounded bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed font-semibold"
        >
          {submitting ? "Deleting..." : "Permanently Delete Account"}
        </button>
      </div>
    </div>
  );
}
