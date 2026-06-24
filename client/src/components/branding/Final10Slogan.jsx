import React from 'react';
import { FINAL10_OFFICIAL_SLOGAN } from '../../config/final10Branding';
import '../../styles/final10Branding.css';

/**
 * Official Final10 / Savvy Universe slogan — exact copy, premium variants.
 * @param {{ variant?: 'auth'|'hero'|'section'|'calendar'|'footer'|'toast'|'banner'|'empty'|'inline', className?: string, as?: keyof JSX.IntrinsicElements }} props
 */
export default function Final10Slogan({
  variant = 'section',
  className = '',
  as: Tag = 'p',
}) {
  return (
    <Tag className={`f10-slogan f10-slogan--${variant} ${className}`.trim()}>
      {FINAL10_OFFICIAL_SLOGAN}
    </Tag>
  );
}
