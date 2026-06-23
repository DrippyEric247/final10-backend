import ProductFeed from './pages/ProductFeed';
import Trending from './pages/Trending';
import VideoScanner from './components/VideoScanner';
import Navigation from './components/Navigation';
import ApiCoolingBanner from './components/ApiCoolingBanner';
import UniversalBoostProgressBar from './components/UniversalBoostProgressBar';
import Final10RewardHost from './components/Final10RewardHost';
import Final10SideAssistant from './components/Final10SideAssistant';
import CallingCardUnlockCeremony from './components/cosmetics/CallingCardUnlockCeremony';
import AuthDebugger from './components/AuthDebugger';
import DevOverridePanel from './components/dev/DevOverridePanel';
import DevModeBadge from './components/dev/DevModeBadge';
import InternalRoute from './components/InternalRoute';
import SavvyMark from './components/SavvyMark';
import { Final10PowerProvider } from './context/Final10PowerContext';
import { PointsRewardProvider } from './context/PointsRewardContext';
import { SearchIntentProvider } from './context/SearchIntentContext';
import { PartyProvider } from './context/PartyContext';
import PartyDock from './components/party/PartyDock';
import PartyPage from './pages/PartyPage';
import './styles/ProductFeed.css';
import './styles/browser-compatibility.css';
import './styles/final10-power-visual.css';
import './styles/final10-ftue.css';
import './styles/states.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect, useMemo } from "react";
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { hasCompletedOnboarding, onboardingUserId } from "./lib/onboardingPreferences";
import { auditOnboarding } from "./lib/auditLog";
import { installRewardDevTools } from "./lib/rewardEngine";
import { setCurrentUserForCosmetics } from "./lib/adminCosmetics";
import { captureAttributionFromLocation, recordCreatorClick } from "./lib/attribution";

/* Pages (use real ones as you build them) */
import Dashboard from "./pages/Dashboard";        // public (for now)
import Login from "./pages/Login";                // public
import Register from "./pages/Register";          // public
import Auctions from "./pages/Auctions";          // public
import AlertsCommandCenter from "./pages/AlertsCommandCenter";              // protected
import BuildWarsPage from "./pages/BuildWarsPage";
import AuctionDetail from "./pages/AuctionDetail"; // public
import Profile from "./pages/Profile";            // protected
import LeaderboardPage from "./pages/LeaderboardPage"; // protected
import WinFeed from "./pages/WinFeed";            // public — Savvy Wins social feed
import AdminCosmeticsPanel from "./pages/AdminCosmeticsPanel"; // owner-only grants
import Customization from "./pages/Customization"; // protected
import Premium from "./pages/Premium";            // protected
import BattlePassPage from "./pages/BattlePassPage"; // protected
import Pricing from "./pages/Pricing";            // public
import LocalDeals from "./pages/LocalDeals";      // protected
import PromoteListing from "./pages/PromoteListing"; // protected
import PromotionPayment from "./pages/PromotionPayment"; // protected
import PromotionDashboard from "./pages/PromotionDashboard"; // protected
import ShieldDashboard from "./pages/ShieldDashboard"; // superadmin only
import OwnerControlPanel from "./pages/OwnerControlPanel"; // superadmin only
import AdminHub from "./pages/AdminHub";
import ProductionReadinessPage from "./pages/ProductionReadinessPage"; // internal planning
import LaunchKPIDashboard from "./pages/LaunchKPIDashboard"; // internal KPI dashboard
import GrowthLeversDashboard from "./pages/GrowthLeversDashboard"; // internal growth lever system
import SavvyOffers from "./pages/SavvyOffers";
import SavvyPrograms from "./pages/SavvyPrograms";
import AppBackground from "./components/AppBackground";
import BusinessOffersDashboard from "./pages/BusinessOffersDashboard";
import BusinessOfferCreate from "./pages/BusinessOfferCreate";
import SmartCoachHost from "./components/smartCoach/SmartCoachHost";
import StartupBootSequence, { shouldShowStartupBootSequence } from "./components/branding/StartupBootSequence";
import SavvyFirstRunExperience from "./components/onboarding/SavvyFirstRunExperience";
import SavvyInteractiveDemos from "./components/onboarding/SavvyInteractiveDemos";
import CreatorLanding from "./pages/CreatorLanding";
import OnboardingPreferences from "./pages/OnboardingPreferences";
import OnboardingBestMove from "./pages/OnboardingBestMove";
import SellerTrendsDashboard from "./pages/SellerTrendsDashboard";
import SellerDashboard from "./pages/SellerDashboard";
import CreateAuction from "./pages/CreateAuction";
import TourHost from "./components/tour/TourHost";
import TabJourneyPanel from "./components/onboarding/TabJourneyPanel";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Support from "./pages/Support";
import DeleteAccount from "./pages/DeleteAccount";
import Settings from "./pages/Settings";
import SavvyShopPage from "./pages/SavvyShopPage";
import SavvyShopStudio from "./pages/SavvyShopStudio";
import FoundingTesterMission from "./pages/FoundingTesterMission";
import AppTelemetry from "./components/AppTelemetry";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { useEntitlement } from "./hooks/useEntitlement";
import { setCurrentSubscriptionTier } from "./lib/tierMultiplier";
import { isBetaTester, registerBetaTesterGetter } from "./lib/betaTesterAccess";
import FoundingTesterBadge from "./components/beta/FoundingTesterBadge";
import { SavvyScoutMissionsProvider } from './context/SavvyScoutMissionsContext';
import MissionLog from './pages/MissionLog';
import DailyStreak from './pages/DailyStreak';
import './styles/SavvyScoutMissions.css';

/* Protect any route by requiring a token/user */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="card flex items-center gap-3">
        <SavvyMark variant="brand" size={24} glow animated />
        <span>Loading…</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Create a client for react-query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error?.isCoolingDown || error?.status === 429) return false;
        return failureCount < 1;
      },
    },
  },
});

/* Redirect signed-in users who have not finished category onboarding. */
const ONBOARDING_EXEMPT_PREFIXES = [
  "/onboarding/",
  "/login",
  "/register",
  "/privacy",
  "/terms",
  "/support",
  "/c/",
];

function OnboardingRedirect() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    const path = location.pathname;
    if (ONBOARDING_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return;
    }
    const userId = onboardingUserId(user);
    if (!userId || !hasCompletedOnboarding(userId)) {
      auditOnboarding({
        action: "redirect_to_preferences",
        userId: userId || null,
        path,
      });
      navigate("/onboarding/preferences", { replace: true });
    }
  }, [loading, location.pathname, navigate, user]);

  return null;
}

export default function App() {
  const { user, logout } = useAuth();
  const entitlement = useEntitlement(Boolean(user));
  const entIsBeta = Boolean(entitlement?.isBetaTester);
  const entFoundingAccess = Boolean(entitlement?.foundingTesterAccess);
  const isFoundingTester = useMemo(
    () =>
      isBetaTester(user, {
        isBetaTester: entIsBeta || Boolean(user?.isBetaTester),
        foundingTesterAccess: entFoundingAccess || Boolean(user?.foundingTesterAccess),
      }),
    [user, entIsBeta, entFoundingAccess]
  );
  const [authLogoutBusy, setAuthLogoutBusy] = React.useState(false);
  const [showStartupBoot, setShowStartupBoot] = React.useState(() => shouldShowStartupBootSequence());
  useEffect(() => {
    installRewardDevTools();
  }, []);

  // Capture creator/referral attribution on first paint (Phase B foundation).
  useEffect(() => {
    const captured = captureAttributionFromLocation();
    if (captured && captured.creatorHandle) {
      // Fire-and-forget click telemetry. Uses native fetch so we don't
      // tangle attribution with the auth-aware axios instance.
      recordCreatorClick((url, init) => fetch(url, init));
    }
  }, []);

  // Keep the cosmetics layer's identity snapshot in sync with auth so the
  // exclusive grant/role-based unlock checks resolve the current user.
  useEffect(() => {
    setCurrentUserForCosmetics(user || null);
  }, [user]);

  useEffect(() => {
    registerBetaTesterGetter(() => isFoundingTester);
    return () => registerBetaTesterGetter(null);
  }, [isFoundingTester]);

  useEffect(() => {
    if (!user || !isFoundingTester) return;
    setCurrentSubscriptionTier("elite");
  }, [user, isFoundingTester]);

  return (
    <QueryClientProvider client={queryClient}>
      <SavvyScoutMissionsProvider>
      <Final10PowerProvider>
      <PointsRewardProvider>
      <SearchIntentProvider>
      <PartyProvider>
      <div className="bg-app min-h-screen text-white">
        {/* Faded brand layer (logo on every tab, aurora on /profile). */}
        <AppBackground />
        <AppTelemetry />
        <OnboardingRedirect />
        {/* Auth Debugger is strictly a development aid and must not
            render in production builds or for App Store reviewers. */}
        {process.env.NODE_ENV !== 'production' ? <AuthDebugger /> : null}
        {process.env.NODE_ENV !== 'production' ? <DevOverridePanel /> : null}
        {process.env.NODE_ENV !== 'production' ? <DevModeBadge /> : null}
        
        {/* Use the new Navigation component */}
        <Navigation />
        <ApiCoolingBanner />
        <UniversalBoostProgressBar />
        <Final10RewardHost />
        <CallingCardUnlockCeremony />
        <SmartCoachHost enabled={Boolean(user)} />
        <Final10SideAssistant />
        <TourHost />
        {user ? <TabJourneyPanel /> : null}
        {user ? <PartyDock /> : null}
        <SavvyFirstRunExperience user={user} />
        <SavvyInteractiveDemos enabled={Boolean(user)} />
        {showStartupBoot ? (
          <StartupBootSequence
            appName="Final10"
            durationMs={1450}
            onComplete={() => setShowStartupBoot(false)}
            onCue={(cue) => {
              if (cue === "boot_complete" && typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("f10:startup-boot-complete"));
              }
              // Sound-ready hook for future audio sync / haptics.
              if (process.env.NODE_ENV === "development") {
                // eslint-disable-next-line no-console
                console.debug("[StartupBootSequence cue]", cue);
              }
            }}
          />
        ) : null}

        {/* Keep the existing header for login/logout */}
        <header className="nav container app-auth-header">
          <div className="app-auth-header-inner flex items-center justify-between px-6 py-4">
            {/* FINAL10 APP Logo */}
            <div className="flex-shrink-0 app-logo-wrap">
              <SavvyMark variant="product" appName="Final10" size={28} glow />
            </div>
            
            {/* Login/Logout Section */}
            <div className="flex gap-3 app-auth-buttons">
              {isFoundingTester ? <FoundingTesterBadge /> : null}
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
                  <button
                    type="button"
                    className="btn btn-ghost disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={authLogoutBusy}
                    aria-busy={authLogoutBusy}
                    onClick={() => {
                      if (authLogoutBusy) return;
                      setAuthLogoutBusy(true);
                      logout();
                    }}
                  >
                    {authLogoutBusy ? 'Logging out…' : 'Logout'}
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

      <main className="container max-w-[100vw] px-4 sm:px-6 pb-[max(5rem,calc(env(safe-area-inset-bottom,0px)+4.5rem))] overflow-x-clip">
        <AppErrorBoundary>
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
          <Route path="/savvy-offers" element={<SavvyOffers />} />
          <Route path="/savvy-programs" element={<SavvyPrograms />} />
          <Route path="/win-feed" element={<WinFeed />} />
          <Route path="/shop/:slug" element={<SavvyShopPage />} />
          {/* Creator deep-link: /c/:handle. Attribution capture happens on App load. */}
          <Route path="/c/:handle" element={<CreatorLanding />} />
          {/* Post-onboarding personalization: preference picker + instant Best Move. */}
          <Route path="/onboarding/preferences" element={<OnboardingPreferences />} />
          <Route path="/onboarding/best-move" element={<OnboardingBestMove />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/support" element={<Support />} />
          <Route
            path="/founding-tester"
            element={
              <ProtectedRoute>
                <FoundingTesterMission />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delete-account"
            element={
              <ProtectedRoute>
                <DeleteAccount />
              </ProtectedRoute>
            }
          />
          <Route
            path="/business-offers"
            element={
              <ProtectedRoute>
                <BusinessOffersDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/business-offers/create"
            element={
              <ProtectedRoute>
                <BusinessOfferCreate />
              </ProtectedRoute>
            }
          />
          {/* Protected */}
          <Route
            path="/points"
            element={
              <ProtectedRoute>
                <Navigate to="/profile#savvy-balance" replace />
              </ProtectedRoute>
            }
          />
          <Route path="/hashtag-tracker" element={<Navigate to="/win-feed" replace />} />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <AlertsCommandCenter />
              </ProtectedRoute>
            }
          />
          <Route path="/build-wars" element={<BuildWarsPage />} />
          <Route
            path="/mission-log"
            element={
              <ProtectedRoute>
                <MissionLog />
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
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <LeaderboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customization"
            element={
              <ProtectedRoute>
                <Customization />
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-streak"
            element={
              <ProtectedRoute>
                <DailyStreak />
              </ProtectedRoute>
            }
          />
          <Route
            path="/battle-pass"
            element={
              <ProtectedRoute>
                <BattlePassPage />
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
                  path="/seller-trends"
                  element={
                    <ProtectedRoute>
                      <SellerTrendsDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/savvy-shop/studio"
                  element={
                    <ProtectedRoute>
                      <SavvyShopStudio />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/seller-dashboard"
                  element={
                    <ProtectedRoute>
                      <SellerDashboard />
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
        {/* Internal operator tools — see InternalRoute. In production only
            admin or superadmin users can open these; in dev any signed-in user
            can reach them to iterate quickly. */}
        <Route
          path="/admin"
          element={
            <InternalRoute allowedRoles={["admin", "superadmin", "owner"]}>
              <AdminHub />
            </InternalRoute>
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            <InternalRoute allowedRoles={["admin", "superadmin", "owner"]}>
              <AdminHub />
            </InternalRoute>
          }
        />
        <Route
          path="/shield-dashboard"
          element={
            <InternalRoute allowedRoles={["admin", "superadmin", "owner"]}>
              <ShieldDashboard />
            </InternalRoute>
          }
        />
        <Route
          path="/owner-control"
          element={
            <InternalRoute allowedRoles={["admin", "superadmin", "owner"]}>
              <OwnerControlPanel />
            </InternalRoute>
          }
        />
        <Route
          path="/admin/cosmetics"
          element={
            <InternalRoute allowedRoles={["admin", "superadmin", "owner"]}>
              <AdminCosmeticsPanel />
            </InternalRoute>
          }
        />
        <Route
          path="/production-readiness"
          element={
            <InternalRoute allowedRoles={["admin", "superadmin", "owner"]}>
              <ProductionReadinessPage />
            </InternalRoute>
          }
        />
        <Route
          path="/launch-kpis"
          element={
            <InternalRoute allowedRoles={["admin", "superadmin", "owner"]}>
              <LaunchKPIDashboard />
            </InternalRoute>
          }
        />
        <Route
          path="/growth-levers"
          element={
            <InternalRoute allowedRoles={["admin", "superadmin", "owner"]}>
              <GrowthLeversDashboard />
            </InternalRoute>
          }
        />

          {/* Squad Sync (party system) */}
          <Route
            path="/party"
            element={
              <ProtectedRoute>
                <PartyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/party/:id"
            element={
              <ProtectedRoute>
                <PartyPage />
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<div className="card">Not found</div>} />
        </Routes>
        </AppErrorBoundary>
      </main>
      <footer className="container px-6 pb-8 text-sm text-gray-400">
        <div className="flex flex-wrap gap-4 border-t border-gray-800 pt-4">
          <Link to="/privacy" className="hover:text-gray-200">Privacy</Link>
          <Link to="/terms" className="hover:text-gray-200">Terms</Link>
          <Link to="/support" className="hover:text-gray-200">Support</Link>
          {user ? <Link to="/delete-account" className="hover:text-red-300">Delete Account</Link> : null}
          {user ? <Link to="/mission-log" className="hover:text-gray-200">Mission Log</Link> : null}
        </div>
      </footer>
    </div>
      </PartyProvider>
      </SearchIntentProvider>
      </PointsRewardProvider>
      </Final10PowerProvider>
      </SavvyScoutMissionsProvider>
    </QueryClientProvider>
  );
}
