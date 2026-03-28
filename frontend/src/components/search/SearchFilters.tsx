"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { tagsApi } from "@/lib/api";
import CityAutocomplete from "@/components/ui/CityAutocomplete";

const OPPORTUNITY_TYPES = [
  { value: "vacancy", label: "Вакансия" },
  { value: "internship", label: "Стажировка" },
  { value: "mentorship", label: "Менторство" },
  { value: "event", label: "Событие" },
] as const;

const OPPORTUNITY_FORMATS = [
  { value: "office", label: "Офис" },
  { value: "hybrid", label: "Гибрид" },
  { value: "remote", label: "Удалённо" },
] as const;

const SALARY_MAX = 500_000;

interface TagOption {
  id: string;
  name: string;
  category: string | null;
}

export default function SearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local state mirrors URL params
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    searchParams.getAll("type")
  );
  const [selectedFormats, setSelectedFormats] = useState<string[]>(
    searchParams.getAll("format")
  );
  const [salaryMin, setSalaryMin] = useState(
    Number(searchParams.get("salary_min") ?? 0)
  );
  const [salaryMax, setSalaryMax] = useState(
    Number(searchParams.get("salary_max") ?? SALARY_MAX)
  );
  const [city, setCity] = useState(searchParams.get("city") ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    searchParams.getAll("tags")
  );
  const [tagSearch, setTagSearch] = useState("");
  const [tagsOpen, setTagsOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);
  const tagsRef = useRef<HTMLDivElement>(null);

  // Load tags once
  useEffect(() => {
    tagsApi
      .list()
      .then(({ data }) => {
        const tags = Array.isArray(data) ? data : (data as { items?: TagOption[] }).items ?? [];
        setAvailableTags(tags);
      })
      .catch(() => {});
  }, []);

  // Close tags dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (tagsRef.current && !tagsRef.current.contains(e.target as Node)) {
        setTagsOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced URL push
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushParams = useCallback(
    (updates: {
      q: string;
      types: string[];
      formats: string[];
      salaryMin: number;
      salaryMax: number;
      tagIds: string[];
      city: string;
    }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());

        // Reset pagination cursor on any filter change
        params.delete("cursor");

        params.delete("q");
        if (updates.q) params.set("q", updates.q);

        params.delete("type");
        updates.types.forEach((t) => params.append("type", t));

        params.delete("format");
        updates.formats.forEach((f) => params.append("format", f));

        params.delete("salary_min");
        if (updates.salaryMin > 0) params.set("salary_min", String(updates.salaryMin));

        params.delete("salary_max");
        if (updates.salaryMax < SALARY_MAX)
          params.set("salary_max", String(updates.salaryMax));

        params.delete("tags");
        updates.tagIds.forEach((id) => params.append("tags", id));

        params.delete("city");
        if (updates.city) params.set("city", updates.city);

        router.push(`?${params.toString()}`, { scroll: false });
      }, 300);
    },
    [router, searchParams]
  );

  function handleQ(value: string) {
    setQ(value);
    pushParams({ q: value, types: selectedTypes, formats: selectedFormats, salaryMin, salaryMax, tagIds: selectedTagIds, city });
  }

  function toggleType(value: string) {
    const next = selectedTypes.includes(value)
      ? selectedTypes.filter((t) => t !== value)
      : [...selectedTypes, value];
    setSelectedTypes(next);
    pushParams({ q, types: next, formats: selectedFormats, salaryMin, salaryMax, tagIds: selectedTagIds, city });
  }

  function toggleFormat(value: string) {
    const next = selectedFormats.includes(value)
      ? selectedFormats.filter((f) => f !== value)
      : [...selectedFormats, value];
    setSelectedFormats(next);
    pushParams({ q, types: selectedTypes, formats: next, salaryMin, salaryMax, tagIds: selectedTagIds, city });
  }

  function handleSalaryMin(value: number) {
    const clamped = Math.min(value, salaryMax);
    setSalaryMin(clamped);
    pushParams({ q, types: selectedTypes, formats: selectedFormats, salaryMin: clamped, salaryMax, tagIds: selectedTagIds, city });
  }

  function handleSalaryMax(value: number) {
    const clamped = Math.max(value, salaryMin);
    setSalaryMax(clamped);
    pushParams({ q, types: selectedTypes, formats: selectedFormats, salaryMin, salaryMax: clamped, tagIds: selectedTagIds, city });
  }

  function toggleTag(id: string) {
    const next = selectedTagIds.includes(id)
      ? selectedTagIds.filter((t) => t !== id)
      : [...selectedTagIds, id];
    setSelectedTagIds(next);
    pushParams({ q, types: selectedTypes, formats: selectedFormats, salaryMin, salaryMax, tagIds: next, city });
  }

  function handleCity(value: string) {
    setCity(value);
    pushParams({ q, types: selectedTypes, formats: selectedFormats, salaryMin, salaryMax, tagIds: selectedTagIds, city: value });
  }

  function clearAll() {
    setQ("");
    setSelectedTypes([]);
    setSelectedFormats([]);
    setSalaryMin(0);
    setSalaryMax(SALARY_MAX);
    setSelectedTagIds([]);
    setCity("");
    router.push("?", { scroll: false });
  }

  const filteredTags = tagSearch
    ? availableTags.filter((t) =>
        t.name.toLowerCase().includes(tagSearch.toLowerCase())
      )
    : availableTags;

  const CATEGORY_LABELS: Record<string, string> = {
    language: "Язык",
    framework: "Фреймворк",
    level: "Уровень",
    employment: "Занятость",
    direction: "Направление",
  };

  const tagGroups: { label: string; tags: TagOption[] }[] = [];
  const categoryOrder = ["language", "framework", "level", "employment", "direction"];
  for (const cat of categoryOrder) {
    const group = filteredTags.filter((t) => t.category === cat);
    if (group.length > 0) tagGroups.push({ label: CATEGORY_LABELS[cat], tags: group });
  }
  const uncategorized = filteredTags.filter((t) => !t.category || !categoryOrder.includes(t.category));
  if (uncategorized.length > 0) tagGroups.push({ label: "Другое", tags: uncategorized });

  const selectedTagNames = availableTags
    .filter((t) => selectedTagIds.includes(t.id))
    .map((t) => t.name);

  const hasFilters =
    q || selectedTypes.length || selectedFormats.length ||
    salaryMin > 0 || salaryMax < SALARY_MAX || selectedTagIds.length || city;

  return (
    <aside className="flex flex-col gap-5 w-full">
      {/* Text search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Поиск по вакансиям..."
          value={q}
          onChange={(e) => handleQ(e.target.value)}
          className="w-full bg-white pl-9 pr-3 py-2 text-sm placeholder-gray-400 focus:outline-none"
          style={{
            border: "1.5px solid #E2E8F0",
            borderRadius: 10,
            fontSize: 13,
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#F97316";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(249,115,22,0.1)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#E2E8F0";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>

      {/* City */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#F97316" }}>
          Город
        </p>
        <CityAutocomplete
          value={city}
          onChange={handleCity}
          placeholder="Все города"
        />
      </div>

      {/* Types */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#F97316" }}>
          Тип
        </p>
        <div className="flex flex-col gap-1.5">
          {OPPORTUNITY_TYPES.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedTypes.includes(value)}
                onChange={() => toggleType(value)}
                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Formats */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#F97316" }}>
          Формат
        </p>
        <div className="flex flex-col gap-1.5">
          {OPPORTUNITY_FORMATS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedFormats.includes(value)}
                onChange={() => toggleFormat(value)}
                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Salary range */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#F97316" }}>
          Зарплата (₽)
        </p>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={SALARY_MAX}
              step={5000}
              value={salaryMin || ""}
              onChange={(e) => handleSalaryMin(Number(e.target.value))}
              placeholder="от"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
            />
            <input
              type="number"
              min={0}
              max={SALARY_MAX}
              step={5000}
              value={salaryMax === SALARY_MAX ? "" : salaryMax}
              onChange={(e) =>
                handleSalaryMax(e.target.value ? Number(e.target.value) : SALARY_MAX)
              }
              placeholder="до"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
            />
          </div>
          <input
            type="range"
            min={0}
            max={SALARY_MAX}
            step={5000}
            value={salaryMin}
            onChange={(e) => handleSalaryMin(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
        </div>
      </div>

      {/* Tags multiselect */}
      <div ref={tagsRef} className="relative">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#F97316" }}>
          Теги
        </p>
        <button
          type="button"
          onClick={() => setTagsOpen((o) => !o)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm focus:border-orange-400 focus:outline-none"
        >
          {selectedTagNames.length
            ? selectedTagNames.slice(0, 3).join(", ") +
              (selectedTagNames.length > 3
                ? ` +${selectedTagNames.length - 3}`
                : "")
            : "Выбрать теги..."}
        </button>

        {tagsOpen && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="p-2">
              <input
                type="text"
                placeholder="Поиск тегов..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <ul className="max-h-56 overflow-y-auto pb-1">
              {tagGroups.length === 0 && (
                <li className="px-3 py-2 text-sm text-gray-400">Ничего не найдено</li>
              )}
              {tagGroups.map((group) => (
                <li key={group.label}>
                  <p className="px-3 pt-2 pb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {group.label}
                  </p>
                  <ul>
                    {group.tags.map((tag) => (
                      <li key={tag.id}>
                        <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-gray-50 select-none">
                          <input
                            type="checkbox"
                            checked={selectedTagIds.includes(tag.id)}
                            onChange={() => toggleTag(tag.id)}
                            className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                          />
                          <span className="text-sm text-gray-700">{tag.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={clearAll}
          style={{
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            padding: "8px",
            fontSize: 12,
            color: "#6B7280",
            background: "transparent",
            transition: "border-color 0.2s, color 0.2s",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#F97316";
            (e.currentTarget as HTMLElement).style.color = "#F97316";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0";
            (e.currentTarget as HTMLElement).style.color = "#6B7280";
          }}
        >
          Сбросить фильтры
        </button>
      )}
    </aside>
  );
}
