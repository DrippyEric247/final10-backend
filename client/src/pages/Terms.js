import React from "react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-200">
        <h1 className="text-3xl font-bold text-white mb-4">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-6">Last updated: April 27, 2026</p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">User responsibility</h2>
          <p>
            You are responsible for your account activity, keeping your login credentials secure, and
            making independent purchase decisions when using Final10.
          </p>
        </section>

        <section className="space-y-4 mt-8">
          <h2 className="text-xl font-semibold text-white">No guarantee of deal accuracy</h2>
          <p>
            Final10 provides scoring, trust signals, and recommendations for convenience, but does not
            guarantee listing accuracy, price outcomes, seller behavior, or availability.
          </p>
        </section>

        <section className="space-y-4 mt-8">
          <h2 className="text-xl font-semibold text-white">Platform usage rules</h2>
          <p>
            You agree not to abuse the platform, attempt unauthorized access, automate harmful traffic, or
            use Final10 for unlawful activity. We may suspend accounts that violate these rules.
          </p>
        </section>

        <section className="space-y-4 mt-8">
          <h2 className="text-xl font-semibold text-white">Contact</h2>
          <p>
            Terms questions: <a className="text-purple-300 underline" href="mailto:support@final10.com">support@final10.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}
