import React from "react";

const sectionClass = "space-y-3 text-[var(--f10-text)] leading-relaxed";
const headingClass = "text-xl font-semibold text-[var(--f10-text)] m-0";

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl py-4">
      <div className="card p-6 sm:p-8 space-y-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--f10-text-dim)] mb-2">
            Legal
          </p>
          <h1 className="text-3xl font-bold m-0 text-[var(--f10-text)]">Privacy Policy</h1>
          <p className="text-sm text-[var(--f10-text-dim)] mt-2">Last updated: April 27, 2026</p>
        </header>

        <section className={sectionClass}>
          <h2 className={headingClass}>What data we collect</h2>
          <p className="m-0 text-[var(--f10-text-dim)]">
            Final10 collects account details such as your email, username, and profile information.
            We also collect usage data such as searches, viewed listings, and alert preferences to keep
            the product working and improve recommendations.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>How we use your data</h2>
          <p className="m-0 text-[var(--f10-text-dim)]">
            We use your data to authenticate your account, deliver search and alert features, personalize
            your experience, prevent abuse, and improve app reliability and performance.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Data sharing</h2>
          <p className="m-0 text-[var(--f10-text-dim)]">
            We do not sell your personal data. We only share data with service providers necessary to run
            Final10, such as hosting, analytics, and infrastructure vendors.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Contact</h2>
          <p className="m-0 text-[var(--f10-text-dim)]">
            Privacy questions:{" "}
            <a className="text-purple-300 underline hover:text-purple-200" href="mailto:support@final10.com">
              support@final10.com
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
