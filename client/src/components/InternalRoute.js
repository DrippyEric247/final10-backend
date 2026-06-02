import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccessInternalRoute } from "../lib/adminAccess";
import SavvyMark from "./SavvyMark";

/**
 * InternalRoute — gate for routes that must NEVER be reachable by normal
 * end-users in production.
 *
 * Layers of protection:
 *   1. In production builds, the route is only reachable if the signed-in
 *      user has an admin or superadmin role. Everyone else is bounced to home.
 *   2. In development builds, the route renders for any authenticated user
 *      so the team can iterate without seeding admin accounts.
 *   3. Unauthenticated visitors are always redirected to /login, never to
 *      the internal page itself.
 *
 * Use this for dashboards that expose KPIs, ops tools, shield controls,
 * feature planning, or any UI that would confuse (or scare) a first-time
 * App Store reviewer.
 */
export default function InternalRoute({
  children,
  allowedRoles = ["admin", "superadmin", "owner"],
}) {
  const { user, loading } = useAuth();
  const isProd = process.env.NODE_ENV === "production";

  if (loading) {
    return (
      <div className="card flex items-center gap-3">
        <SavvyMark variant="brand" size={24} glow animated />
        <span>Loading…</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (isProd) {
    const isAllowed = canAccessInternalRoute(user, allowedRoles);
    if (!isAllowed) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
