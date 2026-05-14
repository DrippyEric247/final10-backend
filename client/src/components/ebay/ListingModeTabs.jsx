import React from 'react';

const MODES = [
  { id: 'auction', label: 'Auctions' },
  { id: 'buy_now', label: 'Buy It Now' },
  { id: 'best_move', label: 'Best Move' },
];

export default function ListingModeTabs({ mode, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            mode === m.id
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

