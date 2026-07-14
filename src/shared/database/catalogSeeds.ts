/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { classifyProduct } from "../../backend/productIntelligence";

// Tiny, dependency-free string hash so we can produce a stable image seed on
// both the server and the browser (no node `crypto` in the frontend bundle).
function simpleSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Build an image URL that ACTUALLY matches a product by name.
 *
 * The old seeds cycled a tiny pool of generic category photos (and some
 * curated URLs were reused across unrelated products), which is why e.g.
 * "Natural Himalayan Pink Salt" could end up showing broccoli. Instead we
 * generate the image from the product's own title/description via
 * Pollinations (free, no API key), so the picture is always about that exact
 * product. The seed is derived from the title so the same product always
 * renders the same image (stable across reloads).
 */
export function buildProductImageUrl(title: string, description?: string): string {
  const prompt = `professional e-commerce product photograph of ${title}${
    description ? ", " + description : ""
  }, single product, centered, sharp focus, clean plain white studio background, soft lighting, high detail, photorealistic, no text, no watermark`;
  const seed = simpleSeed(title.toLowerCase().trim());
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt.slice(0, 700)
  )}?width=800&height=800&seed=${seed}&nologo=true&model=flux`;
}

/**
 * Build a hero/banner image URL that matches the KIND of business, so an
 * electronics store gets an electronics banner instead of a generic clothing
 * boutique photo. Generated from the business type + name, keyed for stability.
 */
export function buildHeroImageUrl(businessType: string, businessName?: string): string {
  const prompt = `wide professional storefront hero banner photograph for a ${businessType} business${
    businessName ? " called " + businessName : ""
  }, showing its real products and setting, bright, inviting, high detail, photorealistic, commercial quality, no text, no watermark`;
  const seed = simpleSeed(`hero:${businessType.toLowerCase().trim()}`);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt.slice(0, 700)
  )}?width=1280&height=720&seed=${seed}&nologo=true&model=flux`;
}

/**
 * Maps a free-text business/industry type onto one of our preset store
 * templates. Single source of truth used by BOTH the Wizard (client, when a
 * seller is creating a store) and the server-side migration that corrects
 * already-existing stores - so the two can never drift out of sync again.
 * Anything unrecognized falls back to "custom", which preserves whatever
 * business-type-aware colors were already assigned rather than forcing a
 * preset.
 */
export function deriveTemplateKey(businessType: string): "electronics" | "grocery" | "fashion" | "custom" {
  const t = (businessType || "").toLowerCase();
  if (/electr|phone|gadget|device|tech|comput/.test(t)) return "electronics";
  if (/grocer|food|supermarket|vegetable|organic|produce/.test(t)) return "grocery";
  if (/fashion|apparel|cloth|wear|garment|perfume|cosmetic|beauty|fragrance/.test(t)) return "fashion";
  return "custom";
}

export interface TemplatePreset {
  templateKey: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  typography: string;
  themeMode: "light" | "dark";
  brandStyle: "clean" | "bold" | "editorial" | "minimal";
  featureOverrides: Record<string, boolean>;
}

export const TEMPLATE_PRESETS: Record<"electronics" | "grocery" | "fashion", TemplatePreset> = {
  electronics: {
    templateKey: "electronics",
    primaryColor: "#0A0F24",
    secondaryColor: "#172A45",
    accentColor: "#34D6A6",
    typography: "Space Grotesk",
    themeMode: "dark",
    brandStyle: "bold",
    featureOverrides: { compare_products: true, stock_alerts: true, flash_deals: true },
  },
  fashion: {
    templateKey: "fashion",
    primaryColor: "#FAF9F6",
    secondaryColor: "#1A1A1A",
    accentColor: "#E29578",
    typography: "Inter",
    themeMode: "light",
    brandStyle: "clean",
    featureOverrides: { compare_products: false, stock_alerts: true, flash_deals: false },
  },
  grocery: {
    templateKey: "grocery",
    primaryColor: "#F4F9F4",
    secondaryColor: "#1E3F20",
    accentColor: "#2ECC71",
    typography: "Inter",
    themeMode: "light",
    brandStyle: "minimal",
    featureOverrides: { compare_products: false, flash_deals: true },
  },
};

export interface GeneratedLogo {
  id: string;
  type: "Minimal" | "Modern" | "Luxury" | "Bold" | "Rounded" | "Gradient" | "Monogram" | "Premium";
  initials: string;
  iconName: string;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  borderStyle: string;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function getIconForCategory(businessType: string): string {
  const type = businessType.toLowerCase();
  if (type.includes("furniture") || type.includes("home")) return "Sofa";
  if (type.includes("electr") || type.includes("phone") || type.includes("gadget")) return "Cpu";
  if (type.includes("grocer") || type.includes("food") || type.includes("organic")) return "ShoppingBasket";
  if (type.includes("fashion") || type.includes("apparel") || type.includes("cloth")) return "ShoppingBag";
  if (type.includes("perfume") || type.includes("fragrance") || type.includes("scent")) return "GlassWater";
  if (type.includes("book") || type.includes("library")) return "BookOpen";
  if (type.includes("jewel") || type.includes("gold") || type.includes("diamond")) return "Gem";
  if (type.includes("sport") || type.includes("fit") || type.includes("gym")) return "Trophy";
  if (type.includes("medic") || type.includes("health") || type.includes("pharm")) return "HeartPulse";
  if (type.includes("restau") || type.includes("cafe") || type.includes("dine")) return "Utensils";
  return "Sparkles";
}

export function getBrandColorsForCategory(businessType: string) {
  const type = businessType.toLowerCase();
  if (type.includes("perfume") || type.includes("luxury")) {
    return { primaryColor: "#111111", secondaryColor: "#1A1A1A", accentColor: "#D4AF37", brandStyle: "editorial" as const };
  }
  if (type.includes("furniture") || type.includes("home")) {
    return { primaryColor: "#FAF8F5", secondaryColor: "#4E3629", accentColor: "#8B5A2B", brandStyle: "clean" as const };
  }
  if (type.includes("electr") || type.includes("phone") || type.includes("gadget")) {
    return { primaryColor: "#0A0F24", secondaryColor: "#172A45", accentColor: "#2563EB", brandStyle: "bold" as const };
  }
  if (type.includes("grocer") || type.includes("food") || type.includes("organic")) {
    return { primaryColor: "#F4FDF4", secondaryColor: "#166534", accentColor: "#22C55E", brandStyle: "minimal" as const };
  }
  if (type.includes("fashion") || type.includes("apparel") || type.includes("cloth")) {
    return { primaryColor: "#FAF9F6", secondaryColor: "#18181B", accentColor: "#EC4899", brandStyle: "clean" as const };
  }
  if (type.includes("book")) {
    return { primaryColor: "#FAF5FF", secondaryColor: "#581C87", accentColor: "#A855F7", brandStyle: "editorial" as const };
  }
  if (type.includes("jewel")) {
    return { primaryColor: "#090514", secondaryColor: "#1E1B4B", accentColor: "#06B6D4", brandStyle: "editorial" as const };
  }
  if (type.includes("sport")) {
    return { primaryColor: "#F8FAFC", secondaryColor: "#0F172A", accentColor: "#F97316", brandStyle: "bold" as const };
  }
  if (type.includes("medic")) {
    return { primaryColor: "#F0FDFA", secondaryColor: "#115E59", accentColor: "#0D9488", brandStyle: "minimal" as const };
  }
  if (type.includes("restau")) {
    return { primaryColor: "#FFFBEB", secondaryColor: "#78350F", accentColor: "#EF4444", brandStyle: "retro" as const };
  }
  // Fallback
  return { primaryColor: "#F8FAFC", secondaryColor: "#0F172A", accentColor: "#6366F1", brandStyle: "clean" as const };
}

export function generateLogoOptions(storeName: string, businessType: string): GeneratedLogo[] {
  const initials = getInitials(storeName);
  const iconName = getIconForCategory(businessType);
  const colors = getBrandColorsForCategory(businessType);

  return [
    {
      id: "logo-minimal",
      type: "Minimal",
      initials,
      iconName,
      gradientFrom: "#F1F5F9",
      gradientTo: "#E2E8F0",
      accentColor: "#1E293B",
      bgColor: "#FFFFFF",
      textColor: "#0F172A",
      borderStyle: "border border-slate-200 shadow-sm",
    },
    {
      id: "logo-modern",
      type: "Modern",
      initials,
      iconName,
      gradientFrom: "#EFF6FF",
      gradientTo: "#DBEAFE",
      accentColor: colors.accentColor,
      bgColor: "#F8FAFC",
      textColor: colors.accentColor,
      borderStyle: "border-2 border-dashed",
    },
    {
      id: "logo-luxury",
      type: "Luxury",
      initials,
      iconName,
      gradientFrom: "#1E1B4B",
      gradientTo: "#311042",
      accentColor: "#D4AF37",
      bgColor: "#090514",
      textColor: "#D4AF37",
      borderStyle: "border border-yellow-500/30 shadow-lg shadow-yellow-500/5",
    },
    {
      id: "logo-bold",
      type: "Bold",
      initials,
      iconName,
      gradientFrom: "#FEE2E2",
      gradientTo: "#FCA5A5",
      accentColor: "#EF4444",
      bgColor: "#7F1D1D",
      textColor: "#FFFFFF",
      borderStyle: "skew-x-3 border-r-4 border-b-4 border-red-700",
    },
    {
      id: "logo-rounded",
      type: "Rounded",
      initials,
      iconName,
      gradientFrom: "#F0FDF4",
      gradientTo: "#DCFCE7",
      accentColor: "#22C55E",
      bgColor: "#F0FDF4",
      textColor: "#15803D",
      borderStyle: "rounded-full border border-green-200 shadow-inner",
    },
    {
      id: "logo-gradient",
      type: "Gradient",
      initials,
      iconName,
      gradientFrom: colors.accentColor,
      gradientTo: "#8B5CF6",
      accentColor: "#FFFFFF",
      bgColor: "linear-gradient(to right, " + colors.accentColor + ", #8B5CF6)",
      textColor: "#FFFFFF",
      borderStyle: "border border-indigo-500/50 shadow-md",
    },
    {
      id: "logo-monogram",
      type: "Monogram",
      initials,
      iconName,
      gradientFrom: "#FFF7ED",
      gradientTo: "#FFEDD5",
      accentColor: "#EA580C",
      bgColor: "#FFF7ED",
      textColor: "#9A3412",
      borderStyle: "rounded-2xl border-2 border-orange-200",
    },
    {
      id: "logo-premium",
      type: "Premium",
      initials,
      iconName,
      gradientFrom: "#FAF8F5",
      gradientTo: "#F3EFE9",
      accentColor: colors.secondaryColor,
      bgColor: colors.primaryColor,
      textColor: colors.secondaryColor,
      borderStyle: "border-4 border-double border-amber-800/40 shadow-xl",
    },
  ];
}

export interface SeedProductInput {
  title: string;
  basePrice: number; // in Rupees ₹
  sku: string;
  brand: string;
  description: string;
  imageUrl: string;
  attributes: Record<string, string | string[]>;
}

export function expandTo52Products(base: SeedProductInput[], categoryKey: string, storeName: string): SeedProductInput[] {
  const result = [...base];
  const needed = 52 - result.length;
  if (needed <= 0) return result.slice(0, 52);

  const images: Record<string, string[]> = {
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

  const pool = images[categoryKey] || images.fashion;

  const templates: Record<string, { titles: string[], descriptions: string[], attributes: Record<string, string[]> } > = {
    furniture: {
      titles: [
        "Minimalist Floating Shelf", "Velvet Accent Armchair", "Nordic Ash Bed Frame", "Marble-Top Side Table",
        "Modern Floor Arc Lamp", "Mid-Century TV Console", "Industrial Iron Coat Stand", "Rustic Pine Bench",
        "Classic Leather Ottoman", "Sleek Standing Desk", "Premium Bamboo Area Rug", "Geometric Metal Bookshelf",
        "Ergonomic Back Cushion", "Modernist Ceramic Vase", "Vintage Oak Dressing Table", "Luxurious Pouf Pouffe",
        "Satin Steel Shoe Rack", "Handwoven Macrame Wall Hanging", "Abstract Framed Canvas Art", "Bohemian Velvet Pillow Pack"
      ],
      descriptions: [
        "Crafted with exquisite detail to bring organic elegance, structural harmony, and comfort to any contemporary space.",
        "A statement-making centerpiece that blends functional engineering with premium tactile materials for your lifestyle.",
        "Uncompromising design utilizing sustainably harvested timber. Smooth finish, heavy-duty durability, and beautiful graining.",
        "Accentuate your room's corners with this space-saving, incredibly durable premium furnishing accessory.",
        "High-density resilience padding meets timeless contours. Adds immediate premium character to your modern home setup."
      ],
      attributes: {
        Material: ["Sustainably Sourced Wood", "Powder-Coated Steel", "Premium Italian Leather", "Ultra-Soft Cotton Linen", "Hand-Polished Ashwood"],
        Color: ["Walnut Charcoal", "Classic Emerald Green", "Oatmeal Beige", "Industrial Matte Black", "Natural Oak Amber"],
        Assembly: ["Easy 10-Minute Setup", "Pre-Assembled", "Includes Premium Hardware Set"],
        Origin: ["Handcrafted in Rajasthan", "Designed in Denmark", "Sustainably Sourced Local Craft"]
      }
    },
    cosmetics: {
      titles: [
        "Hydrating Hyaluronic Acid Serum", "Organic Bulgarian Rosewater Mist", "Detoxifying Clay Facial Mask", "Advanced Vitamin C Glow Gel",
        "Soothing Lavender Bath Salts", "Cold-Pressed Argan Hair Elixir", "Nourishing Shea Butter Balm", "Broad-Spectrum Mineral SPF50",
        "Invigorating Peppermint Scrub", "Organic Aloe Vera Healing Gel", "Botanical Tea Tree Cleanser", "Silky Oatmeal Body Butter",
        "Rejuvenating Bakuchiol Oil", "Revitalizing Caffeine Eye Roll-on", "Antioxidant Green Tea Face Cream", "Luxury Sandalwood Incense Cones",
        "Hydrating Coconut Lip Polish", "Prebiotic Balancing Skin Toner", "Nourishing Avocado Hand Cream", "Gentle Chamomile Sleep Elixir"
      ],
      descriptions: [
        "A highly potent, clean formulation crafted to hydrate, protect, and restore radiance to your skin naturally.",
        "Infused with premium botanicals to enrich your daily self-care ritual. Free of parabens, phthalates, and sulfates.",
        "Experience spa-grade rejuvenation at home. Dermatologically tested for sensitive, combination, and mature skin.",
        "Deeply penetrating organic moisture therapy designed to locking in natural skin barriers and healthy complexion.",
        "Sustainably harvested raw active ingredients combined to deliver soothing sensory luxury and instant nutrition."
      ],
      attributes: {
        SkinType: ["All Skin Types", "Sensitive & Dry", "Oily & Combination", "Mature Skin Active"],
        Volume: ["30ml", "50ml", "100ml", "150ml", "200ml"],
        Organic: ["100% Vegan & Cruelty-Free", "Certified Organic Botanicals", "Sustainably Harvested Ingredients"],
        Aroma: ["Mild Lavender Herbaceous", "Crisp Damask Rose", "Earthy Sandalwood Musk", "Invigorating Citrus Fresh"]
      }
    },
    grocery: {
      titles: [
        "Organic Whole Grain Quinoa", "Gluten-Free Fine Almond Flour", "Premium Wood-Pressed Sesame Oil", "Hand-Roasted California Almonds",
        "Stone-Ground Organic Wheat Pasta", "Raw Unfiltered Apple Cider Vinegar", "Single-Origin Medium Roast Coffee", "Dark Chocolate Bar 85% Cocoa",
        "Organic Chia Seed Superfood", "Unsweetened Vanilla Almond Milk", "Himalayan Split Green Lentils", "Toasted Pumpkin Seed Mix",
        "Grass-Fed Unsalted Creamery Butter", "Cold-Brew Jasmine Green Tea", "Premium Iranian Saffron Threads", "Raw Organic Walnuts Half",
        "Stone-Ground Himalayan Pink Salt", "Organic Black Seed Kalonji Oil", "Aromatic Whole Green Cardamom", "Nutrient-Rich Moringa Powder"
      ],
      descriptions: [
        "Sustainably harvested and unadulterated premium grocery essential. Chemical-free, nutrient-rich, and handpicked.",
        "Rich in dietary fiber, high-quality proteins, and antioxidants. Ideal for a wholesome, active, and clean lifestyle.",
        "Direct-from-farm single-origin packaging preserving original enzymes, minerals, and rich natural aromas.",
        "Perfect addition to your daily breakfast or snack routine. 100% natural with no added colors or artificial preservatives.",
        "Grown with love in pesticide-free, certified organic farms under standard premium agricultural practices."
      ],
      attributes: {
        Weight: ["250g Pouch", "500g Jar", "1kg Eco-Pack", "5kg Bulk Canvas Bag"],
        Dietary: ["Certified USDA Organic", "Gluten-Free & Non-GMO", "100% Vegan & Keto-Friendly", "Rich in Plant-Based Protein"],
        Origin: ["Sourced from Himalayan Foothills", "Directly Imported from Spain", "Cultivated by Local Farming Cooperatives"],
        ShelfLife: ["9 Months from Packaging", "12 Months in Cool Storage", "6 Months for Maximum Freshness"]
      }
    },
    electronics: {
      titles: [
        "Premium USB-C Fast Charger 65W", "Ultra-Slim Power Bank 10000mAh", "Ergonomic Aluminium Laptop Stand", "Professional Studio USB Microphone",
        "Multi-Device Wireless Presenter", "High-Speed Braided HDMI 4.1 Cable", "True Wireless Noise-Isolating Buds", "Smart Wi-Fi Power Plug Mini",
        "Dual-Sided Felt Desk Mat Pad", "Bluetooth GPS Smart Tracker Tag", "Super-Fast External SSD 500GB", "Adjustable Quad-LED Ring Light",
        "Ergonomic Memory Foam Wrist Rest", "Magnetic Wireless Car Charger Mount", "Premium Carbon Fiber Stylus Pen", "Anti-Glare Privacy Screen Protector",
        "Portable Multi-Port 8-in-1 Hub", "RGB Dynamic Backlit Headphone Stand", "Sleek Automatic Cable Organizer Sleeve", "Ultra-HD 4K Autofocus Webcam"
      ],
      descriptions: [
        "Engineered with state-of-the-art circuitry to deliver peak efficiency, robust speed, and reliable performance.",
        "Unparalleled modern design optimized for seamless multi-device compatibility, durability, and daily use.",
        "Upgrade your workstation or mobile setup with this compact, sleek, high-speed premium tech accessory.",
        "Shatterproof heavy-duty construction paired with smart smart chips to provide safe, fast, and adaptive power.",
        "Designed for creators, professionals, and gamers alike. Offers unmatched speed, ergonomics, and clean aesthetics."
      ],
      attributes: {
        Interface: ["USB-C Power Delivery", "Dual-Band Wi-Fi 5G", "Bluetooth 5.2 Smart", "High-Speed Thunderbolt 4"],
        Material: ["Aircraft-Grade Aluminum", "Braided Bulletproof Nylon", "Premium Liquid Silicone", "Durable Matte Polycarbonate"],
        Power: ["65W Fast Charge", "15W Qi-Certified", "5V Smart Outlets", "No Battery Needed"],
        Warranty: ["1-Year Manufacturer Warranty", "2-Year Extended Core Protection", "30-Day Hassle-Free Replacement"]
      }
    },
    fashion: {
      titles: [
        "Slim-Fit Stretch Denim Jeans", "Classic Brushed Cotton Sweatshirt", "Water-Resistant Daily Windbreaker", "Breathable Knit Trainer Sneakers",
        "Full-Grain Leather Everyday Belt", "Heavyweight Organic Cotton Hoodie", "Relaxed Linen Drawstring Shorts", "Pack of 3 Combed Cotton Socks",
        "Premium Polarized Sport Sunglasses", "Aviation Grade Chronograph Watch", "Minimalist Suede Leather Wallet", "Sustainable Canvas Messenger Bag",
        "Casual Corduroy Button-Up Shirt", "Lightweight Quilted Puffer Vest", "Ultra-Soft Cashmere Scarf", "Classic Ribbed Knit Beanie Hat",
        "Sleek Waterproof Travel Duffel", "Tailored Merino Wool Trousers", "Breathable Bamboo Lounge Robe", "Earthy Brass Accent Bracelet"
      ],
      descriptions: [
        "Meticulously tailored from premium fabrics to deliver the perfect balance of modern shape, soft comfort, and durability.",
        "An absolute capsule wardrobe essential designed to adapt to any style, season, transition, or dynamic occasion.",
        "Featuring eco-friendly organic fibers dyed with water-saving, skin-safe natural pigments.",
        "Refine your daily style with this timeless, highly versatile, beautifully finished fashion staple.",
        "Designed to survive heavy daily wear while maintaining pristine color, structural elegance, and elegant shape."
      ],
      attributes: {
        Material: ["100% GOTS Organic Cotton", "Premium French Flax Linen", "Full-Grain Italian Calf Leather", "Recycled Performance Polyester", "Ultra-Fine Merino Wool Blend"],
        Fit: ["Modern Slim Fit", "Relaxed Casual Fit", "Classic Athletic Drape"],
        Care: ["Machine Wash Cold, Hang Dry", "Dry Clean Recommended", "Hand Wash with Gentle Detergent"],
        Vibe: ["Timeless Minimalist", "Rugged Outdoor Active", "Refined Modern Smart"]
      }
    },
    sports: {
      titles: [
        "Foam-Cushioned Running Shoes", "Adjustable Dumbbell Set 20kg", "Anti-Slip Yoga Mat 6mm", "Compression Athletic Leggings",
        "Insulated Sports Water Bottle 1L", "Resistance Bands Set (5-Piece)", "Breathable Mesh Training Jersey", "Foldable Jump Rope Pro",
        "Padded Cycling Gloves", "Quick-Dry Gym Towel", "Neoprene Ankle Support Brace", "Adjustable Weightlifting Belt",
        "Wireless Sports Earbuds IPX7", "Foam Roller for Muscle Recovery", "Football Training Cone Set", "Carbon Fiber Badminton Racket",
        "Grip-Sole Cross-Training Shoes", "Moisture-Wicking Gym Duffel Bag", "Adjustable Skipping Rope Handles", "Protein Shaker Bottle 700ml"
      ],
      descriptions: [
        "Engineered for serious performance - built to support high-intensity training, agility, and everyday athletic routines.",
        "Durable, sweat-resistant construction designed to keep pace with your toughest workouts and outdoor sessions.",
        "Ergonomically designed for comfort and control, helping you train longer, recover faster, and perform better.",
        "Lightweight yet rugged, this gear is trusted by athletes and fitness enthusiasts for daily training reliability.",
        "Combines breathable materials and reinforced stitching for a piece of gear that goes the distance with you."
      ],
      attributes: {
        Material: ["Breathable Mesh Knit", "Reinforced Neoprene", "Anti-Slip Rubber Grip", "Moisture-Wicking Polyester", "Impact-Resistant Foam"],
        Fit: ["True to Size Athletic Fit", "Adjustable Strap Fit", "Compression Support Fit"],
        UseCase: ["Gym & Strength Training", "Running & Cardio", "Yoga & Recovery", "Outdoor Sports"],
        Warranty: ["1-Year Manufacturer Warranty", "6-Month Wear Guarantee", "30-Day Performance Guarantee"]
      }
    }
  };

  const categoryTemplates = templates[categoryKey] || templates.fashion;

  for (let i = 0; i < needed; i++) {
    const titleTemplate = categoryTemplates.titles[i % categoryTemplates.titles.length];
    const index = result.length + 1;
    const modifier = i % 3 === 0 ? "Signature" : i % 3 === 1 ? "Elite" : "Premium";
    const title = `${modifier} ${titleTemplate} v${index}`;
    
    const sku = `${categoryKey.toUpperCase()}-${i}-${Math.floor(Math.random() * 900) + 100}`;
    const basePrice = Math.floor(Math.random() * 8) * 150 + 199;
    const brand = i % 2 === 0 ? storeName : (categoryKey === "grocery" ? "PureNourish" : categoryKey === "furniture" ? "Minimalist" : "EcoFit");
    const description = categoryTemplates.descriptions[i % categoryTemplates.descriptions.length];
    
    // Always derive the image from this product's own title so it matches the
    // item instead of pulling a random photo from a shared category pool.
    const imageUrl = buildProductImageUrl(title, description);

    const finalAttributes: Record<string, string | string[]> = {};
    Object.entries(categoryTemplates.attributes).forEach(([attrKey, attrVals]) => {
      finalAttributes[attrKey] = attrVals[i % attrVals.length];
    });

    result.push({
      title,
      basePrice,
      sku,
      brand,
      description,
      imageUrl,
      attributes: finalAttributes
    });
  }

  return result;
}

export function getProductsForCategory(businessType: string, storeName: string): SeedProductInput[] {
  const type = businessType.toLowerCase();

  let baseList: SeedProductInput[] = [];
  let categoryKey: "furniture" | "cosmetics" | "grocery" | "electronics" | "sports" | "fashion" = "fashion";

  if (type.includes("furniture") || type.includes("home")) {
    categoryKey = "furniture";
    baseList = [
      {
        title: "Teak Wood Sofa Set (3-Seater)",
        basePrice: 24999,
        sku: "TEAK-SOFA",
        brand: "RoyalTeak",
        description: "Elegant premium teak wood frame three-seater sofa with water-resistant plush upholstery and high-density foam cushions.",
        imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "Teak Wood", Color: "Oak Brown", Cushions: "Creamy White", Seats: "3 Seater" },
      },
      {
        title: "Ergonomic High-Back Office Chair",
        basePrice: 6999,
        sku: "ERGO-CHAIR",
        brand: "ErgoComfort",
        description: "Professional orthopedic breathable mesh back office chair with adjustable 3D armrests, lumber support, and multi-angle tilt lock.",
        imageUrl: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=600&q=80",
        attributes: { Frame: "Reinforced Polymer", Color: "Obsidian Black", Support: "Adjustable Lumbar", MaxWeight: "130kg" },
      },
      {
        title: "Solid Walnut Dining Table",
        basePrice: 18999,
        sku: "WALNUT-DINING",
        brand: "WoodArts",
        description: "Stunning hand-polished walnut wood dining table that comfortably accommodates 6 chairs. Anti-scratch premium varnish coating.",
        imageUrl: "https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "Walnut Wood", Finish: "Satin Lacquer", Capacity: "6 Persons", Dimensions: "180x90x75 cm" },
      },
      {
        title: "Futuristic Glass-Top Coffee Table",
        basePrice: 4999,
        sku: "COFFEE-TABLE",
        brand: "Minimalist",
        description: "Sleek and minimalist coffee table featuring a tempered safety glass top and an interlocking solid ash wood geometric leg base.",
        imageUrl: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=600&q=80",
        attributes: { Glass: "Tempered 12mm", Base: "Ash Wood", Style: "Mid-Century Modern" },
      },
      {
        title: "Spacious Solid Pine Wardrobe",
        basePrice: 29999,
        sku: "PINE-WARDROBE",
        brand: "CabinetKings",
        description: "Luxury triple-door wardrobe crafted in sustainably sourced solid pine. Includes 6 adjustable shelves, heavy metal hanging rails, and soft-close brass hinges.",
        imageUrl: "https://images.unsplash.com/photo-1558882224-cca16673336d?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "Solid Pine Wood", Finish: "Natural Polish", Doors: "3-Door", Drawers: "2 Internal" },
      },
      {
        title: "Retro Oak Bookshelf",
        basePrice: 8999,
        sku: "OAK-SHELF",
        brand: "WoodArts",
        description: "Premium five-tier open shelf library unit with solid oak struts. Perfect for showcasing books, plants, and collectibles.",
        imageUrl: "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "Oak Veneer", Tiers: "5 Tiers", Backing: "Open-Back", Frame: "Solid Wood" },
      },
      {
        title: "Designer TV Console Unit",
        basePrice: 12499,
        sku: "TV-CONSOLE",
        brand: "Minimalist",
        description: "Modern floating look media console table with cable management holes, sliding slatted doors, and ample gaming console storage.",
        imageUrl: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "MDF & Metal", Color: "Teak & Black", MaxTVSize: "65 Inches" },
      },
      {
        title: "Orthopedic Memory Foam Mattress",
        basePrice: 14999,
        sku: "ORTHO-MATTRESS",
        brand: "SleepCloud",
        description: "Dual-layer breathable queen-size mattress. Cool gel memory foam relieves pressure joints while pocket springs offer contouring support.",
        imageUrl: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=80",
        attributes: { Type: "Gel Memory Foam & Pocket Spring", Size: "Queen (78x60x10 inches)", Firmness: "Medium Firm" },
      },
      {
        title: "Luxury Leatherette Recliner",
        basePrice: 19999,
        sku: "RECLINER-LUXE",
        brand: "ErgoComfort",
        description: "Premium single-seater zero-gravity manual recliner with pocket springs, extendable leg support, and 360-degree silent swivel.",
        imageUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "Premium Leatherette", Reclining: "Manual 150-degrees", Swivel: "360 Spin" },
      },
      {
        title: "Solid Wood Study Desk",
        basePrice: 5499,
        sku: "STUDY-DESK",
        brand: "Minimalist",
        description: "Clean study or computer desk with built-in organizer drawer and durable metal loop legs. Premium wooden veneer surface.",
        imageUrl: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "Engineered Wood & Steel", Width: "120 cm", Drawers: "1 Soft-Close" },
      },
    ];
  } else if (type.includes("perfume") || type.includes("fragrance") || type.includes("scent") || type.includes("cosmetic")) {
    categoryKey = "cosmetics";
    baseList = [
      {
        title: "Luxury Oud Intense Perfume",
        basePrice: 2499,
        sku: "LUXE-OUD",
        brand: "Aura Royale",
        description: "Our signature dense Cambodian Oud fragrance blended with warm spicy cinnamon, damask rose, ambergris, and deep white musk.",
        imageUrl: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=600&q=80",
        attributes: { Concentration: "Eau de Parfum (EDP)", Volume: "100ml", Notes: "Woody Spicy", Longevity: "12+ Hours" },
      },
      {
        title: "Damask Rose & Peach Mist",
        basePrice: 1199,
        sku: "ROSE-MIST",
        brand: "Flora & Bloom",
        description: "A breezy, feminine everyday fragrance mist featuring distilled Bulgarian rose petals combined with crisp juicy nectarine and vanilla orchid.",
        imageUrl: "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=600&q=80",
        attributes: { Concentration: "Body Mist", Volume: "250ml", Notes: "Floral Fruity", BestFor: "Spring / Summer" },
      },
      {
        title: "Ocean Breeze Marine Sport",
        basePrice: 1799,
        sku: "OCEAN-BREEZE",
        brand: "Aura Royale",
        description: "A highly invigorating, fresh masculine cologne opening with mineral marine salts, crushed sage leaf, Sicilian bergamot, and cedar wood.",
        imageUrl: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80",
        attributes: { Concentration: "Eau de Toilette (EDT)", Volume: "100ml", Notes: "Citrus Aquatic", Vibes: "Active & Energetic" },
      },
      {
        title: "Night Bloom Midnight Jasmine",
        basePrice: 2999,
        sku: "NIGHT-BLOOM",
        brand: "Flora & Bloom",
        description: "Deep, sensual, seductive evening parfum radiating night-blooming jasmine blossoms, dark cocoa extract, sweet vanilla, and rich patchouli.",
        imageUrl: "https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=600&q=80",
        attributes: { Concentration: "Eau de Parfum (EDP)", Volume: "75ml", Notes: "Gourmand Floral", Aura: "Mysterious & Warm" },
      },
      {
        title: "Madagascar Vanilla Bean Essence",
        basePrice: 899,
        sku: "VANILLA-ESS",
        brand: "Nectar",
        description: "Cozy comforting roll-on botanical perfume oil featuring genuine organic Madagascar vanilla bean infusion and absolute amber base.",
        imageUrl: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80",
        attributes: { Type: "Natural Perfume Oil", Volume: "15ml", Applicator: "Stainless Steel Roll-On", Organic: "100% Pure" },
      },
      {
        title: "Lavender Fields Soothing Mist",
        basePrice: 999,
        sku: "LAV-MIST",
        brand: "Nectar",
        description: "Relaxing linen and pillow sleep spray blended with premium steam-distilled French lavender essential oil and chamomile extract.",
        imageUrl: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80",
        attributes: { Base: "Witch Hazel Distillate", Volume: "150ml", Purpose: "Aromatherapy & Sleep Aid" },
      },
      {
        title: "Royal Sandalwood Body Mist",
        basePrice: 1299,
        sku: "SANDALWOOD",
        brand: "Aura Royale",
        description: "A warm, comforting unisex body mist highlighting Mysore Sandalwood oil, cardamon hints, dry cedar, and luxurious saffron.",
        imageUrl: "https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?auto=format&fit=crop&w=600&q=80",
        attributes: { Concentration: "Body Mist", Volume: "200ml", Notes: "Creamy Woody" },
      },
      {
        title: "Imperial Saffron & Rose Elixir",
        basePrice: 4500,
        sku: "SAFFRON-ELIXIR",
        brand: "Aura Royale",
        description: "An ultra-luxury private reserve oil. Kashmir saffron strands macerated with Turkish rose absolute, leather notes, and light amberwood.",
        imageUrl: "https://images.unsplash.com/photo-1588405748373-122b2321bc31?auto=format&fit=crop&w=600&q=80",
        attributes: { Type: "Attar / Pure Perfume Oil", Volume: "12ml", Packaging: "Handcut Crystal Decanter" },
      },
    ];
  } else if (type.includes("grocer") || type.includes("food") || type.includes("organic") || type.includes("supermarket")) {
    categoryKey = "grocery";
    baseList = [
      {
        title: "Premium Organic Basmati Rice (5kg)",
        basePrice: 399,
        sku: "BASMATI-RICE",
        brand: "HimalayanGrains",
        description: "Pure extra-long aged aromatic basmati rice grains. Non-GMO, chemical-free processing for premium fluffy texture and flavor.",
        imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
        attributes: { Weight: "5 Kilograms", Type: "Basmati (Aged 12 Months)", GrainLength: "7.4 mm Avg" },
      },
      {
        title: "Farm Fresh Full Cream Milk (1L)",
        basePrice: 62,
        sku: "FRESH-MILK",
        brand: "PureNourish",
        description: "Homogenized, pasteurized nutrient-dense dairy milk sourced directly from family-owned pasture-raised cattle farms.",
        imageUrl: "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80",
        attributes: { Volume: "1 Litre", FatContent: "3.5% Standard", Packaging: "Eco-Friendly TetraPack" },
      },
      {
        title: "Sourdough Whole Wheat Bread (400g)",
        basePrice: 45,
        sku: "WHEAT-BREAD",
        brand: "BakeSmith",
        description: "Freshly baked artisan whole wheat bread leavened with natural wild sourdough starter. No added preservatives or refined sugars.",
        imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
        attributes: { Weight: "400 Grams", Ingredients: "Whole Wheat, Wild Yeast, Sea Salt", Slices: "Approx 12-14 Slices" },
      },
      {
        title: "Organic Wild Forest Honey (500g)",
        basePrice: 399,
        sku: "WILD-HONEY",
        brand: "BeeWild",
        description: "Unfiltered, unpasteurized natural honey collected from wild hives in deep deciduous forests. Retains original pollens and enzymes.",
        imageUrl: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80",
        attributes: { Weight: "500 Grams", Certification: "USDA Organic", Processing: "Cold Extracted" },
      },
      {
        title: "Extra Virgin Cold-Pressed Olive Oil (1L)",
        basePrice: 849,
        sku: "OLIVE-OIL",
        brand: "PureNourish",
        description: "First cold-pressed superior category olive oil extracted solely from olives harvested on Spanish estate orchards. Ideal for salad dressing.",
        imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80",
        attributes: { Volume: "1 Litre", Acidity: "< 0.5%", Process: "Mechanical Cold Pressing" },
      },
      {
        title: "Fresh Farm Eggs (Pack of 12)",
        basePrice: 90,
        sku: "FARM-EGGS",
        brand: "PureNourish",
        description: "Certified cage-free pasture-raised large brown chicken eggs. Delivered in recyclable protective pulp cartons.",
        imageUrl: "https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?auto=format&fit=crop&w=600&q=80",
        attributes: { Quantity: "12 Eggs", Grade: "AA Quality", Color: "Pasture Brown" },
      },
      {
        title: "Organic Cold-Pressed Mustard Oil (1L)",
        basePrice: 185,
        sku: "MUSTARD-OIL",
        brand: "PureNourish",
        description: "Pure and strong cold-pressed mustard oil extracted using wood expellers. Retains strong natural aroma and pungent taste.",
        imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80",
        attributes: { Volume: "1 Litre", Extraction: "Kachi Ghani Wood Pressed" },
      },
      {
        title: "Organic Cane Sugar (1kg)",
        basePrice: 52,
        sku: "CANE-SUGAR",
        brand: "HimalayanGrains",
        description: "Sulphur-free natural brown cane sugar crystals. Healthy alternative to white sugar, unbleached chemical-free processing.",
        imageUrl: "https://images.unsplash.com/photo-1596436889106-be35e843f974?auto=format&fit=crop&w=600&q=80",
        attributes: { Weight: "1 Kilogram", Type: "Unrefined Cane Sugar" },
      },
      {
        title: "Natural Himalayan Pink Salt (1kg)",
        basePrice: 95,
        sku: "PINK-SALT",
        brand: "HimalayanGrains",
        description: "Unrefined mineral-rich premium pink salt, crushed from ancient Himalayan salt mines. Contains 84 trace minerals.",
        imageUrl: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80",
        attributes: { Weight: "1 Kilogram", Type: "Mineral Salt", Origin: "Himalayas" },
      },
      {
        title: "Raw Organic Cashews (250g)",
        basePrice: 280,
        sku: "CASHEW-NUTS",
        brand: "FreshFarm",
        description: "Whole premium quality raw cashews. Perfect for high-protein snacking, raw desserts, or creamy home-made cashew milk.",
        imageUrl: "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=600&q=80",
        attributes: { Weight: "250 Grams", Grade: "W320 Premium", Organic: "USDA Organic" },
      },
      {
        title: "Premium Ground Turmeric (250g)",
        basePrice: 120,
        sku: "TURMERIC",
        brand: "HimalayanGrains",
        description: "High-curcumin organic turmeric powder ground from sun-dried whole turmeric rhizomes. Perfect for golden milk and daily cooking.",
        imageUrl: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80",
        attributes: { Weight: "250 Grams", CurcuminContent: "5.5%+", Type: "Pure Spice Powder" },
      },
      {
        title: "Organic Green Tea Leaves (100g)",
        basePrice: 180,
        sku: "GREEN-TEA",
        brand: "Flora & Bloom",
        description: "Premium loose tea leaves handpicked from sustainable high-altitude tea gardens. Rich in antioxidants with a delicate grassy flavor.",
        imageUrl: "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80",
        attributes: { Weight: "100 Grams", Blend: "Single Estate", Caffeine: "Moderate" },
      },
      {
        title: "Organic Cold-Pressed Coconut Oil (500ml)",
        basePrice: 245,
        sku: "COCONUT-OIL",
        brand: "PureNourish",
        description: "Unrefined, raw, cold-pressed virgin coconut oil extracted from fresh organic coconuts. Multipurpose oil for cooking and skin hydration.",
        imageUrl: "https://images.unsplash.com/photo-1622484211148-716598e04141?auto=format&fit=crop&w=600&q=80",
        attributes: { Volume: "500 ml", Extraction: "Cold Pressed Extra Virgin", Origin: "Kerala Farms" },
      },
      {
        title: "Gluten-Free Rolled Oats (1kg)",
        basePrice: 199,
        sku: "ROLLED-OATS",
        brand: "BakeSmith",
        description: "Whole grain gluten-free jumbo rolled oats. High-fiber slow-release carbs, perfect for morning porridge or baking cookies.",
        imageUrl: "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?auto=format&fit=crop&w=600&q=80",
        attributes: { Weight: "1 Kilogram", GlutenFree: "Certified Gluten Free", FiberContent: "11g per 100g" },
      },
      {
        title: "Organic Chia Seeds (250g)",
        basePrice: 145,
        sku: "CHIA-SEEDS",
        brand: "FreshFarm",
        description: "Premium raw black chia seeds rich in Omega-3 fatty acids, calcium, and dietary fiber. Ideal for chia puddings and smoothies.",
        imageUrl: "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=600&q=80",
        attributes: { Weight: "250 Grams", Purity: "99.9% Clean", Packaging: "Resealable Zip Pouch" },
      },
      {
        title: "Organic Toor Dal (Pigeon Peas - 1kg)",
        basePrice: 165,
        sku: "TOOR-DAL",
        brand: "HimalayanGrains",
        description: "Unpolished, unadulterated high-protein organic split pigeon peas dal. Essential staple for daily Indian home-cooked meals.",
        imageUrl: "https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?auto=format&fit=crop&w=600&q=80",
        attributes: { Weight: "1 Kilogram", Polished: "No", ProteinContent: "22%+" },
      },
    ];
  } else if (type.includes("electr") || type.includes("phone") || type.includes("gadget") || type.includes("device")) {
    categoryKey = "electronics";
    baseList = [
      {
        title: "Premium Active Noise-Cancelling Headphones",
        basePrice: 14999,
        sku: "PRO-HEADPHONES",
        brand: "Vortex",
        description: "Studio-grade wireless over-ear headphones with custom dynamic hybrid active noise cancellation, ambient awareness modes, and 40-hour battery life.",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
        attributes: { Battery: "40 Hours ANC On", Connection: "Bluetooth 5.2 & Wired", ANC: "Hybrid Active up to 45dB" },
      },
      {
        title: "Retina Amoled GPS Smartwatch Series X",
        basePrice: 18999,
        sku: "SMARTWATCH-SERIESX",
        brand: "SyncPro",
        description: "Premium wellness tracking smartwatch with high-brightness always-on AMOLED screen, precision GPS, heart rate monitor, and blood oxygen tracking.",
        imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
        attributes: { Screen: "1.43\" AMOLED Always-On", BatteryLife: "Up to 10 Days", Sensors: "GPS, SpO2, Heart-Rate, Sleep Tracker" },
      },
      {
        title: "Core Ultrabook Pro 14-Inch Laptop",
        basePrice: 84999,
        sku: "CORE-LAPTOP",
        brand: "AuraTech",
        description: "Incredibly thin and lightweight powerhouse featuring high-performance processor, 16GB unified RAM, and 512GB ultra-fast PCIe SSD storage.",
        imageUrl: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=600&q=80",
        attributes: { RAM: "16GB LPDDR5", Storage: "512GB NVMe SSD", CPU: "Intel Core i7 Evo", Weight: "1.25 Kilograms" },
      },
      {
        title: "4K IPS Ultra-Wide Ergonomic Monitor",
        basePrice: 28999,
        sku: "4K-MONITOR",
        brand: "AuraTech",
        description: "Cinema-grade color accurate ultra-wide IPS panel featuring USB-C power delivery, integrated speakers, and dual-axis adjustable ergonomic stand.",
        imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80",
        attributes: { Resolution: "3840x2160 UHD", RefreshRate: "75Hz IPS", PowerDelivery: "65W USB-C" },
      }
    ];
  } else if (type.includes("sport") || type.includes("fitness") || type.includes("gym") || type.includes("athlet")) {
    categoryKey = "sports";
    baseList = [
      {
        title: "Foam-Cushioned Running Shoes",
        basePrice: 3999,
        sku: "RUN-SHOES",
        brand: "PaceFlex",
        description: "Lightweight running shoes with responsive foam cushioning, breathable knit upper, and a durable rubber outsole built for daily mileage.",
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "Breathable Knit Mesh", Sole: "Durable Rubber Outsole", UseCase: "Running & Cardio" },
      },
      {
        title: "Adjustable Dumbbell Set (20kg)",
        basePrice: 4499,
        sku: "ADJ-DUMBBELL",
        brand: "IronCore",
        description: "Space-saving adjustable dumbbell pair with quick-turn weight dial, covering a full range of resistance for home strength training.",
        imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=600&q=80",
        attributes: { WeightRange: "2.5kg - 20kg per Dumbbell", Material: "Cast Iron Core with Rubber Coating" },
      },
      {
        title: "Anti-Slip Yoga Mat (6mm)",
        basePrice: 1299,
        sku: "YOGA-MAT",
        brand: "ZenFlex",
        description: "Extra-thick, non-slip yoga mat with superior cushioning and grip for yoga, pilates, and floor workouts. Includes carry strap.",
        imageUrl: "https://images.unsplash.com/photo-1592432678016-e910b452f9a2?auto=format&fit=crop&w=600&q=80",
        attributes: { Thickness: "6mm", Material: "TPE Eco Foam", Grip: "Dual-Sided Non-Slip" },
      },
      {
        title: "Compression Athletic Leggings",
        basePrice: 1799,
        sku: "COMP-LEGGINGS",
        brand: "PaceFlex",
        description: "Four-way stretch compression leggings with sweat-wicking fabric and a supportive high-waist fit for training and running.",
        imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "Moisture-Wicking Compression Fabric", Fit: "High-Waist Athletic Fit" },
      },
      {
        title: "Insulated Sports Water Bottle (1L)",
        basePrice: 899,
        sku: "SPORT-BOTTLE",
        brand: "HydroFlow",
        description: "Double-wall vacuum insulated stainless steel bottle keeps drinks cold for 24 hours - built for the gym, trail, or daily commute.",
        imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80",
        attributes: { Capacity: "1 Litre", Material: "Vacuum-Insulated Stainless Steel" },
      },
      {
        title: "Resistance Bands Set (5-Piece)",
        basePrice: 799,
        sku: "RESIST-BANDS",
        brand: "IronCore",
        description: "Graduated resistance band set for strength training, mobility work, and physical therapy - includes carry pouch and guide.",
        imageUrl: "https://images.unsplash.com/photo-1598289431512-b97b0917affc?auto=format&fit=crop&w=600&q=80",
        attributes: { Set: "5 Resistance Levels", Material: "Natural Latex" },
      },
      {
        title: "Wireless Sports Earbuds (IPX7)",
        basePrice: 2999,
        sku: "SPORT-EARBUDS",
        brand: "SyncPro",
        description: "Secure-fit wireless earbuds with sweat and water resistance, punchy bass, and a stable connection built for workouts.",
        imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80",
        attributes: { WaterResistance: "IPX7", Battery: "8 Hours + Charging Case", Fit: "Secure Ear Hooks" },
      },
      {
        title: "Foam Roller for Muscle Recovery",
        basePrice: 1099,
        sku: "FOAM-ROLLER",
        brand: "ZenFlex",
        description: "High-density textured foam roller for deep-tissue muscle recovery, myofascial release, and post-workout flexibility.",
        imageUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80",
        attributes: { Density: "High-Density EVA Foam", Length: "45 cm" },
      },
      {
        title: "Adjustable Weightlifting Belt",
        basePrice: 1599,
        sku: "LIFT-BELT",
        brand: "IronCore",
        description: "Genuine leather weightlifting belt with reinforced stitching and secure buckle for lower back support during heavy lifts.",
        imageUrl: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "Genuine Leather", Width: "10 cm", Closure: "Prong Buckle" },
      },
      {
        title: "Carbon Fiber Badminton Racket",
        basePrice: 2499,
        sku: "BADMINTON-RACKET",
        brand: "PaceFlex",
        description: "Lightweight full carbon fiber racket with a high-tension string bed for fast swings and powerful smashes.",
        imageUrl: "https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "Full Carbon Fiber", Weight: "85g", StringTension: "Up to 28 lbs" },
      },
    ];
  } else {
    categoryKey = "fashion";
    baseList = [
      {
        title: "Designer Tailored Blazer",
        basePrice: 6999,
        sku: "DESIGN-BLAZER",
        brand: "UrbanVogue",
        description: "Modern slim-fit tailored wool-blend blazer featuring custom brass button hardware and detailed silk lining stitching.",
        imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "70% Virgin Wool, 30% Silk", Color: "Midnight Navy", Fit: "Slim Fit" },
      },
      {
        title: "Sustainable Linen Blouse",
        basePrice: 2499,
        sku: "SUSTAIN-LINEN",
        brand: "UrbanVogue",
        description: "Breathable and airy casual relaxed-fit long-sleeve blouse spun from 100% GOTS certified premium French linen.",
        imageUrl: "https://images.unsplash.com/photo-1548624149-f9b1859aa7d0?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "100% Organic Linen", Color: "Oatmeal Sage" },
      },
      {
        title: "Organic Cotton Fitted Tee",
        basePrice: 999,
        sku: "COTTON-TEE",
        brand: "EcoFit",
        description: "Ultra-soft combed organic cotton daily t-shirt dyed using water-saving natural botanic pigmentation. Retains shape after 100 washes.",
        imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80",
        attributes: { Material: "100% Combed Cotton", Fit: "Athletic Fit", GOTS: "Certified organic" },
      },
      {
        title: "Designer Polarized Sunglasses",
        basePrice: 3499,
        sku: "POLAR-GLASSES",
        brand: "UrbanVogue",
        description: "Sleek retro-round sunglasses with polarized shatterproof polycarbonate lenses, offering full UV400 radiation protection.",
        imageUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=600&q=80",
        attributes: { Lenses: "Polarized UV400", Frame: "Aviation Grade Alloy" },
      },
      {
        title: "Premium Mechanical Gaming Keyboard",
        basePrice: 5999,
        sku: "MECHANICAL-KB",
        brand: "Vortex",
        description: "Compact 75% mechanical keyboard featuring silent linear red switches, hot-swappable sockets, and customized dynamic RGB lights.",
        imageUrl: "https://images.unsplash.com/photo-1618384887929-16ec33faf9c1?auto=format&fit=crop&w=600&q=80",
        attributes: { Switches: "Gateron Red Linear", HotSwap: "Yes (5-pin)", Backlight: "16.8M RGB Patterns" },
      },
      {
        title: "Minimalist Leather Sneakers",
        basePrice: 4999,
        sku: "LEATHER-SNEAKER",
        brand: "UrbanVogue",
        description: "Clean classic white low-top sneakers constructed in full-grain Italian calf leather and durable hand-stitched margom rubber cupsoles.",
        imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80",
        attributes: { Leather: "Full-Grain Calfskin", Sole: "Margom Vulcanized Rubber" },
      },
    ];
  }

  // Route the hand-curated base items through the same title-based image
  // generator so every product's photo matches its name (the previous curated
  // URLs were sometimes shared across unrelated products, e.g. pink salt and
  // turmeric pointing at the same photo).
  const baseWithImages = baseList.map((item) => ({
    ...item,
    imageUrl: buildProductImageUrl(item.title, item.description),
  }));

  return expandTo52Products(baseWithImages, categoryKey, storeName);
}
