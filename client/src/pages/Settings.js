import React from "react";
import { Link } from "react-router-dom";

export default function Settings() {
  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-200">
        <h1 className="text-3xl font-bold text-white mb-6">Settings</h1>
        <div className="space-y-3">
          <Link to="/privacy" className="block rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3 hover:border-purple-400">
            Privacy Policy
          </Link>
          <Link to="/terms" className="block rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3 hover:border-purple-400">
            Terms of Service
          </Link>
          <Link to="/support" className="block rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3 hover:border-purple-400">
            Support
          </Link>
          <Link to="/delete-account" className="block rounded-lg border border-red-700 bg-red-900/20 px-4 py-3 text-red-200 hover:border-red-500">
            Delete Account
          </Link>
        </div>
      </div>
    </div>
  );
}
