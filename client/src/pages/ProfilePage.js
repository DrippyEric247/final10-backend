import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth(); // assuming you store logged-in user in context

  if (!user) return <p>Please log in</p>;

  const referralLink = `${window.location.origin}/register?ref=${user.id}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    alert("Referral link copied!");
  };

  return (
    <div>
      <h1>Welcome, {user.username}</h1>

      <div style={{ marginTop: '20px' }}>
        <h3>Your Referral Link</h3>
        <input
          type="text"
          value={referralLink}
          readOnly
          style={{ width: '80%' }}
        />
        <button onClick={copyToClipboard}>Copy</button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <p>Share this link with friends. You’ll earn rewards when they sign up!</p>
      </div>
    </div>
  );
}



