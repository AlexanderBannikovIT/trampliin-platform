"use client";

import { create } from "zustand";
import { User } from "@/types";
import { authApi } from "@/lib/api";
import { useFavoritesStore } from "@/store/favoritesStore";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  init: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  init: async () => {
    try {
      const { data } = await authApi.me();
      set({ user: data, isLoading: false });
      await useFavoritesStore.getState().initForUser();
    } catch {
      set({ user: null, isLoading: false });
      useFavoritesStore.getState().initForGuest();
    }
  },
  logout: async () => {
    await authApi.logout();
    set({ user: null, isLoading: false });
    useFavoritesStore.getState().clearFavorites();
  },
}));
