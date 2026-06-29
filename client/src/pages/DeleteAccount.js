import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { deleteMyAccount } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ErrorState from "../components/ui/states/ErrorState";

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
    <article className="mx-auto max-w-2xl py-4">
      <div className="card p-6 sm:p-8">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-300/80 mb-2">
            Danger zone
          </p>
          <h1 className="text-3xl font-bold m-0 text-[var(--f10-text)] flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-400" aria-hidden />
            Delete account
          </h1>
        </header>

        <p className="text-[var(--f10-text-dim)] leading-relaxed mb-4">
          Deleting your account permanently removes your user profile and related account data from Final10.
          This action cannot be undone.
        </p>

        <label htmlFor="delete-confirm" className="block text-sm font-medium text-[var(--f10-text)] mb-2">
          Type <strong>DELETE</strong> to confirm
        </label>
        <input
          id="delete-confirm"
          className="input mb-4"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type DELETE"
          autoComplete="off"
        />

        {error ? (
          <ErrorState
            className="mb-4 f10-state--inline"
            title="Could not delete account"
            description={error}
          />
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete || submitting}
            className="btn disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(90deg, #dc2626, #b91c1c)",
              color: "#fff",
            }}
          >
            {submitting ? "Deleting…" : "Permanently delete account"}
          </button>
          <Link to="/settings" className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </div>
    </article>
  );
}
