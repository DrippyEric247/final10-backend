import React from 'react';

export default function TimingInsightRow({ text }) {
  return (
    <div className="wsp-timing">
      <span className="wsp-timing__icon" aria-hidden>
        ⏱
      </span>
      <div>
        <div className="wsp-timing__title">Timing Signal</div>
        <p className="wsp-timing__text">{text}</p>
      </div>
    </div>
  );
}
