/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ExternalLink, Plus, Store as StoreIcon, Copy, Check, Trash2 } from "lucide-react";
import { AuthenticatedUser } from "./AuthPage";

interface OwnerStore {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  status: string;
  createdAt: string;
}

interface MyStoresProps {
  currentUser: AuthenticatedUser;
  onExit: () => void;
  onCreateNew: () => void;
  onManageStore: (storeId: string) => void;
}

export const MyStores: React.FC<MyStoresProps> = ({ currentUser, onExit, onCreateNew, onManageStore }) => {
  const [stores, setStores] = useState<OwnerStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/stores?ownerId=${currentUser.id}`)
      .then((res) => res.json())
      .then((data) => setStores(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load stores:", err))
      .finally(() => setIsLoading(false));
  }, [currentUser.id]);

  const copyUrl = (slug: string, id: string) => {
    const url = `${window.location.origin}/store/${slug}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
      })
      .catch(() => {});
  };

  const deleteStore = (storeId: string) => {
    setDeletingId(storeId);
    fetch(`/api/v1/stores/${storeId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: currentUser.id }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to delete store.");
        }
        setStores((prev) => prev.filter((s) => s.id !== storeId));
      })
      .catch((err) => console.error("Failed to delete store:", err))
      .finally(() => {
        setDeletingId(null);
        setConfirmDeleteId(null);
      });
  };

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 px-6 py-10 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-semibold transition px-4 py-2 hover:bg-slate-500/5 rounded-full cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
          </button>
          <button
            onClick={onCreateNew}
            className="bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-full shadow-lg transition duration-300 cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Create New Store
          </button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">Welcome back, {currentUser.name.split(" ")[0]}</h1>
          <p className="text-slate-400 mt-2 text-sm">Manage your storefronts and grab their live links anytime.</p>
        </div>

        {isLoading ? (
          <div className="text-slate-500 text-sm font-mono">Loading your stores...</div>
        ) : stores.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-4"
          >
            <StoreIcon className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm">You haven't created any stores yet.</p>
            <button
              onClick={onCreateNew}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs px-6 py-3 rounded-full transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Launch Your First Store
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {stores.map((store) => {
              const liveUrl = `${window.location.origin}/store/${store.slug}`;
              return (
                <div
                  key={store.id}
                  className="bg-[#0B0E14] border border-slate-900 rounded-2xl p-6 space-y-4 shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-white">{store.name}</h3>
                      <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">
                        {store.businessType}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-1 rounded-full border ${
                        store.status === "ACTIVE"
                          ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                          : "text-amber-400 border-amber-500/30 bg-amber-500/10"
                      }`}
                    >
                      {store.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-black/40 border border-slate-800 rounded-full p-1 pl-3">
                    <span className="flex-grow text-[11px] font-mono text-indigo-300 truncate">{liveUrl}</span>
                    <button
                      onClick={() => copyUrl(store.slug, store.id)}
                      className="p-2 rounded-full hover:bg-slate-800 transition cursor-pointer flex-shrink-0"
                      title="Copy link"
                    >
                      {copiedId === store.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <a
                      href={liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-grow border border-slate-800 hover:bg-slate-500/5 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-full transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Visit
                    </a>
                    <button
                      onClick={() => setConfirmDeleteId(store.id)}
                      title="Delete store"
                      className="border border-red-500/30 hover:bg-red-500/10 text-red-400 font-bold text-xs px-4 py-2.5 rounded-full transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {confirmDeleteId === store.id && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 space-y-2">
                      <p className="text-red-300 text-xs">
                        Delete “{store.name}”? This will take it offline permanently.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => deleteStore(store.id)}
                          disabled={deletingId === store.id}
                          className="flex-grow bg-red-500 hover:bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-full transition cursor-pointer disabled:opacity-60"
                        >
                          {deletingId === store.id ? "Deleting..." : "Yes, delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deletingId === store.id}
                          className="flex-grow border border-slate-800 hover:bg-slate-500/5 text-slate-200 font-bold text-xs px-4 py-2 rounded-full transition cursor-pointer disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
