import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DonationSuccessModal from '../components/home/DonationSuccessModal';
import '../styles/HomeLanding.css';

/**
 * Donation success preview — ?preview=1 only until payment webhooks exist.
 * Real payment callbacks will route here after hosted checkout confirmation.
 */
export default function DonationSuccessPreview() {
  const [params] = useSearchParams();
  const preview = params.get('preview') === '1';

  if (preview) {
    return <DonationSuccessModal asPage />;
  }

  return (
    <div className="home-donation-success-page-fallback">
      <h1>Thank you for your support!</h1>
      <p>If you completed a donation, your rewards will appear once payment confirmation is live.</p>
      <Link to="/" className="home-cta home-cta--primary">Back to Home</Link>
    </div>
  );
}
