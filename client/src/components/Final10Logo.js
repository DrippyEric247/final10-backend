import React from 'react';
import SavvyMark from './SavvyMark';
import { SAVVY_UNIVERSE_LABEL } from '../config/final10Branding';

const Final10Logo = ({ size = 'large', showTaglines = true, className = '' }) => {
  const px = size === 'small' ? 20 : size === 'medium' ? 28 : 36;
  const tagPx = size === 'small' ? 8 : size === 'medium' ? 10 : 12;

  return (
    <div
      className={`final10-logo ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '10px 0',
      }}
    >
      {showTaglines ? (
        <div style={{ color: '#94a3b8', fontSize: tagPx, letterSpacing: '0.08em' }}>
          {SAVVY_UNIVERSE_LABEL.toUpperCase()}
        </div>
      ) : null}
      <SavvyMark variant="product" appName="Final10" size={px} glow animated={size !== 'small'} />
    </div>
  );
};

export default Final10Logo;
