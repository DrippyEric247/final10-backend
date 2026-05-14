import React from "react";

export default function Support() {
  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-200">
        <h1 className="text-3xl font-bold text-white mb-4">Support</h1>
        <p className="text-gray-300 mb-4">
          Need help with Final10? We are here to help with account, onboarding, alerts, and app issues.
        </p>
        <p className="text-gray-300">
          Contact support at{" "}
          <a className="text-purple-300 underline" href="mailto:support@final10.com">
            support@final10.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
