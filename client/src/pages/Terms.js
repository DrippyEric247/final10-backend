import React from "react";

const sectionClass = "space-y-3 text-[var(--f10-text)] leading-relaxed";
const headingClass = "text-xl font-semibold text-[var(--f10-text)] m-0";

export default function Terms() {
  return (
    <article className="mx-auto max-w-3xl py-4">
      <div className="card p-6 sm:p-8 space-y-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--f10-text-dim)] mb-2">
            Legal
          </p>
          <h1 className="text-3xl font-bold m-0 text-[var(--f10-text)]">Terms of Service</h1>
          <p className="text-sm text-[var(--f10-text-dim)] mt-2">Last updated: April 27, 2026</p>
        </header>

        <section className={sectionClass}>
          <h2 className={headingClass}>User responsibility</h2>
          <p className="m-0 text-[var(--f10-text-dim)]">
            You are responsible for your account activity, keeping your login credentials secure, and
            making independent purchase decisions when using Final10.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>No guarantee of deal accuracy</h2>
          <p className="m-0 text-[var(--f10-text-dim)]">
            Final10 provides scoring, trust signals, and recommendations for convenience, but does not
            guarantee listing accuracy, price outcomes, seller behavior, or availability.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Platform usage rules</h2>
          <p className="m-0 text-[var(--f10-text-dim)]">
            You agree not to abuse the platform, attempt unauthorized access, automate harmful traffic, or
            use Final10 for unlawful activity. We may suspend accounts that violate these rules.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Contact</h2>
          <p className="m-0 text-[var(--f10-text-dim)]">
            Terms questions:{" "}
            <a className="text-purple-300 underline hover:text-purple-200" href="mailto:support@final10.com">
              support@final10.com
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
