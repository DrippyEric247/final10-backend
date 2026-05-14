import React from "react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-200">
        <h1 className="text-3xl font-bold text-white mb-4">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-6">Last updated: April 27, 2026</p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">What data we collect</h2>
          <p>
            Final10 collects account details such as your email, username, and profile information.
            We also collect usage data such as searches, viewed listings, and alert preferences to keep
            the product working and improve recommendations.
          </p>
        </section>

        <section className="space-y-4 mt-8">
          <h2 className="text-xl font-semibold text-white">How we use your data</h2>
          <p>
            We use your data to authenticate your account, deliver search and alert features, personalize
            your experience, prevent abuse, and improve app reliability and performance.
          </p>
        </section>

        <section className="space-y-4 mt-8">
          <h2 className="text-xl font-semibold text-white">Data sharing</h2>
          <p>
            We do not sell your personal data. We only share data with service providers necessary to run
            Final10, such as hosting, analytics, and infrastructure vendors.
          </p>
        </section>

        <section className="space-y-4 mt-8">
          <h2 className="text-xl font-semibold text-white">Contact</h2>
          <p>
            Privacy questions: <a className="text-purple-300 underline" href="mailto:support@final10.com">support@final10.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}
