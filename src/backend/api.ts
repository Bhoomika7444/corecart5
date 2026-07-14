/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response, NextFunction } from "express";
import { db, Store, Product, Category, Cart, Order, OrderItem, CMSContent, Review, User } from "../shared/database/db";
import { nvidiaGenerateContent, isNvidiaConfigured } from "./nvidia";
import * as crypto from "crypto";
import { classifyProduct, expandSearchQuery } from "./productIntelligence";
import { getBrandColorsForCategory, getProductsForCategory, generateLogoOptions, buildHeroImageUrl } from "../shared/database/catalogSeeds";
import { generateContextualImage } from "./imageIntelligence";

export const apiRouter = Router();

// --- Express Typings Augmentation ---
declare global {
  namespace Express {
    interface Request {
      storeId?: string;
      store?: Store;
      user?: User;
    }
  }
}

// ------------------------------------------------------------------
// Admin Endpoint
// ------------------------------------------------------------------

// Very small bearer-token check: our /auth/login issues `mock-jwt-token-<userId>`.
// We resolve that back to a user and verify they hold the PLATFORM_ADMIN role
// before allowing access to any cross-tenant admin data.
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = (req.headers["authorization"] || "") as string;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  const match = /^mock-jwt-token-(.+)$/.exec(token || "");
  const userId = match ? match[1] : null;
  const user = userId ? db.users.findById(userId) : undefined;

  if (!user || user.role !== "PLATFORM_ADMIN") {
    return res.status(401).json({ error: "Admin authentication required." });
  }
  next();
}

apiRouter.get("/admin/stats", requireAdmin, (req, res) => {
  try {
    const allStores = db.stores.findAll();
    const storeCount = allStores.length;
    const activeStoreCount = allStores.filter((s) => s.status === "ACTIVE").length;
    const userCount = db.users.findAll().filter((u) => u.role !== "PLATFORM_ADMIN").length;
    res.json({ storeCount, activeStoreCount, userCount });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Full directory of every store ever created on the platform, along with
// its owner and the exact live URL a customer would use to visit it.
apiRouter.get("/admin/stores", requireAdmin, (req, res) => {
  try {
    const allStores = db.stores.findAll();
    const rows = allStores
      .map((store) => {
        const owner = db.users.findById(store.ownerId);
        const productCount = db.products.findAllByStore(store.id).length;
        return {
          id: store.id,
          name: store.name,
          slug: store.slug,
          url: `/store/${store.slug}`,
          businessType: store.businessType,
          status: store.status,
          ownerName: owner?.name || "Unknown",
          ownerEmail: owner?.email || "Unknown",
          productCount,
          createdAt: store.createdAt,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ stores: rows, total: rows.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch store directory" });
  }
});

// --- Tenant Resolution Middleware ---
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  // Resolve store slug/id from headers or query params
  const storeId = (req.headers["x-store-id"] || req.query.storeId) as string;
  const storeSlug = (req.headers["x-store-slug"] || req.query.storeSlug) as string;

  if (storeId) {
    const store = db.stores.findById(storeId);
    if (store) {
      req.storeId = store.id;
      req.store = store;
    }
  } else if (storeSlug) {
    const store = db.stores.findUnique(storeSlug);
    if (store) {
      req.storeId = store.id;
      req.store = store;
    }
  }
  next();
});

// Helper for native password hashing
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Server-side mirror of the frontend password rules. Never trust the client alone.
function getPasswordValidationError(password: string): string | null {
  if (!password || password.length < 6) return "Password must be at least 6 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include at least one special character.";
  return null;
}

// --- 1. AUTHENTICATION ENGINE ---
apiRouter.post("/auth/register", (req, res) => {
  const { email, password, name, role, storeId } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Missing required registration parameters." });
  }

  const passwordError = getPasswordValidationError(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const existing = db.users.findUnique(email);
  if (existing) {
    return res.status(409).json({ error: "Email already registered." });
  }

  const newUser = db.users.create({
    email,
    passwordHash: hashPassword(password),
    role: role || "CUSTOMER",
    name,
    storeId,
  });

  // Strip password hash from response
  const { passwordHash, ...userResponse } = newUser;
  res.status(201).json({ user: userResponse, token: `mock-jwt-token-${newUser.id}` });
});

apiRouter.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.users.findUnique(email);
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const { passwordHash, ...userResponse } = user;
  res.status(200).json({ user: userResponse, token: `mock-jwt-token-${user.id}` });
});

// --- 2. STORE LIFE-CYCLE & WIZARD ENGINE ---
// List stores, optionally filtered by owner (used by the "My Stores" screen)
apiRouter.get("/stores", (req, res) => {
  const { ownerId } = req.query;
  let stores = db.stores.findAll();
  if (ownerId) {
    stores = stores.filter((s) => s.ownerId === ownerId);
  }
  const trimmed = stores
    .map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      businessType: s.businessType,
      status: s.status,
      createdAt: s.createdAt,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(trimmed);
});

// Step 1: Create Draft Store (Business Info)
apiRouter.post("/stores", (req, res) => {
  const { name, slug, businessType, description, country, currency, language, timezone, ownerId } = req.body;
  if (!name || !slug || !ownerId) {
    return res.status(400).json({ error: "Store name, unique slug, and owner reference are required." });
  }

  let finalSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!finalSlug) {
    finalSlug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "store";
  }

  // Gracefully handle existing store slug by appending a unique short hex suffix
  const existing = db.stores.findUnique(finalSlug);
  if (existing) {
    const uniqueSuffix = crypto.randomBytes(3).toString("hex");
    finalSlug = `${finalSlug}-${uniqueSuffix}`;
  }

  const brandColors = getBrandColorsForCategory(businessType || "Retail");
  const logoOptions = generateLogoOptions(name, businessType || "Retail");
  const defaultLogo = logoOptions.find((l) => l.type === "Modern") || logoOptions[0];

  const newStore = db.stores.create({
    ownerId,
    name,
    slug: finalSlug,
    businessType: businessType || "Retail",
    description: description || "",
    country: country || "India",
    currency: currency || "INR",
    language: language || "en",
    timezone: timezone || "IST",
    status: "DRAFT",
    templateKey: "custom",
    brandIdentity: {
      primaryColor: brandColors.primaryColor,
      secondaryColor: brandColors.secondaryColor,
      accentColor: brandColors.accentColor,
      typography: brandColors.brandStyle === "bold" ? "Space Grotesk" : "Inter",
      themeMode: brandColors.brandStyle === "bold" ? "dark" : "light",
      brandStyle: brandColors.brandStyle,
      logoConfig: defaultLogo,
    } as any,
    featureToggles: {
      wishlist: true,
      reviews: true,
      coupons: true,
      search_autocomplete: true,
      smart_recommendations: true,
    },
  });

  res.status(201).json(newStore);
});

// Step 2: Configure Brand Identity
apiRouter.patch("/stores/:id/brand-identity", (req, res) => {
  const { id } = req.params;
  const { brandIdentity } = req.body;
  if (!brandIdentity) {
    return res.status(400).json({ error: "Brand identity configuration missing." });
  }

  const store = db.stores.findById(id);
  if (!store) return res.status(404).json({ error: "Store not found." });

  const updatedStore = db.stores.update(id, {
    brandIdentity: {
      ...store.brandIdentity,
      ...brandIdentity,
    },
  });

  res.status(200).json(updatedStore);
});

// Step 3: Choose Template
apiRouter.patch("/stores/:id/template", (req, res) => {
  const { id } = req.params;
  const { templateKey } = req.body;
  if (!templateKey) {
    return res.status(400).json({ error: "Template key is required." });
  }

  const store = db.stores.findById(id);
  if (!store) return res.status(404).json({ error: "Store not found." });

  // Templates have default feature configurations & brandings
  let brandIdentity = store.brandIdentity;
  let featureToggles = { ...store.featureToggles };

  if (templateKey === "electronics") {
    brandIdentity = { primaryColor: "#0A0F24", secondaryColor: "#172A45", accentColor: "#34D6A6", typography: "Space Grotesk", themeMode: "dark", brandStyle: "bold" };
    featureToggles.compare_products = true;
    featureToggles.stock_alerts = true;
    featureToggles.flash_deals = true;
  } else if (templateKey === "fashion") {
    brandIdentity = { primaryColor: "#FAF9F6", secondaryColor: "#1A1A1A", accentColor: "#E29578", typography: "Inter", themeMode: "light", brandStyle: "clean" };
    featureToggles.compare_products = false;
    featureToggles.stock_alerts = true;
    featureToggles.flash_deals = false;
  } else if (templateKey === "grocery") {
    brandIdentity = { primaryColor: "#F4F9F4", secondaryColor: "#1E3F20", accentColor: "#2ECC71", typography: "Inter", themeMode: "light", brandStyle: "minimal" };
    featureToggles.compare_products = false;
    featureToggles.flash_deals = true;
  }

  const updatedStore = db.stores.update(id, {
    templateKey,
    brandIdentity,
    featureToggles,
  });

  res.status(200).json(updatedStore);
});

// Step 4: Configure Feature Selection
apiRouter.patch("/stores/:id/features", (req, res) => {
  const { id } = req.params;
  const { featureToggles } = req.body;
  if (!featureToggles) {
    return res.status(400).json({ error: "Feature selection mapping required." });
  }

  const store = db.stores.findById(id);
  if (!store) return res.status(404).json({ error: "Store not found." });

  // Feature dependency mapping (wishlist dependencies, etc)
  const updatedFeatures = {
    ...store.featureToggles,
    ...featureToggles,
  };

  const updatedStore = db.stores.update(id, {
    featureToggles: updatedFeatures,
  });

  res.status(200).json(updatedStore);
});

// Step 5: Publish Store
apiRouter.post("/stores/:id/publish", (req, res) => {
  const { id } = req.params;
  const { publisher } = req.body;

  const store = db.stores.findById(id);
  if (!store) return res.status(404).json({ error: "Store not found." });

  // Set active
  const updatedStore = db.stores.update(id, { status: "ACTIVE" });

  // Create Snapshot / History config version
  const lastVersion = db.configVersions.findAllByStore(id).length;
  db.configVersions.create({
    storeId: id,
    version: lastVersion + 1,
    configJson: JSON.stringify(updatedStore),
    publishedBy: publisher || "System Owner",
  });

  res.status(200).json({ success: true, store: updatedStore, version: lastVersion + 1 });
});

// Delete (archive) a store — used by the "My Stores" screen so an owner can
// remove a store they no longer want, whether it's still a draft or already
// published. We archive rather than hard-delete so historical order/config
// data isn't destroyed, and archived stores are already excluded everywhere
// else in the app (findAll/findById/findUnique all filter out ARCHIVED).
apiRouter.delete("/stores/:id", (req, res) => {
  const { id } = req.params;
  const { ownerId } = req.body || {};

  const store = db.stores.findById(id);
  if (!store) return res.status(404).json({ error: "Store not found." });

  if (ownerId && store.ownerId !== ownerId) {
    return res.status(403).json({ error: "You do not have permission to delete this store." });
  }

  const updatedStore = db.stores.update(id, { status: "ARCHIVED" });
  res.status(200).json({ success: true, store: updatedStore });
});

// Configure Layout, Custom Navigation, & Theme Settings
apiRouter.patch("/stores/:id/layout", (req, res) => {
  const { id } = req.params;
  const { homepageConfig, navigationConfig, footerConfig, buttonStyle, name, brandIdentity, featureToggles } = req.body;

  const store = db.stores.findById(id);
  if (!store) return res.status(404).json({ error: "Store not found." });

  // Compile layout update payload
  const updatePayload: any = {};
  if (homepageConfig !== undefined) updatePayload.homepageConfig = homepageConfig;
  if (navigationConfig !== undefined) updatePayload.navigationConfig = navigationConfig;
  if (footerConfig !== undefined) updatePayload.footerConfig = footerConfig;
  if (buttonStyle !== undefined) updatePayload.buttonStyle = buttonStyle;
  if (name !== undefined) updatePayload.name = name;
  if (brandIdentity !== undefined) {
    updatePayload.brandIdentity = {
      ...store.brandIdentity,
      ...brandIdentity
    };
  }
  if (featureToggles !== undefined) {
    updatePayload.featureToggles = {
      ...store.featureToggles,
      ...featureToggles
    };
  }

  const updatedStore = db.stores.update(id, updatePayload);

  // Commit history config version snapshot
  const lastVersion = db.configVersions.findAllByStore(id).length;
  db.configVersions.create({
    storeId: id,
    version: lastVersion + 1,
    configJson: JSON.stringify(updatedStore),
    publishedBy: "Storefront Editor",
  });

  res.status(200).json(updatedStore);
});

// Retrieve version logs
// The raw config-version record only stores a stringified `configJson`
// snapshot. The dashboard, however, reads `version.theme.*`, `version.features`,
// `version.publisher` and `version.createdAt` directly. Return an enriched
// shape (theme + features parsed out of the snapshot) so the dashboard never
// crashes trying to read `.theme.primaryColor` off an undefined value - which
// is what was causing the whole "Manage Store" screen to render blank.
apiRouter.get("/stores/:id/history", (req, res) => {
  const { id } = req.params;
  const history = db.configVersions.findAllByStore(id).map((v) => {
    let snapshot: any = {};
    try {
      snapshot = JSON.parse(v.configJson);
    } catch {
      snapshot = {};
    }
    return {
      id: v.id,
      storeId: v.storeId,
      version: v.version,
      publisher: v.publishedBy,
      createdAt: v.publishedAt,
      theme: snapshot.brandIdentity || {},
      features: snapshot.featureToggles || {},
    };
  });
  res.status(200).json(history);
});

// Rollback config to target snapshot version
apiRouter.post("/stores/:id/history/rollback", (req, res) => {
  const { id } = req.params;
  const { versionId } = req.body;

  const version = db.configVersions.findAllByStore(id).find((v) => v.id === versionId);
  if (!version) return res.status(404).json({ error: "Version not found." });

  const restoredStore = JSON.parse(version.configJson);

  // Overwrite entire layouts
  const updatedStore = db.stores.update(id, {
    name: restoredStore.name,
    brandIdentity: restoredStore.brandIdentity,
    featureToggles: restoredStore.featureToggles,
    homepageConfig: restoredStore.homepageConfig,
    navigationConfig: restoredStore.navigationConfig,
    footerConfig: restoredStore.footerConfig,
    buttonStyle: restoredStore.buttonStyle,
  } as any);

  res.status(200).json({ success: true, store: updatedStore });
});

// --- REQUIREMENTS DOCUMENT INGESTION PIPELINE (STEP 5 ALTERNATE) ---
// Builds the same default homepage config shape used by /storefront/config,
// so a generated hero image can be safely stored on the store record without
// dropping any sections (avoids ever shipping a partial/broken homepageConfig).
function buildHomepageConfigWithHero(store: Store, heroImage: string, heroTitle?: string, heroSubtitle?: string) {
  const existing = (store as any).homepageConfig;
  const base = existing || {
    hero: {
      title: `Welcome to ${store.name}`,
      subtitle: store.description || "The future of curated shopping.",
      backgroundImage: buildHeroImageUrl(store.businessType || "Retail", store.name),
      ctaText: "Shop Collection",
      ctaLink: "#products",
    },
    sections: [
      { id: "sec-hero", type: "HERO_BANNER" },
      { id: "sec-categories", type: "CATEGORIES_GRID", title: "Browse Categories" },
      { id: "sec-products-featured", type: "PRODUCT_GRID", title: "Featured Masterpieces", productSource: "all", limit: 8 },
      { id: "sec-deals", type: "DEALS_BANNER", title: "Exclusive Offers", subtitle: "Save up to 50% on selected items." },
      { id: "sec-about", type: "ABOUT_US", html: `<h3>Crafted with Pride</h3><p>We believe in quality over quantity, and direct customer connectivity. Our entire operations is optimized for the highest caliber fulfillment.</p>` },
    ],
    footer: {
      text: `© ${new Date().getFullYear()} ${store.name}. All Rights Reserved.`,
    },
  };

  return {
    ...base,
    hero: {
      ...base.hero,
      backgroundImage: heroImage,
      title: heroTitle || base.hero.title,
      subtitle: heroSubtitle || base.hero.subtitle,
    },
  };
}

apiRouter.post("/stores/:id/requirements-document", async (req, res) => {
  const { id } = req.params;
  const { textContent } = req.body;

  if (!textContent) {
    return res.status(400).json({ error: "Text content from requirements document is required." });
  }

  const store = db.stores.findById(id);
  if (!store) return res.status(404).json({ error: "Store not found." });

  // If NVIDIA is configured, we run actual LLM-assisted generation!
  if (isNvidiaConfigured()) {
    try {
      console.log("Analyzing store requirements document via NVIDIA...");
      const prompt = `
        You are CoreCart's enterprise business analyst. Read the following business description and return structured JSON configuration that matches our store schema.
        
        Requirements text:
        """
        ${textContent}
        """

        You MUST respond strictly with a valid JSON object matching the following fields:
        {
          "name": "Extracted Store Name",
          "businessType": "Extracted niche, e.g. Apparel, Luxury, Toys, Electronics",
          "description": "Short compelling storefront summary",
          "theme": {
            "primaryColor": "Hex color code",
            "secondaryColor": "Hex color code",
            "accentColor": "Hex color code",
            "themeMode": "light" or "dark",
            "brandStyle": "clean" or "bold" or "editorial" or "retro" or "minimal",
            "typography": "Space Grotesk" or "Inter" or "Playfair Display"
          },
          "featureToggles": {
            "wishlist": true/false,
            "reviews": true/false,
            "coupons": true/false,
            "compare_products": true/false,
            "flash_deals": true/false,
            "blog": true/false
          },
          "recommendedProducts": [
            {
              "title": "Product Title",
              "sku": "A unique short SKU string",
              "description": "Compelling product listing text",
              "basePrice": Price in integer cents (e.g., 2999 for $29.99),
              "brand": "Brand Name",
              "attributes": {
                 "Color": "Red",
                 "Material": "Cotton"
              }
            }
          ]
        }
      `;

      const responseText = await nvidiaGenerateContent(prompt, { json: true });
      if (!responseText) {
        throw new Error("NVIDIA returned an empty response.");
      }

      const data = JSON.parse(responseText.trim());

      // Apply the generated theme & properties
      const updatedStore = db.stores.update(id, {
        name: data.name || store.name,
        businessType: data.businessType || store.businessType,
        description: data.description || store.description,
        brandIdentity: {
          primaryColor: data.theme.primaryColor || store.brandIdentity.primaryColor,
          secondaryColor: data.theme.secondaryColor || store.brandIdentity.secondaryColor,
          accentColor: data.theme.accentColor || store.brandIdentity.accentColor,
          typography: data.theme.typography || store.brandIdentity.typography,
          themeMode: data.theme.themeMode || store.brandIdentity.themeMode,
          brandStyle: data.theme.brandStyle || store.brandIdentity.brandStyle,
        },
        featureToggles: {
          ...store.featureToggles,
          ...data.featureToggles,
        },
      });

      // Seed categories & products
      let categoryId = "cat-doc-ingested";
      const catExists = db.categories.findById(categoryId);
      if (!catExists) {
        db.categories.create({
          id: categoryId,
          storeId: id,
          name: "Featured Collections",
          slug: "featured-collections",
        });
      }

      // Generate a business-accurate hero banner image for this storefront.
      const heroImage = await generateContextualImage({
        cacheKey: id,
        businessName: data.name || store.name,
        businessType: data.businessType || store.businessType,
        description: data.description || store.description,
        rawText: textContent,
        kind: "hero",
        subject: `the core products/services of ${data.name || store.name}, a ${data.businessType || store.businessType} business`,
        aspectRatio: "16:9",
      });
      if (heroImage) {
        db.stores.update(id, {
          homepageConfig: buildHomepageConfigWithHero(updatedStore, heroImage, `Welcome to ${data.name || store.name}`, data.description || store.description),
        } as any);
      }

      const addedProducts: Product[] = [];
      if (Array.isArray(data.recommendedProducts)) {
        for (const p of data.recommendedProducts) {
          const productSku = `${store.slug.toUpperCase()}-${p.sku}`;
          // Delete old if exists for safety, then recreate
          const existingP = db.products.findBySku(id, productSku);
          if (!existingP) {
            // Generate a product-accurate image; fall back to the previous
            // placeholder only if AI generation is unavailable or fails.
            const productImage = await generateContextualImage({
              cacheKey: id,
              businessName: data.name || store.name,
              businessType: data.businessType || store.businessType,
              description: data.description || store.description,
              rawText: textContent,
              kind: "product",
              subject: p.title,
              subjectDescription: p.description,
              aspectRatio: "1:1",
            });

            const newP = db.products.create({
              storeId: id,
              sku: productSku,
              title: p.title,
              slug: p.title.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
              description: p.description,
              brand: p.brand || "Generics",
              status: "ACTIVE",
              categoryId: categoryId,
              basePrice: p.basePrice || 2999,
              currency: store.currency,
              attributes: p.attributes || {},
              images: [productImage || `https://image.pollinations.ai/prompt/${encodeURIComponent(`product photo of ${p.title}, ${p.description || ""}`.slice(0, 800))}?width=800&height=800&nologo=true&model=flux`],
              variants: [
                {
                  id: `var-${p.sku}-main`,
                  sku: `${productSku}-MAIN`,
                  attributes: {},
                  priceDelta: 0,
                  quantityOnHand: 100,
                  quantityReserved: 0,
                },
              ],
            });
            addedProducts.push(newP);
          }
        }
      }

      return res.status(200).json({
        success: true,
        extracted: {
          name: data.name,
          theme: data.theme,
          featureToggles: data.featureToggles,
          productsCount: addedProducts.length,
        },
        store: updatedStore,
        products: addedProducts,
      });
    } catch (err: any) {
      console.error("NVIDIA ingestion failed, triggering fallback parsing:", err);
    }
  }

  // --- COMPACT INTELLIGENT REGEX FALLBACK PARSER ---
  console.log("Running fallback requirements heuristics parser...");
  const textLower = textContent.toLowerCase();

  // Extract name candidate
  let nameMatch = textContent.match(/(?:store named|brand called|company name is|welcome to)\s+["']?([A-Za-z0-9\s&]{3,30})["']?/i);
  let name = nameMatch ? nameMatch[1].trim() : `${store.name} Extracted`;

  // Detect category keywords
  let category = "Apparel";
  let templateKey = "fashion";
  let primaryColor = "#FAF9F6";
  let secondaryColor = "#1A1A1A";
  let accentColor = "#E29578";

  if (textLower.includes("electr") || textLower.includes("phone") || textLower.includes("gadget") || textLower.includes("device")) {
    category = "Electronics";
    templateKey = "electronics";
    primaryColor = "#0A0F24";
    secondaryColor = "#172A45";
    accentColor = "#34D6A6";
  } else if (textLower.includes("grocer") || textLower.includes("food") || textLower.includes("organic") || textLower.includes("fruit")) {
    category = "Grocery";
    templateKey = "grocery";
    primaryColor = "#F4F9F4";
    secondaryColor = "#1E3F20";
    accentColor = "#2ECC71";
  }

  const updatedStore = db.stores.update(id, {
    name,
    businessType: category,
    templateKey,
    brandIdentity: {
      primaryColor,
      secondaryColor,
      accentColor,
      typography: templateKey === "electronics" ? "Space Grotesk" : "Inter",
      themeMode: templateKey === "electronics" ? "dark" : "light",
      brandStyle: templateKey === "electronics" ? "bold" : "clean",
    },
    featureToggles: {
      ...store.featureToggles,
      wishlist: true,
      reviews: true,
      coupons: true,
      compare_products: templateKey === "electronics",
    },
  });

  // Seed default items
  let categoryId = "cat-doc-ingested";
  if (!db.categories.findById(categoryId)) {
    db.categories.create({
      id: categoryId,
      storeId: id,
      name: "Featured",
      slug: "featured",
    });
  }

  // Generate a business-accurate hero banner image, even in the no-NVIDIA-text
  // fallback path (image generation is checked independently of text ingestion).
  const heroImage = await generateContextualImage({
    cacheKey: id,
    businessName: name,
    businessType: category,
    description: store.description,
    rawText: textContent,
    kind: "hero",
    subject: `the core products/services of ${name}, a ${category} business`,
    aspectRatio: "16:9",
  });
  if (heroImage) {
    db.stores.update(id, {
      homepageConfig: buildHomepageConfigWithHero(updatedStore, heroImage, `Welcome to ${name}`),
    } as any);
  }

  const seeded: Product[] = [];
  const defaultItems = getProductsForCategory(category, name);

  for (const item of defaultItems) {
    const sku = `${store.slug.toUpperCase()}-${item.sku}`;
    if (!db.products.findBySku(id, sku)) {
      // Prefer an AI-generated, product-accurate image; keep the seeded
      // catalog's curated image as the fallback if generation is unavailable.
      const productImage = await generateContextualImage({
        cacheKey: id,
        businessName: name,
        businessType: category,
        description: store.description,
        rawText: textContent,
        kind: "product",
        subject: item.title,
        subjectDescription: item.description,
        aspectRatio: "1:1",
      });

      const p = db.products.create({
        storeId: id,
        sku,
        title: item.title,
        slug: item.title.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        description: item.description,
        brand: item.brand,
        status: "ACTIVE",
        categoryId,
        basePrice: item.basePrice * 100, // convert Rupee rate to minor unit cents
        currency: "INR",
        attributes: item.attributes,
        images: [productImage || item.imageUrl],
        variants: [
          {
            id: `var-${item.sku}-main`,
            sku: `${sku}-MAIN`,
            attributes: {},
            priceDelta: 0,
            quantityOnHand: 100,
            quantityReserved: 0,
          },
        ],
      });
      seeded.push(p);
    }
  }

  res.status(200).json({
    success: true,
    isFallback: true,
    extracted: {
      name,
      businessType: category,
      theme: updatedStore.brandIdentity,
    },
    store: updatedStore,
    products: seeded,
  });
});

// --- 3. STOREFRONT BOOTSTRAP ENDPOINT ---
// GET /api/v1/storefront/config - Aggregates everything needed to render a custom storefront
apiRouter.get("/storefront/config", (req, res) => {
  const { store } = req;
  if (!store) {
    return res.status(404).json({ error: "Store not resolved. Specify X-Store-Id or X-Store-Slug header." });
  }

  // Get categories
  const categories = db.categories.findAllByStore(store.id);

  // Get core catalog
  const products = db.products.findAllByStore(store.id);

  // Get active rules
  const rules = db.rules.findAllByStore(store.id);

  // Get CMS blocks
  const cmsContents = db.cmsContents.findAllByStore(store.id);

  // Bootstrap configuration payload
  // Load layout configurations, resolving defaults if not stored
  const defaultHomepageConfig = {
    hero: {
      title: `Welcome to ${store.name}`,
      subtitle: store.description || "The future of curated shopping.",
      backgroundImage: buildHeroImageUrl(store.businessType || "Retail", store.name),
      ctaText: "Shop Collection",
      ctaLink: "#products",
    },
    sections: [
      { id: "sec-hero", type: "HERO_BANNER" },
      { id: "sec-categories", type: "CATEGORIES_GRID", title: "Browse Categories" },
      { id: "sec-products-featured", type: "PRODUCT_GRID", title: "Featured Masterpieces", productSource: "all", limit: 8 },
      { id: "sec-deals", type: "DEALS_BANNER", title: "Exclusive Offers", subtitle: "Save up to 50% on selected items." },
      { id: "sec-about", type: "ABOUT_US", html: `<h3>Crafted with Pride</h3><p>We believe in quality over quantity, and direct customer connectivity. Our entire operations is optimized for the highest caliber fulfillment.</p>` },
    ],
    footer: {
      text: `© ${new Date().getFullYear()} ${store.name}. All Rights Reserved.`
    }
  };

  const homepageConfig = (store as any).homepageConfig || defaultHomepageConfig;
  const buttonStyle = (store as any).buttonStyle || "rounded";

  // Map sections dynamically
  const mappedSections = homepageConfig.sections.map((sec: any) => {
    if (sec.type === "HERO_BANNER") {
      return {
        id: sec.id,
        components: [
          {
            id: "comp-hero",
            type: "HERO_BANNER",
            requiredFeature: null,
            payload: {
              title: homepageConfig.hero.title,
              subtitle: homepageConfig.hero.subtitle,
              backgroundImage: homepageConfig.hero.backgroundImage,
              ctaText: homepageConfig.hero.ctaText,
              ctaLink: homepageConfig.hero.ctaLink,
            },
          },
        ],
      };
    } else if (sec.type === "CATEGORIES_GRID") {
      return {
        id: sec.id,
        components: [
          {
            id: "comp-categories",
            type: "CATEGORIES_GRID",
            requiredFeature: null,
            payload: {
              title: sec.title || "Browse Categories",
            },
          },
        ],
      };
    } else if (sec.type === "PRODUCT_GRID") {
      return {
        id: sec.id,
        components: [
          {
            id: "comp-grid",
            type: "PRODUCT_GRID",
            requiredFeature: null,
            payload: {
              title: sec.title || "Trending Masterpieces",
              limit: sec.limit || 8,
            },
          },
        ],
      };
    } else if (sec.type === "DEALS_BANNER") {
      return {
        id: sec.id,
        components: [
          {
            id: "comp-deals",
            type: "DEALS_BANNER",
            requiredFeature: "flash_deals",
            payload: {
              title: sec.title || "Flash Deals of the Week",
              subtitle: sec.subtitle || "Limited time promotions.",
            },
          },
        ],
      };
    } else if (sec.type === "ABOUT_US") {
      return {
        id: sec.id,
        components: [
          {
            id: "comp-about-text",
            type: "CMS_RICH_TEXT",
            requiredFeature: null,
            payload: {
              html: sec.html || `<h3>Crafted with Pride</h3><p>We believe in quality over quantity, and direct customer connectivity. Our entire operations is optimized for the highest caliber fulfillment.</p>`,
            },
          },
        ],
      };
    }
    return null;
  }).filter((x: any) => x !== null);

  let navigation = [];
  if ((store as any).navigationConfig && (store as any).navigationConfig.length > 0) {
    navigation = (store as any).navigationConfig;
  } else {
    navigation = categories.map((c) => ({ label: c.name, link: `/category/${c.slug}`, id: c.id }));
  }

  // Bootstrap configuration payload
  res.status(200).json({
    store: {
      id: store.id,
      // Included so the frontend can show a "Manage Store" entry point when
      // the logged-in owner is viewing their own live storefront, without
      // needing a separate authenticated lookup.
      ownerId: store.ownerId,
      name: store.name,
      slug: store.slug,
      businessType: store.businessType,
      description: store.description,
      country: store.country,
      currency: store.currency,
      language: store.language,
      templateKey: store.templateKey,
      homepageConfig,
      navigationConfig: (store as any).navigationConfig || [],
      footerConfig: (store as any).footerConfig || { footerText: `© ${new Date().getFullYear()} ${store.name}. All Rights Reserved.` },
      buttonStyle,
    },
    theme: store.brandIdentity,
    features: store.featureToggles,
    navigation,
    pages: [
      {
        id: "page-home",
        slug: "home",
        title: "Home",
        sections: mappedSections,
      },
    ],
    initialCatalogPage: {
      products: products,
      categories: categories,
      rules: rules,
      blogs: cmsContents.filter((c) => c.type === "blog").map((c) => c.payload),
      faqs: cmsContents.filter((c) => c.type === "faq").map((c) => c.payload),
    },
  });
});

// --- 4. COMMERCE ENGINE: CATALOGS ---
apiRouter.get("/products", (req, res) => {
  const { storeId } = req;
  const { categoryId, search, brand, minPrice, maxPrice } = req.query;

  if (!storeId) return res.status(400).json({ error: "Store context missing." });

  let products = db.products.findAllByStore(storeId);

  if (categoryId) {
    products = products.filter((p) => p.categoryId === categoryId);
  }

  if (brand) {
    products = products.filter((p) => p.brand?.toLowerCase() === (brand as string).toLowerCase());
  }

  if (minPrice) {
    products = products.filter((p) => p.basePrice >= parseInt(minPrice as string, 10));
  }

  if (maxPrice) {
    products = products.filter((p) => p.basePrice <= parseInt(maxPrice as string, 10));
  }

  if (search) {
    const q = (search as string).toLowerCase();
    products = products.filter((p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }

  res.status(200).json(products);
});

apiRouter.get("/products/:id", (req, res) => {
  const product = db.products.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  res.status(200).json(product);
});

// --- NEW CATALOG ENDPOINTS FOR MANUAL/AI PRODUCT MANAGEMENT ---
apiRouter.post("/products", async (req, res) => {
  const storeId = req.headers["x-store-id"] || req.body.storeId;
  if (!storeId) {
    return res.status(400).json({ error: "Store context missing." });
  }

  const { sku, title, description, brand, basePrice, currency, categoryId, attributes, images, variants } = req.body;
  if (!title || !sku) {
    return res.status(400).json({ error: "Missing required fields: title and sku." });
  }

  // Ensure unique SKU per store
  const existingProduct = db.products.findBySku(storeId as string, sku);
  if (existingProduct) {
    return res.status(409).json({ error: `Product with SKU ${sku} already exists in this store.` });
  }

  const store = db.stores.findById(storeId as string);
  const intelligence = classifyProduct(title, store?.learningPreferences);

  let finalCategoryId = categoryId;
  if (!finalCategoryId) {
    if (intelligence.category !== "Uncategorized") {
      let cat = db.categories.findAllByStore(storeId as string).find(c => c.name === intelligence.category);
      if (!cat) {
         cat = db.categories.create({
            storeId: storeId as string,
            name: intelligence.category,
            slug: intelligence.category.toLowerCase().replace(/[^a-z0-9-]/g, "-")
         });
      }
      finalCategoryId = cat.id;
    } else {
      finalCategoryId = "cat-seeded";
    }
  }

  // Honor the exact price the seller set. We only fall back to a suggested
  // price when no price was supplied at all — a set price (including an
  // intentional 0) is never silently changed.
  const priceWasProvided =
    basePrice !== undefined && basePrice !== null && `${basePrice}`.trim() !== "";
  let finalBasePrice = priceWasProvided
    ? typeof basePrice === "string"
      ? parseInt(basePrice, 10)
      : basePrice
    : intelligence.suggestedPrice || 0;
  if (Number.isNaN(finalBasePrice)) {
    finalBasePrice = intelligence.suggestedPrice || 0;
  }

  const finalDescription = description || intelligence.description;

  let finalImages = images;
  if (!images || images.length === 0) {
    // Try to generate a product-accurate image based on this store's business
    // context and the exact product title/description. Works for any category
    // without hardcoding, and falls back to the previous keyword-based
    // placeholder if AI generation is unavailable or fails.
    const generatedImage = await generateContextualImage({
      cacheKey: storeId as string,
      businessName: store?.name || "Store",
      businessType: store?.businessType || intelligence.businessCategory || "General Retail",
      description: store?.description,
      kind: "product",
      subject: title,
      subjectDescription: finalDescription,
      aspectRatio: "1:1",
    });

    if (generatedImage) {
      finalImages = [generatedImage];
    } else if (intelligence.imageKeyword.startsWith("http")) {
       finalImages = [intelligence.imageKeyword];
    } else {
       finalImages = [`https://image.pollinations.ai/prompt/${encodeURIComponent(`product photo of ${intelligence.imageKeyword}`.slice(0, 800))}?width=800&height=800&nologo=true&model=flux`];
    }
  }

  const finalAttributes = attributes || {};
  if (!finalAttributes.tags && intelligence.tags.length > 0) {
    finalAttributes.tags = intelligence.tags;
  }

  const newProduct = db.products.create({
    storeId: storeId as string,
    sku,
    title,
    slug: req.body.slug || title.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    description: finalDescription,
    brand: brand || "Generic",
    status: req.body.status || "ACTIVE",
    categoryId: finalCategoryId,
    basePrice: finalBasePrice,
    currency: currency || "USD",
    attributes: finalAttributes,
    images: finalImages,
    variants: variants || [
      {
        id: `v-${sku}-${Date.now()}`,
        sku: `${sku}-MAIN`,
        attributes: {},
        priceDelta: 0,
        quantityOnHand: 100,
        quantityReserved: 0,
      }
    ],
  });

  res.status(201).json(newProduct);
});

apiRouter.patch("/products/:id", (req, res) => {
  const { id } = req.params;
  const product = db.products.findById(id);
  if (!product) {
    return res.status(404).json({ error: "Product not found." });
  }

  const { categoryId, images } = req.body;
  const store = db.stores.findById(product.storeId);
  
  if (store) {
    const intelligence = classifyProduct(product.title, store.learningPreferences);
    let overrides: { category?: string; imageKeyword?: string } = {};
    let hasOverride = false;
    
    if (categoryId && categoryId !== product.categoryId) {
      const cat = db.categories.findById(categoryId);
      if (cat && cat.name !== intelligence.category) {
        overrides.category = cat.name;
        hasOverride = true;
      }
    }
    
    // Check if image changed
    if (images && images.length > 0 && images[0] !== product.images[0]) {
       overrides.imageKeyword = images[0]; 
       hasOverride = true;
    }
    
    if (hasOverride && intelligence.familyId) {
      store.learningPreferences = store.learningPreferences || {};
      store.learningPreferences[intelligence.familyId] = {
        ...(store.learningPreferences[intelligence.familyId] || {}),
        ...overrides
      };
      db.stores.update(store.id, { learningPreferences: store.learningPreferences });
    }
  }

  const updated = db.products.update(id, req.body);
  res.status(200).json(updated);
});

apiRouter.delete("/products/:id", (req, res) => {
  const { id } = req.params;
  const product = db.products.findById(id);
  if (!product) {
    return res.status(404).json({ error: "Product not found." });
  }

  // Archiving makes the product disappear from queries but keeps its record
  const updated = db.products.update(id, { status: "ARCHIVED" });
  res.status(200).json({ success: true, product: updated });
});

// --- NEW FULFILLMENT & INVENTORY MANAGEMENT ENDPOINTS ---
apiRouter.patch("/orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: "Order status parameter is missing." });
  }

  const order = db.orders.findById(id);
  if (!order) {
    return res.status(404).json({ error: "Order not found." });
  }

  const updatedOrder = db.orders.updateStatus(id, status);
  res.status(200).json({ success: true, order: updatedOrder });
});

apiRouter.patch("/inventory/adjust", (req, res) => {
  const { storeId, productId, variantId, adjustment } = req.body;
  if (!productId || adjustment === undefined) {
    return res.status(400).json({ error: "Missing required fields: productId and adjustment delta." });
  }

  const product = db.products.findById(productId);
  if (!product) {
    return res.status(404).json({ error: "Product not found." });
  }

  const variants = product.variants.map((v) => {
    if (!variantId || v.id === variantId) {
      return {
        ...v,
        quantityOnHand: Math.max(0, v.quantityOnHand + adjustment),
      };
    }
    return v;
  });

  const updatedProduct = db.products.update(productId, { variants });
  res.status(200).json(updatedProduct);
});

// --- ANALYTICS ENRICHMENT ENDPOINT ---
apiRouter.get("/analytics", (req, res) => {
  const { storeId } = req.query;
  const targetStoreId = (storeId || req.headers["x-store-id"]) as string;
  if (!targetStoreId) {
    return res.status(400).json({ error: "Store context missing." });
  }

  const orders = db.orders.findAllByStore(targetStoreId);
  const events = db.analytics.getEvents(targetStoreId);

  const viewsCount = events.filter((e) => e.eventType === "page_view").length;
  const cartAddsCount = events.filter((e) => e.eventType === "add_to_cart").length;

  res.status(200).json({
    sessionCount: viewsCount || 240, // Elegant baselines if analytics is fresh
    cartAddsCount: cartAddsCount || 82,
    ordersCount: orders.length,
    funnel: {
      views: viewsCount || 240,
      cartAdds: cartAddsCount || 82,
      purchases: orders.length,
    }
  });
});

apiRouter.get("/categories", (req, res) => {
  const { storeId } = req;
  if (!storeId) return res.status(400).json({ error: "Store context missing." });
  res.status(200).json(db.categories.findAllByStore(storeId));
});

// --- WISHLIST ENGINE ---
apiRouter.get("/wishlist", (req, res) => {
  const { storeId } = req;
  const { customerId } = req.query;
  if (!storeId || !customerId) {
    return res.status(400).json({ error: "Store ID and Customer ID are required." });
  }

  let wishlist = db.wishlists.findByCustomer(storeId, customerId as string);
  if (!wishlist) {
    wishlist = db.wishlists.create({
      storeId,
      customerId: customerId as string,
      productIds: [],
    });
  }
  res.status(200).json(wishlist);
});

apiRouter.post("/wishlist/toggle", (req, res) => {
  const { storeId, customerId, productId } = req.body;
  if (!storeId || !customerId || !productId) {
    return res.status(400).json({ error: "Missing required fields (storeId, customerId, productId)." });
  }

  let wishlist = db.wishlists.findByCustomer(storeId, customerId);
  if (!wishlist) {
    wishlist = db.wishlists.create({
      storeId,
      customerId,
      productIds: [productId],
    });
  } else {
    let productIds = [...wishlist.productIds];
    if (productIds.includes(productId)) {
      productIds = productIds.filter((id) => id !== productId);
    } else {
      productIds.push(productId);
    }
    db.wishlists.update(wishlist.id, productIds);
    wishlist.productIds = productIds;
  }
  res.status(200).json(wishlist);
});

// --- 5. CART ENGINE ---
apiRouter.get("/cart", (req, res) => {
  const { storeId } = req;
  const { customerId, sessionId, cartId } = req.query;

  if (!storeId) return res.status(400).json({ error: "Store context missing." });

  let cart: Cart | undefined;
  if (cartId && typeof cartId === "string") {
    cart = db.carts.findById(cartId);
  } else if (customerId) {
    cart = db.carts.findByCustomer(storeId, customerId as string);
  } else if (sessionId) {
    cart = db.carts.findBySession(storeId, sessionId as string);
  }

  if (cart && cart.status !== "ACTIVE") {
    cart = undefined;
  }

  if (!cart) {
    const store = db.stores.findById(storeId);
    // Create new active cart
    cart = db.carts.create({
      storeId,
      customerId: (customerId as string) || undefined,
      sessionId: (sessionId as string) || undefined,
      currency: store ? store.currency : "INR",
      status: "ACTIVE",
      items: [],
    });
  }

  res.status(200).json(cart);
});

apiRouter.post("/cart/items", (req, res) => {
  const { storeId } = req;
  const { cartId, productId, variantId, quantity } = req.body;

  if (!cartId || !productId || !quantity) {
    return res.status(400).json({ error: "Missing required fields: cartId, productId, quantity" });
  }

  const cart = db.carts.findById(cartId);
  if (!cart) return res.status(404).json({ error: "Cart not found." });

  const product = db.products.findById(productId);
  if (!product) return res.status(404).json({ error: "Product not found." });

  // Get price and check inventory
  let unitPriceSnapshot = product.basePrice;
  let sku = product.sku;

  if (variantId) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) return res.status(404).json({ error: "Product variant not found." });
    unitPriceSnapshot += variant.priceDelta;
    sku = variant.sku;

    if (variant.quantityOnHand - variant.quantityReserved < quantity) {
      return res.status(400).json({ error: "Insufficient stock available for this variant." });
    }
  } else {
    const mainVariant = product.variants[0];
    if (mainVariant && mainVariant.quantityOnHand - mainVariant.quantityReserved < quantity) {
      return res.status(400).json({ error: "Insufficient stock available." });
    }
  }

  // Add item or increase quantity
  const existingItemIdx = cart.items.findIndex((item) => item.productId === productId && item.variantId === variantId);

  if (existingItemIdx > -1) {
    cart.items[existingItemIdx].quantity += quantity;
  } else {
    cart.items.push({
      id: `cart-item-${crypto.randomUUID()}`,
      productId,
      variantId,
      quantity,
      unitPriceSnapshot,
    });
  }

  const updatedCart = db.carts.update(cart.id, { items: cart.items });

  // Record add_to_cart analytics event
  db.analytics.createEvent({
    storeId: cart.storeId,
    customerId: cart.customerId,
    sessionId: cart.sessionId,
    eventType: "add_to_cart",
    payload: { productId, variantId, quantity, price: unitPriceSnapshot },
  });

  res.status(200).json(updatedCart);
});

apiRouter.patch("/cart/items/:itemId", (req, res) => {
  const { cartId, quantity } = req.body;
  const { itemId } = req.params;

  if (!cartId || quantity === undefined) {
    return res.status(400).json({ error: "Cart reference and new quantity required." });
  }

  const cart = db.carts.findById(cartId);
  if (!cart) return res.status(404).json({ error: "Cart not found." });

  const itemIdx = cart.items.findIndex((i) => i.id === itemId);
  if (itemIdx === -1) return res.status(404).json({ error: "Cart item not found in this cart." });

  if (quantity <= 0) {
    cart.items.splice(itemIdx, 1);
  } else {
    cart.items[itemIdx].quantity = quantity;
  }

  const updatedCart = db.carts.update(cart.id, { items: cart.items });
  res.status(200).json(updatedCart);
});

apiRouter.delete("/cart/items/:itemId", (req, res) => {
  const { cartId } = req.query;
  const { itemId } = req.params;

  if (!cartId) return res.status(400).json({ error: "Cart reference required." });

  const cart = db.carts.findById(cartId as string);
  if (!cart) return res.status(404).json({ error: "Cart not found." });

  cart.items = cart.items.filter((i) => i.id !== itemId);
  const updatedCart = db.carts.update(cart.id, { items: cart.items });

  res.status(200).json(updatedCart);
});

// --- 6. CHECKOUT, PAYMENTS & ORDER ENGINE ---
apiRouter.post("/checkout/initiate", (req, res) => {
  const { cartId, customerId } = req.body;
  if (!cartId) return res.status(400).json({ error: "cartId is required to initiate checkout." });

  const cart = db.carts.findById(cartId);
  if (!cart) return res.status(404).json({ error: "Cart not found." });

  if (cart.items.length === 0) {
    return res.status(400).json({ error: "Cannot checkout an empty cart." });
  }

  // Soft-reserve products to prevent stock stealing
  for (const item of cart.items) {
    const product = db.products.findById(item.productId);
    if (!product) continue;

    if (item.variantId) {
      const v = product.variants.find((x) => x.id === item.variantId);
      if (v) {
        v.quantityReserved += item.quantity;
      }
    } else if (product.variants[0]) {
      product.variants[0].quantityReserved += item.quantity;
    }
    db.products.update(product.id, { variants: product.variants });
  }

  res.status(200).json({ success: true, cart });
});

apiRouter.post("/checkout/:cartId/complete", (req, res) => {
  const { cartId } = req.params;
  const { shippingAddress, billingAddress, paymentToken, customerEmail, customerName, customerId, couponCode } = req.body;

  if (!shippingAddress || !paymentToken || !customerEmail || !customerName) {
    return res.status(400).json({ error: "Missing checkout parameters (shippingAddress, paymentToken, billing details)." });
  }

  const cart = db.carts.findById(cartId);
  if (!cart) return res.status(404).json({ error: "Cart not found." });

  // Calculate prices
  let subtotal = 0;
  const orderItems: OrderItem[] = [];

  for (const item of cart.items) {
    const product = db.products.findById(item.productId);
    if (!product) continue;

    let price = product.basePrice;
    let sku = product.sku;

    if (item.variantId) {
      const v = product.variants.find((x) => x.id === item.variantId);
      if (v) {
        price += v.priceDelta;
        sku = v.sku;
        // Deduct reservation & quantity
        v.quantityReserved = Math.max(0, v.quantityReserved - item.quantity);
        v.quantityOnHand = Math.max(0, v.quantityOnHand - item.quantity);
      }
    } else if (product.variants[0]) {
      const v = product.variants[0];
      v.quantityReserved = Math.max(0, v.quantityReserved - item.quantity);
      v.quantityOnHand = Math.max(0, v.quantityOnHand - item.quantity);
    }

    db.products.update(product.id, { variants: product.variants });

    const totalItemPrice = price * item.quantity;
    subtotal += totalItemPrice;

    orderItems.push({
      id: `ord-item-${crypto.randomUUID()}`,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      price,
      title: product.title,
      sku,
    });
  }

  // Evaluate Rules (Discount Engine / Shipping Engine)
  let discountTotal = 0;
  let shippingTotal = 0; // Free shipping to match exact cost

  if (couponCode) {
    const rules = db.rules.findAllByStore(cart.storeId);
    const matchedRule = rules.find((r) => r.type === "discount" && r.conditions.couponCode?.toUpperCase() === couponCode.toUpperCase() && r.isActive);
    if (matchedRule) {
      if (matchedRule.actions.discountPercent) {
        discountTotal = Math.round((subtotal * matchedRule.actions.discountPercent) / 100);
      } else if (matchedRule.actions.discountAmount) {
        discountTotal = matchedRule.actions.discountAmount;
      }
    }
  }

  const storeRules = db.rules.findAllByStore(cart.storeId);
  for (const rule of storeRules) {
    if (rule.type === "conditional_shipping" && rule.conditions.minOrderValue && subtotal >= rule.conditions.minOrderValue) {
      if (rule.actions.freeShipping) {
        shippingTotal = 0;
      }
    }
  }

  // Free shipping threshold
  if (cart.currency === "INR" && subtotal >= 99900) {
    shippingTotal = 0;
  } else if (cart.currency !== "INR" && subtotal >= 5000) {
    shippingTotal = 0;
  }

  // Tax rates (Inclusive of taxes to match exact cost)
  const taxRate = 0;
  const taxTotal = 0;
  const grandTotal = Math.max(0, subtotal - discountTotal + taxTotal + shippingTotal);

  // Create order
  const orderNumber = `CC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
  const order = db.orders.create({
    storeId: cart.storeId,
    customerId: customerId || `guest-${crypto.randomUUID().slice(0, 8)}`,
    customerName,
    customerEmail,
    orderNumber,
    status: "CONFIRMED",
    currency: cart.currency,
    subtotal,
    discountTotal,
    taxTotal,
    shippingTotal,
    grandTotal,
    items: orderItems,
    shippingAddress,
    billingAddress: billingAddress || shippingAddress,
  });

  // Mark cart converted
  db.carts.update(cart.id, { status: "CONVERTED" });

  // Record purchase event
  db.analytics.createEvent({
    storeId: cart.storeId,
    customerId,
    sessionId: cart.sessionId,
    eventType: "purchase",
    payload: { orderId: order.id, grandTotal, orderNumber },
  });

  res.status(201).json({ success: true, order });
});

// Coupon validation
apiRouter.post("/coupons/validate", (req, res) => {
  const storeId = req.headers["x-store-id"] || req.headers["store-id"];
  const { code, subtotal } = req.body;
  if (!storeId || !code) return res.status(400).json({ error: "Missing required parameters (store context or coupon code)." });

  const rules = db.rules.findAllByStore(storeId as string);
  const matchedRule = rules.find((r) => r.type === "discount" && r.conditions.couponCode?.toUpperCase() === code.toUpperCase() && r.isActive);

  if (matchedRule) {
    let discountAmount = 0;
    if (matchedRule.actions.discountPercent) {
      discountAmount = Math.round((subtotal * matchedRule.actions.discountPercent) / 100);
    } else if (matchedRule.actions.discountAmount) {
      discountAmount = matchedRule.actions.discountAmount;
    }
    return res.status(200).json({ valid: true, discountAmount, rule: matchedRule });
  }
  return res.status(200).json({ valid: false, error: "Invalid or expired coupon code." });
});

// Get orders
apiRouter.get("/orders", (req, res) => {
  const { storeId } = req;
  const { customerId } = req.query;
  if (!storeId) return res.status(400).json({ error: "Store context missing." });

  if (customerId) {
    const orders = db.orders.findAllByCustomer(storeId, customerId as string);
    res.status(200).json(orders);
  } else {
    const orders = db.orders.findAllByStore(storeId);
    res.status(200).json(orders);
  }
});

apiRouter.patch("/orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const order = db.orders.findById(id);
  if (!order) return res.status(404).json({ error: "Order not found." });

  // Only allow specific status updates from client side (like CANCELLED)
  if (status === "CANCELLED") {
    // Basic validation: Cannot cancel a delivered order
    if (order.status === "DELIVERED") {
       return res.status(400).json({ error: "Cannot cancel a delivered order." });
    }
  }

  const updatedOrder = db.orders.updateStatus(id, status);
  res.status(200).json({ success: true, order: updatedOrder });
});

apiRouter.post("/orders/:id/return", (req, res) => {
  const { id } = req.params;
  const order = db.orders.findById(id);
  if (!order) return res.status(404).json({ error: "Order not found." });

  // Update status to return requested
  const updatedOrder = db.orders.updateStatus(id, "RETURN_REQUESTED");
  res.status(200).json({ success: true, order: updatedOrder });
});

// --- 7. CMS ENGINE (BLOG, FAQ) ---
apiRouter.get("/cms", (req, res) => {
  const { storeId } = req;
  const { type } = req.query;
  if (!storeId) return res.status(400).json({ error: "Store context missing." });

  const contents = type
    ? db.cmsContents.findByType(storeId, type as any)
    : db.cmsContents.findAllByStore(storeId);

  res.status(200).json(contents);
});

// --- 8. REVIEWS ENGINE ---
apiRouter.get("/products/:id/reviews", (req, res) => {
  res.status(200).json(db.reviews.findAllByProduct(req.params.id));
});

apiRouter.post("/reviews", (req, res) => {
  const { storeId, productId, customerId, customerName, rating, comment } = req.body;
  if (!productId || !customerName || !rating || !storeId) {
    return res.status(400).json({ error: "Missing required parameters for review entry." });
  }

  const review = db.reviews.create({
    storeId,
    productId,
    customerId: customerId || "guest",
    customerName,
    rating: parseInt(rating, 10),
    comment: comment || "",
    status: "APPROVED", // Auto-approved for simple local simulation
  });

  res.status(201).json(review);
});

// --- 9. SEARCH & RECOMMENDATIONS ENGINE ---
// Get smart suggestions based on items in cart
apiRouter.get("/cart/recommendations", (req, res) => {
  const { storeId } = req;
  const { cartId } = req.query;
  if (!storeId) return res.status(400).json({ error: "Store context missing." });

  const allProducts = db.products.findAllByStore(storeId);
  if (allProducts.length === 0) {
    return res.status(200).json({
      related: [],
      frequentlyBoughtTogether: [],
      customersAlsoBought: [],
      completeYourSetup: [],
      trending: [],
      bestSellers: [],
      similarProducts: [],
      youMayAlsoLike: [],
      deals: []
    });
  }

  const cart = cartId ? db.carts.findById(cartId as string) : null;
  const inCartProductIds = cart ? cart.items.map((i) => i.productId) : [];
  const inCartProducts = allProducts.filter((p) => inCartProductIds.includes(p.id));

  // Exclude things already in cart
  const candidates = allProducts.filter((p) => !inCartProductIds.includes(p.id));

  // --- Related Products ---
  const cartCategoryIds = inCartProducts.map(p => p.categoryId);
  const related = candidates.filter(p => cartCategoryIds.includes(p.categoryId)).slice(0, 4);

  // --- Frequently Bought Together ---
  const allOrders = db.orders.findAllByStore(storeId);
  const coPurchaseCounts: Record<string, number> = {};
  
  for (const ord of allOrders) {
    const itemIds = ord.items.map(i => i.productId);
    const hasCartItem = itemIds.some(id => inCartProductIds.includes(id));
    if (hasCartItem) {
      for (const id of itemIds) {
        if (!inCartProductIds.includes(id)) {
          coPurchaseCounts[id] = (coPurchaseCounts[id] || 0) + 1;
        }
      }
    }
  }
  
  const sortedCoPurchases = Object.entries(coPurchaseCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => allProducts.find(p => p.id === id))
    .filter((p): p is any => !!p);
    
  const frequentlyBoughtTogether = (sortedCoPurchases.length > 0 
    ? sortedCoPurchases 
    : candidates.filter(p => !related.map(r => r.id).includes(p.id)).slice(0, 4)
  ).slice(0, 4);

  // --- Customers Also Bought ---
  const customersAlsoBought = candidates
    .filter(p => !related.map(r => r.id).includes(p.id) && !frequentlyBoughtTogether.map(f => f.id).includes(p.id))
    .slice(0, 4);

  // --- Complete Your Setup ---
  const completeYourSetup = candidates.filter(p => 
    p.title.toLowerCase().includes("cover") || 
    p.title.toLowerCase().includes("case") || 
    p.title.toLowerCase().includes("glass") || 
    p.title.toLowerCase().includes("charger") || 
    p.title.toLowerCase().includes("cable") || 
    p.title.toLowerCase().includes("accessory") ||
    p.description.toLowerCase().includes("complete") ||
    p.description.toLowerCase().includes("setup")
  ).slice(0, 4);

  // --- Trending Products ---
  const trending = [...candidates].sort((a, b) => b.basePrice - a.basePrice).slice(0, 4);

  // --- Best Sellers ---
  const productSalesCounts: Record<string, number> = {};
  for (const ord of allOrders) {
    for (const item of ord.items) {
      productSalesCounts[item.productId] = (productSalesCounts[item.productId] || 0) + item.quantity;
    }
  }
  const bestSellers = Object.entries(productSalesCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => allProducts.find(p => p.id === id))
    .filter((p): p is any => !!p && !inCartProductIds.includes(p.id))
    .slice(0, 4);

  // --- Similar Products ---
  const similarProducts = candidates.filter(p => {
    const isSameCategory = cartCategoryIds.includes(p.categoryId);
    const hasCartItemWithDiffBrand = inCartProducts.some(cp => cp.brand !== p.brand);
    return isSameCategory || hasCartItemWithDiffBrand;
  }).slice(0, 4);

  // --- You May Also Like ---
  const youMayAlsoLike = candidates
    .filter(p => 
      !related.map(r => r.id).includes(p.id) && 
      !frequentlyBoughtTogether.map(f => f.id).includes(p.id) &&
      !bestSellers.map(b => b.id).includes(p.id)
    ).slice(0, 4);

  // --- Deals ---
  const deals = candidates.filter(p => p.basePrice > 0).slice(0, 4);

  res.status(200).json({
    related,
    frequentlyBoughtTogether,
    customersAlsoBought,
    completeYourSetup,
    trending: trending.length > 0 ? trending : candidates.slice(0, 4),
    bestSellers: bestSellers.length > 0 ? bestSellers : candidates.slice(4, 8),
    similarProducts,
    youMayAlsoLike,
    deals
  });
});

// --- 10. ANALYTICS ENGINE (DASHBOARD) ---
apiRouter.get("/admin/analytics/dashboard", (req, res) => {
  const { storeId } = req;
  if (!storeId) return res.status(400).json({ error: "Store context missing." });

  const orders = db.orders.findAllByStore(storeId);
  const events = db.analytics.getEvents(storeId);

  // Revenue totals
  const totalRevenue = orders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "REFUNDED")
    .reduce((sum, o) => sum + o.grandTotal, 0);

  // Conversion funnel calculations
  const views = events.filter((e) => e.eventType === "page_view").length || 100; // avoid zero divide
  const cartAdds = events.filter((e) => e.eventType === "add_to_cart").length;
  const purchases = orders.length;

  res.status(200).json({
    revenue: totalRevenue,
    ordersCount: purchases,
    averageOrderValue: purchases > 0 ? Math.round(totalRevenue / purchases) : 0,
    funnel: {
      views,
      cartAdds,
      purchases,
      conversionRate: parseFloat(((purchases / views) * 100).toFixed(2)),
    },
    ordersList: orders.slice(-10).reverse(), // Last 10 orders
  });
});

// GET /api/v1/analytics - Get telemetry details for dashboard
apiRouter.get("/analytics", (req, res) => {
  const { storeId } = req.query;
  if (!storeId) return res.status(400).json({ error: "Store ID is required." });

  const orders = db.orders.findAllByStore(storeId as string);
  const events = db.analytics.getEvents(storeId as string);

  // Conversion funnel calculations
  const views = events.filter((e) => e.eventType === "page_view").length || 240;
  const cartAdds = events.filter((e) => e.eventType === "add_to_cart").length || 82;
  const purchases = orders.length;

  res.status(200).json({
    funnel: {
      views,
      cartAdds,
      purchases,
    },
    sessionCount: views,
    cartAddsCount: cartAdds,
  });
});

// --- GENERIC TRACK ANALYTICS INGESTION ---
apiRouter.post("/analytics/event", (req, res) => {
  const { storeId, customerId, sessionId, eventType, payload } = req.body;
  if (!storeId || !eventType) {
    return res.status(400).json({ error: "Store reference and Event Type are required." });
  }

  const ev = db.analytics.createEvent({
    storeId,
    customerId,
    sessionId,
    eventType,
    payload: payload || {},
  });

  res.status(201).json(ev);
});
