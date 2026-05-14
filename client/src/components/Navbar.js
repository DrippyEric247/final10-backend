// client/src/components/Navbar.js
import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const link = "px-3 py-2 rounded hover:opacity-80 transition";
  const active = ({ isActive }) => (isActive ? "font-semibold underline " : "") + link;

  return (
    <nav className="flex items-center justify-between px-6 py-3 bg-gray-950/50 backdrop-blur">
      <Link to="/" className="text-xl font-bold">Final10</Link>
      <div className="flex gap-4 items-center">
        <NavLink to="/profile#savvy-balance" className={active}>Savvy Balance</NavLink>
        {!user ? (
          <>
            <Link to="/login" className={link}>Login</Link>
            <Link to="/register" className="px-4 py-2 rounded bg-gradient-to-tr from-pink-500 to-yellow-400 text-black font-semibold">
              Sign Up
            </Link>
          </>
        ) : (
          <>
            <span className="text-sm text-gray-300">Hi, {user.username || user.email}</span>
            <button
              type="button"
              disabled={loggingOut}
              aria-busy={loggingOut}
              onClick={() => {
                if (loggingOut) return;
                setLoggingOut(true);
                logout();
                nav('/');
              }}
              className="px-3 py-2 rounded border border-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loggingOut ? 'Logging out…' : 'Logout'}
            </button>
          </>
        )}
      </div>
    </nav>
  );
}


