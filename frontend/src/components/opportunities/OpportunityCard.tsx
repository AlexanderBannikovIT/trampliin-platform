"use client";

import { useRouter } from "next/navigation";
import type { Opportunity, OpportunityType, OpportunityFormat } from "@/types";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useAuthStore } from "@/hooks/useAuth";
import { formatSalary } from "@/components/map/PopupCard";

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

const TYPE_STYLES: Record<OpportunityType, React.CSSProperties> = {
  vacancy:    { background: "#FFF7ED", color: "#F97316", border: "1px solid #FED7AA" },
  internship: { background: "#EFF6FF", color: "#3B82F6", border: "1px solid #BFDBFE" },
  mentorship: { background: "#F5F3FF", color: "#8B5CF6", border: "1px solid #DDD6FE" },
  event:      { background: "#F0FDF4", color: "#22C55E", border: "1px solid #BBF7D0" },
};

const FORMAT_STYLES: Record<OpportunityFormat, React.CSSProperties> = {
  office: { background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0" },
  hybrid: { background: "#F0FDFA", color: "#0D9488", border: "1px solid #99F6E4" },
  remote: { background: "#EFF6FF", color: "#6366F1", border: "1px solid #C7D2FE" },
};

interface OpportunityCardProps {
  opportunity: Opportunity;
  onClick?: () => void;
}

export default function OpportunityCard({ opportunity: opp, onClick }: OpportunityCardProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isFavorite, toggle } = useFavoritesStore();

  const handleClick = onClick ?? (() => router.push(`/opportunities/${opp.id}`));
  const isAuth = user !== null;
  const fav = isFavorite(opp.id);

  const salary = formatSalary(opp.salary_min, opp.salary_max);
  const published = new Date(opp.published_at).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
  const expires = opp.expires_at
    ? new Date(opp.expires_at).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <article
      onClick={handleClick}
      className="group relative flex flex-col cursor-pointer"
      style={{
        background: "white",
        border: "1px solid #E2E8F0",
        borderRadius: 14,
        padding: 20,
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "#F97316";
        el.style.boxShadow = "0 4px 20px rgba(249,115,22,0.1)";
        el.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "#E2E8F0";
        el.style.boxShadow = "none";
        el.style.transform = "translateY(0)";
      }}
    >
      {/* Favorite button */}
      <button
        onClick={(e) => { e.stopPropagation(); toggle(opp.id, isAuth); }}
        aria-label={fav ? "Убрать из избранного" : "Добавить в избранное"}
        className="absolute right-4 top-4 transition-colors"
        style={{ color: fav ? "#F97316" : "#CBD5E1" }}
        onMouseEnter={(e) => { if (!fav) (e.currentTarget as HTMLElement).style.color = "#F97316"; }}
        onMouseLeave={(e) => { if (!fav) (e.currentTarget as HTMLElement).style.color = "#CBD5E1"; }}
      >
        <svg className="h-5 w-5" fill={fav ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5 pr-8">
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={TYPE_STYLES[opp.type]}
        >
          {TYPE_LABELS[opp.type]}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={FORMAT_STYLES[opp.format]}
        >
          {FORMAT_LABELS[opp.format]}
        </span>
      </div>

      {/* Title */}
      <h2
        className="mt-2.5 text-base font-semibold line-clamp-2 transition-colors"
        style={{ color: "#0F172A" }}
      >
        {opp.title}
      </h2>

      {/* Company */}
      {opp.employer && (
        <p className="mt-1 text-sm font-medium" style={{ color: "#6B7280" }}>
          {opp.employer.company_name}
        </p>
      )}

      {/* Salary */}
      {salary && (
        <p className="mt-2 font-semibold" style={{ fontSize: 15, color: "#F97316" }}>
          {salary}
        </p>
      )}

      {/* Description excerpt */}
      {opp.description && (
        <p className="mt-2 text-sm line-clamp-2 leading-relaxed" style={{ color: "#6B7280" }}>
          {opp.description}
        </p>
      )}

      {/* Tags */}
      {opp.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {opp.tags.slice(0, 5).map((tag) => (
            <span
              key={tag.id}
              className="text-xs font-medium"
              style={{
                background: "#F1F5F9",
                color: "#475569",
                borderRadius: 6,
                padding: "3px 8px",
              }}
            >
              {tag.name}
            </span>
          ))}
          {opp.tags.length > 5 && (
            <span
              className="text-xs"
              style={{ background: "#F1F5F9", color: "#94A3B8", borderRadius: 6, padding: "3px 8px" }}
            >
              +{opp.tags.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        className="mt-auto pt-3 flex flex-wrap items-center justify-between gap-2"
        style={{ borderTop: "1px solid #F1F5F9", marginTop: 12 }}
      >
        <div className="flex items-center gap-1 text-xs" style={{ color: "#94A3B8" }}>
          {opp.city && (
            <>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{opp.city}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs" style={{ color: "#94A3B8" }}>
          <span>{published}</span>
          {expires && <span style={{ color: "#F97316" }}>до {expires}</span>}
        </div>
      </div>

      {/* Подробнее button — appears on hover */}
      <div
        className="mt-3 group-hover:opacity-100 transition-opacity"
        style={{ opacity: 0 }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          className="w-full rounded-lg text-white font-medium transition-colors"
          style={{ background: "#F97316", fontSize: 13, padding: "7px 0" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EA6C0A"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F97316"; }}
        >
          Подробнее →
        </button>
      </div>
    </article>
  );
}
