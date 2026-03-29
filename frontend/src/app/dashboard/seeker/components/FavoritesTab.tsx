"use client";

import { useEffect, useState } from "react";
import { opportunitiesApi } from "@/lib/api";
import { useFavoritesStore } from "@/store/favoritesStore";
import OpportunityCard from "@/components/opportunities/OpportunityCard";
import type { Opportunity } from "@/types";

export default function FavoritesTab() {
  const { ids, toggleFavorite } = useFavoritesStore();
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  // Whenever ids change, fetch full opportunity data for each id
  useEffect(() => {
    const idArray = [...ids];
    if (idArray.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.allSettled(
      idArray.slice(0, 20).map((id) => opportunitiesApi.get(id))
    )
      .then((results) => {
        setItems(
          results
            .filter(
              (r): r is PromiseFulfilledResult<{ data: Opportunity }> =>
                r.status === "fulfilled"
            )
            .map((r) => r.value.data)
        );
      })
      .finally(() => setLoading(false));
  }, [ids]);

  async function handleRemove(id: string) {
    await toggleFavorite(id);
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-52 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-gray-400">
        <svg className="h-10 w-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <p className="text-sm">Избранных нет</p>
        <p className="text-xs mt-1">Добавляйте понравившиеся позиции с главной страницы</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((opp) => (
        <div key={opp.id} className="relative group">
          <OpportunityCard opportunity={opp} />
          <button
            onClick={() => handleRemove(opp.id)}
            title="Убрать из избранного"
            className="absolute top-3 right-3 z-10 rounded-full bg-white border border-gray-200 p-1.5 text-gray-400 hover:text-red-500 hover:border-red-200 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
