import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { hasAdminRole } from "../lib/adminAccess";

const ADMIN_LINKS = [
  { label: "Cosmetics grants", path: "/admin/cosmetics", description: "Exclusive calling cards and emblems" },
  { label: "SavvyShield", path: "/shield-dashboard", description: "Fraud prevention and enforcement" },
  { label: "Founder control", path: "/owner-control", description: "User search, grants, founding access" },
  { label: "Launch KPIs", path: "/launch-kpis", description: "Growth and funnel metrics" },
  { label: "Growth levers", path: "/growth-levers", description: "Internal growth experiments" },
  { label: "Production readiness", path: "/production-readiness", description: "Launch checklist" },
];

export default function AdminHub() {
  const { user } = useAuth();
  const show = hasAdminRole(user);

  if (!show) {
    return (
      <div className="card max-w-lg mx-auto mt-8">
        <h1 className="text-xl font-bold mb-2">Access denied</h1>
        <p className="text-gray-400 text-sm">Admin or superadmin role required.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-gray-400 text-sm mt-1">
          Operator tools for {user?.email || user?.username || "your account"}.
        </p>
      </header>
      <ul className="space-y-3">
        {ADMIN_LINKS.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              className="card block hover:border-purple-500/50 transition-colors"
            >
              <span className="font-semibold">{item.label}</span>
              <span className="block text-sm text-gray-400 mt-1">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
