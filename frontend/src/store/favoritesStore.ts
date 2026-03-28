"use client";

import { create } from "zustand";
import { favoritesApi } from "@/lib/api";

const STORAGE_KEY = "trampliin_favorites";

interface FavoritesState {
  ids: Set<string>;
  isFavorite: (opportunityId: string) => boolean;
  addFavorite: (id: string, isAuth: boolean) => Promise<void>;
  removeFavorite: (id: string, isAuth: boolean) => Promise<void>;
  toggle: (opportunityId: string, isAuthenticated: boolean) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  load: (isAuthenticated: boolean) => Promise<void>;
  syncWithApi: () => Promise<void>;
}

function readStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeStorage(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: new Set(),

  isFavorite: (id) => get().ids.has(id),

  load: async (isAuthenticated) => {
    if (isAuthenticated) {
      try {
        const { data } = await favoritesApi.list();
        const remote = new Set<string>(
          (data.items ?? []).map((f) => f.opportunity_id)
        );
        set({ ids: remote });
      } catch {
        // silently fall back to local
        set({ ids: readStorage() });
      }
    } else {
      set({ ids: readStorage() });
    }
  },

  addFavorite: async (id, isAuth) => {
    const { ids } = get();
    if (ids.has(id)) return;
    const next = new Set(ids);
    next.add(id);
    set({ ids: next });
    if (isAuth) {
      try { await favoritesApi.add(id); } catch { /* ignore */ }
    } else {
      writeStorage(next);
    }
  },

  removeFavorite: async (id, isAuth) => {
    const { ids } = get();
    if (!ids.has(id)) return;
    const next = new Set(ids);
    next.delete(id);
    set({ ids: next });
    if (isAuth) {
      try { await favoritesApi.remove(id); } catch { /* ignore */ }
    } else {
      writeStorage(next);
    }
  },

  toggle: async (id, isAuthenticated) => {
    const { ids, addFavorite, removeFavorite } = get();
    if (ids.has(id)) {
      await removeFavorite(id, isAuthenticated);
    } else {
      await addFavorite(id, isAuthenticated);
    }
  },

  // toggleFavorite — без параметра isAuth: пишет в localStorage И пробует API
  toggleFavorite: async (id) => {
    const { ids } = get();
    const next = new Set(ids);
    if (ids.has(id)) {
      next.delete(id);
      set({ ids: next });
      writeStorage(next);
      try { await favoritesApi.remove(id); } catch { /* ignore */ }
    } else {
      next.add(id);
      set({ ids: next });
      writeStorage(next);
      try { await favoritesApi.add(id); } catch { /* ignore */ }
    }
  },

  /** Call after login to push local favorites to the server, then reload from API. */
  syncWithApi: async () => {
    const local = readStorage();
    // POST each local favorite to the server (ignore errors for already-saved ones)
    await Promise.allSettled([...local].map((id) => favoritesApi.add(id)));
    // Clear local storage now that they're on the server
    localStorage.removeItem(STORAGE_KEY);
    // Reload from server
    try {
      const { data } = await favoritesApi.list();
      const remote = new Set<string>(
        (data.items ?? []).map((f) => f.opportunity_id)
      );
      set({ ids: remote });
    } catch {
      // keep whatever is in state
    }
  },
}));
