import React from 'react';

const Final10Logo = ({ size = 'large', showTaglines = true, className = '' }) => {
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: { fontSize: '16px' },
          mainText: { fontSize: '24px' },
          appText: { fontSize: '18px' },
          tagline: { fontSize: '8px' },
          star: { width: '12px', height: '12px' }
        };
      case 'medium':
        return {
          container: { fontSize: '20px' },
          mainText: { fontSize: '32px' },
          appText: { fontSize: '24px' },
          tagline: { fontSize: '10px' },
          star: { width: '16px', height: '16px' }
        };
      case 'large':
      default:
        return {
          container: { fontSize: '24px' },
          mainText: { fontSize: '48px' },
          appText: { fontSize: '36px' },
          tagline: { fontSize: '12px' },
          star: { width: '20px', height: '20px' }
        };
    }
  };

  const styles = getSizeStyles();

  return (
    <div 
      className={`final10-logo ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        fontFamily: 'Arial, sans-serif',
        padding: '16px 0',
        ...styles.container
      }}
    >
      {/* Top Tagline */}
      {showTaglines && (
        <div
          style={{
            position: 'absolute',
            top: '-8px',
            right: '20px',
            color: 'white',
            fontSize: styles.tagline.fontSize,
            fontWeight: '300',
            letterSpacing: '1px',
            transform: 'rotate(5deg)',
            opacity: 0.8
          }}
        >
          WHERE WINNERS SHOP
        </div>
      )}

      {/* Main Logo Text */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* FINAL10 */}
        <div
          style={{
            color: 'white',
            fontSize: styles.mainText.fontSize,
            fontWeight: '900',
            fontStyle: 'italic',
            letterSpacing: '2px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            marginBottom: '-8px'
          }}
        >
          FINAL10
        </div>

        {/* APP with Star */}
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          <div
            style={{
              color: '#FFD700', // Bright yellow
              fontSize: styles.appText.fontSize,
              fontWeight: '900',
              fontStyle: 'italic',
              letterSpacing: '1px',
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
              marginLeft: '8px' // Slight indent
            }}
          >
            APP
          </div>
          
          {/* Star */}
          <div
            style={{
              marginLeft: '8px',
              color: '#FFD700',
              fontSize: styles.star.width,
              lineHeight: 1
            }}
          >
            ⭐
          </div>
        </div>
      </div>

      {/* Bottom Tagline */}
      {showTaglines && (
        <div
          style={{
            marginTop: '12px',
            color: 'white',
            fontSize: styles.tagline.fontSize,
            fontWeight: '300',
            letterSpacing: '1px',
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          LOCK IN EXCLUSIVE DEALS
          <span style={{ fontSize: '8px', opacity: 0.6 }}>TM</span>
        </div>
      )}
    </div>
  );
};

export default Final10Logo;

