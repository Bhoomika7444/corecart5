/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShoppingBag,
  Heart,
  Search,
  X,
  Plus,
  Minus,
  Trash2,
  Star,
  Check,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Clock,
  Sparkles,
  User,
  MapPin,
  CreditCard,
  Truck,
  FileText,
  Package,
  Lock,
  LogOut,
  Printer,
  RefreshCw,
  Settings,
  Palette,
  ArrowUp,
  ArrowDown,
  Undo,
  Save,
} from "lucide-react";
import { FrontendStoreBootstrap } from "../types/storefront";

// Generated product/hero images (Pollinations) sometimes fail to load or time
// out under load, since they're rendered on-demand rather than served from a
// static file. Rather than leave a blank/broken box, swap to a clean inline
// SVG placeholder showing the item's initial - no extra network request, so
// it can never itself fail to load. Also guards against retry loops by only
// swapping once (checking a data-fallback marker).
function buildPlaceholderImage(label: string): string {
  const initial = (label || "?").trim().charAt(0).toUpperCase() || "?";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#e2e8f0"/>
    <text x="200" y="220" font-family="system-ui, sans-serif" font-size="120" font-weight="700" fill="#94a3b8" text-anchor="middle">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function handleImgError(label: string) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const attempts = Number(img.dataset.retryCount || "0");

    // Pollinations renders images on-demand (it's an actual generation call,
    // not a static file lookup), so a fresh prompt can easily take 5-20+
    // seconds the first time. The old 2-try/~1.8s budget gave up long before
    // generation finished, so freshly added products almost always fell back
    // to the letter placeholder even though the image would have loaded fine
    // a few seconds later. Retry more times with a longer backoff so slow
    // (but successful) generations actually get shown.
    const baseSrc = img.dataset.baseSrc || img.src;
    if (attempts < 6 && baseSrc.includes("image.pollinations.ai")) {
      img.dataset.baseSrc = baseSrc;
      img.dataset.retryCount = String(attempts + 1);
      const retryUrl = baseSrc.includes("?") ? `${baseSrc}&retry=${attempts + 1}` : `${baseSrc}?retry=${attempts + 1}`;
      // Backs off 2s, 4s, 6s, 8s, 10s, 12s - roughly 42s of total budget,
      // which comfortably covers typical Pollinations generation latency.
      setTimeout(() => {
        img.src = retryUrl;
      }, 2000 * (attempts + 1));
      return;
    }

    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "true";
    img.src = buildPlaceholderImage(label);
  };
}

// CSS `background-image` has no error event, so a failed/slow hero banner
// photo would otherwise just render as an empty box behind the text forever.
// This preloads the URL and reports whether it actually resolved, so the
// hero can fall back to a solid themed gradient instead of a blank hole.
function useImageLoadOk(url: string | undefined): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!url) {
      setOk(false);
      return;
    }
    let cancelled = false;
    setOk(false);
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setOk(true);
    };
    img.onerror = () => {
      if (!cancelled) setOk(false);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return ok;
}

// Standalone component (not inline JSX) so it can call the useImageLoadOk
// hook safely - the HERO_BANNER block it replaces lives inside a .map(),
// where hooks can't be called directly. Falls back to a themed gradient
// (no url()) if the generated photo fails or is still loading, instead of a
// blank/broken box behind the hero text.
interface HeroBannerProps {
  payload: { title: string; subtitle: string; backgroundImage: string; ctaText: string };
  accentColor: string;
  primaryColor: string;
  secondaryColor: string;
}

const HeroBanner: React.FC<HeroBannerProps> = ({ payload, accentColor, primaryColor, secondaryColor }) => {
  const imageOk = useImageLoadOk(payload.backgroundImage);
  const backgroundImage = imageOk
    ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.55)), url(${payload.backgroundImage})`
    : `linear-gradient(135deg, ${secondaryColor}, ${primaryColor})`;

  return (
    <div
      className="relative overflow-hidden py-24 px-8 text-center flex flex-col items-center justify-center"
      style={{ backgroundImage, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-4xl md:text-6xl font-bold text-white max-w-4xl tracking-tight leading-tight"
      >
        {payload.title}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="text-lg md:text-xl text-slate-200 mt-4 max-w-2xl font-light"
      >
        {payload.subtitle}
      </motion.p>
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        onClick={() => {
          const el = document.getElementById("catalog-grid");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
        style={{ backgroundColor: accentColor }}
        className="mt-8 px-8 py-3 rounded-full text-white font-medium shadow-lg hover:shadow-xl hover:brightness-115 transition duration-300 cursor-pointer"
      >
        {payload.ctaText}
      </motion.button>
    </div>
  );
};

interface StoreRendererProps {
  bootstrapData: FrontendStoreBootstrap;
  onExit: () => void;
  // Optional: when the person viewing this live storefront is signed in as
  // its OWNER, a persistent "Manage Store" control appears in the header so
  // they can always reach product/price management from the storefront
  // itself - not just right after first publishing it.
  onManageStore?: (storeId: string) => void;
}

export const StoreRenderer: React.FC<StoreRendererProps> = ({
  bootstrapData,
  onExit,
  onManageStore,
}) => {
  // Guard Clause
  if (!bootstrapData || !bootstrapData.store) {
    return (
      <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-xl font-bold text-red-400">Invalid Store Configuration</h2>
        <p className="text-slate-400 text-sm mt-2">The storefront bootstrap data could not be parsed successfully.</p>
        <button onClick={onExit} className="mt-6 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-xs font-bold transition cursor-pointer">
          Return to Hub
        </button>
      </div>
    );
  }

  const { store: originalStore, theme: originalTheme, features: originalFeatures, pages, initialCatalogPage } = bootstrapData;

  // True when the person currently signed in (as a store OWNER, via the
  // separate owner-login flow) is this exact store's owner - lets the
  // storefront show a persistent "Manage Store" control so the owner can
  // always reach product/price management, not just right after publishing.
  const isOwnerViewing = (() => {
    try {
      const raw = localStorage.getItem("corecart_owner_session");
      if (!raw) return false;
      const session = JSON.parse(raw);
      return !!originalStore.ownerId && session?.user?.id === originalStore.ownerId;
    } catch {
      return false;
    }
  })();

  // Layout customization state (initialized using original values from bootstrapData)
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [customStoreName, setCustomStoreName] = useState(originalStore.name);
  const [customBrandIdentity, setCustomBrandIdentity] = useState({ ...originalTheme });
  const [customFeatureToggles, setCustomFeatureToggles] = useState({ ...originalFeatures });
  const [customHomepageConfig, setCustomHomepageConfig] = useState(originalStore.homepageConfig || {
    hero: {
      title: `Welcome to ${originalStore.name}`,
      subtitle: originalStore.description || "The future of curated shopping.",
      backgroundImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1920&q=80",
      ctaText: "Shop Collection",
      ctaLink: "#products",
    },
    sections: [
      { id: "sec-hero", type: "HERO_BANNER" },
      { id: "sec-categories", type: "CATEGORIES_GRID", title: "Browse Categories" },
      { id: "sec-products-featured", type: "PRODUCT_GRID", title: "Featured Masterpieces", productSource: "all", limit: 8 },
      { id: "sec-deals", type: "DEALS_BANNER", title: "Exclusive Offers", subtitle: "Save up to 50% on selected items." },
      { id: "sec-about", type: "ABOUT_US", html: `<h3>Crafted with Pride</h3><p>We believe in quality over quantity, and direct customer connectivity.</p>` },
    ],
    footer: {
      text: `© ${new Date().getFullYear()} ${originalStore.name}. All Rights Reserved.`
    }
  });
  const [customButtonStyle, setCustomButtonStyle] = useState(originalStore.buttonStyle || "rounded");
  const [customNavigationConfig, setCustomNavigationConfig] = useState<any[]>(bootstrapData.navigation || []);
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  // Shadow variables mapping reactive editor customizer changes to existing storefront usages
  const theme = customBrandIdentity;
  const features = customFeatureToggles;
  const store = {
    ...originalStore,
    name: customStoreName,
    homepageConfig: customHomepageConfig,
    buttonStyle: customButtonStyle,
  };
  const navigation = customNavigationConfig;

  // Storefront Client States
  const [cart, setCart] = useState<{ id: string; items: any[] } | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const storeId = bootstrapData?.store?.id || "default";
      const saved = localStorage.getItem(`store_wishlist_${storeId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState<any | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState("M");
  const [selectedColor, setSelectedColor] = useState("Charcoal Black");
  const [activeSection, setActiveSection] = useState<"home" | "product-details" | "checkout" | "orders" | "account">("home");

  // Authentication State (Pre-populated for frictionless testing, can be logged out)
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  
  // Login / Registration Temp States
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [authError, setAuthError] = useState<string | null>(null);

  // Reviews and Blogs
  const [productsList, setProductsList] = useState<any[]>(initialCatalogPage.products);
  const [reviewsMap, setReviewsMap] = useState<Record<string, any[]>>({});
  const [newReview, setNewReview] = useState({ rating: 5, comment: "", name: "" });

  // Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("addr-1");
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isEditingAddressId, setIsEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    name: "",
    phone: "",
    email: "",
    flatNumber: "",
    street: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    isDefault: false,
  });

  // Checkout Steps (1 to 7) & Selections
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express" | "free">("standard");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "upi" | "card" | "netbanking" | "wallet" | "">("");
  
  const [cardForm, setCardForm] = useState({
    holder: "",
    number: "",
    expiry: "",
    cvv: "",
  });
  const [upiForm, setUpiForm] = useState({ upiId: "" });
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);
  const [reviewingProduct, setReviewingProduct] = useState<any | null>(null);

  // The account/profile control in the top-right stays hidden until the shopper
  // engages with the store: it appears once they add something to the cart, and
  // stays available after they buy (persisted per-store so it survives reloads).
  const [hasPurchased, setHasPurchased] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`store_${bootstrapData?.store?.id}_purchased`) === "true";
    } catch {
      return false;
    }
  });

  const unlockAccountAfterPurchase = () => {
    setHasPurchased(true);
    try {
      localStorage.setItem(`store_${store.id}_purchased`, "true");
    } catch {
      /* ignore storage failures */
    }
  };

  // Smart Recommendations States
  const [recommendations, setRecommendations] = useState<any | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("store_recently_viewed");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Account Dashboard Tab
  const [activeAccountTab, setActiveAccountTab] = useState<"profile" | "orders" | "addresses" | "wishlist" | "settings">("profile");
  const [myOrdersList, setMyOrdersList] = useState<any[]>([]);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState<any | null>(null);
  const [viewingInvoiceOrder, setViewingInvoiceOrder] = useState<any | null>(null);

  // Coupon Engine States
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState<string | null>(null);

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    setCouponError(null);
    fetch("/api/v1/coupons/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Store-Id": store.id,
        "store-id": store.id,
      },
      body: JSON.stringify({
        code: couponCode.trim(),
        subtotal: cartTotal,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setAppliedCoupon(couponCode.trim().toUpperCase());
          setCouponDiscount(data.discountAmount);
          setCouponError(null);
        } else {
          setCouponError(data.error || "Invalid coupon code.");
          setCouponDiscount(0);
          setAppliedCoupon(null);
        }
      })
      .catch((err) => {
        console.error(err);
        setCouponError("Failed to validate coupon.");
      });
  };

  // Load / Setup cart
  useEffect(() => {
    // Fetch cart
    const sessionId = "guest-session-123";
    fetch(`/api/v1/cart?storeId=${store.id}&sessionId=${sessionId}`)
      .then((res) => res.json())
      .then((data) => setCart(data))
      .catch((err) => console.error("Error fetching cart:", err));

    // Seed initial reviews
    productsList.forEach((p) => {
      fetch(`/api/v1/products/${p.id}/reviews`)
        .then((res) => res.json())
        .then((reviews) => {
          setReviewsMap((prev) => ({ ...prev, [p.id]: reviews }));
        });
    });
  }, [store.id]);

  // Load wishlist from SQL backend on login/mount
  useEffect(() => {
    if (currentUser && store.id) {
      fetch(`/api/v1/wishlist?storeId=${store.id}&customerId=${currentUser.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.productIds) {
            // Merge backend wishlists with local storage wishlists to avoid wiping out items!
            const localSaved = localStorage.getItem(`store_wishlist_${store.id}`);
            const localIds = localSaved ? JSON.parse(localSaved) : [];
            const merged = Array.from(new Set([...data.productIds, ...localIds]));
            
            setWishlist(merged);
            try {
              localStorage.setItem(`store_wishlist_${store.id}`, JSON.stringify(merged));
            } catch (err) {
              console.error(err);
            }

            // If local had more items, send update to backend to persist them!
            if (merged.length > data.productIds.length) {
              // Sync missing items back to backend
              merged.forEach((id) => {
                if (!data.productIds.includes(id)) {
                  fetch("/api/v1/wishlist/toggle", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      storeId: store.id,
                      customerId: currentUser.id,
                      productId: id,
                    }),
                  }).catch(err => console.error(err));
                }
              });
            }
          }
        })
        .catch((err) => console.error("Error fetching wishlist:", err));
    }
  }, [currentUser?.id, store.id]);

  // Fetch Smart Recommendations whenever Cart updates
  useEffect(() => {
    if (cart) {
      fetch(`/api/v1/cart/recommendations?storeId=${store.id}&cartId=${cart.id}`)
        .then((res) => res.json())
        .then((data) => setRecommendations(data))
        .catch((err) => console.error("Error fetching recommendations:", err));
    }
  }, [cart?.id, cart?.items?.length, store.id]);

  // Fetch My Orders from PostgreSQL API
  const fetchMyOrders = () => {
    if (!currentUser) {
      setMyOrdersList([]);
      return;
    }
    fetch(`/api/v1/orders?storeId=${store.id}&customerId=${currentUser.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMyOrdersList(data.reverse()); // latest first
        }
      })
      .catch((err) => console.error("Error loading customer orders:", err));
  };

  useEffect(() => {
    fetchMyOrders();
  }, [currentUser, store.id, activeSection]);

  const refreshCart = () => {
    if (!cart) return;
    fetch(`/api/v1/cart?storeId=${store.id}&cartId=${cart.id}`)
      .then((res) => res.json())
      .then((data) => setCart(data));
  };

  // Add Product to Recently Viewed list
  const addToRecentlyViewed = (prodId: string) => {
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((id) => id !== prodId);
      const updated = [prodId, ...filtered].slice(0, 10);
      try {
        localStorage.setItem("store_recently_viewed", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  // "Buy Now" handler - adds item and goes straight to secure checkout
  const handleBuyNow = async (productId: string, variantId?: string) => {
    if (!cart) return;

    try {
      // Clear existing items in cart for Buy Now so it only contains this item
      for (const item of cart.items) {
        await fetch(`/api/v1/cart/items/${item.id}?cartId=${cart.id}`, { method: "DELETE" });
      }

      const res = await fetch("/api/v1/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Store-Id": store.id,
        },
        body: JSON.stringify({
          cartId: cart.id,
          productId,
          variantId,
          quantity: 1,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Low stock!");
      }
      
      await refreshCart();
      setIsCartOpen(false);
      setActiveSection("checkout");
      setCheckoutStep(1); // Start from Authentication/Address
    } catch (err: any) {
      console.error("Buy Now failed:", err);
      alert(err.message || "Failed to initiate Buy Now");
    }
  };

  // 1. Add to Cart Handler
  const handleAddToCart = (productId: string, variantId?: string) => {
    if (!cart) return;

    fetch("/api/v1/cart/items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Store-Id": store.id,
      },
      body: JSON.stringify({
        cartId: cart.id,
        productId,
        variantId,
        quantity: 1,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => alert(err.error || "Low stock!"));
        }
        return res.json();
      })
      .then(() => {
        refreshCart();
        setIsCartOpen(true);
      })
      .catch((err) => console.error(err));
  };

  // 2. Update Cart Item Quantity
  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    if (!cart) return;
    fetch(`/api/v1/cart/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId: cart.id, quantity: newQty }),
    })
      .then(() => refreshCart())
      .catch((err) => console.error(err));
  };

  // 3. Delete Cart Item
  const handleDeleteItem = (itemId: string) => {
    if (!cart) return;
    fetch(`/api/v1/cart/items/${itemId}?cartId=${cart.id}`, {
      method: "DELETE",
    })
      .then(() => refreshCart())
      .catch((err) => console.error(err));
  };

  // 4. Submit Review
  const handleSubmitReview = (productId: string) => {
    if (!newReview.name || !newReview.comment) {
      alert("Please provide your name and comment.");
      return;
    }

    fetch("/api/v1/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: store.id,
        productId,
        customerName: newReview.name,
        rating: newReview.rating,
        comment: newReview.comment,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        // Update local review cache
        setReviewsMap((prev) => ({
          ...prev,
          [productId]: [...(prev[productId] || []), data],
        }));
        setNewReview({ rating: 5, comment: "", name: "" });
      })
      .catch((err) => console.error(err));
  };

  // Wishlist toggle helper
  const toggleWishlist = (productId: string) => {
    // 1. Optimistic Update Local State & Local Storage immediately
    const updated = wishlist.includes(productId)
      ? wishlist.filter((id) => id !== productId)
      : [...wishlist, productId];
    
    setWishlist(updated);
    try {
      localStorage.setItem(`store_wishlist_${store.id}`, JSON.stringify(updated));
    } catch (err) {
      console.error("Local storage sync error:", err);
    }

    // 2. Background Sync with Backend if logged in
    if (currentUser) {
      fetch("/api/v1/wishlist/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          customerId: currentUser.id,
          productId,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.productIds) {
            // Keep local state in sync with backend's source of truth
            setWishlist(data.productIds);
            try {
              localStorage.setItem(`store_wishlist_${store.id}`, JSON.stringify(data.productIds));
            } catch (err) {
              console.error(err);
            }
          }
        })
        .catch((err) => console.error("Error toggling backend wishlist:", err));
    }
  };

  // Format minor units cents to store currency
  const formatMoney = (cents: number) => {
    const amount = cents / 100;
    return new Intl.NumberFormat(store.language || "en", {
      style: "currency",
      currency: store.currency || "USD",
    }).format(amount);
  };

  // Filter products by category & search query
  const filteredProducts = productsList.filter((p) => {
    const matchesCat = selectedCategory ? p.categoryId === selectedCategory : true;
    const matchesSearch = searchQuery
      ? p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesCat && matchesSearch;
  });

  const cartTotal = cart
    ? cart.items.reduce((sum, item) => sum + item.unitPriceSnapshot * item.quantity, 0)
    : 0;

  const getCheckoutDetails = () => {
    const subtotal = cartTotal;
    const discount = couponDiscount;
    const isINR = store.currency === "INR";
    
    // Tax: Inclusive of taxes (MRP)
    const taxRate = 0;
    const tax = 0;
    
    // Shipping: Free shipping by default to match exact cost expectation
    let shippingFee = 0;
    
    // Free delivery check (above 499 for INR, 50 for other)
    const canGetFreeDelivery = isINR ? subtotal >= 49900 : subtotal >= 5000;
    
    const grandTotal = Math.max(0, subtotal - discount + tax + shippingFee);
    
    return {
      subtotal,
      discount,
      tax,
      shippingFee,
      grandTotal,
      canGetFreeDelivery,
    };
  };

  // Move section helper
  const moveSection = (index: number, direction: "up" | "down") => {
    const list = [...customHomepageConfig.sections];
    if (direction === "up" && index > 0) {
      const temp = list[index];
      list[index] = list[index - 1];
      list[index - 1] = temp;
    } else if (direction === "down" && index < list.length - 1) {
      const temp = list[index];
      list[index] = list[index + 1];
      list[index + 1] = temp;
    }
    setCustomHomepageConfig((prev: any) => ({
      ...prev,
      sections: list,
    }));
  };

  // Add section helper
  const addSection = (type: string) => {
    const id = `sec-${type.toLowerCase()}-${Date.now()}`;
    setCustomHomepageConfig((prev: any) => ({
      ...prev,
      sections: [...prev.sections, { id, type, title: type === "PRODUCT_GRID" ? "New Grid" : type === "DEALS_BANNER" ? "Special Offers" : undefined }],
    }));
  };

  // Delete section helper
  const deleteSection = (id: string) => {
    setCustomHomepageConfig((prev: any) => ({
      ...prev,
      sections: prev.sections.filter((s: any) => s.id !== id),
    }));
  };

  // Add nav link helper
  const addNavLink = () => {
    const id = `nav-${Date.now()}`;
    setCustomNavigationConfig((prev) => [...prev, { label: "New Link", link: "#", id }]);
  };

  // Delete nav link helper
  const deleteNavLink = (id: string) => {
    setCustomNavigationConfig((prev) => prev.filter((n) => n.id !== id));
  };

  // Save Layout to Backend helper
  const saveLayoutConfig = () => {
    setIsSavingLayout(true);
    fetch(`/api/v1/stores/${store.id}/layout`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homepageConfig: customHomepageConfig,
        navigationConfig: customNavigationConfig,
        footerConfig: { footerText: customHomepageConfig.footer?.text || `© ${new Date().getFullYear()} ${store.name}. All Rights Reserved.` },
        buttonStyle: customButtonStyle,
        name: customStoreName,
        brandIdentity: customBrandIdentity,
        featureToggles: customFeatureToggles,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to save layout.");
        return res.json();
      })
      .then(() => {
        alert("Layout configurations saved and published successfully!");
        fetchVersionHistory();
      })
      .catch((err) => {
        console.error(err);
        alert("Failed to save store layout details.");
      })
      .finally(() => {
        setIsSavingLayout(false);
      });
  };

  // Version History list state
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [activeCustomizerTab, setActiveCustomizerTab] = useState<"branding" | "layout" | "hero" | "navigation" | "features" | "history">("branding");

  // Fetch Version History logs
  const fetchVersionHistory = () => {
    fetch(`/api/v1/stores/${store.id}/history`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setVersionHistory(data.reverse());
        }
      })
      .catch((err) => console.error("Error fetching store versions history:", err));
  };

  // Rollback to selected snapshot version
  const rollbackToVersion = (versionId: string) => {
    if (!confirm("Are you sure you want to rollback to this configuration snapshot?")) return;
    fetch(`/api/v1/stores/${store.id}/history/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.store) {
          const s = data.store;
          setCustomStoreName(s.name);
          if (s.brandIdentity) setCustomBrandIdentity(s.brandIdentity);
          if (s.featureToggles) setCustomFeatureToggles(s.featureToggles);
          if (s.homepageConfig) setCustomHomepageConfig(s.homepageConfig);
          if (s.navigationConfig) setCustomNavigationConfig(s.navigationConfig);
          if (s.buttonStyle) setCustomButtonStyle(s.buttonStyle);
          alert("Store config rolled back successfully!");
        }
      })
      .catch((err) => {
        console.error(err);
        alert("Rollback failed.");
      });
  };

  useEffect(() => {
    if (isCustomizerOpen) {
      fetchVersionHistory();
    }
  }, [isCustomizerOpen]);

  const getMappedSections = () => {
    return customHomepageConfig.sections.map((sec: any) => {
      if (sec.type === "HERO_BANNER") {
        return {
          id: sec.id,
          components: [
            {
              id: "comp-hero",
              type: "HERO_BANNER",
              requiredFeature: null,
              payload: {
                title: customHomepageConfig.hero.title,
                subtitle: customHomepageConfig.hero.subtitle,
                backgroundImage: customHomepageConfig.hero.backgroundImage,
                ctaText: customHomepageConfig.hero.ctaText,
                ctaLink: customHomepageConfig.hero.ctaLink,
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
                title: sec.title || "Featured Products",
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
                title: sec.title || "Exclusive Deals",
                subtitle: sec.subtitle || "Save big on selected items.",
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
                html: sec.html || `<h3>Crafted with Pride</h3><p>We believe in quality over quantity, and direct customer connectivity.</p>`,
              },
            },
          ],
        };
      }
      return null;
    }).filter((x: any) => x !== null);
  };

  // Layout Dynamic Token Styling Mapping
  const localThemeStyle = {
    "--store-primary": theme.primaryColor,
    "--store-secondary": theme.secondaryColor,
    "--store-accent": theme.accentColor,
    "--store-font-family": theme.typography === "Space Grotesk" ? "'Space Grotesk', sans-serif" : "'Inter', sans-serif",
    fontFamily: theme.typography === "Space Grotesk" ? "'Space Grotesk', sans-serif" : "'Inter', sans-serif",
  } as React.CSSProperties;

  return (
    <div
      style={localThemeStyle}
      className={`relative min-h-screen transition-all duration-300 ${
        theme.themeMode === "dark" ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"
      }`}
    >
      {/* 1. STORE HEADER NAVBAR */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md px-6 py-4 flex items-center justify-between ${
          theme.themeMode === "dark" ? "bg-slate-900/90 border-slate-800" : "bg-white/90 border-slate-100"
        }`}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-slate-200 hover:bg-slate-50 transition cursor-pointer font-medium text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Exit Storefront
          </button>
          <div className="font-bold tracking-tight text-xl flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: theme.accentColor }}
            />
            {store.name}
            <span className="text-xs font-mono px-2 py-0.5 rounded border border-slate-300/30 text-slate-400 bg-slate-500/10">
              {store.templateKey.toUpperCase()}
            </span>
          </div>
          {isOwnerViewing && onManageStore && (
            <button
              onClick={() => onManageStore(store.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full font-bold text-white transition cursor-pointer"
              style={{ backgroundColor: theme.accentColor }}
              title="Add/edit/delete products, set prices, view orders"
            >
              <Settings className="w-3.5 h-3.5" />
              Manage Store
            </button>
          )}
        </div>

        {/* Navigation Menus */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => {
              setActiveSection("home");
              setSelectedCategory(null);
            }}
            className="hover:opacity-80 transition cursor-pointer"
          >
            Home
          </button>
          {navigation.map((nav) => (
            <button
              key={nav.id}
              onClick={() => {
                setActiveSection("home");
                setSelectedCategory(nav.id);
              }}
              className={`hover:opacity-80 transition cursor-pointer ${
                selectedCategory === nav.id ? "underline decoration-2" : ""
              }`}
              style={{ decorationColor: theme.accentColor }}
            >
              {nav.label}
            </button>
          ))}
        </nav>

        {/* Search, Wishlist, Cart Actions */}
        <div className="flex items-center gap-4">
          {features.search_autocomplete && (
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search catalog..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-9 pr-4 py-1.5 text-xs rounded-full w-48 focus:w-64 transition-all duration-300 border focus:outline-none focus:ring-1 ${
                  theme.themeMode === "dark"
                    ? "bg-slate-800 border-slate-700 focus:ring-slate-500"
                    : "bg-slate-50 border-slate-200 focus:ring-slate-300"
                }`}
              />
            </div>
          )}

          {features.wishlist && (
            <button
              onClick={() => setIsWishlistOpen(true)}
              className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title="View Wishlist"
            >
              <Heart className={`w-5 h-5 ${wishlist.length > 0 ? "fill-red-500 text-red-500" : ""}`} />
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ShoppingBag className="w-5 h-5" />
            {cart && cart.items.length > 0 && (
              <span
                style={{ backgroundColor: theme.accentColor }}
                className="absolute -top-1 -right-1 text-white font-bold text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center"
              >
                {cart.items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>

          {/* User profile / Account navigation.
              Hidden until the shopper adds a product to the cart (or has bought
              something), so a brand-new visitor doesn't see an account entry. */}
          {(((cart?.items?.length || 0) > 0) || hasPurchased) && (
            <button
              onClick={() => {
                if (activeSection === "account") {
                  setActiveSection("home");
                } else {
                  setActiveSection("account");
                  setActiveAccountTab("profile");
                }
              }}
              className={`flex items-center gap-1.5 p-1.5 px-3 rounded-full border text-xs font-semibold cursor-pointer transition ${
                activeSection === "account"
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                  : theme.themeMode === "dark"
                  ? "hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200"
                  : "hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="hidden md:inline">
                {currentUser ? currentUser.name : "My Account"}
              </span>
            </button>
          )}
        </div>
      </header>

      {activeSection === "home" && (
        <main className="pb-20">
          {getMappedSections().map((sec) => (
            <section key={sec.id} className="relative">
              {sec.components.map((comp) => {
                // Check feature gate
                if (comp.requiredFeature && !features[comp.requiredFeature]) {
                  return null;
                }

                // Render matching component block
                if (comp.type === "HERO_BANNER") {
                  return (
                    <HeroBanner
                      key={comp.id}
                      payload={comp.payload}
                      accentColor={theme.accentColor}
                      primaryColor={theme.primaryColor}
                      secondaryColor={theme.secondaryColor}
                    />
                  );
                }

                if (comp.type === "PRODUCT_GRID") {
                  return (
                    <div id="catalog-grid" key={comp.id} className="max-w-7xl mx-auto px-6 py-16">
                      <div className="flex items-center justify-between mb-8 border-b pb-4 border-slate-300/20">
                        <div>
                          <h2 className="text-2xl font-bold tracking-tight">{comp.payload.title}</h2>
                          <p className="text-sm text-slate-400 mt-1">
                            Displaying {filteredProducts.length} premium products
                          </p>
                        </div>
                        {selectedCategory && (
                          <button
                            onClick={() => setSelectedCategory(null)}
                            className="text-xs font-semibold underline text-slate-400 hover:text-slate-100"
                          >
                            Clear Filter
                          </button>
                        )}
                      </div>

                      {/* Store-Wide Special Deals Flag (e.g. Flash Deals) */}
                      {features.flash_deals && (
                        <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Clock className="text-amber-500 w-5 h-5 animate-pulse" />
                            <div>
                              <span className="font-bold text-amber-500 text-sm">FLASH DEAL OF THE WEEK!</span>
                              <p className="text-xs text-slate-400">Exclusive coupon stacking enabled during next 2 hours.</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs font-mono font-bold bg-amber-500/20 px-3 py-1 rounded text-amber-500">
                            01h : 44m : 52s
                          </div>
                        </div>
                      )}

                      {/* Products Grid Columns */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        {filteredProducts.map((p) => {
                          const ratingList = reviewsMap[p.id] || [];
                          const averageRating =
                            ratingList.length > 0
                              ? ratingList.reduce((sum, r) => sum + r.rating, 0) / ratingList.length
                              : 5;

                          return (
                            <motion.div
                              key={p.id}
                              whileHover={{ y: -5 }}
                              className={`group relative rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col justify-between ${
                                theme.themeMode === "dark"
                                  ? "bg-slate-900 border-slate-800/80 hover:border-slate-700"
                                  : "bg-slate-50 border-slate-100 hover:border-slate-200"
                              }`}
                            >
                              {/* Thumbnail Image */}
                              <div className="relative aspect-square overflow-hidden bg-slate-300/10">
                                <img
                                  src={p.images[0] || `https://image.pollinations.ai/prompt/${encodeURIComponent(`product photo of ${p.title}`)}?width=600&height=600&nologo=true&model=flux`}
                                  alt={p.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  referrerPolicy="no-referrer"
                                  onError={handleImgError(p.title)}
                                />
                                {/* Top Badges overlay */}
                                <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                                  {p.variants[0]?.quantityOnHand < 10 && (
                                    <span className="text-[10px] bg-red-500 text-white font-bold px-2 py-0.5 rounded-full uppercase">
                                      Low Stock
                                    </span>
                                  )}
                                </div>

                                {features.wishlist && (
                                  <button
                                    onClick={() => toggleWishlist(p.id)}
                                    className="absolute top-3 right-3 p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-700 shadow-sm transition z-10 cursor-pointer"
                                  >
                                    <Heart
                                      className={`w-4 h-4 ${
                                        wishlist.includes(p.id) ? "fill-red-500 text-red-500" : "text-slate-600"
                                      }`}
                                    />
                                  </button>
                                )}
                              </div>

                              {/* Info Content */}
                              <div className="p-4 flex-grow flex flex-col justify-between">
                                <div>
                                  <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                                    {p.brand}
                                  </span>
                                  <h3 className="font-semibold text-sm line-clamp-1 mt-0.5 group-hover:underline">
                                    {p.title}
                                  </h3>

                                  {/* Star Rating display */}
                                  {features.reviews && (
                                    <div className="flex items-center gap-1 mt-1 text-amber-500">
                                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                      <span className="text-xs font-semibold font-mono">
                                        {averageRating.toFixed(1)}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        ({ratingList.length})
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-300/10">
                                  <span className="font-bold text-base font-mono">
                                    {formatMoney(p.basePrice)}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        setSelectedProductDetails(p);
                                        setActiveImageIndex(0);
                                        setActiveSection("product-details");
                                        addToRecentlyViewed(p.id);
                                        window.scrollTo({ top: 0, behavior: "smooth" });
                                      }}
                                      className="text-[10px] font-bold border px-2.5 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                    >
                                      View
                                    </button>
                                    <button
                                      onClick={() => handleBuyNow(p.id, p.variants[0]?.id)}
                                      style={{ borderColor: theme.accentColor, color: theme.accentColor }}
                                      className="text-[10px] border px-3 py-1.5 rounded-full hover:bg-slate-500/10 font-bold transition cursor-pointer"
                                    >
                                      Buy Now
                                    </button>
                                    <button
                                      onClick={() => handleAddToCart(p.id, p.variants[0]?.id)}
                                      style={{ backgroundColor: theme.accentColor }}
                                      className="p-1.5 rounded-full text-white hover:brightness-115 transition shadow-sm cursor-pointer"
                                      title="Add to Bag"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if (comp.type === "CMS_RICH_TEXT") {
                  return (
                    <div key={comp.id} className="max-w-4xl mx-auto px-6 py-12">
                      <div
                        className="prose dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: comp.payload.html }}
                      />
                    </div>
                  );
                }

                return null;
              })}
            </section>
          ))}

          {/* Blogs and FAQs dynamic sections */}
          {features.blog && initialCatalogPage.blogs.length > 0 && (
            <div className="max-w-7xl mx-auto px-6 py-16 border-t border-slate-300/15">
              <h2 className="text-2xl font-bold mb-8">Latest Editorial Updates</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {initialCatalogPage.blogs.map((blog, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl overflow-hidden border p-5 flex gap-4 ${
                      theme.themeMode === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-100"
                    }`}
                  >
                    <img
                      src={blog.image}
                      alt={blog.title}
                      className="w-24 h-24 rounded-xl object-cover"
                      referrerPolicy="no-referrer"
                      onError={handleImgError(blog.title)}
                    />
                    <div>
                      <span className="text-[10px] font-mono text-slate-400">By {blog.author}</span>
                      <h3 className="font-bold text-base mt-1 leading-snug">{blog.title}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{blog.summary}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Footer Component rendering */}
          <footer className={`py-12 border-t border-slate-300/10 text-center text-xs text-slate-500 mt-20 ${
            theme.themeMode === "dark" ? "bg-slate-950/20" : "bg-slate-50"
          }`}>
            <p>{customHomepageConfig.footer?.text || `© ${new Date().getFullYear()} ${store.name}. All Rights Reserved.`}</p>
          </footer>
        </main>
      )}

      {/* 3. CART DRAWER COMPONENT */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-black"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className={`relative w-full max-w-md h-full flex flex-col justify-between shadow-2xl z-10 ${
                theme.themeMode === "dark" ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
              }`}
            >
              <div className="p-6 overflow-y-auto flex-grow">
                <div className="flex items-center justify-between pb-4 border-b border-slate-300/20">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <ShoppingBag /> Active Shopping Bag
                  </h3>
                  <button onClick={() => setIsCartOpen(false)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {cart && cart.items.length > 0 ? (
                  <div className="divide-y divide-slate-300/10 mt-4">
                    {cart.items.map((item) => {
                      const prod = productsList.find((x) => x.id === item.productId);
                      return (
                        <div key={item.id} className="py-4 flex gap-3">
                          <img
                            src={prod?.images[0]}
                            alt={prod?.title}
                            className="w-16 h-16 rounded-xl object-cover bg-slate-100"
                            referrerPolicy="no-referrer"
                            onError={handleImgError(prod?.title || "")}
                          />
                          <div className="flex-grow flex flex-col justify-between">
                            <div>
                              <h4 className="font-semibold text-xs leading-tight">{prod?.title}</h4>
                              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                {prod?.brand}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2 border rounded-full px-2 py-0.5 border-slate-300/20">
                                <button
                                  onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                  className="p-0.5"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-xs font-mono font-bold px-1">{item.quantity}</span>
                                <button
                                  onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                  className="p-0.5"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs font-bold">
                                  {formatMoney(item.unitPriceSnapshot * item.quantity)}
                                </span>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="text-red-400 hover:text-red-500 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* --- SMART CART RECOMMENDATIONS --- */}
                    <div className="mt-8 pt-6 border-t border-slate-300/10">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                          Frequently Bought Together
                        </h4>
                        <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-semibold font-mono">Smart AI Suggestion</span>
                      </div>
                      
                      {recommendations && (
                        recommendations.frequentlyBoughtTogether?.length > 0 || 
                        recommendations.related?.length > 0 || 
                        recommendations.completeYourSetup?.length > 0
                      ) ? (
                        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin snap-x">
                          {(
                            recommendations.frequentlyBoughtTogether?.length > 0 
                              ? recommendations.frequentlyBoughtTogether 
                              : (recommendations.related?.length > 0 ? recommendations.related : recommendations.completeYourSetup || [])
                          ).slice(0, 5).map((item: any) => (
                            <div 
                              key={item.id} 
                              className={`min-w-[130px] w-[130px] flex flex-col justify-between p-2.5 rounded-2xl border snap-start ${
                                theme.themeMode === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-150"
                              }`}
                            >
                              <div>
                                <img
                                  src={item.images?.[0] || `https://image.pollinations.ai/prompt/${encodeURIComponent(`product photo of ${item.title}`)}?width=200&height=200&nologo=true&model=flux`}
                                  alt={item.title}
                                  className="w-full h-20 object-cover rounded-xl"
                                  referrerPolicy="no-referrer"
                                  onError={handleImgError(item.title)}
                                />
                                <h5 className="text-[10px] font-bold line-clamp-1 mt-1.5 leading-tight">{item.title}</h5>
                                <span className="text-[10px] font-mono font-bold block mt-0.5 text-indigo-400">
                                  {formatMoney(item.basePrice)}
                                </span>
                              </div>
                              <button
                                onClick={() => handleAddToCart(item.id, item.variants?.[0]?.id)}
                                style={{ backgroundColor: theme.accentColor }}
                                className="mt-2.5 w-full py-1 rounded-full text-[9px] text-white font-bold hover:brightness-115 transition duration-300 cursor-pointer"
                              >
                                + Add
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500">Discover complementary items as you build your basket.</p>
                      )}
                    </div>

                    {/* --- DEALS YOU MIGHT LIKE --- */}
                    {recommendations?.deals && recommendations.deals.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-slate-300/10">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                            Trending Deals for You
                          </h4>
                          <span className="text-[9px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full font-semibold font-mono">% Hot Discount</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin snap-x">
                          {recommendations.deals.slice(0, 5).map((item: any) => (
                            <div 
                              key={item.id} 
                              className={`min-w-[130px] w-[130px] flex flex-col justify-between p-2.5 rounded-2xl border snap-start ${
                                theme.themeMode === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-150"
                              }`}
                            >
                              <div>
                                <img
                                  src={item.images?.[0] || `https://image.pollinations.ai/prompt/${encodeURIComponent(`product photo of ${item.title}`)}?width=200&height=200&nologo=true&model=flux`}
                                  alt={item.title}
                                  className="w-full h-20 object-cover rounded-xl"
                                  referrerPolicy="no-referrer"
                                  onError={handleImgError(item.title)}
                                />
                                <h5 className="text-[10px] font-bold line-clamp-1 mt-1.5 leading-tight">{item.title}</h5>
                                <span className="text-[10px] font-mono font-bold block mt-0.5 text-rose-400">
                                  {formatMoney(item.basePrice)}
                                </span>
                              </div>
                              <button
                                onClick={() => handleAddToCart(item.id, item.variants?.[0]?.id)}
                                style={{ backgroundColor: theme.accentColor }}
                                className="mt-2.5 w-full py-1 rounded-full text-[9px] text-white font-bold hover:brightness-115 transition duration-300 cursor-pointer"
                              >
                                + Add Deal
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* --- RECENTLY VIEWED PRODUCTS --- */}
                    {recentlyViewed.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-slate-300/10">
                        <h4 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-3">
                          Recently Viewed
                        </h4>
                        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin snap-x">
                          {recentlyViewed
                            .map((id) => productsList.find((p) => p.id === id))
                            .filter(Boolean)
                            .map((item: any) => (
                              <div 
                                key={item.id} 
                                className={`min-w-[130px] w-[130px] flex flex-col justify-between p-2.5 rounded-2xl border snap-start ${
                                  theme.themeMode === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-150"
                                }`}
                              >
                                <div>
                                  <img
                                    src={item.images?.[0] || `https://image.pollinations.ai/prompt/${encodeURIComponent(`product photo of ${item.title}`)}?width=200&height=200&nologo=true&model=flux`}
                                    alt={item.title}
                                    className="w-full h-20 object-cover rounded-xl"
                                    referrerPolicy="no-referrer"
                                    onError={handleImgError(item.title)}
                                  />
                                  <h5 className="text-[10px] font-bold line-clamp-1 mt-1.5 leading-tight">{item.title}</h5>
                                  <span className="text-[10px] font-mono font-bold block mt-0.5 text-slate-400">
                                    {formatMoney(item.basePrice)}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleAddToCart(item.id, item.variants?.[0]?.id)}
                                  style={{ backgroundColor: theme.accentColor }}
                                  className="mt-2.5 w-full py-1 rounded-full text-[9px] text-white font-bold hover:brightness-115 transition duration-300 cursor-pointer"
                                >
                                  + Re-add
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400 gap-3">
                    <ShoppingBag className="w-12 h-12 opacity-30" />
                    <p className="text-sm">Your shopping cart is currently empty.</p>
                    
                    {/* Fallback general recommendations inside empty cart */}
                    <div className="mt-8 pt-6 border-t border-slate-300/10 w-full text-left">
                      <h4 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-3 text-center">
                        Best Sellers You May Like
                      </h4>
                      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin snap-x">
                        {productsList.slice(0, 5).map((item: any) => (
                          <div 
                            key={item.id} 
                            className={`min-w-[130px] w-[130px] flex flex-col justify-between p-2.5 rounded-2xl border snap-start ${
                              theme.themeMode === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-150"
                            }`}
                          >
                            <div>
                              <img
                                src={item.images?.[0] || `https://image.pollinations.ai/prompt/${encodeURIComponent(`product photo of ${item.title}`)}?width=200&height=200&nologo=true&model=flux`}
                                alt={item.title}
                                className="w-full h-20 object-cover rounded-xl"
                                referrerPolicy="no-referrer"
                                onError={handleImgError(item.title)}
                              />
                              <h5 className="text-[10px] font-bold line-clamp-1 mt-1.5 leading-tight">{item.title}</h5>
                              <span className="text-[10px] font-mono font-bold block mt-0.5 text-indigo-400">
                                {formatMoney(item.basePrice)}
                              </span>
                            </div>
                            <button
                              onClick={() => handleAddToCart(item.id, item.variants?.[0]?.id)}
                              style={{ backgroundColor: theme.accentColor }}
                              className="mt-2.5 w-full py-1 rounded-full text-[9px] text-white font-bold hover:brightness-115 transition duration-300 cursor-pointer"
                            >
                              + Add to Bag
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer Checkout Action */}
              {cart && cart.items.length > 0 && (
                <div className="p-6 border-t border-slate-300/20">
                  <div className="flex items-center justify-between mb-4 font-mono font-bold text-sm">
                    <span>ESTIMATED SUBTOTAL</span>
                    <span>{formatMoney(cartTotal)}</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      setActiveSection("checkout");
                      setCheckoutStep(1);
                    }}
                    style={{ backgroundColor: theme.accentColor }}
                    className="w-full py-3 rounded-full text-white font-semibold shadow hover:brightness-115 transition duration-300 cursor-pointer flex items-center justify-center gap-2"
                  >
                    Proceed to Secure Checkout
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3.5. WISHLIST DRAWER COMPONENT */}
      <AnimatePresence>
        {isWishlistOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWishlistOpen(false)}
              className="absolute inset-0 bg-black"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className={`relative w-full max-w-md h-full flex flex-col justify-between shadow-2xl z-10 ${
                theme.themeMode === "dark" ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
              }`}
            >
              <div className="p-6 overflow-y-auto flex-grow">
                {(() => {
                  const wishlistItems = wishlist
                    .map((id) => productsList.find((x) => x.id === id))
                    .filter((p): p is any => p !== undefined);

                  return (
                    <>
                      <div className="flex items-center justify-between pb-4 border-b border-slate-300/20">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <Heart className="text-red-500 fill-red-500 w-5 h-5" /> Saved Items ({wishlistItems.length})
                        </h3>
                        <button onClick={() => setIsWishlistOpen(false)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {wishlistItems.length > 0 ? (
                        <div className="divide-y divide-slate-300/10 mt-4">
                          {wishlistItems.map((prod) => (
                            <div key={prod.id} className="py-4 flex gap-3">
                              <img
                                src={prod.images[0]}
                                alt={prod.title}
                                className="w-16 h-16 rounded-xl object-cover bg-slate-100"
                                referrerPolicy="no-referrer"
                                onError={handleImgError(prod.title)}
                              />
                              <div className="flex-grow flex flex-col justify-between">
                                <div>
                                  <div className="flex justify-between items-start">
                                    <h4 className="font-semibold text-xs leading-tight pr-2">{prod.title}</h4>
                                    <button
                                      onClick={() => toggleWishlist(prod.id)}
                                      className="text-slate-400 hover:text-red-500 p-0.5"
                                      title="Remove from Wishlist"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                {prod.brand}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-mono text-xs font-bold" style={{ color: theme.accentColor }}>
                                {formatMoney(prod.basePrice)}
                              </span>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => {
                                    handleAddToCart(prod.id, prod.variants?.[0]?.id);
                                    setIsWishlistOpen(false);
                                    setIsCartOpen(true);
                                  }}
                                  style={{ backgroundColor: theme.accentColor }}
                                  className="px-3 py-1 rounded-full text-[10px] text-white font-bold hover:brightness-115 transition duration-300 cursor-pointer"
                                >
                                  Add to Bag
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400 gap-3">
                    <Heart className="w-12 h-12 opacity-30 text-red-400" />
                    <p className="text-sm">Your wishlist is currently empty.</p>
                    <button
                      onClick={() => {
                        setIsWishlistOpen(false);
                        const el = document.getElementById("catalog-grid");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}
                      style={{ backgroundColor: theme.accentColor }}
                      className="mt-4 px-6 py-2 rounded-full text-white font-semibold text-xs hover:brightness-115 transition"
                    >
                      Browse Catalog
                    </button>
                  </div>
                )}
                    </>
                  );
                })()}
              </div>

              {wishlist.length > 0 && (
                <div className="p-6 border-t border-slate-300/20 flex gap-2">
                  <button
                    onClick={() => {
                      setIsWishlistOpen(false);
                      setActiveSection("account");
                      setActiveAccountTab("wishlist");
                    }}
                    className="w-full py-2.5 rounded-full border border-slate-300/20 text-xs font-semibold hover:bg-slate-500/10 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    View Wishlist Folder
                  </button>
                  <button
                    onClick={() => {
                      wishlist.forEach((id) => {
                        const prod = productsList.find((p) => p.id === id);
                        if (prod) {
                          handleAddToCart(prod.id, prod.variants?.[0]?.id);
                        }
                      });
                      setIsWishlistOpen(false);
                      setIsCartOpen(true);
                    }}
                    style={{ backgroundColor: theme.accentColor }}
                    className="w-full py-2.5 rounded-full text-white text-xs font-semibold hover:brightness-115 transition duration-300 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Add All to Bag
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. PRODUCT DETAILS PAGE */}
      {activeSection === "product-details" && selectedProductDetails && (
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Back breadcrumb */}
          <button
            onClick={() => {
              setActiveSection("home");
              setSelectedProductDetails(null);
            }}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 mb-8 cursor-pointer border border-slate-800 rounded-full px-4 py-2 hover:bg-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Products Catalog
          </button>

          {/* Core Info Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left Image Gallery Column */}
            <div className="space-y-4">
              <div className="aspect-square rounded-3xl overflow-hidden bg-slate-350/5 border border-slate-800 relative group cursor-zoom-in">
                <img
                  src={selectedProductDetails.images[activeImageIndex] || `https://image.pollinations.ai/prompt/${encodeURIComponent(`product photo of ${selectedProductDetails.title}`)}?width=600&height=600&nologo=true&model=flux`}
                  alt={selectedProductDetails.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-125"
                  referrerPolicy="no-referrer"
                  onError={handleImgError(selectedProductDetails.title)}
                />
              </div>

              {/* Thumbnails Row */}
              {selectedProductDetails.images && selectedProductDetails.images.length > 1 && (
                <div className="flex gap-3 overflow-x-auto py-1">
                  {selectedProductDetails.images.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-20 h-20 rounded-xl overflow-hidden border-2 cursor-pointer transition ${
                        activeImageIndex === idx ? "border-indigo-500 scale-105" : "border-slate-800 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={handleImgError(selectedProductDetails?.title || "")} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Information Details Column */}
            <div className="space-y-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-indigo-400">
                  {selectedProductDetails.brand}
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight mt-1">
                  {selectedProductDetails.title}
                </h1>

                {/* Rating & Review summary links */}
                {features.reviews && (
                  <div className="flex items-center gap-1.5 mt-2.5 text-amber-500">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => {
                        const reviews = reviewsMap[selectedProductDetails.id] || [];
                        const avg = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 5;
                        return (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${
                              s <= Math.round(avg) ? "fill-amber-500 text-amber-500" : "text-slate-650"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <span className="text-xs font-semibold font-mono text-slate-400 ml-1">
                      {((reviewsMap[selectedProductDetails.id] || []).length > 0
                        ? (reviewsMap[selectedProductDetails.id].reduce((sum, r) => sum + r.rating, 0) / reviewsMap[selectedProductDetails.id].length).toFixed(1)
                        : "5.0")}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({(reviewsMap[selectedProductDetails.id] || []).length} reviews)
                    </span>
                  </div>
                )}

                {/* Price Box with original cross-out */}
                <div className="flex items-baseline gap-3 mt-4">
                  <span className="text-3xl font-extrabold font-mono text-indigo-450" style={{ color: theme.accentColor }}>
                    {formatMoney(selectedProductDetails.basePrice)}
                  </span>
                  <span className="text-sm font-mono text-slate-500 line-through">
                    {formatMoney(Math.round(selectedProductDetails.basePrice * 1.25))}
                  </span>
                  <span className="text-xs font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">
                    Save 20%
                  </span>
                </div>

                {/* Variant selector fields */}
                <div className="mt-6 space-y-4 pt-6 border-t border-slate-350/10">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 block mb-2">Available Sizes</span>
                    <div className="flex gap-2">
                      {["S", "M", "L", "XL"].map((sz) => (
                        <button
                          key={sz}
                          onClick={() => setSelectedSize(sz)}
                          className={`px-4 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                            selectedSize === sz
                              ? "bg-indigo-500 text-white border-indigo-500"
                              : "border-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 block mb-2">Select Color</span>
                    <div className="flex gap-2">
                      {["Charcoal Black", "Pure Alabaster", "Amber Gold"].map((col) => (
                        <button
                          key={col}
                          onClick={() => setSelectedColor(col)}
                          className={`px-4 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                            selectedColor === col
                              ? "bg-indigo-500 text-white border-indigo-500"
                              : "border-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {col}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Stock status indicator */}
                <div className="mt-6 flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      selectedProductDetails.variants?.[0]?.quantityOnHand > 20
                        ? "bg-emerald-500"
                        : selectedProductDetails.variants?.[0]?.quantityOnHand > 0
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="text-xs font-semibold">
                    {selectedProductDetails.variants?.[0]?.quantityOnHand > 20
                      ? "In Stock (Ready to Ship)"
                      : selectedProductDetails.variants?.[0]?.quantityOnHand > 0
                      ? `Only ${selectedProductDetails.variants[0].quantityOnHand} units left - Order soon!`
                      : "Out of Stock"}
                  </span>
                </div>

                {/* Delivery estimate & Returns badges */}
                <div className="grid grid-cols-2 gap-4 mt-6 p-4 rounded-2xl bg-slate-500/5 border border-slate-350/5">
                  <div className="flex gap-2">
                    <Truck className="w-4 h-4 text-indigo-400 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 block">Fast Shipping</span>
                      <span className="text-xs font-bold block mt-0.5">
                        Est. Delivery: {new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 block">Trust Shield</span>
                      <span className="text-xs font-bold block mt-0.5">10-Day Returns & Replacements</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="mt-6 pt-6 border-t border-slate-300/10">
                  <span className="text-[10px] font-mono uppercase text-slate-500 block mb-2">Overview Description</span>
                  <p className="text-sm text-slate-400 leading-relaxed font-light">{selectedProductDetails.description}</p>
                </div>

                {/* Full Specifications */}
                {selectedProductDetails.attributes && Object.keys(selectedProductDetails.attributes).length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-300/10">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block mb-3">Technical Specifications</span>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      {Object.entries(selectedProductDetails.attributes).map(([key, val]) => (
                        <div key={key} className="border-b border-slate-300/5 pb-2">
                          <span className="text-slate-500 uppercase tracking-wider block font-mono text-[9px]">{key}</span>
                          <span className="font-bold block mt-0.5">{Array.isArray(val) ? val.join(", ") : String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons row */}
              <div className="mt-8 pt-6 border-t border-slate-300/10 flex items-center gap-3">
                <button
                  onClick={() => handleAddToCart(selectedProductDetails.id, selectedProductDetails.variants?.[0]?.id)}
                  style={{ borderRadius: customButtonStyle === "pill" ? "9999px" : customButtonStyle === "square" ? "0px" : "16px" }}
                  className="flex-grow py-3 px-6 bg-slate-900 border border-slate-800 text-slate-200 hover:text-white font-semibold transition duration-300 cursor-pointer flex items-center justify-center gap-2"
                >
                  Add to Cart
                </button>
                <button
                  onClick={() => handleBuyNow(selectedProductDetails.id, selectedProductDetails.variants?.[0]?.id)}
                  style={{ 
                    backgroundColor: theme.accentColor,
                    borderRadius: customButtonStyle === "pill" ? "9999px" : customButtonStyle === "square" ? "0px" : "16px"
                  }}
                  className="flex-grow py-3 px-6 text-white font-bold hover:brightness-110 transition duration-300 cursor-pointer flex items-center justify-center gap-2"
                >
                  Buy Now
                </button>

                {features.wishlist && (
                  <button
                    onClick={() => toggleWishlist(selectedProductDetails.id)}
                    className="border border-slate-800 p-3 rounded-2xl hover:bg-slate-500/10 transition cursor-pointer"
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        wishlist.includes(selectedProductDetails.id) ? "fill-red-500 text-red-500" : "text-slate-600"
                      }`}
                    />
                  </button>
                )}

                {/* Share Clipboard toast */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert("Product URL link copied to clipboard!");
                  }}
                  className="border border-slate-800 p-3 rounded-2xl hover:bg-slate-500/10 transition cursor-pointer text-xs font-semibold text-slate-400"
                  title="Copy Product Link"
                >
                  Share
                </button>
              </div>
            </div>
          </div>

          {/* Amazon-style: Frequently Bought Together Bundle Card */}
          {(() => {
            const relatedCandidates = productsList.filter((p) => p.id !== selectedProductDetails.id);
            const bundleItem1 = relatedCandidates[0];
            const bundleItem2 = relatedCandidates[1];

            if (!bundleItem1 || !bundleItem2) return null;

            return (
              <div className={`mt-12 p-6 rounded-3xl border ${
                theme.themeMode === "dark" ? "bg-slate-905 border-slate-800" : "bg-slate-50 border-slate-100"
              }`}>
                <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-1.5 uppercase font-mono text-slate-400">
                  Frequently Bought Together
                </h3>

                <div className="flex flex-col lg:flex-row items-center gap-6 justify-between">
                  {/* Gallery chain layout */}
                  <div className="flex items-center gap-3 md:gap-4 overflow-x-auto max-w-full">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                        <img src={selectedProductDetails.images[0]} alt="" className="w-full h-full object-cover" onError={handleImgError(selectedProductDetails.title)} />
                      </div>
                      <span className="font-bold text-lg text-slate-500">+</span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                        <img src={bundleItem1.images[0]} alt="" className="w-full h-full object-cover" onError={handleImgError(bundleItem1.title)} />
                      </div>
                      <span className="font-bold text-lg text-slate-500">+</span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                        <img src={bundleItem2.images[0]} alt="" className="w-full h-full object-cover" onError={handleImgError(bundleItem2.title)} />
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Action box */}
                  <div className="space-y-3 lg:text-right w-full lg:w-auto">
                    <div className="text-sm">
                      <span className="text-slate-400 block font-mono">Total Bundle Price</span>
                      <span className="text-2xl font-bold font-mono text-indigo-400 block mt-0.5" style={{ color: theme.accentColor }}>
                        {formatMoney(selectedProductDetails.basePrice + bundleItem1.basePrice + bundleItem2.basePrice)}
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        handleAddToCart(selectedProductDetails.id, selectedProductDetails.variants?.[0]?.id);
                        handleAddToCart(bundleItem1.id, bundleItem1.variants?.[0]?.id);
                        handleAddToCart(bundleItem2.id, bundleItem2.variants?.[0]?.id);
                        setIsCartOpen(true);
                      }}
                      style={{ backgroundColor: theme.accentColor }}
                      className="px-6 py-2.5 rounded-full text-white font-semibold text-xs hover:brightness-110 transition cursor-pointer"
                    >
                      Add all three to Cart
                    </button>
                  </div>
                </div>

                {/* Items checkboxes selection */}
                <div className="space-y-2 mt-6 text-xs text-slate-450">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked disabled className="accent-indigo-500" />
                    <span><strong>This item:</strong> {selectedProductDetails.title} — {formatMoney(selectedProductDetails.basePrice)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked disabled className="accent-indigo-500" />
                    <span><strong>Bundle Item 1:</strong> {bundleItem1.title} — {formatMoney(bundleItem1.basePrice)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked disabled className="accent-indigo-500" />
                    <span><strong>Bundle Item 2:</strong> {bundleItem2.title} — {formatMoney(bundleItem2.basePrice)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Slider Row: Similar Products & Customers Also Bought */}
          {recommendations && (
            <div className="space-y-12 mt-12">
              {recommendations.similarProducts && recommendations.similarProducts.length > 0 && (
                <div className="border-t border-slate-800 pt-8">
                  <h4 className="text-sm font-bold tracking-tight mb-4 flex items-center gap-1.5 uppercase font-mono text-slate-400">
                    Similar Products
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {recommendations.similarProducts.map((p: any) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedProductDetails(p);
                          setActiveImageIndex(0);
                          addToRecentlyViewed(p.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="group p-3 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 cursor-pointer text-left flex flex-col justify-between"
                      >
                        <div className="aspect-square rounded-xl overflow-hidden bg-slate-800 relative">
                          <img src={p.images[0]} alt="" className="w-full h-full object-cover transition group-hover:scale-105" onError={handleImgError(p.title)} />
                        </div>
                        <div className="mt-2.5">
                          <span className="text-[9px] font-mono text-slate-500 uppercase block">{p.brand}</span>
                          <h5 className="font-semibold text-xs leading-tight line-clamp-1 group-hover:underline mt-0.5">{p.title}</h5>
                          <span className="font-bold text-xs font-mono block mt-1.5" style={{ color: theme.accentColor }}>{formatMoney(p.basePrice)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recommendations.customersAlsoBought && recommendations.customersAlsoBought.length > 0 && (
                <div className="border-t border-slate-800 pt-8">
                  <h4 className="text-sm font-bold tracking-tight mb-4 flex items-center gap-1.5 uppercase font-mono text-slate-400">
                    Customers Also Bought
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {recommendations.customersAlsoBought.map((p: any) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedProductDetails(p);
                          setActiveImageIndex(0);
                          addToRecentlyViewed(p.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="group p-3 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 cursor-pointer text-left flex flex-col justify-between"
                      >
                        <div className="aspect-square rounded-xl overflow-hidden bg-slate-800 relative">
                          <img src={p.images[0]} alt="" className="w-full h-full object-cover transition group-hover:scale-105" onError={handleImgError(p.title)} />
                        </div>
                        <div className="mt-2.5">
                          <span className="text-[9px] font-mono text-slate-500 uppercase block">{p.brand}</span>
                          <h5 className="font-semibold text-xs leading-tight line-clamp-1 group-hover:underline mt-0.5">{p.title}</h5>
                          <span className="font-bold text-xs font-mono block mt-1.5" style={{ color: theme.accentColor }}>{formatMoney(p.basePrice)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Reviews Submission Form and Lists */}
          {features.reviews && (
            <div className="mt-12 pt-8 border-t border-slate-800">
              <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-2">
                Customer Ratings & Feedback
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: list reviews */}
                <div className="lg:col-span-2 space-y-4">
                  {(reviewsMap[selectedProductDetails.id] || []).length > 0 ? (
                    (reviewsMap[selectedProductDetails.id] || []).map((rev, idx) => (
                      <div key={idx} className="p-4 rounded-2xl bg-slate-500/5 border border-slate-850 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">{rev.customerName[0].toUpperCase()}</span>
                            <span className="font-bold">{rev.customerName}</span>
                          </div>
                          <div className="flex gap-0.5 text-amber-500 font-bold font-mono">
                            {rev.rating} ★
                          </div>
                        </div>
                        <p className="text-slate-400 leading-relaxed mt-2 pl-8">{rev.comment}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-500 py-12">
                      No reviews found for this product. Be the first to share your thoughts!
                    </div>
                  )}
                </div>

                {/* Right: Write Review Trigger Button */}
                <div className={`p-6 rounded-3xl border h-fit space-y-4 text-xs flex flex-col items-center justify-center text-center ${
                  theme.themeMode === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-gray-250 shadow-sm"
                }`}>
                  <h4 className={`font-bold text-sm tracking-tight ${theme.themeMode === "dark" ? "text-slate-200" : "text-slate-800"}`}>Share your thoughts</h4>
                  <p className={`${theme.themeMode === "dark" ? "text-slate-400" : "text-slate-600"}`}>Feedback helps other customers make their shopping decisions.</p>
                  <button
                    onClick={() => setReviewingProduct(selectedProductDetails)}
                    style={{ backgroundColor: theme.accentColor }}
                    className="w-full py-2.5 rounded-full text-white font-bold cursor-pointer hover:brightness-110 transition"
                  >
                    Write a product review
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. CHECKOUT FLOW PANEL */}
      {activeSection === "checkout" && (
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Progress Tracker (Removed per user request) */}

          {checkoutStep < 7 && (
            <button
              onClick={() => {
                if (checkoutStep === 2) setCheckoutStep(1);
                else if (checkoutStep === 5) setCheckoutStep(2);
                else if (checkoutStep === 6) setCheckoutStep(5);
                else setActiveSection("home");
              }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 mb-6 font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {checkoutStep > 1 ? "Previous Step" : "Back to Catalog"}
            </button>
          )}

          <div className="max-w-3xl mx-auto items-start">
            {/* Form Column */}
            <div className="space-y-6">
              {/* STEP 1: AUTHENTICATION */}
              {checkoutStep === 1 && (
                <div className="p-4 lg:p-6 border border-gray-300 rounded-[8px] bg-white text-black mb-6 shadow-sm">
                  <h3 className="text-[18px] font-bold mb-4">
                    1 &nbsp;&nbsp;&nbsp; Customer Authentication
                  </h3>
                  
                  {currentUser ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-[8px] bg-[#f0f2f2] border border-gray-300">
                        <p className="text-[14px] text-gray-800">Logged in as:</p>
                        <h4 className="font-bold text-[16px] mt-1 text-black">{currentUser.name}</h4>
                        <p className="text-[14px] text-gray-600">{currentUser.email} • {currentUser.phone}</p>
                      </div>
                      <div className="flex gap-4 pt-2 items-center">
                        <button
                          onClick={() => setCheckoutStep(2)}
                          className="bg-[#ffd814] hover:bg-[#f7ca00] border border-[#fcd200] rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[14px]"
                        >
                          Continue to Delivery Address
                        </button>
                        <button
                          onClick={() => {
                            setCurrentUser(null);
                            setAuthError(null);
                          }}
                          className="text-[#007185] hover:text-[#c45500] hover:underline text-[14px]"
                        >
                          Change Account
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Tabs */}
                      <div className="flex border-b border-gray-200 mb-6 gap-6">
                        <button
                          onClick={() => setAuthMode("login")}
                          className={`pb-2 text-[16px] font-bold ${authMode === "login" ? "border-b-2 border-[#e77600] text-black" : "text-[#007185] hover:text-[#c45500] hover:underline"}`}
                        >
                          Sign In
                        </button>
                        <button
                          onClick={() => setAuthMode("register")}
                          className={`pb-2 text-[16px] font-bold ${authMode === "register" ? "border-b-2 border-[#e77600] text-black" : "text-[#007185] hover:text-[#c45500] hover:underline"}`}
                        >
                          Create account
                        </button>
                      </div>

                      {authError && (
                        <div className="p-3 mb-4 rounded-[8px] bg-[#fffcf3] border border-[#d6a13d] text-[13px] text-black flex items-center gap-2">
                          <span className="text-[#c40000] font-bold">!</span>
                          {authError}
                        </div>
                      )}

                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (authMode === "login") {
                            if (!authForm.email || !authForm.password) {
                              setAuthError("Email and password are required.");
                              return;
                            }
                            // Mock authorization
                            setCurrentUser({
                              id: "cust-99",
                              name: authForm.email.split("@")[0].toUpperCase(),
                              email: authForm.email,
                              phone: authForm.phone || "Not Provided",
                            });
                          } else {
                            if (!authForm.name || !authForm.email || !authForm.password || !authForm.phone) {
                              setAuthError("All fields are mandatory.");
                              return;
                            }
                            setCurrentUser({
                              id: "cust-new",
                              name: authForm.name,
                              email: authForm.email,
                              phone: authForm.phone,
                            });
                          }
                          setCheckoutStep(2);
                        }} 
                        className="space-y-4 max-w-sm"
                      >
                        {authMode === "register" && (
                          <div>
                            <label className="text-[13px] font-bold block text-black mb-1">Your name</label>
                            <input
                              type="text"
                              required
                              value={authForm.name}
                              onChange={(e) => setAuthForm(p => ({ ...p, name: e.target.value }))}
                              placeholder="First and last name"
                              className="w-full text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#e77600] text-black shadow-sm"
                            />
                          </div>
                        )}
                        <div>
                          <label className="text-[13px] font-bold block text-black mb-1">Email</label>
                          <input
                            type="email"
                            required
                            value={authForm.email}
                            onChange={(e) => setAuthForm(p => ({ ...p, email: e.target.value }))}
                            className="w-full text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#e77600] text-black shadow-sm"
                          />
                        </div>
                        {authMode === "register" && (
                          <div>
                            <label className="text-[13px] font-bold block text-black mb-1">Mobile number</label>
                            <input
                              type="tel"
                              required
                              value={authForm.phone}
                              onChange={(e) => setAuthForm(p => ({ ...p, phone: e.target.value }))}
                              placeholder="Mobile number"
                              className="w-full text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#e77600] text-black shadow-sm"
                            />
                          </div>
                        )}
                        <div>
                          <label className="text-[13px] font-bold block text-black mb-1">Password</label>
                          <input
                            type="password"
                            required
                            value={authForm.password}
                            onChange={(e) => setAuthForm(p => ({ ...p, password: e.target.value }))}
                            placeholder="At least 6 characters"
                            className="w-full text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#e77600] text-black shadow-sm"
                          />
                        </div>

                        <div className="pt-4 space-y-3">
                          <button
                            type="submit"
                            className="w-full bg-[#ffd814] hover:bg-[#f7ca00] border border-[#fcd200] rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[14px]"
                          >
                            {authMode === "login" ? "Sign in" : "Verify email"}
                          </button>
                          
                          <div className="text-[12px] text-gray-700 mt-4">
                            By continuing, you agree to CoreCart's <span className="text-[#007185] hover:text-[#c45500] hover:underline cursor-pointer">Conditions of Use</span> and <span className="text-[#007185] hover:text-[#c45500] hover:underline cursor-pointer">Privacy Notice</span>.
                          </div>

                          <div className="mt-4 pt-4 border-t border-gray-300">
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentUser({
                                  id: "cust-guest",
                                  name: "Guest",
                                  email: "guest@storefront.com",
                                  phone: "+91 00000 00000",
                                });
                                setCheckoutStep(2);
                              }}
                              className="w-full bg-white hover:bg-gray-50 border border-gray-400 rounded-[8px] text-black font-normal py-1 shadow-sm text-[13px] text-center cursor-pointer"
                            >
                              Checkout as Guest
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}
              {/* STEP 2: DELIVERY ADDRESS */}
              {checkoutStep === 2 && (
                <div className="p-4 lg:p-6 border border-gray-300 rounded-[8px] bg-white text-black mb-6 shadow-sm">
                  <h3 className="text-[18px] font-bold mb-4 text-[#c40000]">
                    2 &nbsp;&nbsp;&nbsp; Choose a delivery address
                  </h3>

                  {/* List of Saved Addresses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {savedAddresses.map((addr) => (
                      <div
                        key={addr.id}
                        onClick={() => setSelectedAddressId(addr.id)}
                        className={`p-4 rounded-[8px] border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                          selectedAddressId === addr.id
                            ? "bg-[#fcf8e3] border-[#e77600] shadow-sm ring-1 ring-[#e77600]"
                            : "bg-white border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-[14px]">{addr.name}</span>
                            {addr.isDefault && (
                              <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-[4px]">Default</span>
                            )}
                          </div>
                          <p className="text-gray-800 text-[13px] leading-relaxed">
                            {addr.flatNumber}, {addr.street}<br />
                            {addr.landmark && `${addr.landmark}, `}{addr.city}, {addr.state} {addr.pincode}<br />
                            {addr.country}
                          </p>
                          <p className="text-[13px] text-gray-600 mt-2">Phone number: {addr.phone}</p>
                        </div>

                        <div className="flex justify-start gap-4 mt-4 pt-3 text-[13px] text-[#007185]">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsEditingAddressId(addr.id);
                              setAddressForm(addr);
                              setIsAddingAddress(true);
                            }}
                            className="hover:text-[#c45500] hover:underline"
                          >
                            Edit
                          </button>
                          <span className="text-gray-300">|</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSavedAddresses(prev => prev.filter(x => x.id !== addr.id));
                              if (selectedAddressId === addr.id) {
                                setSelectedAddressId("");
                              }
                            }}
                            className="hover:text-[#c45500] hover:underline"
                          >
                            Remove
                          </button>
                          {!addr.isDefault && (
                            <>
                              <span className="text-gray-300">|</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSavedAddresses(prev => prev.map(x => ({ ...x, isDefault: x.id === addr.id })));
                                }}
                                className="hover:text-[#c45500] hover:underline"
                              >
                                Set as Default
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {!isAddingAddress ? (
                    <button
                      onClick={() => {
                        setAddressForm({
                          name: currentUser?.name || "",
                          phone: currentUser?.phone || "",
                          email: currentUser?.email || "",
                          flatNumber: "",
                          street: "",
                          landmark: "",
                          city: "",
                          state: "",
                          pincode: "",
                          country: "India",
                          isDefault: false,
                        });
                        setIsAddingAddress(true);
                        setIsEditingAddressId(null);
                      }}
                      className="text-[#007185] hover:text-[#c45500] hover:underline text-[14px] font-medium flex items-center gap-2 cursor-pointer mb-6"
                    >
                      + Add a new address
                    </button>
                  ) : (
                    <div className="p-6 border border-gray-300 rounded-[8px] bg-[#f0f2f2] mb-6">
                      <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-300">
                        <h4 className="text-[18px] font-bold">{isEditingAddressId ? "Edit address" : "Add a new address"}</h4>
                        <button onClick={() => setIsAddingAddress(false)} className="text-[14px] text-[#007185] hover:text-[#c45500] hover:underline cursor-pointer">Cancel</button>
                      </div>

                      <div className="space-y-4 max-w-lg">
                        <div>
                          <label className="text-[13px] font-bold text-black block mb-1">Country/Region</label>
                          <select
                            value={addressForm.country}
                            onChange={(e) => setAddressForm(p => ({ ...p, country: e.target.value }))}
                            className="w-full text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e77600]"
                          >
                            <option value="India">India</option>
                            <option value="United States">United States</option>
                            <option value="United Kingdom">United Kingdom</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[13px] font-bold text-black block mb-1">Full name (First and Last name)</label>
                          <input
                            type="text"
                            required
                            value={addressForm.name}
                            onChange={(e) => setAddressForm(p => ({ ...p, name: e.target.value }))}
                            className="w-full text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e77600]"
                          />
                        </div>
                        
                        <div>
                          <label className="text-[13px] font-bold text-black block mb-1">Mobile number</label>
                          <input
                            type="tel"
                            required
                            value={addressForm.phone}
                            onChange={(e) => setAddressForm(p => ({ ...p, phone: e.target.value }))}
                            className="w-full text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e77600]"
                          />
                        </div>

                        <div>
                          <label className="text-[13px] font-bold text-black block mb-1">Flat, House no., Building, Company, Apartment</label>
                          <input
                            type="text"
                            required
                            value={addressForm.flatNumber}
                            onChange={(e) => setAddressForm(p => ({ ...p, flatNumber: e.target.value }))}
                            className="w-full text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e77600]"
                          />
                        </div>

                        <div>
                          <label className="text-[13px] font-bold text-black block mb-1">Area, Street, Sector, Village</label>
                          <input
                            type="text"
                            required
                            value={addressForm.street}
                            onChange={(e) => setAddressForm(p => ({ ...p, street: e.target.value }))}
                            className="w-full text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e77600]"
                          />
                        </div>

                        <div>
                          <label className="text-[13px] font-bold text-black block mb-1">Landmark</label>
                          <input
                            type="text"
                            value={addressForm.landmark}
                            onChange={(e) => setAddressForm(p => ({ ...p, landmark: e.target.value }))}
                            placeholder="E.g. near apollo hospital"
                            className="w-full text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e77600]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[13px] font-bold text-black block mb-1">Pincode</label>
                            <input
                              type="text"
                              required
                              value={addressForm.pincode}
                              onChange={(e) => setAddressForm(p => ({ ...p, pincode: e.target.value }))}
                              className="w-full text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e77600]"
                            />
                          </div>
                          <div>
                            <label className="text-[13px] font-bold text-black block mb-1">Town/City</label>
                            <input
                              type="text"
                              required
                              value={addressForm.city}
                              onChange={(e) => setAddressForm(p => ({ ...p, city: e.target.value }))}
                              className="w-full text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e77600]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[13px] font-bold text-black block mb-1">State</label>
                          <input
                            type="text"
                            required
                            value={addressForm.state}
                            onChange={(e) => setAddressForm(p => ({ ...p, state: e.target.value }))}
                            className="w-full text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e77600]"
                          />
                        </div>
                      </div>

                      <div className="mt-6">
                        <button
                          onClick={() => {
                            if (!addressForm.name || !addressForm.phone || !addressForm.flatNumber || !addressForm.street || !addressForm.pincode || !addressForm.city || !addressForm.state) {
                              alert("Please fill all required address fields.");
                              return;
                            }
                            
                            const newAddr = {
                              ...addressForm,
                              id: isEditingAddressId || `addr-${Date.now()}`
                            };

                            let updatedList = [...savedAddresses];
                            if (newAddr.isDefault) {
                              updatedList = updatedList.map(a => ({ ...a, isDefault: false }));
                            }

                            if (isEditingAddressId) {
                              updatedList = updatedList.map(a => a.id === isEditingAddressId ? newAddr : a);
                            } else {
                              updatedList.push(newAddr);
                            }

                            setSavedAddresses(updatedList);
                            setSelectedAddressId(newAddr.id);
                            setIsAddingAddress(false);
                            setIsEditingAddressId(null);
                          }}
                          className="bg-[#ffd814] hover:bg-[#f7ca00] border border-[#fcd200] rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[14px]"
                        >
                          Use this address
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="bg-[#f0f2f2] p-4 rounded-[4px] flex justify-start gap-4 items-center mt-6">
                    <button
                      onClick={() => setCheckoutStep(1)}
                      className="bg-white hover:bg-gray-50 border border-gray-400 rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[14px]"
                    >
                      Back
                    </button>
                    <button
                      disabled={!selectedAddressId || isAddingAddress}
                      onClick={() => setCheckoutStep(5)}
                      className="bg-[#ffd814] hover:bg-[#f7ca00] border border-[#fcd200] rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue to Payment Method
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: SECURE PAYMENT METHOD */}
              {checkoutStep === 5 && (
                <div className="p-4 lg:p-6 border border-gray-300 rounded-[8px] bg-white mb-6 text-black shadow-lg">
                  <h3 className="text-[20px] font-bold mb-4 text-[#c40000]">Select a payment method</h3>

                  <div className="border border-gray-300 rounded-[8px] overflow-hidden mb-4">
                    <div className="p-4 bg-gray-50 border-b border-gray-300">
                      <h4 className="font-bold text-[14px]">Available payment methods</h4>
                    </div>
                    
                    <div className="p-4">
                      {/* UPI Option */}
                      <div className="flex items-start gap-3 mb-4 p-3 border border-gray-200 rounded-[8px] hover:bg-gray-50 transition-colors">
                        <input 
                          type="radio" 
                          name="payment" 
                          checked={paymentMethod === "upi"} 
                          onChange={() => setPaymentMethod("upi")}
                          className="mt-1 text-[#007185] focus:ring-[#007185]"
                        />
                        <div className="w-full">
                          <span className="text-[14px] font-bold">Other UPI Apps</span>
                          {paymentMethod === "upi" && (
                            <div className="mt-3 bg-white p-3 border border-gray-200 rounded-[8px]">
                              <label className="text-[13px] block mb-1 font-semibold">Please enter your UPI ID</label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="text"
                                  required
                                  value={upiForm?.upiId || ""}
                                  onChange={(e) => setUpiForm(p => ({ ...p, upiId: e.target.value }))}
                                  placeholder="Ex: MobileNumber@upi"
                                  className="w-full max-w-sm text-[14px] p-2 bg-white border border-gray-400 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#e77600] shadow-[0_1px_2px_rgba(0,0,0,0.2)_inset]"
                                />
                                <button className="bg-white border border-gray-400 hover:bg-gray-50 rounded-[8px] px-4 py-2 text-[13px] shadow-sm whitespace-nowrap">Verify</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* COD Option */}
                      <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-[8px] hover:bg-gray-50 transition-colors">
                        <input 
                          type="radio" 
                          name="payment" 
                          checked={paymentMethod === "cod"} 
                          onChange={() => setPaymentMethod("cod")}
                          className="mt-1 text-[#007185] focus:ring-[#007185]"
                        />
                        <div>
                          <span className="text-[14px] font-bold">Cash on Delivery/Pay on Delivery</span>
                          <div className="text-[12px] text-gray-700 mt-1">
                            Scan & Pay using Amazon Pay UPI, or pay cash on delivery. <span className="text-[#007185] hover:underline cursor-pointer">Know more.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#f0f2f2] p-4 rounded-[4px] flex justify-start gap-4 items-center mt-6">
                    <button
                      onClick={() => setCheckoutStep(2)}
                      className="bg-white hover:bg-gray-50 border border-gray-400 rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[14px]"
                    >
                      Back
                    </button>
                    <button
                      disabled={!paymentMethod}
                      onClick={() => setCheckoutStep(6)}
                      className="bg-[#ffd814] hover:bg-[#f7ca00] border border-[#fcd200] rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Use this payment method
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 6: FINAL DETAILS REVIEW */}
              {checkoutStep === 6 && (
                <div className="p-4 lg:p-6 border border-gray-300 rounded-[8px] bg-white mb-6 text-black shadow-lg">
                  <h3 className="text-[20px] font-bold mb-4">Review your order</h3>
                  <p className="text-[14px] mb-4">By placing your order, you agree to {store.name}'s privacy notice and conditions of use.</p>

                  <div className="border border-gray-300 rounded-[8px] overflow-hidden mb-6 flex flex-col md:flex-row text-[14px]">
                    {/* Address Block */}
                    <div className="flex-1 p-4 border-b md:border-b-0 md:border-r border-gray-300">
                      <span className="font-bold block mb-1">Shipping address <button onClick={() => setCheckoutStep(2)} className="text-[#007185] hover:underline hover:text-[#c40000] font-normal text-[13px] ml-1">Change</button></span>
                      {(() => {
                        const activeAddr = savedAddresses.find(a => a.id === selectedAddressId) || savedAddresses[0];
                        if (!activeAddr) return <p className="text-red-600 mt-1">No address selected.</p>;
                        return (
                          <div className="text-gray-700 leading-snug">
                            {activeAddr.name}<br />
                            {activeAddr.flatNumber}, {activeAddr.street}<br />
                            {activeAddr.city}, {activeAddr.state} {activeAddr.pincode}<br />
                            Phone: {activeAddr.phone}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Payment Method Block */}
                    <div className="flex-1 p-4">
                      <span className="font-bold block mb-1">Payment method <button onClick={() => setCheckoutStep(5)} className="text-[#007185] hover:underline hover:text-[#c40000] font-normal text-[13px] ml-1">Change</button></span>
                      <div className="text-gray-700 leading-snug capitalize">
                        {paymentMethod === "cod" ? "Pay on Delivery (Cash/UPI)" : 
                         paymentMethod === "upi" ? `UPI (${upiForm.upiId})` : 
                         paymentMethod}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#f0f2f2] p-4 rounded-[4px] flex justify-between items-center border border-gray-300">
                    <div className="flex gap-4">
                      <button
                        onClick={() => setCheckoutStep(5)}
                        className="bg-white hover:bg-gray-50 border border-gray-400 rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[14px]"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          const { subtotal, discount, tax, shippingFee, grandTotal } = getCheckoutDetails();
                          const activeAddress = savedAddresses.find(a => a.id === selectedAddressId) || savedAddresses[0];
                          if (!activeAddress) {
                            alert("Please select a delivery address.");
                            return;
                          }

                          fetch(`/api/v1/checkout/${cart?.id}/complete`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              "X-Store-Id": store.id,
                            },
                            body: JSON.stringify({
                              shippingAddress: {
                                flatNumber: activeAddress.flatNumber,
                                street: activeAddress.street,
                                landmark: activeAddress.landmark,
                                city: activeAddress.city,
                                state: activeAddress.state,
                                pincode: activeAddress.pincode,
                                country: activeAddress.country,
                              },
                              paymentToken: "tok_visa_mock_" + Math.random().toString().slice(2, 8),
                              customerEmail: activeAddress.email || currentUser?.email || "guest@gmail.com",
                              customerName: activeAddress.name || currentUser?.name || "Guest Customer",
                              customerId: currentUser?.id || "guest-session-123",
                              couponCode: appliedCoupon || undefined,
                              shippingMethod,
                              paymentMethod,
                              grandTotal,
                              tax,
                              shippingFee,
                              discount,
                            }),
                          })
                            .then((res) => {
                              if (!res.ok) throw new Error("Failed to secure order placement.");
                              return res.json();
                            })
                            .then((data) => {
                              if (data.success) {
                                setPlacedOrder(data.order);
                                // Buying keeps the account control available even
                                // after the cart is emptied on success.
                                unlockAccountAfterPurchase();
                                // Fetch a new active cart instead of locking the user to null
                                const sessionId = "guest-session-123";
                                fetch(`/api/v1/cart?storeId=${store.id}&sessionId=${sessionId}`)
                                  .then((res) => res.json())
                                  .then((cartData) => setCart(cartData))
                                  .catch((err) => console.error("Error creating new active cart:", err));
                                setCheckoutStep(7); // Success Step!
                                fetchMyOrders(); // Synchronously load details
                              }
                            })
                            .catch((err) => {
                              console.error("Order placement failed:", err);
                              alert("Failed to register checkout order. Please try again.");
                            });
                        }}
                        className="bg-[#ffd814] hover:bg-[#f7ca00] border border-[#fcd200] rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[14px]"
                      >
                        Place your order
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="text-[#c40000] font-bold text-[18px]">Order total: {formatMoney(getCheckoutDetails().grandTotal)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 7: ORDER SUCCESS */}
              {checkoutStep === 7 && placedOrder && (
                <div className="p-8 border border-gray-300 rounded-[8px] bg-white text-black shadow-lg mb-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full border-2 border-green-600 flex items-center justify-center">
                      <Check className="text-green-600 w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-[20px] font-bold text-green-700">Order placed, thanks!</h3>
                      <p className="text-[14px] text-gray-700">Confirmation will be sent to your registered email.</p>
                    </div>
                  </div>

                  <div className="border border-gray-300 rounded-[8px] p-6 mb-6">
                    <h4 className="font-bold text-[16px] mb-4">Order Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[14px]">
                      <div>
                        <span className="text-gray-500 block mb-1">Order Number</span>
                        <span className="font-bold text-[#007185] hover:underline cursor-pointer">{placedOrder.orderNumber}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-1">Payment Method</span>
                        <span className="font-semibold capitalize">
                          {paymentMethod === "cod" ? "Pay on Delivery" : paymentMethod === "upi" ? "UPI" : paymentMethod}
                        </span>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-gray-500 block mb-1">Shipping Address</span>
                        <div className="text-gray-800">
                          {placedOrder.shippingAddress.flatNumber}, {placedOrder.shippingAddress.street}, {placedOrder.shippingAddress.city}, {placedOrder.shippingAddress.state} {placedOrder.shippingAddress.pincode}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 border-t border-gray-200 pt-6">
                    <button
                      onClick={() => {
                        setActiveSection("account");
                        setActiveAccountTab("orders");
                        setPlacedOrder(null);
                      }}
                      className="bg-[#ffd814] hover:bg-[#f7ca00] border border-[#fcd200] rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[14px]"
                    >
                      Review or edit your recent orders
                    </button>
                    <button
                      onClick={() => {
                        setActiveSection("home");
                        setPlacedOrder(null);
                      }}
                      className="bg-white hover:bg-gray-50 border border-gray-400 rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[14px]"
                    >
                      Continue shopping
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cart Summary Column removed as requested */}
          </div>
        </div>
      )}

      {/* --- 6. CUSTOMER ACCOUNT DASHBOARD --- */}
      {activeSection === "account" && (
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col lg:flex-row gap-8">
            
            {/* Sidebar Controls */}
            <div className="w-full lg:w-1/4 space-y-2">
              <div className={`p-6 rounded-3xl border text-center ${
                theme.themeMode === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-gray-250 shadow-sm"
              }`}>
                <h4 className={`font-bold ${theme.themeMode === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                  {currentUser ? currentUser.name : "Guest Session"}
                </h4>
                <p className={`text-xs mt-0.5 ${theme.themeMode === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                  {currentUser?.email || "Guest User"}
                </p>
                <div className="mt-4 pt-3 border-t border-slate-300/5">
                  <span className="text-[10px] bg-indigo-500/15 text-indigo-500 px-2.5 py-1 rounded-full font-bold font-mono">GOLD ROYALTIES MEMBERSHIP</span>
                </div>
              </div>

              <div className={`border rounded-3xl overflow-hidden p-2 space-y-1 ${
                theme.themeMode === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-gray-250 shadow-sm"
              }`}>
                {[
                  { tab: "profile", label: "My Profile Details", icon: User },
                  { tab: "orders", label: "Order History", icon: Package },
                  { tab: "addresses", label: "Saved Deliveries", icon: MapPin },
                  { tab: "wishlist", label: "Wishlist Folder", icon: Heart }
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.tab}
                      onClick={() => {
                        setActiveAccountTab(t.tab as any);
                        setSelectedOrderForTracking(null);
                        setViewingInvoiceOrder(null);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-2xl transition cursor-pointer text-left ${
                        activeAccountTab === t.tab
                          ? "text-white"
                          : theme.themeMode === "dark"
                          ? "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          : "text-slate-650 hover:bg-gray-100 hover:text-slate-800"
                      }`}
                      style={{ 
                        backgroundColor: activeAccountTab === t.tab ? theme.accentColor : undefined 
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  );
                })}

                <button
                  onClick={() => {
                    setCurrentUser(null);
                    setActiveSection("home");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-2xl text-red-500 hover:bg-red-500/10 transition cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out of Account
                </button>
              </div>
            </div>

            {/* Dashboard Workspace */}
            <div className="flex-grow w-full lg:w-3/4">
              
              {/* Profile Details */}
              {activeAccountTab === "profile" && (
                <div className={`p-8 rounded-3xl border ${
                  theme.themeMode === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-gray-250 text-slate-800 shadow-sm"
                }`}>
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <User className="text-indigo-500" /> Account Identity Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Customer Name</span>
                      <span className={`text-sm font-bold mt-1 block ${theme.themeMode === "dark" ? "text-slate-200" : "text-slate-800"}`}>{currentUser?.name || "Guest User"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Email Address</span>
                      <span className={`text-sm font-bold mt-1 block ${theme.themeMode === "dark" ? "text-slate-200" : "text-slate-800"}`}>{currentUser?.email || "No email"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Mobile Number</span>
                      <span className={`text-sm font-bold mt-1 block ${theme.themeMode === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                        {currentUser?.phone && currentUser.phone !== "Not Provided" ? currentUser.phone : (savedAddresses.length > 0 ? savedAddresses[0].phone : "Not Provided")}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Account Tier Status</span>
                      <span className="text-sm font-bold text-emerald-600 mt-1 block">Active Premium Member</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Order History */}
              {activeAccountTab === "orders" && (
                <div className={`p-4 lg:p-6 rounded-3xl border text-black bg-white border-gray-300 shadow-sm`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 pb-4 border-b border-gray-200">
                    <h3 className="text-2xl font-normal text-slate-900">Your Orders</h3>
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-slate-700">
                      {myOrdersList.length} orders placed
                    </span>
                  </div>

                  {myOrdersList.length > 0 ? (
                    <div className="space-y-4">
                      {myOrdersList.map((order) => {
                        const isExpanded = selectedOrderForTracking?.id === order.id;
                        return (
                          <div key={order.id} className="border border-gray-300 rounded-[8px] overflow-hidden bg-white text-slate-800">
                            {/* Order Header */}
                            <div className="bg-[#f0f2f2] px-4 py-3 border-b border-gray-300 text-[12px] flex flex-wrap justify-between gap-4">
                              <div className="flex gap-12">
                                <div className="flex flex-col">
                                  <span className="text-gray-500 uppercase font-bold tracking-tight">Order Placed</span>
                                  <span className="font-medium text-slate-700">
                                    {(() => {
                                      const d = new Date(order.createdAt);
                                      return (isNaN(d.getTime()) ? new Date() : d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
                                    })()}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-gray-500 uppercase font-bold tracking-tight">Total</span>
                                  <span className="font-bold text-slate-700">{formatMoney(order.grandTotal)}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-gray-500 uppercase font-bold tracking-tight">Ship To</span>
                                  <span className="font-semibold text-[#007185] hover:text-[#c45500] hover:underline cursor-pointer">
                                    {order.shippingAddress?.name || currentUser?.name || "Customer"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-gray-500 uppercase font-bold tracking-tight">Order # {order.orderNumber}</span>
                                <div className="flex gap-2 mt-1">
                                  <button 
                                    onClick={() => setViewingInvoiceOrder(order)}
                                    className="text-[#007185] hover:text-[#c45555] hover:underline font-medium"
                                  >
                                    View Invoice
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Tracking Panel */}
                            {isExpanded && (
                              <div className="px-6 py-6 border-b border-gray-200 bg-gray-50/50">
                                <h4 className="text-[15px] font-bold mb-4">Tracking Progress</h4>
                                <div className="flex items-center justify-between relative max-w-2xl mx-auto">
                                  {[
                                    { label: "Ordered", status: "CONFIRMED" },
                                    { label: "Shipped", status: "SHIPPED" },
                                    { label: "Out for delivery", status: "OUT_FOR_DELIVERY" },
                                    { label: "Delivered", status: "DELIVERED" }
                                  ].map((s, sIdx, sArr) => {
                                    const orderStatusRank = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
                                    const currentRankIdx = orderStatusRank.indexOf(order.status);
                                    const stepRankIdx = orderStatusRank.indexOf(s.status);
                                    const isReached = currentRankIdx >= stepRankIdx && order.status !== "CANCELLED";

                                    return (
                                      <div key={sIdx} className="flex-grow flex items-center">
                                        <div className="flex flex-col items-center relative flex-grow">
                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 ${
                                            isReached ? "bg-green-600 text-white" : "bg-gray-200 text-gray-400"
                                          }`}>
                                            {isReached ? "✓" : ""}
                                          </div>
                                          <span className="text-[12px] mt-2 text-slate-800 font-medium">{s.label}</span>
                                        </div>
                                        {sIdx < sArr.length - 1 && (
                                          <div className={`h-1 w-full -mt-6 ${
                                            isReached && orderStatusRank.indexOf(order.status) > stepRankIdx ? "bg-green-600" : "bg-gray-250"
                                          }`} />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Order Products & Action Section */}
                            <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-6">
                              <div className="md:col-span-3 space-y-4">
                                <h3 className="text-[16px] font-bold text-slate-900">
                                  {order.status === "DELIVERED" ? "Delivered" : order.status === "CANCELLED" ? "Cancelled" : "Arriving soon / Preparing Dispatch"}
                                </h3>
                                
                                {order.items.map((item: any, idx: number) => {
                                  const prod = productsList.find(x => x.id === item.productId);
                                  return (
                                    <div key={idx} className="flex gap-4">
                                      <img src={prod?.images[0]} alt={prod?.title} className="w-16 h-16 object-contain bg-white border border-gray-200 rounded-[4px]" referrerPolicy="no-referrer" onError={handleImgError(prod?.title || "")} />
                                      <div>
                                        <span className="text-[#007185] hover:text-[#c45500] hover:underline text-[14px] font-medium leading-tight block mb-1 cursor-pointer" onClick={() => {
                                              if (prod) {
                                                setSelectedProductDetails(prod);
                                                setActiveImageIndex(0);
                                                setActiveSection("product-details");
                                                window.scrollTo({ top: 0, behavior: "smooth" });
                                              }
                                            }}>
                                          {prod?.title}
                                        </span>
                                        <div className="text-[12px] text-gray-500">
                                          Quantity: {item.quantity} • Sold by: {store.name} Retail
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="flex flex-col gap-2 justify-start border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-4">
                                <button
                                  onClick={() => setSelectedOrderForTracking(isExpanded ? null : order)}
                                  className="w-full bg-[#ffd814] hover:bg-[#f7ca00] border border-[#fcd200] rounded-[8px] text-black font-normal py-1 shadow-sm text-[13px] text-center cursor-pointer"
                                >
                                  {isExpanded ? "Hide tracking" : "Track package"}
                                </button>
                                {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
                                  <button
                                    onClick={() => {
                                      if (confirm("Are you sure you want to cancel this order?")) {
                                        fetch(`/api/v1/orders/${order.id}/status`, {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ status: "CANCELLED" })
                                        })
                                          .then(() => {
                                            fetchMyOrders();
                                            alert("Order Cancelled successfully.");
                                          })
                                          .catch((err) => console.error(err));
                                      }
                                    }}
                                    className="w-full bg-white hover:bg-gray-50 border border-gray-400 rounded-[8px] text-black font-normal py-1 shadow-sm text-[13px] text-center cursor-pointer"
                                  >
                                    Cancel order
                                  </button>
                                )}

                                <button 
                                  onClick={() => {
                                    const firstItem = order.items?.[0];
                                    if (firstItem) {
                                      const p = productsList.find((x) => x.id === firstItem.productId);
                                      if (p) {
                                        setReviewingProduct(p);
                                      }
                                    }
                                  }}
                                  className="w-full bg-white hover:bg-gray-50 border border-gray-400 rounded-[8px] text-black font-normal py-1 shadow-sm text-[13px] text-center cursor-pointer"
                                >
                                  Write a product review
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-20 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                      <Package className="w-12 h-12 opacity-30 text-gray-400" />
                      <p className="text-sm">You have not placed any orders yet.</p>
                      <button 
                        onClick={() => setActiveSection("home")}
                        className="bg-[#ffd814] hover:bg-[#f7ca00] border border-[#fcd200] rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[14px]"
                      >
                        Start Shopping
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Saved Deliveries Address Area */}
              {activeAccountTab === "addresses" && (
                <div className={`p-8 rounded-3xl border ${
                  theme.themeMode === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-gray-250 text-slate-800 shadow-sm"
                }`}>
                  <div className={`flex items-center justify-between mb-6 pb-4 border-b ${theme.themeMode === "dark" ? "border-slate-800" : "border-gray-200"}`}>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <MapPin className="text-indigo-500" /> Saved Shipping Targets
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {savedAddresses.map((addr) => (
                      <div
                        key={addr.id}
                        className={`p-5 rounded-2xl border flex flex-col justify-between ${
                          theme.themeMode === "dark" ? "bg-slate-950/25 border-slate-800" : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-bold text-xs ${theme.themeMode === "dark" ? "text-slate-200" : "text-slate-800"}`}>{addr.name}</span>
                            {addr.isDefault && (
                              <span className="text-[9px] bg-emerald-500/25 text-emerald-600 px-1.5 py-0.5 rounded font-bold font-mono">DEFAULT</span>
                            )}
                          </div>
                          <p className={`text-[11px] leading-relaxed ${theme.themeMode === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                            {addr.flatNumber}, {addr.street}<br />
                            {addr.landmark && `Landmark: ${addr.landmark}, `}{addr.city}, {addr.state} - <span className="font-mono">{addr.pincode}</span><br />
                            Country: {addr.country}
                          </p>
                          <p className="text-[10px] font-mono text-indigo-500 mt-2">{addr.phone}</p>
                        </div>

                        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-300/5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <button 
                            onClick={() => {
                              setAddressForm(addr);
                              setIsAddingAddress(true);
                              setIsEditingAddressId(addr.id);
                            }}
                            className="hover:text-indigo-500 transition cursor-pointer"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => {
                              setSavedAddresses(prev => prev.filter(x => x.id !== addr.id));
                            }}
                            className="hover:text-red-500 transition cursor-pointer text-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Wishlist Folder */}
              {activeAccountTab === "wishlist" && (
                <div className={`p-8 rounded-3xl border ${
                  theme.themeMode === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-gray-250 text-slate-800 shadow-sm"
                }`}>
                  <h3 className={`text-xl font-bold mb-6 pb-4 border-b ${theme.themeMode === "dark" ? "border-slate-800" : "border-gray-200"} flex items-center gap-2`}>
                    <Heart className="text-red-500" /> Wishlist Folder Products
                  </h3>

                  {(() => {
                    const wishlistItems = wishlist
                      .map((id) => productsList.find((p) => p.id === id))
                      .filter((p): p is any => p !== undefined);

                    return wishlistItems.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {wishlistItems.map((item: any) => (
                          <div 
                            key={item.id} 
                            className={`p-4 rounded-2xl border flex gap-4 items-center justify-between ${
                              theme.themeMode === "dark" ? "border-slate-850 bg-slate-950/20" : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <img src={item.images[0]} alt={item.title} className="w-12 h-12 rounded-xl object-cover bg-slate-800" referrerPolicy="no-referrer" onError={handleImgError(item.title)} />
                              <div>
                                <h4 className={`font-bold text-xs ${theme.themeMode === "dark" ? "text-slate-200" : "text-slate-800"}`}>{item.title}</h4>
                                <p className="text-[10px] font-mono text-indigo-500 mt-0.5">{formatMoney(item.basePrice)}</p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <button
                                onClick={() => handleAddToCart(item.id, item.variants?.[0]?.id)}
                                style={{ backgroundColor: theme.accentColor }}
                                className="px-3 py-1 rounded-full text-[9px] text-white font-bold hover:brightness-110 transition cursor-pointer"
                              >
                                + Bag
                              </button>
                              <button
                                onClick={() => handleBuyNow(item.id, item.variants?.[0]?.id)}
                                className={`px-3 py-1 border rounded-full text-[9px] transition cursor-pointer ${
                                  theme.themeMode === "dark" ? "border-slate-800 text-slate-400 hover:text-slate-100" : "border-gray-300 text-slate-600 hover:bg-gray-150"
                                }`}
                              >
                                Buy Now
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-20 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                        <Heart className="w-12 h-12 opacity-30" />
                        <p className="text-sm">Your Wishlist is currently empty.</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* --- 6.5. PRODUCT REVIEW MODAL OVERLAY --- */}
      <AnimatePresence>
        {reviewingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => setReviewingProduct(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="relative w-full max-w-lg bg-white text-slate-800 rounded-2xl overflow-hidden shadow-2xl p-6 z-10 font-sans border border-gray-200"
            >
              <button 
                onClick={() => setReviewingProduct(null)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-[18px] cursor-pointer"
              >
                ✕
              </button>
              <h4 className="font-bold text-[20px] text-[#c40000] mb-2">Create Review</h4>
              <p className="text-[13px] text-gray-650 mb-6 pb-4 border-b border-gray-250">
                Reviewing: <span className="font-bold text-gray-800">{reviewingProduct.title}</span>
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[13px] font-bold text-black block mb-1">Your Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={newReview.name}
                    onChange={(e) => setNewReview((p) => ({ ...p, name: e.target.value }))}
                    className="w-full text-[14px] p-2 bg-white text-black border border-gray-400 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#e77600] shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-bold text-black block mb-1">Overall Rating</label>
                  <select
                    value={newReview.rating}
                    onChange={(e) => setNewReview((p) => ({ ...p, rating: parseInt(e.target.value, 10) }))}
                    className="w-full text-[14px] p-2 bg-white text-black border border-gray-400 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#e77600] shadow-sm"
                  >
                    <option value="5" className="text-black">5 Stars (Excellent)</option>
                    <option value="4" className="text-black">4 Stars (Good)</option>
                    <option value="3" className="text-black">3 Stars (Average)</option>
                    <option value="2" className="text-black">2 Stars (Poor)</option>
                    <option value="1" className="text-black">1 Star (Very Bad)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-bold text-black block mb-1">Add a written review</label>
                  <textarea
                    rows={4}
                    placeholder="What did you like or dislike? What did you use this product for?"
                    value={newReview.comment}
                    onChange={(e) => setNewReview((p) => ({ ...p, comment: e.target.value }))}
                    className="w-full text-[14px] p-2 bg-white text-black border border-gray-400 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#e77600] shadow-sm"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-250 mt-4">
                  <button
                    onClick={() => setReviewingProduct(null)}
                    className="bg-white hover:bg-gray-50 border border-gray-400 rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[13px] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleSubmitReview(reviewingProduct.id);
                      setReviewingProduct(null);
                    }}
                    className="bg-[#ffd814] hover:bg-[#f7ca00] border border-[#fcd200] rounded-[8px] text-black font-normal py-2 px-6 shadow-sm text-[13px] cursor-pointer"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- 7. COMMERCIAL TAX INVOICE RECEIPT MODAL --- */}
      <AnimatePresence>
        {viewingInvoiceOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingInvoiceOrder(null)}
              className="absolute inset-0 bg-black"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white text-slate-900 rounded-3xl overflow-hidden shadow-2xl p-8 z-10 font-sans"
            >
              {/* Invoice Window controls */}
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold font-mono tracking-wider text-slate-500 uppercase">GST Corporate Invoice</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="p-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Invoice
                  </button>
                  <button
                    onClick={() => setViewingInvoiceOrder(null)}
                    className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Invoice Printable Sheet */}
              <div id="tax-invoice-printable-sheet" className="space-y-6 text-slate-800">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900">{store.name} Ltd.</h3>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                      Sector 54, Cyber Park Towers<br />
                      GSTIN ID: <span className="font-mono">07AAACR1293B1ZX</span><br />
                      Support: help@{store.name.toLowerCase().replace(/\s+/g, "")}.in
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 font-mono tracking-wider uppercase block">TAX INVOICE</span>
                    <span className="text-lg font-bold font-mono text-slate-900 block mt-1">{viewingInvoiceOrder.orderNumber}</span>
                    <span className="text-[10px] text-slate-500 block mt-1">Date: {new Date(viewingInvoiceOrder.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[9px] font-mono uppercase text-slate-400 block font-bold">Billed To</span>
                    <p className="text-xs font-bold text-slate-800 mt-1">{viewingInvoiceOrder.customerName}</p>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">{viewingInvoiceOrder.customerEmail}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono uppercase text-slate-400 block font-bold">Delivered Target</span>
                    <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                      {viewingInvoiceOrder.shippingAddress.flatNumber}, {viewingInvoiceOrder.shippingAddress.street},<br />
                      {viewingInvoiceOrder.shippingAddress.city}, {viewingInvoiceOrder.shippingAddress.pincode}
                    </p>
                  </div>
                </div>

                {/* Items Summary Table */}
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-mono uppercase text-slate-400">
                      <th className="py-2.5">Item Description</th>
                      <th className="py-2.5 text-center">Qty</th>
                      <th className="py-2.5 text-right">Unit Price</th>
                      <th className="py-2.5 text-right">AmountSnapshot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingInvoiceOrder.items.map((item: any, idx: number) => {
                      const prod = productsList.find(x => x.id === item.productId);
                      return (
                        <tr key={idx} className="text-slate-700">
                          <td className="py-3">
                            <span className="font-bold text-slate-900 block">{prod?.title}</span>
                            <span className="text-[9px] text-slate-400 block mt-0.5">{prod?.brand}</span>
                          </td>
                          <td className="py-3 text-center font-mono font-bold text-slate-600">{item.quantity}</td>
                          <td className="py-3 text-right font-mono text-slate-600">{formatMoney(item.unitPriceSnapshot)}</td>
                          <td className="py-3 text-right font-mono font-bold text-slate-900">{formatMoney(item.unitPriceSnapshot * item.quantity)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Subtotals & Taxes */}
                <div className="border-t border-slate-200 pt-4 flex justify-end">
                  <div className="w-64 space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-500">
                      <span>Commercial Subtotal</span>
                      <span>{formatMoney(viewingInvoiceOrder.grandTotal - (viewingInvoiceOrder.tax || 0) - (viewingInvoiceOrder.shippingFee || 0) + (viewingInvoiceOrder.discount || 0))}</span>
                    </div>
                    {viewingInvoiceOrder.discount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Coupon Savings</span>
                        <span>-{formatMoney(viewingInvoiceOrder.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-500">
                      <span>GST Tax (18%)</span>
                      <span>{formatMoney(viewingInvoiceOrder.tax || 0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Shipping Handlings</span>
                      <span>{viewingInvoiceOrder.shippingFee === 0 ? "FREE" : formatMoney(viewingInvoiceOrder.shippingFee)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t border-slate-200">
                      <span>TOTAL PAYABLE</span>
                      <span className="text-indigo-600">{formatMoney(viewingInvoiceOrder.grandTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Declarations */}
                <div className="pt-6 border-t border-slate-100 text-[9px] text-slate-400 text-center space-y-1">
                  <p>Computer-generated corporate invoice. No physical signature is required.</p>
                  <p>Thank you for purchasing with {store.name}!</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Customizer Cog Button */}
      <button
        onClick={() => setIsCustomizerOpen(!isCustomizerOpen)}
        className="fixed bottom-6 right-6 z-40 p-4 rounded-full bg-slate-900 border border-slate-800 text-white shadow-2xl hover:bg-slate-850 cursor-pointer flex items-center gap-2 hover:scale-105 transition active:scale-95 duration-200"
        title="Customize Storefront Theme & Layout"
      >
        <Palette className="w-5 h-5 text-indigo-400" />
        <span className="text-xs font-bold font-mono tracking-wider uppercase pr-1">Customize Layout</span>
      </button>

      {/* Sidebar Customizer Drawer */}
      <AnimatePresence>
        {isCustomizerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCustomizerOpen(false)}
              className="absolute inset-0 bg-black/60"
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md h-full bg-[#0b0f19] border-l border-slate-800 text-slate-100 flex flex-col justify-between shadow-2xl z-10 font-sans"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-400" /> Storefront Customizer
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Real-time design overrides</p>
                </div>
                <button
                  onClick={() => setIsCustomizerOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub Navigation Tabs */}
              <div className="flex border-b border-slate-800 overflow-x-auto scrollbar-none text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-950/20">
                {[
                  { tab: "branding", label: "Branding" },
                  { tab: "hero", label: "Hero" },
                  { tab: "layout", label: "Sections" },
                  { tab: "navigation", label: "Navbar" },
                  { tab: "features", label: "Features" },
                  { tab: "history", label: "History" }
                ].map((t) => (
                  <button
                    key={t.tab}
                    onClick={() => setActiveCustomizerTab(t.tab as any)}
                    className={`py-3 px-4 border-b-2 transition flex-shrink-0 cursor-pointer ${
                      activeCustomizerTab === t.tab
                        ? "border-indigo-500 text-white bg-slate-900/50"
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content Body */}
              <div className="flex-grow overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
                {activeCustomizerTab === "branding" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Store Name</label>
                      <input
                        type="text"
                        value={customStoreName}
                        onChange={(e) => setCustomStoreName(e.target.value)}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 block mb-2">Color Palette</label>
                      <div className="space-y-3 p-4 rounded-2xl bg-slate-950/40 border border-slate-800">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px]">Primary Base Color</span>
                            <span className="font-mono text-[10px] text-slate-400">{customBrandIdentity.primaryColor}</span>
                          </div>
                          <input
                            type="color"
                            value={customBrandIdentity.primaryColor}
                            onChange={(e) => setCustomBrandIdentity(p => ({ ...p, primaryColor: e.target.value }))}
                            className="w-full h-8 bg-transparent cursor-pointer rounded overflow-hidden"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px]">Secondary Base Color</span>
                            <span className="font-mono text-[10px] text-slate-400">{customBrandIdentity.secondaryColor}</span>
                          </div>
                          <input
                            type="color"
                            value={customBrandIdentity.secondaryColor}
                            onChange={(e) => setCustomBrandIdentity(p => ({ ...p, secondaryColor: e.target.value }))}
                            className="w-full h-8 bg-transparent cursor-pointer rounded overflow-hidden"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px]">Accent Highlights Color</span>
                            <span className="font-mono text-[10px] text-slate-400">{customBrandIdentity.accentColor}</span>
                          </div>
                          <input
                            type="color"
                            value={customBrandIdentity.accentColor}
                            onChange={(e) => setCustomBrandIdentity(p => ({ ...p, accentColor: e.target.value }))}
                            className="w-full h-8 bg-transparent cursor-pointer rounded overflow-hidden"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 block mb-1.5">Typography Pairing</label>
                      <select
                        value={customBrandIdentity.typography}
                        onChange={(e) => setCustomBrandIdentity(p => ({ ...p, typography: e.target.value }))}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl"
                      >
                        <option value="Inter">Clean Sans (Inter)</option>
                        <option value="Space Grotesk">Tech Editorial (Space Grotesk)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 block mb-1.5">Default Theme Mode</label>
                      <select
                        value={customBrandIdentity.themeMode}
                        onChange={(e) => setCustomBrandIdentity(p => ({ ...p, themeMode: e.target.value }))}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl"
                      >
                        <option value="light">Always Light Mode</option>
                        <option value="dark">Always Dark Mode</option>
                        <option value="system">Auto System preference</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 block mb-1.5">Interactive Button Shape</label>
                      <select
                        value={customButtonStyle}
                        onChange={(e) => setCustomButtonStyle(e.target.value)}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl"
                      >
                        <option value="rounded">Soft Rounded (12px)</option>
                        <option value="square">Sharp Square (0px)</option>
                        <option value="pill">Frictionless Pill (9999px)</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeCustomizerTab === "hero" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Banner Hero Title</label>
                      <input
                        type="text"
                        value={customHomepageConfig.hero.title}
                        onChange={(e) => setCustomHomepageConfig(p => ({
                          ...p,
                          hero: { ...p.hero, title: e.target.value }
                        }))}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Hero Subtitle</label>
                      <textarea
                        rows={3}
                        value={customHomepageConfig.hero.subtitle}
                        onChange={(e) => setCustomHomepageConfig(p => ({
                          ...p,
                          hero: { ...p.hero, subtitle: e.target.value }
                        }))}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Banner Image URL</label>
                      <input
                        type="text"
                        value={customHomepageConfig.hero.backgroundImage}
                        onChange={(e) => setCustomHomepageConfig(p => ({
                          ...p,
                          hero: { ...p.hero, backgroundImage: e.target.value }
                        }))}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Button CTA Text</label>
                        <input
                          type="text"
                          value={customHomepageConfig.hero.ctaText}
                          onChange={(e) => setCustomHomepageConfig(p => ({
                            ...p,
                            hero: { ...p.hero, ctaText: e.target.value }
                          }))}
                          className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Button Link</label>
                        <input
                          type="text"
                          value={customHomepageConfig.hero.ctaLink}
                          onChange={(e) => setCustomHomepageConfig(p => ({
                            ...p,
                            hero: { ...p.hero, ctaLink: e.target.value }
                          }))}
                          className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Footer copyright Text</label>
                      <input
                        type="text"
                        value={customHomepageConfig.footer?.text || ""}
                        onChange={(e) => setCustomHomepageConfig(p => ({
                          ...p,
                          footer: { ...p.footer, text: e.target.value }
                        }))}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {activeCustomizerTab === "layout" && (
                  <div className="space-y-4">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block mb-2">Organize Homepage Sections</span>

                    <div className="space-y-2.5">
                      {customHomepageConfig.sections.map((sec: any, idx: number) => (
                        <div
                          key={sec.id}
                          className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold block text-slate-200 text-xs">
                              {sec.type.replace("_", " ")}
                            </span>
                            <span className="text-[9px] font-mono text-slate-500 block mt-0.5">{sec.id}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => moveSection(idx, "up")}
                              disabled={idx === 0}
                              className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => moveSection(idx, "down")}
                              disabled={idx === customHomepageConfig.sections.length - 1}
                              className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteSection(sec.id)}
                              className="p-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-800 pt-4 mt-6">
                      <span className="text-[10px] font-mono uppercase text-slate-500 block mb-2">Append Page Section</span>
                      <div className="flex gap-2">
                        <select
                          id="add-section-select"
                          className="flex-grow p-2 bg-slate-950 border border-slate-800 rounded-xl"
                        >
                          <option value="CATEGORIES_GRID">Categories Grid</option>
                          <option value="PRODUCT_GRID">Product Catalog Grid</option>
                          <option value="DEALS_BANNER">Promotions Deals Banner</option>
                          <option value="ABOUT_US">CMS Rich Text block</option>
                        </select>
                        <button
                          onClick={() => {
                            const el = document.getElementById("add-section-select") as HTMLSelectElement;
                            if (el) addSection(el.value);
                          }}
                          className="px-4 py-2 bg-indigo-500 text-white text-xs font-bold rounded-xl hover:bg-indigo-650 cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeCustomizerTab === "navigation" && (
                  <div className="space-y-4">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block mb-2">Manage Navbar Navigation Links</span>

                    <div className="space-y-3">
                      {customNavigationConfig.map((nav, idx) => (
                        <div
                          key={nav.id || idx}
                          className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 space-y-3"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-mono uppercase tracking-wider text-slate-505">Navigation Link {idx + 1}</span>
                            <button
                              onClick={() => deleteNavLink(nav.id)}
                              className="text-red-400 hover:text-red-300 font-bold uppercase tracking-wider text-[9px] cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] text-slate-500 block mb-0.5">Label Text</label>
                              <input
                                type="text"
                                value={nav.label}
                                onChange={(e) => {
                                  const updated = [...customNavigationConfig];
                                  updated[idx].label = e.target.value;
                                  setCustomNavigationConfig(updated);
                                }}
                                className="w-full p-2 bg-slate-900 border border-slate-800 rounded focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-slate-505 block mb-0.5">Hyperlink URL</label>
                              <input
                                type="text"
                                value={nav.link}
                                onChange={(e) => {
                                  const updated = [...customNavigationConfig];
                                  updated[idx].link = e.target.value;
                                  setCustomNavigationConfig(updated);
                                }}
                                className="w-full p-2 bg-slate-900 border border-slate-800 rounded focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={addNavLink}
                      className="w-full py-2 border border-dashed border-slate-850 rounded-xl hover:bg-slate-950/40 text-xs font-bold text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    >
                      + Add Navigation Link
                    </button>
                  </div>
                )}

                {activeCustomizerTab === "features" && (
                  <div className="space-y-4">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block mb-2">Storefront Toggle Engines</span>

                    <div className="p-4 rounded-3xl bg-slate-950 border border-slate-850 divide-y divide-slate-900">
                      {[
                        { key: "wishlist", label: "Persistent Wishlist Folders" },
                        { key: "reviews", label: "Feedback Rating Reviews Engine" },
                        { key: "coupons", label: "Promo Coupon Checkout Discount" },
                        { key: "dark_mode", label: "Dark Theme Toggle modes" },
                        { key: "flash_deals", label: "Flash Sale Deals grid banner" }
                      ].map((f) => (
                        <div key={f.key} className="py-3 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-slate-200">{f.label}</span>
                          <input
                            type="checkbox"
                            checked={!!customFeatureToggles[f.key]}
                            onChange={(e) => setCustomFeatureToggles(p => ({ ...p, [f.key]: e.target.checked }))}
                            className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeCustomizerTab === "history" && (
                  <div className="space-y-4">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block mb-2">Configuration Version History Log</span>

                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {versionHistory.length > 0 ? (
                        versionHistory.map((ver: any) => (
                          <div
                            key={ver.id}
                            className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-slate-200 block text-xs">Version v{ver.version}</span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">By {ver.publishedBy}</span>
                              <span className="text-[8px] font-mono text-slate-500 block mt-0.5">{new Date(ver.createdAt).toLocaleString()}</span>
                            </div>
                            <button
                              onClick={() => rollbackToVersion(ver.id)}
                              className="px-2.5 py-1.5 bg-indigo-550/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 rounded-lg text-[10px] font-bold cursor-pointer transition"
                            >
                              Rollback
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-slate-500 py-8">
                          No past layout config versions logged.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Save Operations */}
              <div className="p-6 border-t border-slate-800 flex gap-3 bg-slate-950/40">
                <button
                  onClick={() => {
                    if (confirm("Reset layout modifications back to current published values?")) {
                      setCustomStoreName(store.name);
                      setCustomBrandIdentity({ ...originalTheme });
                      setCustomFeatureToggles({ ...originalFeatures });
                      setCustomHomepageConfig(store.homepageConfig || {});
                      setCustomNavigationConfig(bootstrapData.navigation || []);
                      setCustomButtonStyle(store.buttonStyle || "rounded");
                    }
                  }}
                  className="w-1/3 py-3 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-2xl text-xs font-bold transition duration-350 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Undo className="w-4 h-4" /> Reset
                </button>
                <button
                  onClick={saveLayoutConfig}
                  disabled={isSavingLayout}
                  style={{ backgroundColor: theme.accentColor }}
                  className="w-2/3 py-3 text-white rounded-2xl text-xs font-extrabold hover:brightness-110 disabled:opacity-50 transition duration-350 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/20"
                >
                  {isSavingLayout ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save & Publish Layout
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
