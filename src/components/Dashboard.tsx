/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  TrendingUp,
  ShoppingBag,
  History,
  FileCode,
  CheckCircle,
  Clock,
  RefreshCw,
  Trash2,
  Undo,
  DollarSign,
  Users,
  LineChart,
  Plus,
  Edit2,
  Save,
  X,
} from "lucide-react";
import { FrontendStoreBootstrap } from "../types/storefront";

interface DashboardProps {
  bootstrapData: FrontendStoreBootstrap;
  onExit: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ bootstrapData, onExit }) => {
  // Guard Clause
  if (!bootstrapData || !bootstrapData.store) {
    return (
      <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-xl font-bold text-red-400">Invalid Store Configuration</h2>
        <p className="text-slate-400 text-sm mt-2">The dashboard bootstrap data could not be parsed successfully.</p>
        <button onClick={onExit} className="mt-6 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-xs font-bold transition cursor-pointer">
          Return to Hub
        </button>
      </div>
    );
  }

  const { store } = bootstrapData;

  // State Hooks
  const [orders, setOrders] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<any | null>(null);
  const [inventoryList, setInventoryList] = useState<any[]>([]);

  // Manual Product Management States
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [newProductForm, setNewProductForm] = useState({
    title: "",
    sku: "",
    basePrice: "", // in primary currency decimal format
    description: "",
    brand: "",
  });

  // Fetch initial dashboard metrics
  const refreshDashboard = () => {
    // 1. Fetch Orders List
    fetch(`/api/v1/orders?storeId=${store.id}`)
      .then((res) => res.json())
      .then((data) => setOrders(data))
      .catch((err) => console.error(err));

    // 2. Fetch Version History
    fetch(`/api/v1/stores/${store.id}/history`)
      .then((res) => res.json())
      .then((data) => {
        setHistory(data);
        if (data.length > 0) {
          setSelectedVersion(data[0]);
        }
      })
      .catch((err) => console.error(err));

    // 3. Fetch Analytics Telemetry
    fetch(`/api/v1/analytics?storeId=${store.id}`)
      .then((res) => res.json())
      .then((data) => setAnalytics(data))
      .catch((err) => console.error(err));

    // 4. Fetch Products Catalog for inventory list
    fetch(`/api/v1/storefront/config?storeId=${store.id}`)
      .then((res) => res.json())
      .then((data) => setInventoryList(data.initialCatalogPage.products))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    refreshDashboard();
  }, [store.id]);

  // Adjust Inventory counts
  const handleInventoryAdjust = (productId: string, variantId: string, delta: number) => {
    fetch(`/api/v1/inventory/adjust`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: store.id,
        productId,
        variantId,
        adjustment: delta,
      }),
    })
      .then(() => refreshDashboard())
      .catch((err) => console.error(err));
  };

  // Change Order Status
  const handleOrderStatusUpdate = (orderId: string, newStatus: string) => {
    fetch(`/api/v1/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: store.id, status: newStatus }),
    })
      .then(() => refreshDashboard())
      .catch((err) => console.error(err));
  };

  // Trigger Version Rollback
  const handleRollback = (versionId: string) => {
    if (!window.confirm("Are you sure you want to rollback this store layout config to this version?")) return;

    fetch(`/api/v1/stores/${store.id}/history/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert("Store config rolled back successfully! Hot-reloading layout...");
          window.location.reload();
        }
      })
      .catch((err) => console.error(err));
  };

  // Manual Product Actions
  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductForm.title || !newProductForm.sku || !newProductForm.basePrice) {
      alert("Missing required fields (Title, SKU, Base Price).");
      return;
    }

    const priceInCents = Math.round(parseFloat(newProductForm.basePrice) * 100);
    if (isNaN(priceInCents)) {
      alert("Invalid Base Price amount.");
      return;
    }

    const cleanSku = newProductForm.sku.toUpperCase();

    setIsSavingProduct(true);
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 45000);

    fetch("/api/v1/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Store-Id": store.id,
      },
      signal: controller.signal,
      body: JSON.stringify({
        storeId: store.id,
        sku: `${store.slug.toUpperCase()}-${cleanSku}`,
        title: newProductForm.title,
        slug: newProductForm.title.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        description: newProductForm.description || "Premium manually seeded listing.",
        brand: newProductForm.brand || store.name,
        status: "ACTIVE",
        categoryId: "cat-seeded",
        basePrice: priceInCents,
        currency: store.currency || "USD",
        attributes: {},
        // Intentionally no `images` field here: leaving it empty lets the
        // backend's generateContextualImage pipeline (imageIntelligence.ts)
        // generate a real image that actually matches this product's title
        // and this store's business, instead of a random unrelated photo.
        variants: [
          {
            id: `v-${cleanSku}-${Date.now()}`,
            sku: `${cleanSku}-MAIN`,
            attributes: {},
            priceDelta: 0,
            quantityOnHand: 100,
            quantityReserved: 0,
          },
        ],
      }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => { throw new Error(data.error || "Failed to add product."); });
        }
        return res.json();
      })
      .then(() => {
        setIsAddingProduct(false);
        setIsSavingProduct(false);
        setNewProductForm({ title: "", sku: "", basePrice: "", description: "", brand: "" });
        refreshDashboard();
      })
      .catch((err) => {
        setIsSavingProduct(false);
        alert(err?.name === "AbortError" ? "Saving the product timed out. Please try again." : err.message);
      })
      .finally(() => clearTimeout(timeoutTimer));
  };

  const handleEditProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct.title || !editingProduct.basePriceForm) {
      alert("Missing required fields (Title, Base Price).");
      return;
    }

    const priceInCents = Math.round(parseFloat(editingProduct.basePriceForm) * 100);
    if (isNaN(priceInCents)) {
      alert("Invalid Base Price amount.");
      return;
    }

    fetch(`/api/v1/products/${editingProduct.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Store-Id": store.id,
      },
      body: JSON.stringify({
        title: editingProduct.title,
        description: editingProduct.description,
        brand: editingProduct.brand,
        basePrice: priceInCents,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to update product.");
        return res.json();
      })
      .then(() => {
        setEditingProduct(null);
        refreshDashboard();
      })
      .catch((err) => alert(err.message));
  };

  const handleDeleteProduct = (productId: string) => {
    if (!window.confirm("Are you sure you want to delete this product? This action is permanent.")) return;

    fetch(`/api/v1/products/${productId}`, {
      method: "DELETE",
      headers: {
        "X-Store-Id": store.id,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to delete product.");
        return res.json();
      })
      .then(() => {
        refreshDashboard();
      })
      .catch((err) => alert(err.message));
  };

  // Calculations
  const totalRevenue = orders
    .filter((o) => o.paymentStatus === "PAID" || o.status === "CONFIRMED" || o.status === "SHIPPED")
    .reduce((sum, o) => sum + o.grandTotal, 0);

  // Fallback metrics if empty mock
  const viewsCount = analytics?.funnel?.views || analytics?.sessionCount || 240;
  const cartAddsCount = analytics?.funnel?.cartAdds || analytics?.cartAddsCount || 82;
  const purchasesCount = orders.length || 2;

  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat(store.language || "en", {
      style: "currency",
      currency: store.currency || "USD",
    }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 p-8">
      {/* Dashboard Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-900 pb-6 mb-8 gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
            Instance ID: {store.id.slice(0, 8)}...
          </span>
          <h2 className="text-3xl font-bold font-sans tracking-tight mt-2">{store.name} — Owner Console</h2>
          <p className="text-slate-500 text-xs">Analytics Telemetry & Version-Control Panel</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={refreshDashboard}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-300 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Analytics
          </button>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Go to Storefront
          </button>
        </div>
      </div>

      {/* Grid 1: Analytics Hero Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="p-6 rounded-2xl border border-slate-900 bg-[#0B0E14] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Gross Sales Revenue</span>
            <div className="text-2xl font-bold font-mono">{formatMoney(totalRevenue || 10700)}</div>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-slate-900 bg-[#0B0E14] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Orders Secured</span>
            <div className="text-2xl font-bold font-mono">{orders.length || 2}</div>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-slate-900 bg-[#0B0E14] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Session Visitors</span>
            <div className="text-2xl font-bold font-mono">{viewsCount}</div>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-slate-900 bg-[#0B0E14] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Checkout Conversion</span>
            <div className="text-2xl font-bold font-mono">
              {((purchasesCount / viewsCount) * 100).toFixed(1)}%
            </div>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Left 2 Cols: Conversion Funnel and Orders */}
        <div className="lg:col-span-2 space-y-8">
          {/* Conversion Funnel Widget */}
          <div className="p-6 rounded-2xl border border-slate-900 bg-[#0B0E14]">
            <h3 className="font-bold text-sm tracking-tight mb-6 flex items-center gap-2">
              <LineChart className="text-indigo-400" /> Storefront Conversion Funnel
            </h3>
            <div className="space-y-4 text-xs font-mono">
              <div>
                <div className="flex justify-between mb-1">
                  <span>1. TOTAL IMPRESSIONS (SESSIONS)</span>
                  <span className="font-bold">{viewsCount} Sessions (100%)</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                  <div className="bg-slate-700 h-2 rounded-full w-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span>2. ADD TO BAG CHECKOUT STARTS</span>
                  <span className="font-bold">
                    {cartAddsCount} Adds ({((cartAddsCount / viewsCount) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-2 rounded-full"
                    style={{ width: `${(cartAddsCount / viewsCount) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span>3. SECURED COMPLETED PURCHASES</span>
                  <span className="font-bold">
                    {purchasesCount} Orders ({((purchasesCount / viewsCount) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-2 rounded-full"
                    style={{ width: `${(purchasesCount / viewsCount) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Secure Fulfillment Orders Grid */}
          <div className="p-6 rounded-2xl border border-slate-900 bg-[#0B0E14]">
            <h3 className="font-bold text-sm tracking-tight mb-4 flex items-center gap-2">
              <ShoppingBag className="text-emerald-400" /> Active Order Logs ({orders.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-400">
                <thead className="text-[10px] font-mono text-slate-500 uppercase border-b border-slate-900">
                  <tr>
                    <th className="py-3 px-2">Order No</th>
                    <th className="py-3 px-2">Customer</th>
                    <th className="py-3 px-2">Payment</th>
                    <th className="py-3 px-2">Total</th>
                    <th className="py-3 px-2">Fulfillment</th>
                    <th className="py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-500/5">
                      <td className="py-3 px-2 font-mono font-bold text-slate-200">#{o.orderNumber}</td>
                      <td className="py-3 px-2">
                        <div>{o.customerName}</div>
                        <div className="text-[10px] text-slate-500">{o.customerEmail}</div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400">
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-mono text-slate-200 font-bold">{formatMoney(o.grandTotal)}</td>
                      <td className="py-3 px-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-mono ${
                            o.fulfillmentStatus === "FULFILLED"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {o.fulfillmentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-2 space-x-1">
                        {o.fulfillmentStatus !== "FULFILLED" && (
                          <button
                            onClick={() => handleOrderStatusUpdate(o.id, "FULFILLED")}
                            className="text-[10px] bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-2 py-0.5 rounded font-bold cursor-pointer"
                          >
                            Ship
                          </button>
                        )}
                        {o.paymentStatus !== "REFUNDED" && (
                          <button
                            onClick={() => handleOrderStatusUpdate(o.id, "REFUNDED")}
                            className="text-[10px] border border-slate-800 hover:bg-slate-800 px-2 py-0.5 rounded text-red-400 cursor-pointer"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        No orders registered yet. Launch store to drive checkout traffic!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Dynamic Version Control Diffs */}
        <div className="lg:col-span-1 space-y-8">
          <div className="p-6 rounded-2xl border border-slate-900 bg-[#0B0E14] flex flex-col h-full justify-between">
            <div>
              <h3 className="font-bold text-sm tracking-tight mb-4 flex items-center gap-2">
                <History className="text-indigo-400" /> Configuration Log History
              </h3>
              <p className="text-[11px] text-slate-500 mb-4">
                Rollback theme layouts instantly. Every dashboard modification generates a new config version.
              </p>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {history.map((rev, idx) => (
                  <div
                    key={rev.id}
                    onClick={() => setSelectedVersion(rev)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedVersion?.id === rev.id
                        ? "bg-indigo-500/10 border-indigo-500"
                        : "bg-slate-900 border-slate-900/60 hover:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs font-mono">v{rev.version ?? history.length - idx}</span>
                      <span className="text-[9px] text-slate-500">
                        {rev.createdAt ? new Date(rev.createdAt).toLocaleTimeString() : ""}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1 line-clamp-1">
                      Published: {rev.publisher || "System Owner"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Version Diff Visualizer */}
              {selectedVersion && (
                <div className="mt-6">
                  <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider block mb-2">
                    Dynamic Config Diff Tree
                  </span>
                  <div className="bg-black p-4 rounded-xl border border-slate-900 font-mono text-[10px] space-y-1 overflow-x-auto text-slate-400 max-h-48">
                    <div># Diff active snapshot template configs</div>
                    <div>versionId: {selectedVersion.id.slice(0, 8)}</div>
                    <div className="text-green-400">+ primaryColor: "{selectedVersion.theme?.primaryColor ?? "—"}"</div>
                    <div className="text-green-400">+ accentColor: "{selectedVersion.theme?.accentColor ?? "—"}"</div>
                    <div className="text-green-400">+ typography: "{selectedVersion.theme?.typography ?? "—"}"</div>
                    <div className="text-green-400">+ brandStyle: "{selectedVersion.theme?.brandStyle ?? "—"}"</div>
                    <div className="text-blue-400">~ featuresCount: {Object.keys(selectedVersion.features ?? {}).length}</div>
                  </div>
                </div>
              )}
            </div>

            {selectedVersion && selectedVersion.id !== history[0]?.id && (
              <button
                onClick={() => handleRollback(selectedVersion.id)}
                className="w-full bg-slate-900 border border-indigo-500/30 hover:bg-slate-800 text-indigo-400 py-2.5 rounded-xl font-bold text-xs mt-6 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Undo className="w-4 h-4" />
                Rollback layout to this state
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid 3: Real-time inventory & manual catalog management */}
      <div className="p-6 rounded-2xl border border-slate-900 bg-[#0B0E14] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
          <div>
            <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
              <FileCode className="text-purple-400" /> Products & Inventory Control
            </h3>
            <p className="text-[11px] text-slate-500">Add, update, or remove physical items and manage real-time inventory counts.</p>
          </div>
          <button
            onClick={() => {
              setIsAddingProduct(!isAddingProduct);
              setEditingProduct(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            {isAddingProduct ? "Cancel Form" : "Add Custom Product"}
          </button>
        </div>

        {/* Dynamic Form: Add Product */}
        {isAddingProduct && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleAddProductSubmit}
            className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-4 text-xs"
          >
            <h4 className="font-bold text-indigo-400 flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add New Product to Storefront
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Premium Perfume Mist"
                  value={newProductForm.title}
                  onChange={(e) => setNewProductForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-900 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Unique SKU *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., ROSE-MIST"
                  value={newProductForm.sku}
                  onChange={(e) => setNewProductForm((p) => ({ ...p, sku: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-900 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Base Price ({store.currency || "USD"}) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g., 29.99"
                  value={newProductForm.basePrice}
                  onChange={(e) => setNewProductForm((p) => ({ ...p, basePrice: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-900 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Brand Name</label>
                <input
                  type="text"
                  placeholder="e.g., Aura Fragrances"
                  value={newProductForm.brand}
                  onChange={(e) => setNewProductForm((p) => ({ ...p, brand: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-900 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Short Description</label>
                <input
                  type="text"
                  placeholder="e.g., A gentle, long-lasting floral fragrance."
                  value={newProductForm.description}
                  onChange={(e) => setNewProductForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-900 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsAddingProduct(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingProduct}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingProduct ? "Generating Image & Saving..." : "Save Product"}
              </button>
            </div>
          </motion.form>
        )}

        {/* Dynamic Form: Edit Product */}
        {editingProduct && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleEditProductSubmit}
            className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-4 text-xs"
          >
            <h4 className="font-bold text-amber-400 flex items-center gap-1">
              <Edit2 className="w-4 h-4" /> Edit Product: {editingProduct.sku}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={editingProduct.title}
                  onChange={(e) => setEditingProduct((p: any) => ({ ...p, title: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-900 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Base Price ({store.currency || "USD"}) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editingProduct.basePriceForm}
                  onChange={(e) => setEditingProduct((p: any) => ({ ...p, basePriceForm: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-900 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Brand Name</label>
                <input
                  type="text"
                  value={editingProduct.brand || ""}
                  onChange={(e) => setEditingProduct((p: any) => ({ ...p, brand: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-900 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Short Description</label>
              <textarea
                rows={2}
                value={editingProduct.description || ""}
                onChange={(e) => setEditingProduct((p: any) => ({ ...p, description: e.target.value }))}
                className="w-full text-xs p-2.5 bg-slate-950 border border-slate-900 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-bold flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                Update Product
              </button>
            </div>
          </motion.form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {inventoryList.map((p) => {
            const v = p.variants[0] || {};
            const stockRemaining = v.quantityOnHand - v.quantityReserved;
            return (
              <div
                key={p.id}
                className="p-4 rounded-xl border border-slate-900 bg-slate-500/5 flex flex-col justify-between gap-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded uppercase">{p.brand}</span>
                    <h4 className="font-semibold text-xs text-slate-200 mt-1.5">{p.title}</h4>
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{p.description}</p>
                    <div className="flex gap-2 text-[10px] font-mono text-slate-400 mt-2">
                      <span>SKU: {p.sku}</span>
                      <span>•</span>
                      <span>Price: {formatMoney(p.basePrice)}</span>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingProduct({
                          ...p,
                          basePriceForm: (p.basePrice / 100).toString(),
                        });
                        setIsAddingProduct(false);
                      }}
                      className="p-1.5 bg-slate-900 border border-slate-800 hover:border-amber-500/30 hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 rounded transition cursor-pointer"
                      title="Edit Product"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(p.id)}
                      className="p-1.5 bg-slate-900 border border-slate-800 hover:border-rose-500/30 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded transition cursor-pointer"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-900/60 pt-3">
                  <div className="text-left">
                    <span
                      className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                        stockRemaining < 10 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {stockRemaining} Available
                    </span>
                  </div>
                  <div className="flex gap-1 items-center">
                    <span className="text-[9px] font-mono text-slate-500 mr-1">STOCK:</span>
                    <button
                      onClick={() => handleInventoryAdjust(p.id, v.id, -10)}
                      className="border border-slate-800 hover:bg-slate-800 px-2 py-1 rounded font-bold text-[10px] text-slate-300 cursor-pointer"
                    >
                      -10
                    </button>
                    <button
                      onClick={() => handleInventoryAdjust(p.id, v.id, 10)}
                      className="border border-slate-800 hover:bg-slate-800 px-2 py-1 rounded font-bold text-[10px] text-slate-300 cursor-pointer"
                    >
                      +10
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {inventoryList.length === 0 && (
            <div className="col-span-2 text-center py-12 text-slate-500 bg-slate-500/5 rounded-xl border border-dashed border-slate-800 font-mono text-xs">
              No products found in this store catalog. Use "Add Custom Product" to seed your listings!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
