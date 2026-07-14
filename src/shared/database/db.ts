/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { classifyProduct } from "../../backend/productIntelligence";
import { buildProductImageUrl, buildHeroImageUrl, deriveTemplateKey, TEMPLATE_PRESETS } from "./catalogSeeds";

// Interfaces for our database models
export interface User {
  id: string;
  email: string;
  passwordHash: string; // Native node crypto SHA256 hashed
  role: "PLATFORM_ADMIN" | "STORE_OWNER" | "STORE_MANAGER" | "CUSTOMER";
  name: string;
  storeId?: string; // Tenant association for non-platform admins
  createdAt: string;
}

export interface BrandIdentity {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  typography: string;
  themeMode: "light" | "dark" | "system";
  brandStyle: "clean" | "bold" | "editorial" | "retro" | "minimal";
  logoUrl?: string;
}

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  businessType: string;
  description: string;
  country: string;
  currency: string;
  language: string;
  timezone: string;
  status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  templateKey: string;
  brandIdentity: BrandIdentity;
  featureToggles: Record<string, boolean>; // FeatureKey -> enabled
  homepageConfig?: any;
  navigationConfig?: any;
  footerConfig?: any;
  buttonStyle?: string;
  learningPreferences?: Record<string, { category?: string; imageKeyword?: string }>; // Map Family ID -> Overrides
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  attributes: Record<string, string>; // e.g., { size: "M", color: "Red" }
  priceDelta: number; // cents added or subtracted from basePrice
  quantityOnHand: number;
  quantityReserved: number;
}

export interface Product {
  id: string;
  storeId: string;
  sku: string;
  title: string;
  slug: string;
  description: string;
  brand: string;
  status: "DRAFT" | "ACTIVE" | "OUT_OF_STOCK" | "ARCHIVED";
  categoryId: string;
  basePrice: number; // cents
  currency: string;
  attributes: Record<string, string | string[]>;
  images: string[];
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  parentId?: string;
  createdAt: string;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPriceSnapshot: number; // cents
}

export interface Cart {
  id: string;
  storeId: string;
  customerId?: string; // Nullable for guests
  sessionId?: string; // Guest identifier
  currency: string;
  status: "ACTIVE" | "CONVERTED" | "ABANDONED";
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number; // cents
  title: string;
  sku: string;
}

export interface Order {
  id: string;
  storeId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURN_REQUESTED" | "RETURNED" | "REFUNDED";
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  grandTotal: number;
  items: OrderItem[];
  shippingAddress: any;
  billingAddress: any;
  placedAt: string;
}

export interface CMSContent {
  id: string;
  storeId: string;
  type: "blog" | "faq" | "testimonial" | "page";
  payload: any; // schema is flexible based on type
  createdAt: string;
}

export interface Review {
  id: string;
  storeId: string;
  productId: string;
  customerId: string;
  customerName: string;
  rating: number; // 1-5
  comment: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface Wishlist {
  id: string;
  storeId: string;
  customerId: string;
  productIds: string[];
  createdAt: string;
}

export interface StoreConfigVersion {
  id: string;
  storeId: string;
  version: number;
  configJson: string; // Full stringified snapshot of the store's settings
  publishedAt: string;
  publishedBy: string;
}

export interface RuleDefinition {
  id: string;
  storeId: string;
  name: string;
  type: "discount" | "conditional_shipping";
  conditions: any; // { minOrderValue?: number, categoryId?: string, etc }
  actions: any; // { discountPercent?: number, discountAmount?: number, freeShipping?: boolean }
  isActive: boolean;
  createdAt: string;
}

export interface WorkflowDefinition {
  id: string;
  storeId: string;
  name: string;
  trigger: string;
  states: string[];
  transitions: Record<string, string>; // "PENDING" -> "CONFIRMED", etc
  createdAt: string;
}

export interface AnalyticsEvent {
  id: string;
  storeId: string;
  customerId?: string;
  sessionId?: string;
  eventType: string; // "page_view" | "add_to_cart" | "purchase" | "search"
  payload: any;
  occurredAt: string;
}

// Database schema container
interface DbSchema {
  users: User[];
  stores: Store[];
  products: Product[];
  categories: Category[];
  carts: Cart[];
  orders: Order[];
  cmsContents: CMSContent[];
  reviews: Review[];
  wishlists: Wishlist[];
  configVersions: StoreConfigVersion[];
  rules: RuleDefinition[];
  workflows: WorkflowDefinition[];
  analyticsEvents: AnalyticsEvent[];
}

const DB_FILE = path.join(process.cwd(), "db.json");

// Pure Node hashing function
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Generates a random admin login (email + strong password) at seed time so no
// human-guessable default credentials ever ship with the project. Meets the
// same strength rules enforced on regular sign-ups (>=6 chars, uppercase,
// number, special character) but goes further since this is a superuser account.
function generateRandomAdminCredentials(): { email: string; password: string } {
  const emailSlug = crypto.randomBytes(4).toString("hex"); // e.g. "a1b2c3d4"
  const email = `admin-${emailSlug}@corecart.local`;

  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;

  const pick = (charset: string) => charset[crypto.randomInt(0, charset.length)];

  // Guarantee at least one of each required character class, then fill the
  // rest randomly, then shuffle so the required characters aren't always
  // in the same position.
  const required = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest = Array.from({ length: 8 }, () => pick(all));
  const passwordChars = [...required, ...rest];
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return { email, password: passwordChars.join("") };
}

class Database {
  private schema: DbSchema = {
    users: [],
    stores: [],
    products: [],
    categories: [],
    carts: [],
    orders: [],
    cmsContents: [],
    reviews: [],
    wishlists: [],
    configVersions: [],
    rules: [],
    workflows: [],
    analyticsEvents: [],
  };

  private pool: any = null;

  constructor() {
    this.load();
    if (this.schema.stores.length === 0) {
      this.seed();
    }
    this.removeLegacyDemoData();
    this.ensureAllStoresHaveAtLeast50Products();
    this.correctMismatchedStoreTemplates();
    this.refreshMismatchedProductImages();
    this.refreshMismatchedHeroImages();
  }

  // Corrects stores that were created before the wizard properly derived its
  // template from the business type (an old bug meant EVERY store defaulted
  // to the "fashion" template/theme regardless of what industry the seller
  // entered - e.g. an "Electronics" store still showing a "FASHION" badge and
  // coral/cream colors). We only touch a store here if its current theme is
  // still EXACTLY one of our untouched preset color sets - if the seller has
  // since customized colors via the layout editor, those custom colors are
  // left alone; only genuinely leftover default theming gets corrected.
  private correctMismatchedStoreTemplates(): void {
    let changed = false;
    for (const store of this.schema.stores) {
      const derived = deriveTemplateKey(store.businessType || "");
      if (derived === "custom" || derived === store.templateKey) continue;

      const currentAccent = store.brandIdentity?.accentColor;
      const isUntouchedPreset = Object.values(TEMPLATE_PRESETS).some((p) => p.accentColor === currentAccent);
      if (!isUntouchedPreset) continue; // seller customized their theme - never override it

      const preset = TEMPLATE_PRESETS[derived];
      store.templateKey = preset.templateKey;
      store.brandIdentity = {
        ...store.brandIdentity,
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        accentColor: preset.accentColor,
        typography: preset.typography,
        themeMode: preset.themeMode,
        brandStyle: preset.brandStyle,
      };
      store.featureToggles = { ...store.featureToggles, ...preset.featureOverrides };
      (store as any).updatedAt = new Date().toISOString();
      changed = true;
    }
    if (changed) {
      console.log("Corrected store template/theme to match business type for pre-existing stores.");
      this.save();
    }
  }

  // Checks whether an image URL's own prompt text actually references the
  // subject it's supposed to depict. This catches mismatches regardless of
  // WHERE the bad image came from — a shared Unsplash pool, an old
  // keyword-based Pollinations fallback with the wrong keyword, a stale
  // cached prompt, etc. Data URIs (real Gemini/Imagen output) are trusted
  // as-is since they were generated from an accurate prompt at creation time.
  private imageLikelyMatchesSubject(imageUrl: string, subject: string): boolean {
    if (!imageUrl) return false;
    if (imageUrl.startsWith("data:")) return true;
    if (!imageUrl.includes("pollinations.ai")) return false; // curated/random stock photo - never trustworthy
    try {
      const decoded = decodeURIComponent(imageUrl).toLowerCase();
      const words = subject
        .toLowerCase()
        .replace(/[^a-z0-9\s]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3);
      if (words.length === 0) return true;
      const matched = words.filter((w) => decoded.includes(w)).length;
      return matched / words.length >= 0.6;
    } catch {
      return false;
    }
  }

  // One-time (but idempotent, re-checked every startup) fix for products whose
  // stored image doesn't actually depict their title — whether that image came
  // from the old shared Unsplash pool, an old mismatched Pollinations keyword
  // fallback, or anything else. Regenerates a fresh title-matched image only
  // for products that fail the check; everything already correct is untouched.
  private refreshMismatchedProductImages(): void {
    let changed = false;
    for (const product of this.schema.products) {
      const current = product.images?.[0] || "";
      if (!this.imageLikelyMatchesSubject(current, product.title)) {
        product.images = [buildProductImageUrl(product.title, product.description)];
        product.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) {
      console.log("Refreshed mismatched product images to match product names.");
      this.save();
    }
  }

  // Same idea, but for each store's homepage hero banner. Existing stores
  // (created before the hero-image fix) keep whatever backgroundImage was
  // saved on them at creation time forever unless we actively refresh it here
  // — a brand-new store gets a matching hero automatically, but an existing
  // one never would without this pass.
  private refreshMismatchedHeroImages(): void {
    let changed = false;
    for (const store of this.schema.stores) {
      const hero = (store as any).homepageConfig?.hero;
      if (!hero) continue;
      if (!this.imageLikelyMatchesSubject(hero.backgroundImage || "", store.businessType || "")) {
        hero.backgroundImage = buildHeroImageUrl(store.businessType || "Retail", store.name);
        (store as any).updatedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) {
      console.log("Refreshed mismatched store hero banners to match business type.");
      this.save();
    }
  }

  // One-time cleanup: the project used to ship with a built-in demo owner
  // ("Alex Mercer" / owner@corecart.com) and three sample stores (ElectroMax,
  // Lumina Wear, FreshCart Organic) so the admin dashboard had something to
  // show out of the box. Real store owners now sign up on their own, so this
  // strips that demo owner and everything tied to their stores out of the
  // database - on every startup, whether the data is freshly seeded or
  // loaded from an existing db.json - while leaving every real account and
  // store (created through actual sign-up) completely untouched.
  private removeLegacyDemoData(): void {
    const legacyOwnerEmail = "owner@corecart.com";
    const legacyOwner = this.schema.users.find((u) => u.email.toLowerCase() === legacyOwnerEmail);
    if (!legacyOwner) return; // Already cleaned up - nothing to do.

    const legacyStoreIds = new Set(
      this.schema.stores.filter((s) => s.ownerId === legacyOwner.id).map((s) => s.id)
    );
    if (legacyStoreIds.size === 0 && !legacyOwner) return;

    this.schema.users = this.schema.users.filter((u) => u.id !== legacyOwner.id);
    this.schema.stores = this.schema.stores.filter((s) => !legacyStoreIds.has(s.id));
    this.schema.products = this.schema.products.filter((p) => !legacyStoreIds.has(p.storeId));
    this.schema.categories = this.schema.categories.filter((c) => !legacyStoreIds.has(c.storeId));
    this.schema.carts = this.schema.carts.filter((c) => !legacyStoreIds.has(c.storeId));
    this.schema.orders = this.schema.orders.filter((o) => !legacyStoreIds.has(o.storeId));
    this.schema.cmsContents = this.schema.cmsContents.filter((c) => !legacyStoreIds.has(c.storeId));
    this.schema.reviews = this.schema.reviews.filter((r) => !legacyStoreIds.has(r.storeId));
    this.schema.wishlists = this.schema.wishlists.filter((w) => !legacyStoreIds.has(w.storeId));
    this.schema.configVersions = this.schema.configVersions.filter((c) => !legacyStoreIds.has(c.storeId));
    this.schema.rules = this.schema.rules.filter((r) => !legacyStoreIds.has(r.storeId));
    this.schema.workflows = this.schema.workflows.filter((w) => !legacyStoreIds.has(w.storeId));
    this.schema.analyticsEvents = this.schema.analyticsEvents.filter((a) => !legacyStoreIds.has(a.storeId));

    console.log(`Removed legacy demo owner and ${legacyStoreIds.size} demo store(s) from the database.`);
    this.save();
  }

  // Persist the freshly-generated admin login somewhere the developer can
  // actually retrieve it (there's no email system in this project), and log
  // it loudly to the console the first time the database is seeded.
  private writeAdminCredentialsFile(email: string, password: string): void {
    const filePath = path.join(process.cwd(), "ADMIN_CREDENTIALS.txt");
    const contents =
      `CoreCart Platform Admin Login\n` +
      `==============================\n` +
      `Generated: ${new Date().toISOString()}\n\n` +
      `Email:    ${email}\n` +
      `Password: ${password}\n\n` +
      `Use these at /admin to sign in to the Platform Admin Dashboard.\n` +
      `This file is regenerated only when the database is first seeded\n` +
      `(i.e. when db.json does not yet exist). Keep it safe and out of\n` +
      `version control - it is already covered by a .gitignore rule.\n`;

    try {
      fs.writeFileSync(filePath, contents, "utf-8");
    } catch (e) {
      console.error("Could not write ADMIN_CREDENTIALS.txt:", e);
    }

    console.log("\n================================================================");
    console.log(" CoreCart Platform Admin credentials generated (first run only)");
    console.log("================================================================");
    console.log(` Email:    ${email}`);
    console.log(` Password: ${password}`);
    console.log(` (Also saved to ADMIN_CREDENTIALS.txt in the project root)`);
    console.log("================================================================\n");
  }

  private ensureAllStoresHaveAtLeast50Products(): void {
    let hasChanges = false;
    
    for (const store of this.schema.stores) {
      const storeProducts = this.schema.products.filter(p => p.storeId === store.id);
      if (storeProducts.length >= 50) {
        continue;
      }

      console.log(`Store ${store.name} (${store.id}) has ${storeProducts.length} products. Seeding up to 52 products...`);

      const type = store.businessType.toLowerCase();
      let categoryKey: "furniture" | "cosmetics" | "grocery" | "electronics" | "sports" | "fashion" = "fashion";
      if (type.includes("furniture") || type.includes("home")) {
        categoryKey = "furniture";
      } else if (type.includes("perfume") || type.includes("fragrance") || type.includes("scent") || type.includes("cosmetic")) {
        categoryKey = "cosmetics";
      } else if (type.includes("grocer") || type.includes("food") || type.includes("organic") || type.includes("supermarket")) {
        categoryKey = "grocery";
      } else if (type.includes("electr") || type.includes("phone") || type.includes("gadget") || type.includes("device")) {
        categoryKey = "electronics";
      } else if (type.includes("sport") || type.includes("fitness") || type.includes("gym") || type.includes("athlet")) {
        categoryKey = "sports";
      }

      let category = this.schema.categories.find(c => c.storeId === store.id);
      if (!category) {
        category = {
          id: `cat-${store.id}-seeded`,
          storeId: store.id,
          name: "Featured Products",
          slug: "featured",
          createdAt: new Date().toISOString()
        };
        this.schema.categories.push(category);
        hasChanges = true;
      }

      const imagesPool: Record<string, string[]> = {
        furniture: [
          "https://images.unsplash.com/photo-1555041469-a586c61ea9bc",
          "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c",
          "https://images.unsplash.com/photo-1577140917170-285929fb55b7",
          "https://images.unsplash.com/photo-1533090161767-e6ffed986c88",
          "https://images.unsplash.com/photo-1558882224-cca16673336d",
          "https://images.unsplash.com/photo-1544644181-1484b3fdfc62",
          "https://images.unsplash.com/photo-1595428774223-ef52624120d2",
          "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85",
          "https://images.unsplash.com/photo-1586023492125-27b2c045efd7",
          "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd"
        ],
        cosmetics: [
          "https://images.unsplash.com/photo-1541643600914-78b084683601",
          "https://images.unsplash.com/photo-1594035910387-fea47794261f",
          "https://images.unsplash.com/photo-1523293182086-7651a899d37f",
          "https://images.unsplash.com/photo-1547887537-6158d64c35b3",
          "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539",
          "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108",
          "https://images.unsplash.com/photo-1595425970377-c9703cf48b6d",
          "https://images.unsplash.com/photo-1588405748373-122b2321bc31",
          "https://images.unsplash.com/photo-1612817288484-6f916006741a",
          "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19"
        ],
        grocery: [
          "https://images.unsplash.com/photo-1586201375761-83865001e31c",
          "https://images.unsplash.com/photo-1563636619-e9143da7973b",
          "https://images.unsplash.com/photo-1509440159596-0249088772ff",
          "https://images.unsplash.com/photo-1587049352846-4a222e784d38",
          "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5",
          "https://images.unsplash.com/photo-1516448620398-c5f44bf9f441",
          "https://images.unsplash.com/photo-1596436889106-be35e843f974",
          "https://images.unsplash.com/photo-1615485290382-441e4d049cb5",
          "https://images.unsplash.com/photo-1508061253366-f7da158b6d46",
          "https://images.unsplash.com/photo-1597481499750-3e6b22637e12"
        ],
        electronics: [
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
          "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
          "https://images.unsplash.com/photo-1546868871-7041f2a55e12",
          "https://images.unsplash.com/photo-1563986768609-322da13575f3",
          "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed",
          "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf",
          "https://images.unsplash.com/photo-1593642632823-8f785ba67e45",
          "https://images.unsplash.com/photo-1542751371-adc38448a05e",
          "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46",
          "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b"
        ],
        fashion: [
          "https://images.unsplash.com/photo-1591047139829-d91aecb6caea",
          "https://images.unsplash.com/photo-1548624149-f9b1859aa7d0",
          "https://images.unsplash.com/photo-1521572267360-ee0c2909d518",
          "https://images.unsplash.com/photo-1511499767150-a48a237f0083",
          "https://images.unsplash.com/photo-1549298916-b41d501d3772",
          "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a",
          "https://images.unsplash.com/photo-1543163521-1bf539c55dd2",
          "https://images.unsplash.com/photo-1627123424574-724758594e93",
          "https://images.unsplash.com/photo-1584917865442-de89df76afd3",
          "https://images.unsplash.com/photo-1524805444758-089113d48a6d"
        ]
      };

      const pool = imagesPool[categoryKey] || imagesPool.fashion;

      const templates = {
        furniture: {
          titles: [
            "Teak Wood Side Chair", "Velvet Accent Ottoman", "Nordic Ash Dining Table", "Marble Coffee Plate",
            "Modern Floor Task Light", "Mid-Century Bookshelf Set", "Industrial Steel Coat Rack", "Rustic Pine Bench Seat",
            "Classic Leather Armchair", "Sleek Adjustable Standing Desk", "Premium Bamboo Storage Bench", "Geometric Metal Display Stand",
            "Ergonomic Memory Backrest", "Modernist Ceramic Planter", "Vintage Walnut Nightstand", "Luxurious Woven Pouf",
            "Satin Finished Shoe Cabinet", "Handwoven Cotton Wall Tapestry", "Abstract Framed Fine Art", "Bohemian Accent Cushion Set"
          ],
          descriptions: [
            "Tailored with absolute detail to bring visual elegance, premium texture, and functional utility to your home space.",
            "A gorgeous accent furniture item that perfectly combines high-density foam support with a durable designer finish.",
            "Crafted using premium, sustainably harvested wood to ensure lasting structural integrity and rich premium grain textures."
          ],
          attributes: {
            Material: "Sustainably Sourced Oak",
            Color: "Warm Amber Glow",
            Assembly: "Easy Toolless Setup",
            Warranty: "3-Year Structural Warranty"
          }
        },
        cosmetics: {
          titles: [
            "Hydrating Vitamin B5 Serum", "Pure Bulgarian Lavender Mist", "Purifying French Charcoal Mask", "Advanced Retinol Night Therapy",
            "Soothing Organic Chamomile Balm", "Cold-Pressed Marula Glow Oil", "Rich Whipped Shea Butter Cream", "Broad-Spectrum Zinc SPF30",
            "Polishing Grapefruit Sugar Scrub", "Cooling Eucalyptus Soothing Gel", "Clarifying Willow Bark Cleanser", "Silky Cocoa Butter Lotion",
            "Brightening Peptide Eye Gel", "Renewing Rosehip Seed Face Elixir", "Antioxidant White Tea Face Cream", "Relaxing Jasmine Aromatherapy",
            "Squalane Plumping Lip Balm", "pH-Balancing Probiotic Toner", "Silken Shea Velvet Hand Cream", "Night Recovery Sleep Elixir"
          ],
          descriptions: [
            "A clean, lightweight botanical solution formulated to nurture, lock in hydration, and illuminate your skin naturally.",
            "Carefully infused with active organic extracts to deliver deep, wholesome skin-barrier protection and lasting luxury.",
            "Indulge in a premium, spa-grade skin pampering experience at home. Cruelty-free, vegan-certified, and pure."
          ],
          attributes: {
            SkinType: "Suitable for All Skin Types",
            Volume: "50ml",
            Formula: "100% Organic & Clean",
            Benefit: "Deep Hydration & Glow"
          }
        },
        grocery: {
          titles: [
            "Organic Red Quinoa Grain", "Gluten-Free Oat Flour Blend", "Pure Wood-Pressed Groundnut Oil", "Natural Roasted Cashew Nuts",
            "Artisan Whole Wheat Spaghetti", "Raw Unfiltered Apple Cider Glaze", "Premium Dark Roast Coffee Pods", "Dark Chocolate Truffle 70%",
            "Premium Black Seed Superfood", "Unsweetened Coconut Milk Carton", "Himalayan Grown Red Lentils", "Spiced Sunflower Seed Mix",
            "Grass-Fed Salted Creamery Butter", "Cold-Brew Oolong Iced Tea", "Aromatic Whole Cloves Pack", "Raw Organic Pecan Halves",
            "Fine Ground Pink Rock Salt", "Organic Black Seed Cold-Pressed Oil", "Aromatic Ground Black Pepper", "Rich Matcha Green Tea Powder"
          ],
          descriptions: [
            "Carefully sourced from ethical and certified sustainable agricultural farms. Nutritious, pure, and premium-packed.",
            "Rich in essential vitamins, plant-based proteins, and fibers. The perfect healthy kitchen staple for clean eating.",
            "Prepared using ancient slow-pressing methods to maintain all original flavor, nutrients, and rich natural aromas."
          ],
          attributes: {
            Weight: "500g Resealable Pack",
            Dietary: "USDA Organic Certified",
            Origin: "Directly Sourced from Farms",
            ShelfLife: "12 Months from Batch Date"
          }
        },
        electronics: {
          titles: [
            "Premium USB-C Charger Hub", "Compact Power Bank 15000mAh", "Adjustable Aluminium Device Stand", "Professional Studio Condenser Mic",
            "Multi-Device Wireless Mouse Pro", "High-Speed Braided HDMI 2.1 Cord", "Wireless Active Noise-Cancelling Buds", "Smart Wi-Fi Grounded Plug",
            "Felt Wool Desk Protector Mat", "Bluetooth GPS Finder Tracker Key", "Ultra-Fast Portable SSD 1TB", "Adaptive Dual-Ring Video Light",
            "Ergonomic Memory Gel Wrist Rest", "Magnetic Wireless Dash Phone Mount", "Precision Carbon Fiber Touch Pen", "Blue-Light Filter Screen Guard",
            "Compact 6-in-1 Expansion Dock", "RGB Aurora Backlit Gaming Stand", "Automatic Cable Management Clip Set", "Full HD Autofocus Streaming Camera"
          ],
          descriptions: [
            "Equipped with advanced intelligent charging and premium chipsets to deliver maximum efficiency and speed.",
            "Exquisite modern design optimized for daily professional use, exceptional lifetime durability, and portability.",
            "Elevate your workspace with this minimal, highly versatile, premium carbon-aluminum desk accessory."
          ],
          attributes: {
            Interface: "USB 3.2 High-Speed Gen 2",
            Material: "Anodized Aerospace Aluminum",
            Power: "65W Power Delivery Support",
            Warranty: "2-Year Core Warranty"
          }
        },
        fashion: {
          titles: [
            "Comfort-Fit Denim Chinos", "Brushed Fleece Lounge Pullover", "Lightweight Shell Running Jacket", "Knit Comfort Daily Trainers",
            "Premium Suede Leather Everyday Belt", "Heavyweight Organic Fleece Hoodie", "Casual Cotton Drawstring Shorts", "Combed Soft Crew Socks Pack",
            "Polarized UV400 Sport Goggles", "Modern Leather Chrono Sport Watch", "Sleek RFID Blocking Slim Wallet", "Sling Canvas Everyday Messenger",
            "Button-Down Fine Corduroy Shirt", "Diamond-Stitch Packable Puffer Vest", "Soft Brushed Acrylic Winter Scarf", "Classic Fisherman Beanie Hat",
            "Heavy-Duty Waterproof Gym Bag", "Tailored Wool Blend Slim Dress Pants", "Super-Soft Bamboo Sleepwear Robe", "Minimalist Steel Cuban Bracelet"
          ],
          descriptions: [
            "Beautifully cut and tailored using hand-selected premium yarns to achieve the perfect silhouette, durability, and comfort.",
            "A timeless wardrobe classic designed to transition effortlessly between relaxed weekends and active outings.",
            "Crafted using certified organic fibers dyed with water-saving, hypoallergenic, skin-safe natural dyes."
          ],
          attributes: {
            Material: "85% Premium Combed Cotton, 15% Linen",
            Fit: "Tailored Modern Slim",
            Care: "Machine Wash Cold, Tumble Dry Low",
            Style: "Minimalist Everyday Classic"
          }
        },
        sports: {
          titles: [
            "Trail-Ready Running Shoes", "Adjustable Kettlebell 16kg", "Extra-Thick Yoga Mat", "High-Support Sports Bra",
            "Insulated Steel Sports Bottle", "Loop Resistance Bands Set", "Breathable Training Tank Top", "Speed Jump Rope",
            "Padded Fingerless Gym Gloves", "Quick-Dry Microfiber Towel", "Compression Knee Sleeve", "Weightlifting Wrist Wraps",
            "Sweat-Proof Wireless Earbuds", "Textured Recovery Foam Roller", "Agility Training Cone Set", "Lightweight Squash Racket",
            "Trail Running Cross-Trainers", "Heavy-Duty Gym Duffel", "Adjustable Speed Rope Handles", "Insulated Protein Shaker"
          ],
          descriptions: [
            "Built for serious training - durable construction that holds up to daily gym sessions, runs, and outdoor workouts.",
            "Ergonomic design with sweat-resistant materials, engineered to keep pace with high-intensity routines.",
            "Trusted by athletes for reliable performance, comfortable fit, and long-lasting durability."
          ],
          attributes: {
            Material: "Moisture-Wicking Performance Fabric",
            Fit: "Athletic Training Fit",
            UseCase: "Gym, Running & Outdoor Training",
            Warranty: "1-Year Manufacturer Warranty"
          }
        }
      };

      const categoryTemplates = templates[categoryKey] || templates.fashion;
      const countToGenerate = 52 - storeProducts.length;

      for (let i = 0; i < countToGenerate; i++) {
        const titleTemplate = categoryTemplates.titles[i % categoryTemplates.titles.length];
        const num = storeProducts.length + i + 1;
        const title = `${titleTemplate} v${num}`;
        const skuPrefix = categoryKey.toUpperCase().substring(0, 3);
        const sku = `${skuPrefix}-${store.slug.toUpperCase().substring(0, 4)}-${num}`;
        const basePrice = (Math.floor(Math.random() * 8) * 150 + 199) * 100; // in cents
        const brand = store.name;
        const description = categoryTemplates.descriptions[i % categoryTemplates.descriptions.length];
        
        // Derive the image from the product's own title so it matches the item
        // (previously cycled a small shared pool, producing mismatched photos).
        const imageUrl = buildProductImageUrl(title, description);

        const product: Product = {
          id: `prod-seeded-${store.id}-${num}`,
          storeId: store.id,
          sku,
          title,
          slug: title.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          description,
          brand,
          status: "ACTIVE",
          categoryId: category.id,
          basePrice,
          currency: store.currency || "INR",
          attributes: categoryTemplates.attributes,
          images: [imageUrl],
          variants: [
            {
              id: `var-seeded-${store.id}-${num}`,
              sku: `${sku}-MAIN`,
              attributes: {},
              priceDelta: 0,
              quantityOnHand: 150,
              quantityReserved: 0
            }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        this.schema.products.push(product);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      console.log("Seeding verified. Saving updated db.json to disk...");
      this.save();
    }
  }

  // Asynchronous initializer for PostgreSQL
  public async initialize(): Promise<void> {
    if (!process.env.SQL_HOST) {
      console.log("SQL_HOST is not set. Running with standard local JSON file storage.");
      return;
    }

    try {
      const { Pool } = await import("pg");
      const poolInstance = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        port: 5432,
        ssl: {
          rejectUnauthorized: false,
        },
        connectionTimeoutMillis: 15000,

      });

      console.log("Connecting to PostgreSQL...");
      // Prevent unhandled pool-level errors from crashing the app
      poolInstance.on("error", (err: any) => {
        console.error("Unexpected error on idle PostgreSQL pool client:", err);
      });

      // Create table for persistent state storage if it does not exist
      await poolInstance.query(`
        CREATE TABLE IF NOT EXISTS core_cart_store (
          key VARCHAR(255) PRIMARY KEY,
          data TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Retrieve state from PostgreSQL
      const res = await poolInstance.query("SELECT data FROM core_cart_store WHERE key = $1", ["db_schema"]);
      if (res.rows.length > 0) {
        console.log("State successfully recovered from PostgreSQL!");
        const pgSchema = JSON.parse(res.rows[0].data);
        // Clean merge to ensure we don't drop empty tables if they're present locally
        this.schema = {
          ...this.schema,
          ...pgSchema,
        };
      } else {
        console.log("No existing state found in PostgreSQL. Writing current template/seed data...");
        await poolInstance.query(
          "INSERT INTO core_cart_store (key, data, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP",
          ["db_schema", JSON.stringify(this.schema)]
        );
      }

      // Set this.pool only after successful table creation and initial sync
      this.pool = poolInstance;
    } catch (e) {
      console.error("Failed to initialize PostgreSQL backend. Operating in local-only fallback mode:", e);
    }
  }

  // Load from db.json
  private load(): void {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        this.schema = JSON.parse(raw);
      }
    } catch (e) {
      console.error("Error loading local database, starting with empty schema:", e);
    }
  }

  // Save to db.json and persist asynchronously to PostgreSQL
  private save(): void {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.schema, null, 2), "utf-8");

      if (this.pool) {
        this.pool.query(
          "INSERT INTO core_cart_store (key, data, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP",
          ["db_schema", JSON.stringify(this.schema)]
        ).catch((err: any) => {
          console.error("Async PostgreSQL state update failed:", err);
        });
      }
    } catch (e) {
      console.error("Error saving local database:", e);
    }
  }

  // Transactional or general persistence trigger
  public persist(): void {
    this.save();
  }

  // Tables API
  public get users() {
    return {
      findUnique: (email: string) => this.schema.users.find((u) => u.email.toLowerCase() === email.toLowerCase()),
      findById: (id: string) => this.schema.users.find((u) => u.id === id),
      findAll: () => this.schema.users,
      create: (user: Omit<User, "id" | "createdAt">) => {
        const newUser: User = {
          ...user,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        this.schema.users.push(newUser);
        this.save();
        return newUser;
      },
    };
  }

  public get stores() {
    return {
      findUnique: (slug: string) => this.schema.stores.find((s) => s.slug === slug && s.status !== "ARCHIVED"),
      findById: (id: string) => this.schema.stores.find((s) => s.id === id && s.status !== "ARCHIVED"),
      findAll: () => this.schema.stores.filter((s) => s.status !== "ARCHIVED"),
      create: (store: Omit<Store, "id" | "createdAt" | "updatedAt">) => {
        const now = new Date().toISOString();
        const defaultHomepageConfig = {
          hero: {
            title: `Welcome to ${store.name}`,
            subtitle: store.description || "The future of curated shopping.",
            // Hero banner reflects the store's actual business type instead of a
            // fixed clothing-boutique photo, so an electronics store no longer
            // shows a fashion backdrop.
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
        const newStore: Store = {
          homepageConfig: defaultHomepageConfig,
          navigationConfig: [],
          footerConfig: { footerText: `© ${new Date().getFullYear()} ${store.name}. All Rights Reserved.` },
          buttonStyle: "rounded",
          ...store,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        this.schema.stores.push(newStore);
        this.save();
        return newStore;
      },
      update: (id: string, data: Partial<Omit<Store, "id" | "createdAt">>) => {
        const idx = this.schema.stores.findIndex((s) => s.id === id);
        if (idx === -1) return null;
        this.schema.stores[idx] = {
          ...this.schema.stores[idx],
          ...data,
          updatedAt: new Date().toISOString(),
        } as Store;
        this.save();
        return this.schema.stores[idx];
      },
    };
  }

  public get products() {
    return {
      findById: (id: string) => this.schema.products.find((p) => p.id === id && p.status !== "ARCHIVED"),
      findBySku: (storeId: string, sku: string) =>
        this.schema.products.find((p) => p.storeId === storeId && p.sku === sku && p.status !== "ARCHIVED"),
      findAllByStore: (storeId: string) => this.schema.products.filter((p) => p.storeId === storeId && p.status !== "ARCHIVED"),
      create: (prod: Omit<Product, "id" | "createdAt" | "updatedAt">) => {
        const now = new Date().toISOString();
        const newProd: Product = {
          ...prod,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        this.schema.products.push(newProd);
        this.save();
        return newProd;
      },
      update: (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => {
        const idx = this.schema.products.findIndex((p) => p.id === id);
        if (idx === -1) return null;
        this.schema.products[idx] = {
          ...this.schema.products[idx],
          ...data,
          updatedAt: new Date().toISOString(),
        } as Product;
        this.save();
        return this.schema.products[idx];
      },
    };
  }

  public get categories() {
    return {
      findById: (id: string) => this.schema.categories.find((c) => c.id === id),
      findAllByStore: (storeId: string) => this.schema.categories.filter((c) => c.storeId === storeId),
      create: (cat: Omit<Category, "id" | "createdAt"> & { id?: string }) => {
        const newCat: Category = {
          ...cat,
          id: cat.id || crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        this.schema.categories.push(newCat);
        this.save();
        return newCat;
      },
    };
  }

  public get carts() {
    return {
      findById: (id: string) => this.schema.carts.find((c) => c.id === id),
      findByCustomer: (storeId: string, customerId: string) =>
        this.schema.carts.find((c) => c.storeId === storeId && c.customerId === customerId && c.status === "ACTIVE"),
      findBySession: (storeId: string, sessionId: string) =>
        this.schema.carts.find((c) => c.storeId === storeId && c.sessionId === sessionId && c.status === "ACTIVE"),
      create: (cart: Omit<Cart, "id" | "createdAt" | "updatedAt">) => {
        const now = new Date().toISOString();
        const newCart: Cart = {
          ...cart,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        this.schema.carts.push(newCart);
        this.save();
        return newCart;
      },
      update: (id: string, data: Partial<Omit<Cart, "id" | "createdAt">>) => {
        const idx = this.schema.carts.findIndex((c) => c.id === id);
        if (idx === -1) return null;
        this.schema.carts[idx] = {
          ...this.schema.carts[idx],
          ...data,
          updatedAt: new Date().toISOString(),
        } as Cart;
        this.save();
        return this.schema.carts[idx];
      },
    };
  }

  public get orders() {
    return {
      findById: (id: string) => this.schema.orders.find((o) => o.id === id),
      findByNumber: (storeId: string, orderNumber: string) =>
        this.schema.orders.find((o) => o.storeId === storeId && o.orderNumber === orderNumber),
      findAllByStore: (storeId: string) => this.schema.orders.filter((o) => o.storeId === storeId),
      findAllByCustomer: (storeId: string, customerId: string) =>
        this.schema.orders.filter((o) => o.storeId === storeId && o.customerId === customerId),
      create: (order: Omit<Order, "id" | "placedAt">) => {
        const newOrder: Order = {
          ...order,
          id: crypto.randomUUID(),
          placedAt: new Date().toISOString(),
        };
        this.schema.orders.push(newOrder);
        this.save();
        return newOrder;
      },
      updateStatus: (id: string, status: Order["status"]) => {
        const order = this.schema.orders.find((o) => o.id === id);
        if (order) {
          order.status = status;
          this.save();
        }
        return order;
      },
    };
  }

  public get cmsContents() {
    return {
      findAllByStore: (storeId: string) => this.schema.cmsContents.filter((c) => c.storeId === storeId),
      findByType: (storeId: string, type: CMSContent["type"]) =>
        this.schema.cmsContents.filter((c) => c.storeId === storeId && c.type === type),
      create: (content: Omit<CMSContent, "id" | "createdAt">) => {
        const newContent: CMSContent = {
          ...content,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        this.schema.cmsContents.push(newContent);
        this.save();
        return newContent;
      },
    };
  }

  public get reviews() {
    return {
      findAllByProduct: (productId: string) => this.schema.reviews.filter((r) => r.productId === productId && r.status === "APPROVED"),
      findAllByStore: (storeId: string) => this.schema.reviews.filter((r) => r.storeId === storeId),
      create: (review: Omit<Review, "id" | "createdAt">) => {
        const newReview: Review = {
          ...review,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        this.schema.reviews.push(newReview);
        this.save();
        return newReview;
      },
      updateStatus: (id: string, status: Review["status"]) => {
        const r = this.schema.reviews.find((x) => x.id === id);
        if (r) {
          r.status = status;
          this.save();
        }
        return r;
      },
    };
  }

  public get wishlists() {
    return {
      findByCustomer: (storeId: string, customerId: string) =>
        this.schema.wishlists.find((w) => w.storeId === storeId && w.customerId === customerId),
      create: (wishlist: Omit<Wishlist, "id" | "createdAt">) => {
        const newWishlist: Wishlist = {
          ...wishlist,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        this.schema.wishlists.push(newWishlist);
        this.save();
        return newWishlist;
      },
      update: (id: string, productIds: string[]) => {
        const w = this.schema.wishlists.find((x) => x.id === id);
        if (w) {
          w.productIds = productIds;
          this.save();
        }
        return w;
      },
    };
  }

  public get configVersions() {
    return {
      findAllByStore: (storeId: string) => this.schema.configVersions.filter((v) => v.storeId === storeId),
      create: (v: Omit<StoreConfigVersion, "id" | "publishedAt">) => {
        const newV: StoreConfigVersion = {
          ...v,
          id: crypto.randomUUID(),
          publishedAt: new Date().toISOString(),
        };
        this.schema.configVersions.push(newV);
        this.save();
        return newV;
      },
    };
  }

  public get rules() {
    return {
      findAllByStore: (storeId: string) => this.schema.rules.filter((r) => r.storeId === storeId && r.isActive),
      create: (rule: Omit<RuleDefinition, "id" | "createdAt">) => {
        const newRule: RuleDefinition = {
          ...rule,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        this.schema.rules.push(newRule);
        this.save();
        return newRule;
      },
    };
  }

  public get workflows() {
    return {
      findAllByStore: (storeId: string) => this.schema.workflows.filter((w) => w.storeId === storeId),
      create: (wf: Omit<WorkflowDefinition, "id" | "createdAt">) => {
        const newWf: WorkflowDefinition = {
          ...wf,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        this.schema.workflows.push(newWf);
        this.save();
        return newWf;
      },
    };
  }

  public get analytics() {
    return {
      createEvent: (ev: Omit<AnalyticsEvent, "id" | "occurredAt">) => {
        const newEv: AnalyticsEvent = {
          ...ev,
          id: crypto.randomUUID(),
          occurredAt: new Date().toISOString(),
        };
        this.schema.analyticsEvents.push(newEv);
        this.save();
        return newEv;
      },
      getEvents: (storeId: string) => this.schema.analyticsEvents.filter((e) => e.storeId === storeId),
    };
  }

  // Seeding default templates, custom stores, demo catalog
  private seed(): void {
    console.log("Seeding CoreCart database with premium storefront configurations...");

    // 1. Users
    const ownerPasswordHash = hashPassword("owner123");
    const customerPasswordHash = hashPassword("customer123");
    const { email: generatedAdminEmail, password: generatedAdminPassword } = generateRandomAdminCredentials();

    const storeOwner: User = {
      id: "owner-id-1",
      email: "owner@corecart.com",
      passwordHash: ownerPasswordHash,
      role: "STORE_OWNER",
      name: "Alex Mercer",
      createdAt: new Date().toISOString(),
    };

    const demoCustomer: User = {
      id: "customer-id-1",
      email: "customer@gmail.com",
      passwordHash: customerPasswordHash,
      role: "CUSTOMER",
      name: "Jane Doe",
      createdAt: new Date().toISOString(),
    };

    const platformAdmin: User = {
      id: "admin-id-1",
      email: generatedAdminEmail,
      passwordHash: hashPassword(generatedAdminPassword),
      role: "PLATFORM_ADMIN",
      name: "Super Admin",
      createdAt: new Date().toISOString(),
    };

    this.schema.users = [storeOwner, demoCustomer, platformAdmin];
    this.writeAdminCredentialsFile(generatedAdminEmail, generatedAdminPassword);

    // 2. Stores & Default Templates
    // Store 1: ElectroMax (Electronics Template)
    const store1Id = "store-electro-id";
    const electroStore: Store = {
      id: store1Id,
      ownerId: "owner-id-1",
      name: "ElectroMax",
      slug: "electromax",
      businessType: "Consumer Electronics",
      description: "Next generation futuristic hardware and smart devices.",
      country: "India",
      currency: "INR",
      language: "en",
      timezone: "IST",
      status: "ACTIVE",
      templateKey: "electronics",
      brandIdentity: {
        primaryColor: "#0A0F24", // Deep void blue
        secondaryColor: "#172A45",
        accentColor: "#34D6A6", // Neon mint
        typography: "Space Grotesk",
        themeMode: "dark",
        brandStyle: "bold",
      },
      featureToggles: {
        wishlist: true,
        compare_products: true,
        reviews: true,
        coupons: true,
        search_autocomplete: true,
        smart_recommendations: true,
        blog: true,
        faq: true,
        dark_mode: true,
        flash_deals: true,
        stock_alerts: true,
        analytics_dashboard: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store 2: Lumina Wear (Fashion Template)
    const store2Id = "store-fashion-id";
    const fashionStore: Store = {
      id: store2Id,
      ownerId: "owner-id-1",
      name: "Lumina Wear",
      slug: "lumina",
      businessType: "Apparel & Fashion",
      description: "Sustainable minimalist garments crafted for comfort.",
      country: "India",
      currency: "INR",
      language: "en",
      timezone: "IST",
      status: "ACTIVE",
      templateKey: "fashion",
      brandIdentity: {
        primaryColor: "#FAF9F6", // Alabaster white
        secondaryColor: "#1A1A1A",
        accentColor: "#E29578", // Teracotta sunset
        typography: "Inter",
        themeMode: "light",
        brandStyle: "clean",
      },
      featureToggles: {
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
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store 3: FreshCart (Grocery Template)
    const store3Id = "store-grocery-id";
    const groceryStore: Store = {
      id: store3Id,
      ownerId: "owner-id-1",
      name: "FreshCart Organic",
      slug: "freshcart",
      businessType: "Food & Grocery",
      description: "Locally sourced organic products delivered to your door.",
      country: "India",
      currency: "INR",
      language: "en",
      timezone: "IST",
      status: "ACTIVE",
      templateKey: "grocery",
      brandIdentity: {
        primaryColor: "#F4F9F4", // Soft green
        secondaryColor: "#1E3F20",
        accentColor: "#2ECC71", // Vibrant green
        typography: "Inter",
        themeMode: "light",
        brandStyle: "minimal",
      },
      featureToggles: {
        wishlist: true,
        compare_products: false,
        reviews: true,
        coupons: true,
        search_autocomplete: true,
        smart_recommendations: true,
        blog: false,
        faq: true,
        dark_mode: false,
        flash_deals: true,
        stock_alerts: false,
        analytics_dashboard: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.schema.stores = [electroStore, fashionStore, groceryStore];

    // 3. Categories
    const electroCatId = "cat-electro-gadget";
    const electroCat: Category = {
      id: electroCatId,
      storeId: store1Id,
      name: "Smart Gadgets",
      slug: "smart-gadgets",
      createdAt: new Date().toISOString(),
    };

    const fashionCatId = "cat-fashion-apparel";
    const fashionCat: Category = {
      id: fashionCatId,
      storeId: store2Id,
      name: "Tops & Outerwear",
      slug: "tops-outerwear",
      createdAt: new Date().toISOString(),
    };

    const groceryCatId = "cat-grocery-fresh";
    const groceryCat: Category = {
      id: groceryCatId,
      storeId: store3Id,
      name: "Organic Produce",
      slug: "organic-produce",
      createdAt: new Date().toISOString(),
    };

    this.schema.categories = [electroCat, fashionCat, groceryCat];

    // 4. Products for ElectroMax
    const p1: Product = {
      id: "prod-quantum-watch",
      storeId: store1Id,
      sku: "EM-WATCH-01",
      title: "Quantum Watch v3",
      slug: "quantum-watch-v3",
      description: "Bionic OLED smart timepiece featuring biometric heartbeat analysis, holographic dials, and a 10-day fusion-cell battery.",
      brand: "AeroTech",
      status: "ACTIVE",
      categoryId: electroCatId,
      basePrice: 1899900, // ₹18,999.00
      currency: "INR",
      attributes: {
        connectivity: "Bluetooth 5.3, WiFi, Satellite",
        sensors: ["Heart rate", "SpO2", "Barometer", "G-sensor"],
        colors: ["Fusion Silver", "Cyber Black", "Obsidian Red"],
      },
      images: [
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?auto=format&fit=crop&w=600&q=80"
      ],
      variants: [
        { id: "var-qw-silver", sku: "EM-WATCH-01-SILVER", attributes: { color: "Fusion Silver" }, priceDelta: 0, quantityOnHand: 45, quantityReserved: 0 },
        { id: "var-qw-black", sku: "EM-WATCH-01-BLACK", attributes: { color: "Cyber Black" }, priceDelta: 150000, quantityOnHand: 30, quantityReserved: 0 },
        { id: "var-qw-red", sku: "EM-WATCH-01-RED", attributes: { color: "Obsidian Red" }, priceDelta: 200000, quantityOnHand: 5, quantityReserved: 0 },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const p2: Product = {
      id: "prod-neon-buds",
      storeId: store1Id,
      sku: "EM-EARBUDS-02",
      title: "NeonBuds Pro",
      slug: "neonbuds-pro",
      description: "Active carbon-shield noise cancelling wireless earphones with neon soundwaves visualization.",
      brand: "AeroTech",
      status: "ACTIVE",
      categoryId: electroCatId,
      basePrice: 349900, // ₹3,499.00
      currency: "INR",
      attributes: {
        "Noise Cancelling": "ANC 45dB Active",
        Battery: "36 Hours with Charging Case",
      },
      images: ["https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80"],
      variants: [
        { id: "var-nb-neon", sku: "EM-EAR-NEON", attributes: { glowColor: "Glow Green" }, priceDelta: 0, quantityOnHand: 150, quantityReserved: 0 },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Products for Lumina Wear (Fashion)
    const p3: Product = {
      id: "prod-linen-shirt",
      storeId: store2Id,
      sku: "LW-LINEN-01",
      title: "Sustainable Linen Blouse",
      slug: "sustainable-linen-blouse",
      description: "Relaxed-fit blouse made from 100% organic linen fibers, dyed using water-saving botanical colors.",
      brand: "Lumina Wear",
      status: "ACTIVE",
      categoryId: fashionCatId,
      basePrice: 149900, // ₹1,499.00
      currency: "INR",
      attributes: {
        Material: "100% Organic Linen",
        Fittings: ["Regular Fit", "Oversized Fit"],
        Colors: ["Oatmeal", "Sage", "Pure Indigo"],
      },
      images: ["https://images.unsplash.com/photo-1548624149-f9b1859aa7d0?auto=format&fit=crop&w=600&q=80"],
      variants: [
        { id: "var-ls-oat-s", sku: "LW-L-OAT-S", attributes: { color: "Oatmeal", size: "S" }, priceDelta: 0, quantityOnHand: 20, quantityReserved: 0 },
        { id: "var-ls-oat-m", sku: "LW-L-OAT-M", attributes: { color: "Oatmeal", size: "M" }, priceDelta: 0, quantityOnHand: 25, quantityReserved: 0 },
        { id: "var-ls-sage-m", sku: "LW-L-SAGE-M", attributes: { color: "Sage", size: "M" }, priceDelta: 20000, quantityOnHand: 15, quantityReserved: 0 },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const p4: Product = {
      id: "prod-organic-trench",
      storeId: store2Id,
      sku: "LW-COAT-02",
      title: "City Trench Coat",
      slug: "city-trench-coat",
      description: "Double-breasted timeless outerwear engineered from waterproof organic twill cotton.",
      brand: "Lumina Wear",
      status: "ACTIVE",
      categoryId: fashionCatId,
      basePrice: 499900, // ₹4,999.00
      currency: "INR",
      attributes: {
        Material: "Waterproof Cotton Twill",
      },
      images: ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80"],
      variants: [
        { id: "var-tc-beige-m", sku: "LW-TC-BEIGE-M", attributes: { color: "Sand Beige", size: "M" }, priceDelta: 0, quantityOnHand: 8, quantityReserved: 0 },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Products for FreshCart (Grocery)
    const p5: Product = {
      id: "prod-honeycrisp-apples",
      storeId: store3Id,
      sku: "FC-APPLE-01",
      title: "Organic Honeycrisp Apples",
      slug: "organic-honeycrisp-apples",
      description: "Sweet, crisp, and freshly harvested organic apples sourced from local organic farms. Priced per kg.",
      brand: "FreshFarm",
      status: "ACTIVE",
      categoryId: groceryCatId,
      basePrice: 39900, // ₹399.00
      currency: "INR",
      attributes: {
        Organic: "USDA Certified Organic",
        Weight: "1 kg",
      },
      images: ["https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&w=600&q=80"],
      variants: [
        { id: "var-apple-3lb", sku: "FC-APP-3LB", attributes: { packSize: "1 kg Bag" }, priceDelta: 0, quantityOnHand: 200, quantityReserved: 0 },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.schema.products = [p1, p2, p3, p4, p5];

    // 5. CMS Content (FAQ + Blogs)
    this.schema.cmsContents = [
      {
        id: "faq-1",
        storeId: store1Id,
        type: "faq",
        payload: {
          question: "What is your return policy on ElectroMax items?",
          answer: "We offer a 30-day absolute trial. If your holographic watch or bionic earphones do not elevate your reality, ship it back for a full refund.",
        },
        createdAt: new Date().toISOString(),
      },
      {
        id: "faq-2",
        storeId: store1Id,
        type: "faq",
        payload: {
          question: "How long does shipping take?",
          answer: "All items ship within 24 hours via high-speed cargo and arrive in 1-3 business days.",
        },
        createdAt: new Date().toISOString(),
      },
      {
        id: "blog-1",
        storeId: store1Id,
        type: "blog",
        payload: {
          title: "The Holographic Wrist Revolution",
          summary: "Exploring how bionic sensors and light projecting lenses in smartwatches are completely changing our daily schedule synchronization.",
          content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam nec arcu id arcu elementum condimentum...",
          author: "Tech Analyst",
          image: "https://picsum.photos/seed/hologramblog/800/400",
        },
        createdAt: new Date().toISOString(),
      },
      {
        id: "faq-3",
        storeId: store2Id,
        type: "faq",
        payload: {
          question: "Is your fashion cotton sustainable?",
          answer: "Absolutely. 100% of our cotton is organic standard certified, grown under fair-trade criteria with rainwater irrigation.",
        },
        createdAt: new Date().toISOString(),
      },
      {
        id: "blog-2",
        storeId: store2Id,
        type: "blog",
        payload: {
          title: "Capsule Wardrobes: Embracing Minimal Fabric",
          summary: "Learn how to build a luxurious styling rotation with just 12 carefully selected organic garments.",
          content: "Building a sustainable capsule wardrobe is easier than you think...",
          author: "Lumina Stylist",
          image: "https://picsum.photos/seed/capsuleblog/800/400",
        },
        createdAt: new Date().toISOString(),
      },
    ];

    // 6. Config Versions (First versions)
    this.schema.configVersions = [
      {
        id: "cv-electro-1",
        storeId: store1Id,
        version: 1,
        configJson: JSON.stringify(electroStore),
        publishedAt: new Date().toISOString(),
        publishedBy: "Alex Mercer",
      },
      {
        id: "cv-fashion-1",
        storeId: store2Id,
        version: 1,
        configJson: JSON.stringify(fashionStore),
        publishedAt: new Date().toISOString(),
        publishedBy: "Alex Mercer",
      },
    ];

    // 7. Rules and Workflows
    this.schema.rules = [
      {
        id: "rule-electro-free-shipping",
        storeId: store1Id,
        name: "Free Shipping on Quantum Gadgets",
        type: "conditional_shipping",
        conditions: { minOrderValue: 15000 }, // $150.00 (15000 cents)
        actions: { freeShipping: true },
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: "rule-fashion-coupon-welcome",
        storeId: store2Id,
        name: "Welcome Launch Discount",
        type: "discount",
        conditions: { couponCode: "WELCOME10" },
        actions: { discountPercent: 10 },
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];

    this.schema.workflows = [
      {
        id: "wf-order-electro",
        storeId: store1Id,
        name: "ElectroMax Tech Order Pipeline",
        trigger: "order_created",
        states: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"],
        transitions: {
          PENDING: "CONFIRMED",
          CONFIRMED: "PROCESSING",
          PROCESSING: "SHIPPED",
          SHIPPED: "DELIVERED",
        },
        createdAt: new Date().toISOString(),
      },
    ];

    // 8. Reviews
    this.schema.reviews = [
      {
        id: "rev-1",
        storeId: store1Id,
        productId: "prod-quantum-watch",
        customerId: "customer-id-1",
        customerName: "Jane Doe",
        rating: 5,
        comment: "This timepiece is absolutely brilliant! The holographic dials and biometric dashboard are spectacular.",
        status: "APPROVED",
        createdAt: new Date().toISOString(),
      },
      {
        id: "rev-2",
        storeId: store1Id,
        productId: "prod-quantum-watch",
        customerId: "guest-jane",
        customerName: "Sam L.",
        rating: 4,
        comment: "Excellent battery life. Really neat interface, but it gets a bit bright in deep night.",
        status: "APPROVED",
        createdAt: new Date().toISOString(),
      },
    ];

    this.save();
    console.log("Seed complete! Stores, Users, Catalogs, CMS, and Rules are loaded.");
  }
}

export const db = new Database();
