"use client";

import { create } from "zustand";
import { favoritesApi } from "@/lib/api";

const STORAGE_KEY = "trampliin_favorites";

interface FavoritesState {
  ids: Set<string>;
  toggle: (opportunityId: string, isAuthenticated: boolean) => Promise<void>;
  load: (isAuthenticated: boolean) => Promise<void>;
  isFavorite: (opportunityId: string) => boolean;
}

function loadFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveToStorage(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export const useFavorites = create<FavoritesState>((set, get) => ({
  ids: new Set(),

  isFavorite: (id) => get().ids.has(id),

  load: async (isAuthenticated) => {
    if (isAuthenticated) {
      const { data } = await favoritesApi.list();
      const remoteIds = new Set<string>(
        (data.items ?? []).map((f: { opportunity_id: string }) => f.opportunity_id)
      );
      set({ ids: remoteIds });
    } else {
      set({ ids: loadFromStorage() });
    }
  },

  toggle: async (id, isAuthenticated) => {
    const { ids } = get();
    const next = new Set(ids);
    if (next.has(id)) {
      next.delete(id);
      if (isAuthenticated) await favoritesApi.remove(id);
    } else {
      next.add(id);
      if (isAuthenticated) await favoritesApi.add(id);
    }
    set({ ids: next });
    if (!isAuthenticated) saveToStorage(next);
  },
}));
