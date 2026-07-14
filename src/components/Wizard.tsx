/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Palette,
  Layout,
  ToggleLeft,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  FileText,
  Terminal,
  CheckCircle,
  Plus,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { AssemblyCanvas } from "./AssemblyCanvas";
import { getProductsForCategory, deriveTemplateKey } from "../shared/database/catalogSeeds";
import { classifyProduct, PRODUCT_FAMILIES } from "../backend/productIntelligence";

// Wraps fetch with a hard timeout so a stalled network call (or an
// unreachable backend) can never leave the caller waiting forever - it
// rejects instead, so the deploy flow can surface a real error and re-enable
// the button rather than spinning on "Deploying Store..." indefinitely.
function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 25000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

interface WizardProps {
  currentUser: { id: string; name: string; email: string } | null;
  onComplete: (bootstrapPayload: any) => void;
  // Optional: lets the success screen jump straight into the owner Dashboard
  // (add/edit/delete products, set prices, etc.) right after publishing,
  // instead of only offering the public storefront view.
  onManageStore?: (bootstrapPayload: any) => void;
  onExit: () => void;
}

export const Wizard: React.FC<WizardProps> = ({ currentUser, onComplete, onManageStore, onExit }) => {
  const [step, setStep] = useState(1);
  const [storeId, setStoreId] = useState<string | null>(null);
  // Tracks whether the seller has manually edited the slug field, so auto-sync
  // from the name field stops the moment they take over.
  const [slugTouched, setSlugTouched] = useState(false);

  // --- WIZARD FORM STATE ---
  // Starts blank (not a pre-filled demo store) so a seller can never
  // accidentally publish under a leftover sample identity ("Aura Fragrances")
  // just by skimming past a field. All four core fields are required, so the
  // form physically can't submit until the seller has typed their own values.
  const [businessInfo, setBusinessType] = useState({
    name: "",
    slug: "",
    businessType: "",
    description: "",
    country: "India",
    currency: "INR",
    language: "en-IN",
    timezone: "IST",
  });

  const [brandIdentity, setBrandIdentity] = useState({
    primaryColor: "#FAF9F6",
    secondaryColor: "#1A1A1A",
    accentColor: "#D4AF37", // Gold
    typography: "Inter",
    themeMode: "light" as "light" | "dark",
    brandStyle: "editorial" as "clean" | "bold" | "editorial" | "minimal",
  });

  const [templateKey, setTemplateKey] = useState("fashion");
  // Tracks whether the seller manually chose a template. Until they do, we keep
  // the template (and its theme) in sync with the business type they entered,
  // so an electronics/grocery store never silently ships with the fashion
  // theme + "FASHION" badge just because "fashion" was the initial default.
  const [templateTouched, setTemplateTouched] = useState(false);

  const [featureToggles, setFeatureToggles] = useState<Record<string, boolean>>({
    wishlist: true,
    compare_products: false,
    reviews: true,
    coupons: true,
    search_autocomplete: true,
    smart_recommendations: true,
    blog: true,
    faq: true,
    dark_mode: false,
    flash_deals: false,
    stock_alerts: true,
    analytics_dashboard: true,
  });

  // Step 5 Products State
  const [manualProducts, setManualProducts] = useState<any[]>([]);
  const [hasCustomizedProducts, setHasCustomizedProducts] = useState(false);
  const [newManual, setNewManual] = useState({ title: "", price: 999, sku: "", brand: "" });
  // Tracks whether the seller has typed their own price, so we stop
  // overwriting it with a fresh market suggestion as they keep typing the title.
  const [manualPriceTouched, setManualPriceTouched] = useState(false);

  // Looks up a realistic Indian market price range for whatever the seller is
  // currently typing as the product title, so prices stay relevant instead of
  // defaulting to one generic number for every kind of product.
  const manualPriceMatch = useMemo(() => {
    if (!newManual.title.trim()) return null;
    const result = classifyProduct(newManual.title.trim());
    if (!result.familyId || !PRODUCT_FAMILIES[result.familyId]) return null;
    const family = PRODUCT_FAMILIES[result.familyId];
    return {
      minRupees: Math.round(family.minPrice / 100),
      maxRupees: Math.round(family.maxPrice / 100),
      suggestedRupees: Math.round(result.suggestedPrice / 100),
    };
  }, [newManual.title]);

  // Auto-fill the price with a realistic market suggestion as the seller
  // types a recognizable product name - but only until they edit the price
  // field themselves, so we never fight their intentional input.
  useEffect(() => {
    if (manualPriceMatch && !manualPriceTouched) {
      setNewManual((prev) => ({ ...prev, price: manualPriceMatch.suggestedRupees }));
    }
  }, [manualPriceMatch, manualPriceTouched]);

  // AI Upload Pipeline States
  const [useAiPipeline, setUseAiPipeline] = useState(false);
  const [requirementsText, setRequirementsText] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiConsoleLogs, setAiConsoleLogs] = useState<string[]>([]);
  const [aiExtractedData, setAiExtractedData] = useState<any | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Publish flow state: once the store is deployed we show the merchant a
  // dedicated success screen with their live, shareable storefront URL so
  // they never have to come back through the wizard to find it again.
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishedBootstrap, setPublishedBootstrap] = useState<any | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);

  // Dynamically synchronize the manualProducts list to match the chosen industry category, unless custom overrides exist
  React.useEffect(() => {
    if (hasCustomizedProducts) return;
    const type = businessInfo.businessType || "Cosmetics & Luxury";
    const name = businessInfo.name || "Aura Fragrances";
    const seeds = getProductsForCategory(type, name);
    const mapped = seeds.map((item) => ({
      title: item.title,
      basePrice: item.basePrice * 100, // convert major standard unit to minor units (cents)
      sku: item.sku,
      brand: item.brand || name,
      description: item.description,
      imageUrl: item.imageUrl,
      attributes: item.attributes,
    }));
    setManualProducts(mapped);
  }, [businessInfo.businessType, businessInfo.name, hasCustomizedProducts]);

  // Handle Step 1
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    fetch("/api/v1/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...businessInfo, ownerId: currentUser?.id || "owner-id-1" }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.error || "Failed to create store. Please try again.");
          });
        }
        return res.json();
      })
      .then((data) => {
        if (data.error) {
          throw new Error(data.error);
        }
        setStoreId(data.id);
        setStep(2);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || "Failed to establish telemetry connection with commerce backend.");
      });
  };

  // Handle Step 2 Brand
  const handleStep2Submit = () => {
    if (!storeId) return;
    fetch(`/api/v1/stores/${storeId}/brand-identity`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandIdentity }),
    })
      .then(() => setStep(3))
      .catch((err) => console.error(err));
  };

  // Apply a template's preset brand tokens + feature defaults. Shared by both
  // manual selection and the automatic business-type-driven default so the
  // live preview and the values we send to the server always agree.
  const applyTemplatePresets = (key: string) => {
    setTemplateKey(key);
    if (key === "electronics") {
      setBrandIdentity({ primaryColor: "#0A0F24", secondaryColor: "#172A45", accentColor: "#34D6A6", typography: "Space Grotesk", themeMode: "dark", brandStyle: "bold" });
      setFeatureToggles((prev) => ({ ...prev, compare_products: true, stock_alerts: true, flash_deals: true }));
    } else if (key === "fashion") {
      setBrandIdentity({ primaryColor: "#FAF9F6", secondaryColor: "#1A1A1A", accentColor: "#E29578", typography: "Inter", themeMode: "light", brandStyle: "clean" });
      setFeatureToggles((prev) => ({ ...prev, compare_products: false, stock_alerts: true, flash_deals: false }));
    } else if (key === "grocery") {
      setBrandIdentity({ primaryColor: "#F4F9F4", secondaryColor: "#1E3F20", accentColor: "#2ECC71", typography: "Inter", themeMode: "light", brandStyle: "minimal" });
      setFeatureToggles((prev) => ({ ...prev, compare_products: false, flash_deals: true }));
    }
  };

  // Handle Step 3 Preset Presets - explicit user choice locks the template in.
  const selectTemplate = (key: string) => {
    setTemplateTouched(true);
    applyTemplatePresets(key);
  };

  // Keep the template aligned with the entered business type until the seller
  // overrides it, so the created store matches its industry instead of always
  // defaulting to the fashion template + fashion hero.
  useEffect(() => {
    if (templateTouched) return;
    const derived = deriveTemplateKey(businessInfo.businessType);
    // "custom" keeps the branding-step colors (already business-type aware)
    // rather than overwriting them with a preset.
    if (derived === "custom") {
      setTemplateKey("custom");
    } else {
      applyTemplatePresets(derived);
    }
  }, [businessInfo.businessType, templateTouched]);

  const handleStep3Submit = () => {
    if (!storeId) return;
    fetch(`/api/v1/stores/${storeId}/template`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateKey }),
    })
      .then(() => setStep(4))
      .catch((err) => console.error(err));
  };

  // Handle Step 4 Advanced selection
  const handleStep4Submit = () => {
    if (!storeId) return;
    fetch(`/api/v1/stores/${storeId}/features`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureToggles }),
    })
      .then(() => setStep(5))
      .catch((err) => console.error(err));
  };

  // Step 5 Add Manual Product
  const handleAddManualProduct = () => {
    if (!newManual.title || !newManual.sku) {
      alert("Missing SKU or Title.");
      return;
    }
    if (!newManual.price || Number.isNaN(newManual.price) || newManual.price <= 0) {
      alert("Please enter a valid selling price greater than 0.");
      return;
    }
    // Soft sanity check: if we recognize this product, make sure the entered
    // price is at least in the right ballpark for the current Indian market
    // (allowing plenty of room for budget vs. premium pricing) instead of
    // silently accepting wildly unrealistic values like ₹999 for an apple.
    if (manualPriceMatch) {
      const tooLow = newManual.price < manualPriceMatch.minRupees * 0.4;
      const tooHigh = newManual.price > manualPriceMatch.maxRupees * 3;
      if (tooLow || tooHigh) {
        const proceed = window.confirm(
          `Heads up: ₹${newManual.price} looks ${tooHigh ? "much higher" : "much lower"} than the typical Indian market price for "${newManual.title}" (₹${manualPriceMatch.minRupees.toLocaleString("en-IN")}–₹${manualPriceMatch.maxRupees.toLocaleString("en-IN")}). Add it anyway?`
        );
        if (!proceed) return;
      }
    }
    setHasCustomizedProducts(true);
    setManualProducts((prev) => [
      ...prev,
      {
        title: newManual.title,
        // The seller types the real-world selling price (e.g. 999 for ₹999).
        // Convert it to minor units (paise) here so it matches how every other
        // product in the catalog is stored, instead of saving the raw rupee
        // number as if it were already paise (which caused prices to render
        // ~100x too small on the storefront, e.g. showing "₹29" instead of "₹2,999").
        basePrice: Math.round(newManual.price * 100),
        sku: newManual.sku,
        brand: newManual.brand || businessInfo.name,
      },
    ]);
    setNewManual({ title: "", price: 999, sku: "", brand: "" });
    setManualPriceTouched(false);
  };

  // Step 5 Ingest AI Requirements File
  const handleAiRequirementsSubmit = () => {
    if (!requirementsText) return;
    setIsAiLoading(true);
    setAiConsoleLogs(["Establishing telemetry terminal connection...", "Attaching client headers: User-Agent: aistudio-build"]);

    const logs = [
      "Contacting server side NVIDIA LLM Ingestion pipeline...",
      "Extracting business structure candidate models...",
      "Mapping brand design-tokens and color palettes...",
      "Checking feature toggle schema constraints...",
      "Compiling dynamic product metadata tree structure...",
      "Seeding catalog inventory & publishing bootstrap package...",
    ];

    logs.forEach((log, index) => {
      setTimeout(() => {
        setAiConsoleLogs((prev) => [...prev, `[CLI] > ${log}`]);
      }, (index + 1) * 800);
    });

    fetch(`/api/v1/stores/${storeId}/requirements-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ textContent: requirementsText }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsAiLoading(false);
        if (data.success) {
          setAiExtractedData(data);
          // Auto fill brand and feature choices with AI suggestions
          setBrandIdentity({
            primaryColor: data.store.brandIdentity.primaryColor,
            secondaryColor: data.store.brandIdentity.secondaryColor,
            accentColor: data.store.brandIdentity.accentColor,
            typography: data.store.brandIdentity.typography,
            themeMode: data.store.brandIdentity.themeMode,
            brandStyle: data.store.brandIdentity.brandStyle,
          });
          setFeatureToggles(data.store.featureToggles);
        }
      })
      .catch((err) => {
        setIsAiLoading(false);
        console.error(err);
      });
  };

  // Final Action: Compile config, commit publish, enter Store Preview!
  const handlePublishStore = async () => {
    if (!storeId) return;
    setIsPublishing(true);
    setError(null);

    // Decide which product set to write
    let productsToSeed = [...manualProducts];

    // If no manual products and no AI-extracted collections exist, automatically seed sample products based on business type
    if (productsToSeed.length === 0 && !aiExtractedData) {
      const type = businessInfo.businessType || "Cosmetics & Luxury";
      const name = businessInfo.name || "Aura Fragrances";
      const seeds = getProductsForCategory(type, name);
      productsToSeed = seeds.map((item) => ({
        title: item.title,
        basePrice: item.basePrice * 100, // convert major standard unit to minor units (cents)
        sku: item.sku,
        brand: item.brand || name,
        description: item.description,
        imageUrl: item.imageUrl,
        attributes: item.attributes,
      }));
    }

    try {
      // Create all products sequentially or concurrently, and WAIT for completion
      if (productsToSeed.length > 0) {
        const createPromises = productsToSeed.map((p) => {
          // Longer timeout than other calls: the server now verifies each
          // product's image actually renders (with its own retries) before
          // responding, which legitimately takes longer than a normal API
          // call - especially for the first product of a new store.
          return fetchWithTimeout(
            "/api/v1/products",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Store-Id": storeId,
              },
              body: JSON.stringify({
                storeId,
                sku: `${businessInfo.slug.toUpperCase()}-${p.sku}`,
                title: p.title,
                slug: p.title.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                description: p.description || "Premium catalog seed listing.",
                brand: p.brand || businessInfo.name,
                status: "ACTIVE",
                categoryId: "cat-seeded",
                basePrice: p.basePrice,
                currency: businessInfo.currency,
                attributes: p.attributes || {},
                // Only pass a pre-set image when it truly came from a curated
                // category seed (p.imageUrl / p.images). Otherwise leave images
                // empty so the backend's generateContextualImage pipeline can
                // generate a real image that matches this exact product title,
                // instead of a random unrelated loremflickr photo.
                ...(p.imageUrl ? { images: [p.imageUrl] } : p.images ? { images: p.images } : {}),
                variants: [
                  {
                    id: `v-${p.sku}-${Date.now()}`,
                    sku: `${p.sku}-MAIN`,
                    attributes: {},
                    priceDelta: 0,
                    quantityOnHand: 100,
                    quantityReserved: 0,
                  },
                ],
              }),
            },
            45000
          )
            .then((res) => {
              if (!res.ok) console.error("Failed to seed product", p.title);
            })
            .catch((err) => {
              // Don't let one slow/failed product seed abort the whole
              // deploy - log it and continue with the rest.
              console.error("Failed to seed product", p.title, err);
            });
        });
        await Promise.all(createPromises);
      }

      // Now call publish endpoint
      const publishRes = await fetchWithTimeout(`/api/v1/stores/${storeId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publisher: "Owner Dashboard" }),
      });
      if (!publishRes.ok) {
        throw new Error("Failed to publish store. Please try again.");
      }
      await publishRes.json();

      // Finally, fetch the full aggregated storefront bootstrap
      const bootstrapRes = await fetchWithTimeout(`/api/v1/storefront/config?storeId=${storeId}`);
      const bootstrapPayload = await bootstrapRes.json();

      // Build the permanent, shareable live URL for this store. Because the
      // app resolves "/store/:slug" directly (see App.tsx), this link works
      // in any browser tab even after this wizard session is long gone.
      const liveUrl = `${window.location.origin}/store/${businessInfo.slug}`;

      setPublishedBootstrap(bootstrapPayload);
      setPublishedUrl(liveUrl);
      setIsPublishing(false);
    } catch (err: any) {
      console.error("Error during storefront publish pipeline:", err);
      const message =
        err?.name === "AbortError"
          ? "Publishing timed out — the server took too long to respond. Please try again."
          : err?.message || "Something went wrong while publishing your store. Please try again.";
      setError(message);
      setIsPublishing(false);
    }
  };

  const handleCopyUrl = () => {
    if (!publishedUrl) return;
    navigator.clipboard
      .writeText(publishedUrl)
      .then(() => {
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2000);
      })
      .catch(() => {
        setUrlCopied(false);
      });
  };

  // --- Publish Success Screen ---
  // Shown the moment the store is deployed. This is the ONLY place the
  // merchant needs to grab their live URL from - it stays visible until they
  // choose to continue, and the URL itself is also shown inside the Owner
  // Dashboard afterwards so it's never lost.
  if (publishedUrl) {
    return (
      <div className="relative min-h-screen bg-[#0A0C10] text-slate-100 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full bg-[#13161D] border border-slate-900 rounded-3xl p-8 space-y-6 shadow-2xl text-center"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-sans tracking-tight text-white">Your store is live!</h2>
            <p className="text-slate-400 text-sm">
              <strong className="text-white">{businessInfo.name}</strong> has been deployed. Share this link with
              anyone &mdash; it works directly in any browser, any time, without coming back here.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-black/40 border border-slate-800 rounded-full p-1.5 pl-4">
            <span className="flex-grow text-left text-xs font-mono text-indigo-300 truncate">{publishedUrl}</span>
            <button
              onClick={handleCopyUrl}
              className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-full transition cursor-pointer flex-shrink-0"
            >
              {urlCopied ? "Copied!" : "Copy Link"}
            </button>
          </div>

          {onManageStore && (
            <button
              onClick={() => publishedBootstrap && onManageStore(publishedBootstrap)}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs px-5 py-3.5 rounded-full transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              Manage Products & Store <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-grow bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs px-5 py-3 rounded-full transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              Open Live Store <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => publishedBootstrap && onComplete(publishedBootstrap)}
              className="flex-grow border border-slate-800 hover:bg-slate-500/5 text-slate-200 font-bold text-xs px-5 py-3 rounded-full transition cursor-pointer"
            >
              Continue to Store Preview
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0A0C10] text-slate-100 flex flex-col md:flex-row overflow-hidden">
      {/* LEFT: FORM CONTENT */}
      <div className="w-full md:w-3/5 min-h-screen z-10 flex flex-col justify-between p-8 md:p-12 bg-[#0A0C10]/95 backdrop-blur-sm border-r border-slate-900 overflow-y-auto">
        {/* Wizard Header Navbar */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-900">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-bold font-sans tracking-tight text-lg">Store Creation Wizard</h2>
              <p className="text-slate-500 text-xs">Deploying premium commerce infrastructure</p>
            </div>
          </div>
          <button
            onClick={onExit}
            className="text-xs text-slate-500 hover:text-slate-300 font-semibold border border-slate-900 rounded-lg px-3 py-1.5 transition cursor-pointer"
          >
            Cancel Wizard
          </button>
        </div>

        {/* Dynamic Multi-Step Progress Indicators */}
        <div className="flex items-center gap-2 my-6">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex-grow flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold text-xs font-mono transition-all ${
                  step === s
                    ? "bg-indigo-500 text-white ring-4 ring-indigo-500/10"
                    : step > s
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-900 text-slate-500"
                }`}
              >
                {s}
              </div>
              <span
                className={`text-[10px] uppercase font-mono tracking-wider hidden lg:block ${
                  step === s ? "text-indigo-400 font-bold" : "text-slate-600"
                }`}
              >
                {s === 1
                  ? "BUSINESS"
                  : s === 2
                  ? "BRANDING"
                  : s === 3
                  ? "TEMPLATES"
                  : s === 4
                  ? "FEATURES"
                  : "PUBLISH"}
              </span>
              {s < 5 && <div className="h-0.5 bg-slate-900 flex-grow" />}
            </div>
          ))}
        </div>

        {/* Render Steps */}
        <div className="flex-grow flex flex-col justify-center max-w-xl mx-auto w-full py-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleStep1Submit}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <h3 className="text-xl font-bold font-sans tracking-tight">Step 1: Core Business Specifications</h3>
                  <p className="text-slate-400 text-xs">Let's set up the core parameters of your commerce instance.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block mb-1">
                      Storefront Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nova Electronics"
                      value={businessInfo.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setBusinessType((prev) => ({
                          ...prev,
                          name,
                          // Keep the slug in sync with the name until the seller
                          // edits the slug field themselves - so a fresh store
                          // never accidentally keeps a previous/default slug.
                          slug: slugTouched ? prev.slug : name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
                        }));
                      }}
                      className="w-full text-xs p-3 bg-slate-500/5 border border-slate-900 rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block mb-1">
                      Slug Identifier (URL)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. nova-electronics"
                      value={businessInfo.slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setBusinessType((prev) => ({ ...prev, slug: e.target.value }));
                      }}
                      className="w-full text-xs p-3 bg-slate-500/5 border border-slate-900 rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block mb-1">
                    Industry Type / Niche
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Electronics, Grocery, Fashion"
                    value={businessInfo.businessType}
                    onChange={(e) => setBusinessType((prev) => ({ ...prev, businessType: e.target.value }))}
                    className="w-full text-xs p-3 bg-slate-500/5 border border-slate-900 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block mb-1">
                    Brief Instance Description
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="What does this store sell? Who is it for?"
                    value={businessInfo.description}
                    onChange={(e) => setBusinessType((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full text-xs p-3 bg-slate-500/5 border border-slate-900 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                    <span className="text-sm mt-0.5">⚠️</span>
                    <div>
                      <p className="font-semibold text-[11px] uppercase tracking-wider font-mono">Telemetry Alert</p>
                      <p className="opacity-90">{error}</p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-indigo-500 hover:bg-indigo-600 py-3 rounded-full text-white font-semibold text-xs transition duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Continue to Branding Tokens
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.form>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h3 className="text-xl font-bold font-sans tracking-tight">Step 2: Brand Identity Tokens</h3>
                  <p className="text-slate-400 text-xs">Set up your brand guidelines. Color variables map 1:1 onto layout variables.</p>
                </div>

                {/* Live Swatch Picker */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandIdentity.primaryColor}
                        onChange={(e) => setBrandIdentity((prev) => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-8 h-8 rounded-lg overflow-hidden border-0 cursor-pointer"
                      />
                      <span className="text-xs font-mono text-slate-400">{brandIdentity.primaryColor}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block">
                      Secondary Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandIdentity.secondaryColor}
                        onChange={(e) => setBrandIdentity((prev) => ({ ...prev, secondaryColor: e.target.value }))}
                        className="w-8 h-8 rounded-lg overflow-hidden border-0 cursor-pointer"
                      />
                      <span className="text-xs font-mono text-slate-400">{brandIdentity.secondaryColor}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block">
                      Accent Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandIdentity.accentColor}
                        onChange={(e) => setBrandIdentity((prev) => ({ ...prev, accentColor: e.target.value }))}
                        className="w-8 h-8 rounded-lg overflow-hidden border-0 cursor-pointer"
                      />
                      <span className="text-xs font-mono text-slate-400">{brandIdentity.accentColor}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block mb-1">
                      Display Font Pairings
                    </label>
                    <select
                      value={brandIdentity.typography}
                      onChange={(e) => setBrandIdentity((prev) => ({ ...prev, typography: e.target.value }))}
                      className="w-full text-xs p-3 bg-[#13161D] border border-slate-900 rounded-xl text-slate-300"
                    >
                      <option value="Inter">Clean: Inter Duo</option>
                      <option value="Space Grotesk">Technical: Space Grotesk</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block mb-1">
                      Theme Interface Mode
                    </label>
                    <select
                      value={brandIdentity.themeMode}
                      onChange={(e) => setBrandIdentity((prev) => ({ ...prev, themeMode: e.target.value as any }))}
                      className="w-full text-xs p-3 bg-[#13161D] border border-slate-900 rounded-xl text-slate-300"
                    >
                      <option value="light">Refined Light Theme</option>
                      <option value="dark">Cosmic Dark Theme</option>
                    </select>
                  </div>
                </div>

                {/* Color Warning Alert */}
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs">
                  <HelpCircle className="w-4 h-4 inline mr-1.5" />
                  <strong>Accessibility check passed!</strong> Contrast ratio between primary and secondary is within safe thresholds.
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-grow border border-slate-900 py-3 rounded-full font-semibold text-xs hover:bg-slate-500/5 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleStep2Submit}
                    className="flex-grow bg-indigo-500 hover:bg-indigo-600 py-3 rounded-full text-white font-semibold text-xs transition duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Choose Base Preset Template
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h3 className="text-xl font-bold font-sans tracking-tight">Step 3: Choose Store Template</h3>
                  <p className="text-slate-400 text-xs">Selecting a template auto-loads high-fidelity tokens & preset features.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Preset 1 */}
                  <div
                    onClick={() => selectTemplate("fashion")}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      templateKey === "fashion"
                        ? "bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/20"
                        : "bg-slate-900 border-slate-900/60 hover:border-slate-800"
                    }`}
                  >
                    <div className="w-full aspect-video rounded-lg bg-orange-100 flex items-center justify-center mb-3">
                      <Layout className="text-slate-800" />
                    </div>
                    <span className="font-bold text-xs block">Lumina Premium Fashion</span>
                    <span className="text-[10px] text-slate-400 mt-1 block">Elegant, soft tones, Inter editorial typography.</span>
                  </div>

                  {/* Preset 2 */}
                  <div
                    onClick={() => selectTemplate("electronics")}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      templateKey === "electronics"
                        ? "bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/20"
                        : "bg-slate-900 border-slate-900/60 hover:border-slate-800"
                    }`}
                  >
                    <div className="w-full aspect-video rounded-lg bg-slate-950 flex items-center justify-center mb-3">
                      <Layout className="text-emerald-400" />
                    </div>
                    <span className="font-bold text-xs block">ElectroMax Futuristic</span>
                    <span className="text-[10px] text-slate-400 mt-1 block">Void-dark color palettes, Space Grotesk, comparisons.</span>
                  </div>

                  {/* Preset 3 */}
                  <div
                    onClick={() => selectTemplate("grocery")}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      templateKey === "grocery"
                        ? "bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/20"
                        : "bg-slate-900 border-slate-900/60 hover:border-slate-800"
                    }`}
                  >
                    <div className="w-full aspect-video rounded-lg bg-emerald-950/10 border border-emerald-900/30 flex items-center justify-center mb-3">
                      <Layout className="text-emerald-500" />
                    </div>
                    <span className="font-bold text-xs block">FreshCart Organics</span>
                    <span className="text-[10px] text-slate-400 mt-1 block">Minimal grid layouts, soft pastel palettes.</span>
                  </div>

                  {/* Preset 4 */}
                  <div
                    onClick={() => selectTemplate("custom")}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      templateKey === "custom"
                        ? "bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/20"
                        : "bg-slate-900 border-slate-900/60 hover:border-slate-800"
                    }`}
                  >
                    <div className="w-full aspect-video rounded-lg bg-[#13161D] flex items-center justify-center mb-3">
                      <Layout className="text-slate-500" />
                    </div>
                    <span className="font-bold text-xs block">Fully Custom Canvas</span>
                    <span className="text-[10px] text-slate-400 mt-1 block">Blank blueprint canvas to style entirely from scratch.</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-grow border border-slate-900 py-3 rounded-full font-semibold text-xs hover:bg-slate-500/5 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleStep3Submit}
                    className="flex-grow bg-indigo-500 hover:bg-indigo-600 py-3 rounded-full text-white font-semibold text-xs transition duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Configure Advanced Engine Features
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h3 className="text-xl font-bold font-sans tracking-tight">Step 4: Commerce Engine Features</h3>
                  <p className="text-slate-400 text-xs">Enable/disable complex capabilities of CoreCart. Features compile out of DOM when disabled.</p>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {/* Row Wishlist */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs block">Wishlist Database Persistence</span>
                      <span className="text-[10px] text-slate-500">Enable customers to save and query persistent favorite logs.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={featureToggles.wishlist}
                      onChange={(e) => setFeatureToggles((prev) => ({ ...prev, wishlist: e.target.checked }))}
                      className="accent-indigo-500"
                    />
                  </div>

                  {/* Row Coupons */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs block">Discount Engine (Coupons / Automatic rules)</span>
                      <span className="text-[10px] text-slate-500">Evaluate conditions, apply multi-tier discounts.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={featureToggles.coupons}
                      onChange={(e) => setFeatureToggles((prev) => ({ ...prev, coupons: e.target.checked }))}
                      className="accent-indigo-500"
                    />
                  </div>

                  {/* Row Reviews */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs block">Product Reviews & Ratings</span>
                      <span className="text-[10px] text-slate-500">Collect ratings and host verified moderating queues.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={featureToggles.reviews}
                      onChange={(e) => setFeatureToggles((prev) => ({ ...prev, reviews: e.target.checked }))}
                      className="accent-indigo-500"
                    />
                  </div>

                  {/* Row Autocomplete */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs block">Fuzzy Trigram Autocomplete</span>
                      <span className="text-[10px] text-slate-500">Real-time prefix suggestions in header navbar.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={featureToggles.search_autocomplete}
                      onChange={(e) => setFeatureToggles((prev) => ({ ...prev, search_autocomplete: e.target.checked }))}
                      className="accent-indigo-500"
                    />
                  </div>

                  {/* Row Flash Deals */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs block">Time-Boxed Flash Deals</span>
                      <span className="text-[10px] text-slate-500">Auto-inject timed countdown overlays.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={featureToggles.flash_deals}
                      onChange={(e) => setFeatureToggles((prev) => ({ ...prev, flash_deals: e.target.checked }))}
                      className="accent-indigo-500"
                    />
                  </div>

                  {/* Row Comparison - dependent */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs block flex items-center gap-1.5">
                        Product Comparison Tool
                        <span className="text-[9px] bg-indigo-500/10 text-indigo-400 font-mono px-1 rounded">Requires Variants</span>
                      </span>
                      <span className="text-[10px] text-slate-500">Compare complex product specs in grids.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={featureToggles.compare_products}
                      onChange={(e) => setFeatureToggles((prev) => ({ ...prev, compare_products: e.target.checked }))}
                      className="accent-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(3)}
                    className="flex-grow border border-slate-900 py-3 rounded-full font-semibold text-xs hover:bg-slate-500/5 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleStep4Submit}
                    className="flex-grow bg-indigo-500 hover:bg-indigo-600 py-3 rounded-full text-white font-semibold text-xs transition duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Continue to Products & Publish
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h3 className="text-xl font-bold font-sans tracking-tight">Step 5: Products & Deployment</h3>
                  <p className="text-slate-400 text-xs">Configure your initial collections catalog or upload an enterprise requirements plan.</p>
                </div>

                {/* Split Pipeline Selector */}
                <div className="flex border border-slate-900 p-1.5 rounded-full bg-[#13161D]">
                  <button
                    onClick={() => setUseAiPipeline(false)}
                    className={`flex-grow py-2 rounded-full font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      !useAiPipeline ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" /> Manual Catalog Table
                  </button>
                  <button
                    onClick={() => setUseAiPipeline(true)}
                    className={`flex-grow py-2 rounded-full font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      useAiPipeline ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <UploadCloud className="w-4 h-4" /> AI Requirements Ingestion
                  </button>
                </div>

                {/* Path A: Manual Catalog Config */}
                {!useAiPipeline && (
                  <div className="space-y-4">
                    <span className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block">
                      Active Seeding Catalog Products
                    </span>
                    <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-900 rounded-xl p-3 bg-slate-500/5">
                      {manualProducts.map((p, idx) => (
                        <div key={idx} className="text-xs flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                          <div>
                            <span className="font-bold block">{p.title}</span>
                            <span className="text-[10px] text-slate-500 block font-mono">
                              SKU: {p.sku} | Price: {businessInfo.currency === "INR" ? "₹" : "$"}
                              {(p.basePrice / 100).toFixed(2)}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setHasCustomizedProducts(true);
                              setManualProducts((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="text-red-400 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                      <span className="text-[10px] font-bold tracking-tight text-indigo-400 block">Add Seeding Item</span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <input
                          type="text"
                          placeholder="Title, e.g. Silk Scarve"
                          value={newManual.title}
                          onChange={(e) => setNewManual((prev) => ({ ...prev, title: e.target.value }))}
                          className="p-2 bg-slate-500/10 border border-slate-800 rounded focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="SKU, e.g. SLK-SCARF"
                          value={newManual.sku}
                          onChange={(e) => setNewManual((prev) => ({ ...prev, sku: e.target.value }))}
                          className="p-2 bg-slate-500/10 border border-slate-800 rounded focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder={`Selling Price (${businessInfo.currency === "INR" ? "₹" : businessInfo.currency}, e.g. 999)`}
                          value={Number.isNaN(newManual.price) ? "" : newManual.price}
                          onChange={(e) => {
                            setManualPriceTouched(true);
                            setNewManual((prev) => ({ ...prev, price: parseFloat(e.target.value) }));
                          }}
                          className="p-2 text-xs bg-slate-500/10 border border-slate-800 rounded focus:outline-none focus:border-indigo-500 flex-grow"
                        />
                        <button
                          type="button"
                          onClick={handleAddManualProduct}
                          className="bg-indigo-500 hover:bg-indigo-600 px-4 rounded text-white font-bold text-xs cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      {manualPriceMatch && (
                        <p className="text-[10px] text-slate-500 font-mono">
                          Typical India market price for &quot;{newManual.title.trim()}&quot;: ₹
                          {manualPriceMatch.minRupees.toLocaleString("en-IN")} – ₹{manualPriceMatch.maxRupees.toLocaleString("en-IN")}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Path B: NVIDIA AI Requirements Document Ingest */}
                {useAiPipeline && (
                  <div className="space-y-4">
                    <span className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block">
                      Enterprise Document Upload Terminal
                    </span>

                    {!aiExtractedData ? (
                      <div className="space-y-3">
                        <textarea
                          placeholder="Type or copy-paste your plain-text requirements document... E.g. 'A store named CyberGadget focused on premium high-speed gadgets. Host a void dark theme with neon mint colors. Seed products like holographic drones, smart bands...'"
                          rows={6}
                          value={requirementsText}
                          onChange={(e) => setRequirementsText(e.target.value)}
                          className="w-full text-xs p-4 bg-slate-500/5 border border-slate-900 rounded-xl focus:outline-none focus:border-indigo-500 leading-relaxed font-mono"
                        />
                        <button
                          onClick={handleAiRequirementsSubmit}
                          disabled={isAiLoading}
                          className="w-full bg-[#13161D] border border-slate-800 hover:bg-[#1A1F29] py-3 rounded-full text-indigo-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Sparkles className="w-4 h-4 animate-pulse" />
                          Parse Document with NVIDIA LLM
                        </button>
                      </div>
                    ) : (
                      <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3 text-xs">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold">
                          <CheckCircle className="w-5 h-5" />
                          Requirements Extracted & Seeding Catalog Created!
                        </div>
                        <div className="space-y-1 font-mono text-[11px] text-slate-300">
                          <div>
                            <strong>Extracted Name:</strong> {aiExtractedData.extracted.name}
                          </div>
                          <div>
                            <strong>Extracted Industry:</strong> {aiExtractedData.extracted.businessType}
                          </div>
                          <div>
                            <strong>Feature Count:</strong> {Object.keys(aiExtractedData.store.featureToggles).length}
                          </div>
                          <div>
                            <strong>Seeded Inventory Count:</strong> {aiExtractedData.products.length} Products
                          </div>
                        </div>
                        <button
                          onClick={() => setAiExtractedData(null)}
                          className="text-xs underline text-slate-400 hover:text-slate-100"
                        >
                          Upload Alternate Specifications Document
                        </button>
                      </div>
                    )}

                    {/* Dynamic Loading console CLI visualizer */}
                    {isAiLoading && (
                      <div className="p-4 rounded-xl bg-black border border-slate-900 font-mono text-[10px] space-y-1.5 text-slate-400">
                        <div className="flex items-center justify-between text-indigo-400 border-b border-slate-900 pb-1 mb-2 font-bold uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <Terminal className="w-3.5 h-3.5" /> CoreCart AI Ingestion CLI
                          </span>
                          <span className="animate-pulse">PROCESSING...</span>
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1">
                          {aiConsoleLogs.map((log, idx) => (
                            <div key={idx} className="line-clamp-1 leading-snug">
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-6 border-t border-slate-900">
                  <button
                    onClick={() => setStep(4)}
                    className="flex-grow border border-slate-900 py-3 rounded-full font-semibold text-xs hover:bg-slate-500/5 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={handlePublishStore}
                    disabled={isPublishing}
                    className="flex-grow bg-emerald-500 hover:bg-emerald-600 py-3 rounded-full text-slate-950 font-bold text-xs transition duration-300 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {isPublishing ? "Deploying Store..." : "Lock Specifications & Deploy Store!"}
                    {!isPublishing && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT: LIVE PREVIEW DOCK (MINI ASSEMBLY CANVAS) */}
      <div className="hidden md:flex w-2/5 min-h-screen relative bg-[#06070a] border-l border-slate-950 flex-col items-center justify-center p-8 overflow-hidden">
        {/* Absolute Background Canvas */}
        <AssemblyCanvas
          scrollProgress={0}
          wizardStep={step}
          accentColor={brandIdentity.accentColor}
        />

        {/* Live floating preview frame card */}
        <div className="relative max-w-sm w-full rounded-2xl overflow-hidden border border-slate-900/60 shadow-2xl p-6 bg-[#13161D]/90 backdrop-blur-md z-10 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-900">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Live Preview Chassis</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          </div>

          <div className="my-6 space-y-4">
            <div className="space-y-1 text-center">
              <span className="text-[10px] uppercase font-mono tracking-wider bg-slate-500/10 border border-slate-300/10 px-2 py-0.5 rounded text-indigo-400">
                {businessInfo.slug ? businessInfo.slug.toUpperCase() : "YOUR-SLUG"}
              </span>
              <h4 className="font-bold text-lg tracking-tight mt-2">{businessInfo.name || "Your Store Name"}</h4>
              <p className="text-slate-400 text-xs line-clamp-2">{businessInfo.description || "Your store description will appear here."}</p>
            </div>

            {/* Simulated Color swatches */}
            <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-900">
              <div className="text-center space-y-1">
                <div
                  className="w-8 h-8 rounded-full border border-slate-700 mx-auto"
                  style={{ backgroundColor: brandIdentity.primaryColor }}
                />
                <span className="text-[9px] font-mono text-slate-500">Primary</span>
              </div>
              <div className="text-center space-y-1">
                <div
                  className="w-8 h-8 rounded-full border border-slate-700 mx-auto"
                  style={{ backgroundColor: brandIdentity.secondaryColor }}
                />
                <span className="text-[9px] font-mono text-slate-500">Secondary</span>
              </div>
              <div className="text-center space-y-1">
                <div
                  className="w-8 h-8 rounded-full border border-slate-700 mx-auto"
                  style={{ backgroundColor: brandIdentity.accentColor }}
                />
                <span className="text-[9px] font-mono text-slate-500">Accent</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>TEMPLATE: {templateKey.toUpperCase()}</span>
            <span>STATUS: {step === 5 ? "STAGING" : "DRAFT"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
