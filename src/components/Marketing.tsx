/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  ArrowRight,
  Cpu,
  Layers,
  Database,
  ShieldAlert,
  Sliders,
  Terminal,
  Activity,
  ChevronDown,
} from "lucide-react";
import { AssemblyCanvas } from "./AssemblyCanvas";

interface MarketingProps {
  currentUser: { id: string; name: string; email: string } | null;
  onLaunchWizard: () => void;
  onOpenMyStores: () => void;
  onLaunchDashboard: () => void;
  onSignIn: () => void;
  onLogout: () => void;
}

export const Marketing: React.FC<MarketingProps> = ({
  currentUser,
  onLaunchWizard,
  onOpenMyStores,
  onLaunchDashboard,
  onSignIn,
  onLogout,
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);

  // Playground Configurator States (Interactive Act 3)
  const [playgroundConfig, setPlaygroundConfig] = useState({
    themeName: "Refined Gold Slate",
    primary: "#07090D",
    accent: "#D4AF37",
    features: ["Wishlist", "Secured Checkout", "Smart Search"],
  });

  const [activePreset, setActivePreset] = useState("gold");

  // Track scroll position to update background assembly particles
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? scrollY / docHeight : 0;
      setScrollProgress(Math.min(1, Math.max(0, progress)));
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Update playground swatches on preset click
  const selectPlaygroundPreset = (key: string) => {
    setActivePreset(key);
    if (key === "gold") {
      setPlaygroundConfig({
        themeName: "Refined Gold Slate",
        primary: "#07090D",
        accent: "#D4AF37",
        features: ["Wishlist Persistence", "Secured SSL Checkout", "Fuzzy Search"],
      });
    } else if (key === "neon") {
      setPlaygroundConfig({
        themeName: "Cyberpunk Electronic Grid",
        primary: "#0A0B10",
        accent: "#00FF66",
        features: ["Variants Comparison", "Time countdown deals", "Auto stock thresholds"],
      });
    } else if (key === "eco") {
      setPlaygroundConfig({
        themeName: "Fresh Pastel Organic",
        primary: "#FAF9F5",
        accent: "#27AE60",
        features: ["Local coupons engine", "FAQ accordion widgets", "Editorial blog rolls"],
      });
    }
  };

  return (
    <div className="relative min-h-screen bg-[#06070a] text-slate-100 overflow-x-hidden selection:bg-indigo-500/30 font-sans">
      {/* Dynamic Ambient Particles Background */}
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
        <AssemblyCanvas scrollProgress={scrollProgress} />
        {/* Subtle radial dark overlay */}
        <div className="absolute inset-0 bg-radial-[circle_at_center,rgba(6,7,10,0.1)_0%,rgba(6,7,10,0.85)_100%]" />
      </div>

      {/* FIXED NAVIGATION */}
      <header className="fixed top-0 left-0 w-full z-50 border-b border-slate-900/65 bg-[#06070a]/70 backdrop-blur-md px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 font-sans font-bold tracking-tight text-lg">
          <span className="w-3.5 h-3.5 rounded bg-indigo-500 animate-pulse" />
          CoreCart
          <span className="text-[10px] font-mono text-slate-500 bg-slate-500/5 px-2 py-0.5 rounded border border-slate-300/10">
            v1.0.0 ENGINE
          </span>
        </div>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <>
              <button
                onClick={onOpenMyStores}
                className="hidden sm:block text-xs text-slate-400 hover:text-white font-semibold transition px-4 py-2 hover:bg-slate-500/5 rounded-full cursor-pointer"
              >
                My Stores
              </button>
              <button
                onClick={onLogout}
                className="hidden sm:block text-xs text-slate-500 hover:text-white font-semibold transition px-4 py-2 hover:bg-slate-500/5 rounded-full cursor-pointer"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={onSignIn}
              className="hidden sm:block text-xs text-slate-400 hover:text-white font-semibold transition px-4 py-2 hover:bg-slate-500/5 rounded-full cursor-pointer"
            >
              Sign In
            </button>
          )}
          <button
            onClick={onLaunchWizard}
            className="bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-full shadow-lg transition duration-300 cursor-pointer flex items-center gap-1"
          >
            {currentUser ? "Create New Store" : "Get Started"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* SCROLLABLE MARKETING SECTION SHEETS */}
      <main className="relative z-10 w-full flex flex-col">
        {/* --- ACT 1: THE REVELATION --- */}
        <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 relative py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-4xl space-y-6 mt-16"
          >
            <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1.5 rounded-full inline-flex items-center gap-2 border border-indigo-500/20">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Re-engineering Tenant Commerce Architecture
            </span>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none text-white max-w-5xl font-sans">
              Traditional platforms store business data. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-amber-300">
                CoreCart stores the website itself.
              </span>
            </h1>
            <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto font-light leading-relaxed">
              A high-performance database-driven multi-tenant commerce engine. No container sprawl. 
              No slow server boots. Themes, layouts, and logic compile instantly from database configuration rows.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="absolute bottom-8 flex flex-col items-center gap-1 text-slate-500 text-xs font-mono uppercase tracking-widest"
          >
            <span>Scroll to Assemble Storefront</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </motion.div>
        </section>

        {/* --- ACT 2: ATOMIC ASSEMBLY --- */}
        <section className="min-h-screen flex items-center justify-center px-6 py-20 bg-gradient-to-b from-transparent via-[#06070a]/90 to-transparent">
          <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="text-xs font-mono text-indigo-400 tracking-wider block uppercase">
                ACT II: Dynamic Ingestion
              </span>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
                Physical Assembly of UI Layout Elements
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                As you scroll, notice the floating plexus nodes aligning. Under the hood, CoreCart takes raw 
                JSON parameters representing themes, color tokens, inventory categories, and toggle features, 
                snapping them together in real time to draw complete customer-facing storefronts with 
                <strong> 0ms latency</strong>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-900 bg-slate-500/5 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold">
                    <Cpu className="w-4 h-4" /> Single-Source Engine
                  </div>
                  <p className="text-slate-500 leading-normal">
                    Entire tenant assets resolve through a row discriminator. No slow microservice dependencies.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-900 bg-slate-500/5 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <Layers className="w-4 h-4" /> Hexagonal Decoupling
                  </div>
                  <p className="text-slate-500 leading-normal">
                    The core domain has zero awareness of frameworks. Migrate databases or UI components cleanly.
                  </p>
                </div>
              </div>
            </div>

            {/* Static visual representing geometric assembly block */}
            <div className="relative p-6 rounded-2xl border border-slate-900 bg-[#0B0E14]/80 backdrop-blur-md space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-900">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Active Core Assembler</span>
                <span className="text-xs text-indigo-400 font-mono font-bold animate-pulse">COMPILING...</span>
              </div>
              <div className="space-y-3 font-mono text-[10px] text-slate-400">
                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                  <span>RESOLVING STORE ID:</span>
                  <span className="text-indigo-400">"aura-fragrances"</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                  <span>LOAD BRAND GRAPHICS:</span>
                  <span className="text-emerald-400">"Space Grotesk Duo"</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                  <span>DEPLOYED CODES (RULES):</span>
                  <span className="text-amber-400">"Buy2Get1_Solstice"</span>
                </div>
                <div className="flex justify-between pb-1.5">
                  <span>PCI STRIPE CREDENTIALS:</span>
                  <span className="text-purple-400">"Authorized Token"</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- ACT 3: THE COMPLIANT PLAYGROUND --- */}
        <section className="min-h-screen flex items-center justify-center px-6 py-20">
          <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left Column Playground Sandbox */}
            <div className="p-8 rounded-3xl border border-slate-900 bg-[#0A0C11]/90 backdrop-blur-md space-y-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-900">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded bg-emerald-500/10 text-emerald-400">
                    <Terminal className="w-4 h-4" />
                  </span>
                  <h4 className="font-bold text-xs tracking-tight uppercase font-mono">CoreCart Engine Console</h4>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
              </div>

              {/* Console selector buttons */}
              <div className="flex border border-slate-900 p-1 rounded-full bg-[#13161D]">
                <button
                  onClick={() => selectPlaygroundPreset("gold")}
                  className={`flex-grow py-1.5 rounded-full text-[10px] font-mono font-bold transition cursor-pointer ${
                    activePreset === "gold" ? "bg-indigo-500 text-white" : "text-slate-500"
                  }`}
                >
                  GOLD_REFINED
                </button>
                <button
                  onClick={() => selectPlaygroundPreset("neon")}
                  className={`flex-grow py-1.5 rounded-full text-[10px] font-mono font-bold transition cursor-pointer ${
                    activePreset === "neon" ? "bg-indigo-500 text-white" : "text-slate-500"
                  }`}
                >
                  NEON_CYBERPUNK
                </button>
                <button
                  onClick={() => selectPlaygroundPreset("eco")}
                  className={`flex-grow py-1.5 rounded-full text-[10px] font-mono font-bold transition cursor-pointer ${
                    activePreset === "eco" ? "bg-indigo-500 text-white" : "text-slate-500"
                  }`}
                >
                  ECO_ORGANICS
                </button>
              </div>

              {/* Dynamic Theme visual representation */}
              <div
                style={{ backgroundColor: playgroundConfig.primary }}
                className="p-6 rounded-2xl border border-slate-800 transition-colors duration-300 space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                  <span className="text-[11px] font-bold text-slate-400">{playgroundConfig.themeName}</span>
                  <div
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: playgroundConfig.accent }}
                  />
                </div>

                <div className="space-y-1.5 text-[10px] font-mono text-slate-500">
                  {playgroundConfig.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column copy */}
            <div className="space-y-6">
              <span className="text-xs font-mono text-indigo-400 tracking-wider block uppercase">
                ACT III: Interactive Playground
              </span>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight font-sans">
                Real-time Sandbox Telemetry Hot-swap
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed font-light">
                Click across the interactive presets on the adjacent terminal block. Instantly watch color values, 
                feature inclusions, and layouts compile. CoreCart resolves this state dynamically 
                on customer load, mapping standard theme databases right to custom render pipelines.
              </p>
            </div>
          </div>
        </section>

        {/* --- ACT 4: CONFIG ARCHITECTURE --- */}
        <section className="min-h-screen flex items-center justify-center px-6 py-20 bg-[#07090D]/50 border-y border-slate-900/60">
          <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="text-xs font-mono text-indigo-400 tracking-wider block uppercase">
                ACT IV: Database Engine
              </span>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight font-sans">
                Full Hexagonal Multi-Tenant Decoupling
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                CoreCart relies on standard Clean Architecture principles. Row-level multi-tenancy ensures that 
                thousands of stores operate concurrently on shared tables, with strict schema isolation.
              </p>

              <div className="space-y-3 font-mono text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <Database className="text-indigo-400 w-4 h-4" />
                  <span>Config Ingestion evaluates custom structures via NVIDIA LLM.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sliders className="text-emerald-400 w-4 h-4" />
                  <span>Automatic feature dependencies checked globally.</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="text-amber-500 w-4 h-4" />
                  <span>Audit Logs track version-control rollbacks live.</span>
                </div>
              </div>
            </div>

            {/* Aesthetic graphic mapping database config block */}
            <div className="relative p-6 rounded-2xl border border-slate-900 bg-black/60 font-mono text-[10px] space-y-2 text-slate-400">
              <div className="text-indigo-400 font-bold border-b border-slate-900 pb-1 mb-2">
                # CoreCart Tenancy Mapping
              </div>
              <div>tenant_id: "sec_aura_001"</div>
              <div>table_schema: "shared_public_stores"</div>
              <div>isolation_level: "Row-Level Multi-Tenancy"</div>
              <div className="text-green-500">+ SELECT * FROM products WHERE store_id = 'aura'</div>
              <div className="text-slate-500">// Result resolves instantly without container spawns</div>
            </div>
          </div>
        </section>

        {/* --- ACT 5: TELEMETRY & CONVERSION --- */}
        <section className="min-h-screen flex items-center justify-center px-6 py-20">
          <div className="max-w-6xl w-full text-center space-y-12">
            <div className="space-y-4 max-w-3xl mx-auto">
              <span className="text-xs font-mono text-indigo-400 tracking-wider block uppercase">
                ACT V: High Conversion Payoff
              </span>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight font-sans">
                Configured for Secure Peak Checkout Volatility
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed font-light">
                Standard React architectures suffer from bloated virtual DOM reconciliation when rendering dynamic templates. 
                CoreCart compiles your configurations down into sleek, highly-optimized components.
              </p>
            </div>

            {/* Stat callouts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="p-6 rounded-2xl border border-slate-900 bg-[#0B0E14]/80 backdrop-blur-md space-y-2">
                <div className="text-4xl font-bold font-mono text-indigo-400">0ms</div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                  Fulfillment Cold Starts
                </span>
              </div>
              <div className="p-6 rounded-2xl border border-slate-900 bg-[#0B0E14]/80 backdrop-blur-md space-y-2">
                <div className="text-4xl font-bold font-mono text-emerald-400">100%</div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                  Row Schema Isolation
                </span>
              </div>
              <div className="p-6 rounded-2xl border border-slate-900 bg-[#0B0E14]/80 backdrop-blur-md space-y-2">
                <div className="text-4xl font-bold font-mono text-purple-400">15+</div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                  Built-in Commerce Engines
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* --- ACT 6: CTA TO ACTION --- */}
        <section className="min-h-screen flex items-center justify-center px-6 py-20 relative">
          <div className="max-w-4xl text-center space-y-8 relative z-10">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight text-white font-sans leading-none">
              Assemble Your <br />
              Custom Storefront Now.
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl mx-auto font-light leading-relaxed">
              Experience the database-driven Multi-Tenant Revolution. Create your store from scratch using 
              our 5-step wizard, or ingest your full requirements file using NVIDIA LLM.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={onLaunchWizard}
                className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs px-8 py-3.5 rounded-full shadow-lg hover:shadow-indigo-500/20 transition duration-300 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {currentUser ? "Create New Store" : "Launch Storefront Builder"}
                <ArrowRight className="w-4 h-4" />
              </button>
              {!currentUser && (
                <button
                  onClick={onSignIn}
                  className="w-full sm:w-auto bg-[#13161D] border border-slate-900 hover:bg-[#1C202B] text-slate-300 font-bold text-xs px-8 py-3.5 rounded-full transition cursor-pointer"
                >
                  Sign In to Existing Account
                </button>
              )}
            </div>
          </div>

          <footer className="absolute bottom-6 left-0 w-full text-center text-[10px] font-mono text-slate-600 tracking-wider space-y-1.5">
            <div>CORECART commerce platform • PROVEN HEXAGONAL ENGINE SPECIFICATIONS</div>
            <button
              onClick={onLaunchDashboard}
              className="text-slate-700 hover:text-slate-400 transition cursor-pointer underline underline-offset-2"
            >
              Platform Admin Access
            </button>
          </footer>
        </section>
      </main>
    </div>
  );
};
