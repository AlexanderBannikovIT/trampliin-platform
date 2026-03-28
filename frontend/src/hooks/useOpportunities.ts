"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { opportunitiesApi } from "@/lib/api";
import type { Opportunity, OpportunityListResponse, SearchParams } from "@/types";

function buildParams(sp: URLSearchParams): SearchParams {
  const params: SearchParams = {};

  const q = sp.get("q");
  if (q) params.q = q;

  const type = sp.get("type");
  if (type) params.type = type as SearchParams["type"];

  const format = sp.get("format");
  if (format) params.format = format as SearchParams["format"];

  const salaryMin = sp.get("salary_min");
  if (salaryMin) params.salary_min = Number(salaryMin);

  const salaryMax = sp.get("salary_max");
  if (salaryMax) params.salary_max = Number(salaryMax);

  const tags = sp.getAll("tags");
  if (tags.length) params.tags = tags;

  const lat = sp.get("lat");
  const lng = sp.get("lng");
  if (lat && lng) {
    params.lat = Number(lat);
    params.lng = Number(lng);
    const radius = sp.get("radius_km");
    params.radius_km = radius ? Number(radius) : 10;
  }

  const city = sp.get("city");
  if (city) params.city = city;

  const sort = sp.get("sort");
  if (sort) params.sort = sort as SearchParams["sort"];

  return params;
}

interface UseOpportunitiesResult {
  data: OpportunityListResponse | null;
  items: Opportunity[];
  isLoading: boolean;
  error: string | null;
  loadMore: () => void;
  hasMore: boolean;
  refresh: () => void;
}

export function useOpportunities(): UseOpportunitiesResult {
  const searchParams = useSearchParams();

  const [data, setData] = useState<OpportunityListResponse | null>(null);
  const [items, setItems] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Track the "base" params (without cursor) to detect filter changes
  const paramsKey = searchParams.toString();
  const prevParamsKey = useRef<string>("");

  const fetchPage = useCallback(
    async (cursorValue: string | null, append: boolean) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = buildParams(new URLSearchParams(searchParams.toString()));
        if (cursorValue) params.cursor = cursorValue;

        console.log("Applying filters:", params);
        const { data: response } = await opportunitiesApi.list(params);
        console.log("API response total:", response.total_count);
        setData(response);
        setHasMore(response.next_cursor !== null);
        setCursor(response.next_cursor);

        if (append) {
          setItems((prev) => [...prev, ...response.items]);
        } else {
          setItems(response.items);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paramsKey]
  );

  // Reset when filters change — debounced 300ms to avoid bursts on rapid typing
  useEffect(() => {
    if (prevParamsKey.current === paramsKey) return;
    prevParamsKey.current = paramsKey;
    setCursor(null);
    setItems([]);
    setData(null);
    const timer = setTimeout(() => fetchPage(null, false), 300);
    return () => clearTimeout(timer);
  }, [paramsKey, fetchPage]);

  // Initial load
  useEffect(() => {
    fetchPage(null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore && cursor) {
      fetchPage(cursor, true);
    }
  }, [isLoading, hasMore, cursor, fetchPage]);

  const refresh = useCallback(() => {
    setCursor(null);
    setItems([]);
    fetchPage(null, false);
  }, [fetchPage]);

  return { data, items, isLoading, error, loadMore, hasMore, refresh };
}
