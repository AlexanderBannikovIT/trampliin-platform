"use client";

import { create } from "zustand";
import { favoritesApi } from "@/lib/api";

const STORAGE_KEY = "trampliin_favorites";

interface FavoritesState {
  ids: Set<string>;
  isAuth: boolean;
  isFavorite: (opportunityId: string) => boolean;
  toggleFavorite: (id: string) => Promise<void>;
  initForUser: () => Promise<void>;
  initForGuest: () => void;
  clearFavorites: () => void;
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

function clearStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: new Set(),
  isAuth: false,

  isFavorite: (id) => get().ids.has(id),

  /** Call after successful login — loads from API, clears any leftover localStorage. */
  initForUser: async () => {
    clearStorage();
    try {
      const { data } = await favoritesApi.list();
      const remote = new Set<string>(
        (data.items ?? []).map((f) => f.opportunity_id)
      );
      set({ ids: remote, isAuth: true });
    } catch {
      set({ ids: new Set(), isAuth: true });
    }
  },

  /** Call on app start when not authenticated. */
  initForGuest: () => {
    set({ ids: readStorage(), isAuth: false });
  },

  /** Call on logout — wipes state and localStorage. */
  clearFavorites: () => {
    clearStorage();
    set({ ids: new Set(), isAuth: false });
  },

  toggleFavorite: async (id) => {
    const { ids, isAuth } = get();
    const next = new Set(ids);
    const removing = ids.has(id);

    if (removing) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ ids: next });

    if (isAuth) {
      try {
        if (removing) {
          await favoritesApi.remove(id);
        } else {
          await favoritesApi.add(id);
        }
      } catch {
        // Revert on failure
        set({ ids });
      }
    } else {
      writeStorage(next);
    }
  },
}));
