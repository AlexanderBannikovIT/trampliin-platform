"use client";

import "leaflet/dist/leaflet.css";
import { Suspense, useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import SearchFilters from "@/components/search/SearchFilters";
import ViewToggle from "@/components/search/ViewToggle";
import OpportunityCard from "@/components/opportunities/OpportunityCard";
import { useOpportunities } from "@/hooks/useOpportunities";
import { useFavoritesStore } from "@/store/favoritesStore";
import type { ViewMode } from "@/types";

const YandexMap = dynamic(() => import("@/components/map/YandexMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-50">
      <span className="text-sm text-gray-400">Загрузка карты...</span>
    </div>
  ),
});

function OpportunitiesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view: ViewMode = (searchParams.get("view") as ViewMode | null) ?? "map";
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data, items, isLoading, error, loadMore, hasMore } = useOpportunities();
  const { ids: favoriteIds } = useFavoritesStore();

  const handleMarkerClick = useCallback(
    (id: string) => { setTimeout(() => router.push(`/opportunities/${id}`), 100); },
    [router]
  );

  function setView(mode: ViewMode) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", mode);
    router.push(`?${p.toString()}`, { scroll: false });
  }

  const totalLabel = data
    ? `${data.total_count.toLocaleString("ru-RU")} рез.`
    : isLoading ? "Поиск..." : "";

  return (
    <div className="flex h-full">

      {/* ── Filter drawer (< 1024px) ────────────────────────────────────────── */}
      {filtersOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 lg:hidden"
            style={{ zIndex: 999, background: "rgba(0,0,0,0.5)" }}
            onClick={() => setFiltersOpen(false)}
          />
          {/* Drawer */}
          <div
            className="fixed bottom-0 left-0 right-0 flex flex-col bg-white lg:hidden"
            style={{ zIndex: 1000, borderRadius: "16px 16px 0 0", maxHeight: "80vh" }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="h-1 w-10 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Фильтры</h2>
              <button
                onClick={() => setFiltersOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Scrollable filter content */}
            <div className="flex-1 overflow-y-auto px-5 pb-2">
              <SearchFilters />
            </div>
            {/* Apply button */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => setFiltersOpen(false)}
                className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
              >
                Применить
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Left filters panel (>= 1024px only) ────────────────────────────── */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col border-r border-gray-100 bg-white overflow-y-auto">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-gray-700">Фильтры</h2>
        </div>
        <div className="px-4 pb-4">
          <SearchFilters />
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Toolbar */}
        <div
          className="flex-shrink-0 flex items-center gap-2 bg-white px-3 md:px-4 py-2 md:py-3"
          style={{ borderBottom: "1px solid #E2E8F0" }}
        >
          {/* Result count */}
          <span className="text-sm text-gray-500 flex-1 min-w-0 truncate">
            {totalLabel}
          </span>

          {/* < 1024px: filters button */}
          <button
            onClick={() => setFiltersOpen(true)}
            className="lg:hidden flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            style={{ height: 36 }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M10 12h4" />
            </svg>
            Фильтры
          </button>

          {/* < 1024px: inline view toggle */}
          <div
            className="lg:hidden flex overflow-hidden border border-gray-200"
            style={{ borderRadius: 8, height: 36 }}
          >
            {(["map", "list"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className="flex-1 flex items-center justify-center gap-1 px-3 text-xs font-medium transition-colors"
                style={{
                  background: view === mode ? "#F97316" : "white",
                  color: view === mode ? "white" : "#4B5563",
                  minWidth: 64,
                }}
              >
                {mode === "map" ? (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Карта
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Список
                  </>
                )}
              </button>
            ))}
          </div>

          {/* >= 1024px: sort select + ViewToggle */}
          <select
            value={searchParams.get("sort") ?? "date"}
            onChange={(e) => {
              const p = new URLSearchParams(searchParams.toString());
              p.set("sort", e.target.value);
              router.push(`?${p.toString()}`, { scroll: false });
            }}
            className="hidden lg:block rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-600 focus:border-orange-400 focus:outline-none"
          >
            <option value="date">По дате</option>
            <option value="salary">По зарплате</option>
            <option value="relevance">По релевантности</option>
          </select>
          <div className="hidden lg:block">
            <ViewToggle value={view} />
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {view === "map" ? (
            /* MAP view */
            <div className="relative flex flex-1 lg:p-4">
              <div
                className="flex-1 min-h-0 overflow-hidden lg:rounded-xl h-[calc(100vh-110px)] lg:h-auto"
                style={{ zIndex: 1 }}
              >
                <YandexMap
                  geoJson={data?.geo_json ?? { type: "FeatureCollection", features: [] }}
                  favoriteIds={favoriteIds}
                  onMarkerClick={handleMarkerClick}
                />
              </div>
            </div>
          ) : (
            /* LIST view */
            <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-gray-50">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-600 mb-4">
                  {error}
                </div>
              )}
              {!isLoading && !error && items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <svg className="h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">Ничего не найдено</p>
                  <p className="text-xs mt-1">Попробуйте изменить фильтры</p>
                </div>
              )}
              <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((opp) => (
                  <OpportunityCard key={opp.id} opportunity={opp} />
                ))}
                {isLoading && Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-gray-100 bg-gray-50 h-52 animate-pulse" />
                ))}
              </div>
              {hasMore && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={isLoading}
                    className="rounded-xl border border-gray-200 px-6 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? "Загрузка..." : "Показать ещё"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Загрузка...
      </div>
    }>
      <OpportunitiesContent />
    </Suspense>
  );
}
