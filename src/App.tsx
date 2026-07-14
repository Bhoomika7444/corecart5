/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { Marketing } from "./components/Marketing";
import { Wizard } from "./components/Wizard";
import { Dashboard } from "./components/Dashboard";
import { StoreRenderer } from "./components/StoreRenderer";
import { AdminDashboard } from "./components/AdminDashboard";
import { AuthPage, AuthenticatedUser } from "./components/AuthPage";
import { MyStores } from "./components/MyStores";
import { FrontendStoreBootstrap } from "./types/storefront";

type ActiveView =
  | "MARKETING"
  | "AUTH"
  | "WIZARD"
  | "MY_STORES"
  | "DASHBOARD"
  | "STOREFRONT"
  | "ADMIN_DASHBOARD";

const SESSION_KEY = "corecart_owner_session";
const ADMIN_SESSION_KEY = "corecart_admin_session";

export default function App() {
  const [view, setView] = useState<ActiveView>("MARKETING");
  const [activeBootstrap, setActiveBootstrap] = useState<FrontendStoreBootstrap | null>(null);
  const [isResolvingRoute, setIsResolvingRoute] = useState(true);

  // Where to send the user after they finish signing in / signing up.
  const [postAuthIntent, setPostAuthIntent] = useState<"WIZARD" | "MY_STORES">("MY_STORES");
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");

  // Logged-in store owner session, persisted across reloads.
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw).user : null;
    } catch {
      return null;
    }
  });

  // --- Direct-link routing ---
  // A published store's URL looks like "/store/<slug>" and must render the
  // storefront directly, in a brand new browser tab, with no dependency on
  // any prior in-app navigation. "/admin" opens the platform admin console.
  useEffect(() => {
    const path = window.location.pathname;
    const storeMatch = /^\/store\/([a-z0-9-]+)\/?$/i.exec(path);

    if (storeMatch) {
      const slug = storeMatch[1];
      fetch(`/api/v1/storefront/config?storeSlug=${slug}`)
        .then((res) => {
          if (!res.ok) throw new Error(`Server returned status ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (!data || data.error || !data.store) {
            throw new Error(data?.error || "This store could not be found.");
          }
          setActiveBootstrap(data);
          setView("STOREFRONT");
        })
        .catch((err) => {
          console.error("Error loading store by URL:", err);
          setView("MARKETING");
        })
        .finally(() => setIsResolvingRoute(false));
      return;
    }

    if (path === "/admin") {
      setView("ADMIN_DASHBOARD");
    }
    setIsResolvingRoute(false);
  }, []);

  // Keep the address bar in sync with what's on screen so refreshing or
  // sharing the URL always lands in the right place.
  const navigateTo = (nextView: ActiveView, pathname: string) => {
    setView(nextView);
    if (window.location.pathname !== pathname) {
      window.history.pushState({}, "", pathname);
    }
  };

  const persistSession = (user: AuthenticatedUser, token: string) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user, token }));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
    navigateTo("MARKETING", "/");
  };

  // Gate any store-owner action (building a store / viewing "My Stores")
  // behind authentication. Already-logged-in users skip straight through.
  const requireAuth = (intent: "WIZARD" | "MY_STORES") => {
    if (currentUser) {
      navigateTo(intent, intent === "WIZARD" ? "/build" : "/my-stores");
    } else {
      setPostAuthIntent(intent);
      setAuthMode("signup");
      navigateTo("AUTH", "/signup");
    }
  };

  const handleAuthSuccess = (user: AuthenticatedUser, token: string) => {
    // Role-based routing: a Platform Admin account always lands on the admin
    // console (which can see every store on the platform), regardless of
    // which button they clicked to get to the sign-in form. Any other role
    // only ever gets their own stores, never the full directory.
    if (user.role === "PLATFORM_ADMIN") {
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ token, email: user.email, name: user.name }));
      navigateTo("ADMIN_DASHBOARD", "/admin");
      return;
    }
    persistSession(user, token);
    navigateTo(postAuthIntent, postAuthIntent === "WIZARD" ? "/build" : "/my-stores");
  };

  const handleManageStore = (storeId: string) => {
    fetch(`/api/v1/storefront/config?storeId=${storeId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.error || !data.store) {
          throw new Error(data?.error || "Failed to load this store.");
        }
        setActiveBootstrap(data);
        navigateTo("DASHBOARD", "/dashboard");
      })
      .catch((err) => {
        console.error("Error loading store for management:", err);
        alert(`Failed to open store: ${err.message || err}`);
      });
  };

  const handleExitDashboard = () => {
    navigateTo("MY_STORES", "/my-stores");
  };

  if (isResolvingRoute) {
    return <div className="w-full min-h-screen bg-[#06070a]" />;
  }

  return (
    <div className="w-full min-h-screen bg-[#06070a]">
      {view === "MARKETING" && (
        <Marketing
          currentUser={currentUser}
          onLaunchWizard={() => requireAuth("WIZARD")}
          onOpenMyStores={() => requireAuth("MY_STORES")}
          onLaunchDashboard={() => navigateTo("ADMIN_DASHBOARD", "/admin")}
          onSignIn={() => {
            setAuthMode("login");
            setPostAuthIntent("MY_STORES");
            navigateTo("AUTH", "/login");
          }}
          onLogout={handleLogout}
        />
      )}

      {view === "AUTH" && (
        <AuthPage
          initialMode={authMode}
          onAuthSuccess={handleAuthSuccess}
          onExit={() => navigateTo("MARKETING", "/")}
        />
      )}

      {view === "ADMIN_DASHBOARD" && (
        <AdminDashboard onExit={() => navigateTo("MARKETING", "/")} />
      )}

      {view === "MY_STORES" && currentUser && (
        <MyStores
          currentUser={currentUser}
          onExit={() => navigateTo("MARKETING", "/")}
          onCreateNew={() => navigateTo("WIZARD", "/build")}
          onManageStore={handleManageStore}
        />
      )}

      {view === "WIZARD" && (
        <Wizard
          currentUser={currentUser}
          onComplete={(payload) => {
            setActiveBootstrap(payload);
            navigateTo("STOREFRONT", `/store/${payload?.store?.slug || ""}`);
          }}
          onManageStore={(payload) => {
            setActiveBootstrap(payload);
            navigateTo("DASHBOARD", "/dashboard");
          }}
          onExit={() => navigateTo(currentUser ? "MY_STORES" : "MARKETING", currentUser ? "/my-stores" : "/")}
        />
      )}

      {view === "DASHBOARD" && activeBootstrap && (
        <Dashboard
          bootstrapData={activeBootstrap}
          onExit={handleExitDashboard}
        />
      )}

      {view === "STOREFRONT" && activeBootstrap && (
        <StoreRenderer
          bootstrapData={activeBootstrap}
          onExit={() => navigateTo("MARKETING", "/")}
          onManageStore={handleManageStore}
        />
      )}
    </div>
  );
}
