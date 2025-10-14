import React, { useState } from "react";

export default function CopyField({ value, label = "Share link" }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: "Join me on Final10", url: value }); }
      catch {}
    } else {
      copy();
    }
  }

  return (
    <div className="w-full flex items-center gap-2">
      <input
        readOnly
        value={value}
        aria-label={label}
        className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
      />
      <button onClick={copy} className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm">
        {copied ? "Copied!" : "Copy"}
      </button>
      <button onClick={share} className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-sm">
        Share
      </button>
    </div>
  );
}

