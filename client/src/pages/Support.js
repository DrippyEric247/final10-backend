import React from "react";
import { LifeBuoy, Mail } from "lucide-react";

export default function Support() {
  return (
    <article className="mx-auto max-w-3xl py-4">
      <div className="card p-6 sm:p-8">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--f10-text-dim)] mb-2">
            Help
          </p>
          <h1 className="text-3xl font-bold m-0 text-[var(--f10-text)] flex items-center gap-3">
            <LifeBuoy className="h-8 w-8 text-purple-300" aria-hidden />
            Support
          </h1>
        </header>

        <p className="text-[var(--f10-text-dim)] leading-relaxed mb-6">
          Need help with Final10? We are here to help with account access, onboarding, alerts, and app issues.
        </p>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 flex items-start gap-4">
          <Mail className="h-5 w-5 shrink-0 text-purple-300 mt-0.5" aria-hidden />
          <div>
            <p className="font-semibold text-[var(--f10-text)] m-0 mb-1">Email us</p>
            <p className="text-[var(--f10-text-dim)] m-0">
              <a
                className="text-purple-300 underline hover:text-purple-200"
                href="mailto:support@final10.com"
              >
                support@final10.com
              </a>
            </p>
            <p className="text-sm text-[var(--f10-text-dim)] mt-2 mb-0">
              Include your account email and a short description of the issue for the fastest response.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
