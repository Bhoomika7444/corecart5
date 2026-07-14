/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { X, Server, Database, Activity, ShieldCheck, ExternalLink, Users, LogOut, ArrowRight } from "lucide-react";

interface AdminDashboardProps {
  onExit: () => void;
}

interface AdminSession {
  token: string;
  email: string;
  name: string;
}

interface AdminStoreRow {
  id: string;
  name: string;
  slug: string;
  url: string;
  businessType: string;
  status: string;
  ownerName: string;
  ownerEmail: string;
  productCount: number;
  createdAt: string;
}

const ADMIN_SESSION_KEY = "corecart_admin_session";

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExit }) => {
  const [session, setSession] = useState<AdminSession | null>(() => {
    try {
      const raw = localStorage.getItem(ADMIN_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [stats, setStats] = useState<{ storeCount: number; activeStoreCount: number; userCount: number } | null>(null);
  const [stores, setStores] = useState<AdminStoreRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed.");
        return data;
      })
      .then((data) => {
        if (data.user.role !== "PLATFORM_ADMIN") {
          throw new Error("This account does not have Platform Admin access.");
        }
        const newSession: AdminSession = { token: data.token, email: data.user.email, name: data.user.name };
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(newSession));
        setSession(newSession);
      })
      .catch((err) => setLoginError(err.message || "Login failed."))
      .finally(() => setIsSubmitting(false));
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    setSession(null);
  };

  useEffect(() => {
    if (!session) return;
    const headers = { Authorization: `Bearer ${session.token}` };

    Promise.all([
      fetch("/api/v1/admin/stats", { headers }).then((res) => {
        if (!res.ok) throw new Error("Failed to fetch admin stats");
        return res.json();
      }),
      fetch("/api/v1/admin/stores", { headers }).then((res) => {
        if (!res.ok) throw new Error("Failed to fetch store directory");
        return res.json();
      }),
    ])
      .then(([statsData, storesData]) => {
        setStats(statsData);
        setStores(storesData.stores || []);
      })
      .catch((err) => setError(err.message));
  }, [session]);

  // --- Gated Login Screen ---
  if (!session) {
    return (
      <div className="min-h-screen bg-[#06070a] text-slate-100 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-[#0B0E14]/90 border border-slate-900 rounded-3xl p-8 shadow-2xl"
        >
          <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-5">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-white text-center mb-1">Platform Admin</h2>
          <p className="text-slate-500 text-xs text-center mb-6">Restricted access. Admin credentials required.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 text-sm bg-slate-500/10 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 text-sm bg-slate-500/10 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs px-5 py-3.5 rounded-full shadow-lg transition duration-300 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {isSubmitting ? "Signing in..." : (
                <>Sign In <ArrowRight className="w-3.5 h-3.5" /></>
              )}
            </button>
          </form>

          <p className="text-[10px] text-slate-600 text-center mt-5 font-mono leading-relaxed">
            First run? Your admin login was generated automatically and saved to{" "}
            <span className="text-slate-400">ADMIN_CREDENTIALS.txt</span> in the project folder.
          </p>

          <button
            onClick={onExit}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-300 font-semibold mt-4 cursor-pointer"
          >
            &larr; Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  // --- Authenticated Dashboard ---
  return (
    <div className="min-h-screen bg-[#06070a] text-slate-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Platform Admin Dashboard
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Signed in as {session.name} ({session.email})</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full text-xs font-bold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
            <button
              onClick={onExit}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full text-xs font-bold transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Exit
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg mb-6">{error}</div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-indigo-500/10 rounded-lg">
                <Database className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold">Websites Created</h3>
            </div>
            <div className="text-4xl font-bold text-white">{stats === null ? "..." : stats.storeCount}</div>
            <p className="text-sm text-slate-500 mt-2">Total stores ever created on CoreCart</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <Activity className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold">Live Stores</h3>
            </div>
            <div className="text-4xl font-bold text-white">{stats === null ? "..." : stats.activeStoreCount}</div>
            <p className="text-sm text-slate-500 mt-2">Published and publicly reachable</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold">Registered Users</h3>
            </div>
            <div className="text-4xl font-bold text-white">{stats === null ? "..." : stats.userCount}</div>
            <p className="text-sm text-slate-500 mt-2">Store owners &amp; customers combined</p>
          </div>
        </div>

        {/* Store Directory Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-sm">All Websites Created</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 uppercase text-[10px] font-mono border-b border-slate-800">
                  <th className="p-4">Store Name</th>
                  <th className="p-4">Owner</th>
                  <th className="p-4">Live URL</th>
                  <th className="p-4">Products</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {stores.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      No stores created yet.
                    </td>
                  </tr>
                )}
                {stores.map((store) => (
                  <tr key={store.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                    <td className="p-4 font-semibold text-white">{store.name}</td>
                    <td className="p-4">
                      <div>{store.ownerName}</div>
                      <div className="text-slate-500">{store.ownerEmail}</div>
                    </td>
                    <td className="p-4">
                      <a
                        href={store.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono"
                      >
                        {store.url} <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="p-4">{store.productCount}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-mono uppercase border ${
                          store.status === "ACTIVE"
                            ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                            : "text-amber-400 border-amber-500/30 bg-amber-500/10"
                        }`}
                      >
                        {store.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">{new Date(store.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
