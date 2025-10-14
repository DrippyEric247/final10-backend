import React, { useEffect, useState } from "react";

function PointsPage() {
  const [points, setPoints] = useState(0);
  const [message, setMessage] = useState("");

  // Get token from localStorage (after login)
  const token = localStorage.getItem("f10_token");

  // Fetch user points
  const fetchPoints = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/points", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!res.ok) {
        if (res.status === 429) {
          setMessage("Too many requests. Please wait a moment.");
          return;
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setPoints(data.points);
    } catch (err) {
      console.error(err);
      setMessage("Network error. Please try again.");
    }
  };

  // Claim daily reward
  const claimDailyReward = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/points/daily-claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!res.ok) {
        if (res.status === 429) {
          setMessage("Too many requests. Please wait a moment.");
          return;
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setPoints(data.points);
      setMessage(data.message);
    } catch (err) {
      console.error(err);
      setMessage("Network error. Please try again.");
    }
  };

  // Load balance on mount
  useEffect(() => {
    fetchPoints();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-6">Savvy Points</h1>

      <p className="text-xl mb-4">Your Balance: <span className="font-mono">{points}</span></p>

      <button
        onClick={claimDailyReward}
        className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 rounded-lg shadow-lg font-semibold"
      >
        Claim Daily Reward
      </button>

      {message && <p className="mt-4 text-green-400">{message}</p>}
    </div>
  );
}

export default PointsPage;
