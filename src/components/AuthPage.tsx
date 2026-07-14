/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { PASSWORD_RULES, isPasswordStrong } from "../shared/validation/password";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: "PLATFORM_ADMIN" | "STORE_OWNER" | "STORE_MANAGER" | "CUSTOMER";
}

interface AuthPageProps {
  onAuthSuccess: (user: AuthenticatedUser, token: string) => void;
  onExit: () => void;
  initialMode?: "login" | "signup";
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess, onExit, initialMode = "signup" }) => {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordHints, setShowPasswordHints] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordOk = isPasswordStrong(password);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "signup" && !passwordOk) {
      setError("Please choose a stronger password — check the requirements below.");
      setShowPasswordHints(true);
      return;
    }

    setIsSubmitting(true);

    const endpoint = mode === "signup" ? "/api/v1/auth/register" : "/api/v1/auth/login";
    const body =
      mode === "signup"
        ? { name, email, password, role: "STORE_OWNER" }
        : { email, password };

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Something went wrong. Please try again.");
        }
        return data;
      })
      .then((data) => {
        onAuthSuccess(data.user, data.token);
      })
      .catch((err) => {
        setError(err.message || "Unable to authenticate. Please try again.");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <div className="relative min-h-screen bg-[#06070a] text-slate-100 flex items-center justify-center px-6 py-12 overflow-hidden">
      {/* Ambient background glow to match the marketing page's dark aesthetic */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <button
        onClick={onExit}
        className="absolute top-6 left-6 z-20 flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-semibold transition px-4 py-2 hover:bg-slate-500/5 rounded-full cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md bg-[#0B0E14]/90 border border-slate-900 rounded-3xl p-8 shadow-2xl backdrop-blur-md"
      >
        <div className="flex items-center gap-2.5 font-sans font-bold tracking-tight text-lg mb-8 justify-center">
          <span className="w-3.5 h-3.5 rounded bg-indigo-500 animate-pulse" />
          CoreCart
        </div>

        {/* Mode switch pill */}
        <div className="flex border border-slate-900 p-1.5 rounded-full bg-[#13161D] mb-8">
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex-grow py-2 rounded-full font-bold text-xs transition cursor-pointer ${
              mode === "signup" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-grow py-2 rounded-full font-bold text-xs transition cursor-pointer ${
              mode === "login" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
        </div>

        <div className="space-y-1 mb-6 text-center">
          <h2 className="text-xl font-bold font-sans tracking-tight text-white">
            {mode === "signup" ? "Start building your storefront" : "Welcome back"}
          </h2>
          <p className="text-slate-400 text-xs">
            {mode === "signup"
              ? "One account, unlimited stores. Takes about 30 seconds."
              : "Sign in to manage your stores and catalogs."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          {mode === "signup" && (
            <div className="space-y-1">
              <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Roopa Bhoomika"
                className="w-full p-3 text-sm bg-slate-500/10 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block">Email</label>
            <input
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full p-3 text-sm bg-slate-500/10 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block">Password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => mode === "signup" && setShowPasswordHints(true)}
              placeholder="••••••••"
              className="w-full p-3 text-sm bg-slate-500/10 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 transition"
            />
            {mode === "signup" && showPasswordHints && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2">
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(password || "");
                  return (
                    <div
                      key={rule.label}
                      className={`flex items-center gap-1.5 text-[10px] font-mono ${
                        ok ? "text-emerald-400" : "text-slate-500"
                      }`}
                    >
                      {ok ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                      {rule.label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl">{error}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs px-5 py-3.5 rounded-full shadow-lg transition duration-300 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {isSubmitting ? (
              "Please wait..."
            ) : (
              <>
                {mode === "signup" ? "Create My Account" : "Sign In"}
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-500 mt-6 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          {mode === "signup" ? (
            <>
              Already have a store?{" "}
              <button onClick={() => setMode("login")} className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer">
                Sign in instead
              </button>
            </>
          ) : (
            <>
              New to CoreCart?{" "}
              <button onClick={() => setMode("signup")} className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer">
                Create an account
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
};
