import React from "react";
import { Link } from "react-router-dom";
import { FileText, LifeBuoy, Shield, Trash2, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Final10Slogan from "../components/branding/Final10Slogan";

const linkClass =
  "flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 no-underline transition-colors hover:border-purple-400/50 hover:bg-white/[0.05]";
const linkLabelClass = "font-semibold text-[var(--f10-text)]";
const linkHintClass = "text-sm text-[var(--f10-text-dim)]";

export default function Settings() {
  const { user } = useAuth() || {};

  return (
    <article className="mx-auto max-w-3xl py-4">
      <div className="card p-6 sm:p-8">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--f10-text-dim)] mb-2">
            Account
          </p>
          <h1 className="text-3xl font-bold m-0 text-[var(--f10-text)]">Account &amp; legal</h1>
          <p className="mt-2 text-[var(--f10-text-dim)]">
            Policies, support, and account actions for your Final10 profile.
          </p>
          <Final10Slogan variant="empty" as="p" className="mt-3" />
        </header>

        {user ? (
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--f10-text-dim)] mb-3">
              Your account
            </h2>
            <Link to="/profile" className={linkClass}>
              <User className="h-5 w-5 shrink-0 text-purple-300" aria-hidden />
              <span>
                <span className={linkLabelClass}>Profile &amp; Savvy wallet</span>
                <span className={`block ${linkHintClass}`}>Rewards, customization, and membership</span>
              </span>
            </Link>
          </section>
        ) : null}

        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--f10-text-dim)] mb-3">
            Legal &amp; support
          </h2>
          <div className="space-y-3">
            <Link to="/privacy" className={linkClass}>
              <Shield className="h-5 w-5 shrink-0 text-purple-300" aria-hidden />
              <span>
                <span className={linkLabelClass}>Privacy Policy</span>
                <span className={`block ${linkHintClass}`}>How we handle your data</span>
              </span>
            </Link>
            <Link to="/terms" className={linkClass}>
              <FileText className="h-5 w-5 shrink-0 text-purple-300" aria-hidden />
              <span>
                <span className={linkLabelClass}>Terms of Service</span>
                <span className={`block ${linkHintClass}`}>Platform rules and responsibilities</span>
              </span>
            </Link>
            <Link to="/support" className={linkClass}>
              <LifeBuoy className="h-5 w-5 shrink-0 text-purple-300" aria-hidden />
              <span>
                <span className={linkLabelClass}>Support</span>
                <span className={`block ${linkHintClass}`}>Get help with your account</span>
              </span>
            </Link>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-red-300/80 mb-3">
            Danger zone
          </h2>
          <Link
            to="/delete-account"
            className="flex items-center gap-3 rounded-xl border border-red-500/35 bg-red-950/25 px-4 py-3 no-underline transition-colors hover:border-red-400/60 hover:bg-red-950/40"
          >
            <Trash2 className="h-5 w-5 shrink-0 text-red-300" aria-hidden />
            <span>
              <span className="font-semibold text-red-100">Delete account</span>
              <span className="block text-sm text-red-200/70">Permanently remove your profile and data</span>
            </span>
          </Link>
        </section>
      </div>
    </article>
  );
}
