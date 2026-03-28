"use client";

import { useEffect, useState } from "react";
import type { GeoJsonFeature, OpportunityType, OpportunityFormat } from "@/types";
import { formatSalary } from "./PopupCard";
import { useFavoritesStore } from "@/store/favoritesStore";

const TYPE_LABELS: Record<OpportunityType, string> = {
  vacancy: "Вакансия",
  internship: "Стажировка",
  mentorship: "Менторство",
  event: "Событие",
};

const FORMAT_LABELS: Record<OpportunityFormat, string> = {
  office: "Офис",
  hybrid: "Гибрид",
  remote: "Удалённо",
};

const TYPE_COLORS: Record<OpportunityType, string> = {
  vacancy: "bg-blue-100 text-blue-700",
  internship: "bg-green-100 text-green-700",
  mentorship: "bg-purple-100 text-purple-700",
  event: "bg-amber-100 text-amber-700",
};

interface OpportunityPreviewProps {
  feature: GeoJsonFeature | null;
  onClose: () => void;
  onOpen: (id: string) => void;
}

export default function OpportunityPreview({ feature, onClose, onOpen }: OpportunityPreviewProps) {
  const { isFavorite, toggleFavorite } = useFavoritesStore();

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!feature) return null;

  const { properties } = feature;
  const salary = formatSalary(properties.salary_min, properties.salary_max);
  const tags = properties.tags.slice(0, 4);
  const isFav = isFavorite(properties.id);

  return (
    <div
      className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden"
      style={
        isMobile
          ? {
              position: "fixed",
              left: 16,
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 1000,
              maxHeight: "80vh",
              overflowY: "auto",
              animation: "previewSlideIn 0.2s ease-out",
            }
          : {
              position: "fixed",
              bottom: 24,
              right: 24,
              width: 320,
              zIndex: 1000,
              animation: "previewSlideIn 0.2s ease-out",
            }
      }
    >
      <style>{`
        @keyframes previewSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-4 pb-3">
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[properties.type]}`}>
            {TYPE_LABELS[properties.type]}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {FORMAT_LABELS[properties.format]}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
          aria-label="Закрыть"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Title */}
      <div className="px-4 pb-3">
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
          {properties.title}
        </p>

        {/* Salary */}
        {salary ? (
          <p className="mt-1.5 text-sm font-medium text-orange-600">{salary}</p>
        ) : (
          <p className="mt-1.5 text-xs text-gray-400">Зарплата не указана</p>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {tag}
            </span>
          ))}
          {properties.tags.length > 4 && (
            <span className="text-xs text-gray-400 self-center">+{properties.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-4 pb-4">
        <button
          onClick={() => onOpen(properties.id)}
          className="flex-1 rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
        >
          Подробнее →
        </button>
        <button
          onClick={() => onOpen(properties.id)}
          className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Откликнуться
        </button>
        <button
          onClick={() => toggleFavorite(properties.id)}
          aria-label={isFav ? "Убрать из избранного" : "В избранное"}
          className="flex-shrink-0 rounded-lg border border-gray-200 px-2.5 py-2 text-sm transition-colors hover:bg-gray-50"
          style={{ color: isFav ? "#BA7517" : "#9CA3AF" }}
        >
          {isFav ? "★" : "☆"}
        </button>
      </div>
    </div>
  );
}
