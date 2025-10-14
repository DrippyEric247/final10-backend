import ProductFeed from './pages/ProductFeed';
import Trending from './pages/Trending';
import VideoScanner from './components/VideoScanner';
import Navigation from './components/Navigation';
import AuthDebugger from './components/AuthDebugger';
import Final10Logo from './components/Final10Logo';
import './styles/ProductFeed.css';
import './styles/browser-compatibility.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from "react";
import { Routes, Route, Link, NavLink, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

/* Pages (use real ones as you build them) */
import PointsPage from "./pages/PointsPage";      // protected
import Dashboard from "./pages/Dashboard";        // public (for now)
import Login from "./pages/Login";                // public
import Register from "./pages/Register";          // public
import Auctions from "./pages/Auctions";          // public
import Alerts from "./pages/Alerts";              // protected
import AuctionDetail from "./pages/AuctionDetail"; // public
import CreateAuction from "./pages/CreateAuction"; // protected
import Profile from "./pages/Profile";            // protected
import Premium from "./pages/Premium";            // protected
import Pricing from "./pages/Pricing";            // public
import LocalDeals from "./pages/LocalDeals";      // protected
import PromoteListing from "./pages/PromoteListing"; // protected
import PromotionPayment from "./pages/PromotionPayment"; // protected
import PromotionDashboard from "./pages/PromotionDashboard"; // protected
import ShieldDashboard from "./pages/ShieldDashboard"; // superadmin only
import OwnerControlPanel from "./pages/OwnerControlPanel"; // superadmin only

/* Protect any route by requiring a token/user */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="card">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Create a client for react-query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

export default function App() {
  const { user, logout } = useAuth();

  const link = "px-3 py-2 rounded hover:opacity-80 transition";
  const active = ({ isActive }) =>
    (isActive ? "font-semibold underline " : "") + link;

  return (
    <QueryClientProvider client={queryClient}>
      <div className="bg-app min-h-screen text-white">
        {/* Auth Debugger for development */}
        <AuthDebugger />
        
        {/* Use the new Navigation component */}
        <Navigation />
        
        {/* Keep the existing header for login/logout */}
        <header className="nav container">
          <div className="flex items-center justify-between px-6 py-4">
            {/* FINAL10 APP Logo */}
            <div className="flex-shrink-0">
              <Final10Logo size="medium" showTaglines={false} />
            </div>
            
            {/* Login/Logout Section */}
            <div className="flex gap-3">
              {!user ? (
                <>
                  <Link to="/login" className="btn btn-ghost">Login</Link>
                  <Link to="/register" className="btn btn-primary">Sign Up</Link>
                </>
              ) : (
                <>
                  <span className="text-sm opacity-80">
                    {user.firstName ?? user.username}
                  </span>
                  <button className="btn btn-ghost" onClick={logout}>
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

      <main className="container px-6 pb-20">
        <Routes>
          {/* Public */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auctions" element={<Auctions />} />
          <Route path="/auction/:id" element={<AuctionDetail />} />
          <Route path="/feed" element={<ProductFeed />} />
          <Route path="/trending" element={<Trending />} />
          <Route path="/scanner" element={<VideoScanner />} />
          <Route path="/pricing" element={<Pricing />} />
          {/* Protected */}
          <Route
            path="/points"
            element={
              <ProtectedRoute>
                <PointsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <Alerts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-auction"
            element={
              <ProtectedRoute>
                <CreateAuction />
              </ProtectedRoute>
            }
          />
                 <Route
                   path="/premium"
                   element={
                     <ProtectedRoute>
                       <Premium />
                     </ProtectedRoute>
                   }
                 />
                 <Route
                   path="/local-deals"
                   element={
                     <ProtectedRoute>
                       <LocalDeals />
                     </ProtectedRoute>
                   }
                 />
                 <Route
                   path="/promote-listing"
                   element={
                     <ProtectedRoute>
                       <PromoteListing />
                     </ProtectedRoute>
                   }
                 />
                 <Route
                   path="/promotion/:id/payment"
                   element={
                     <ProtectedRoute>
                       <PromotionPayment />
                     </ProtectedRoute>
                   }
                 />
        <Route
          path="/promotion-dashboard"
          element={
            <ProtectedRoute>
              <PromotionDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shield-dashboard"
          element={
            <ProtectedRoute>
              <ShieldDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner-control"
          element={
            <ProtectedRoute>
              <OwnerControlPanel />
            </ProtectedRoute>
          }
        />

          {/* 404 */}
          <Route path="*" element={<div className="card">Not found</div>} />
        </Routes>
      </main>
    </div>
    </QueryClientProvider>
  );
}
