"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { opportunitiesApi, applicationsApi } from "@/lib/api";
import { useAuthStore } from "@/hooks/useAuth";
import { useFavoritesStore } from "@/store/favoritesStore";
import NavBar from "@/components/NavBar";
import type { Opportunity, OpportunityType, OpportunityFormat } from "@/types";

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

export default function OpportunityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();

  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  useEffect(() => {
    opportunitiesApi
      .get(params.id)
      .then(({ data }) => setOpp(data))
      .catch(() => setError("Возможность не найдена или недоступна"))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleApply() {
    if (!user) {
      router.push(`/auth/login?next=/opportunities/${params.id}`);
      return;
    }
    setApplying(true);
    setApplyError(null);
    try {
      await applicationsApi.apply({ opportunity_id: params.id });
      setApplied(true);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      if (detail === "Already applied") {
        setApplied(true);
      } else {
        setApplyError(detail ?? "Ошибка при отклике. Попробуйте ещё раз.");
      }
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <NavBar />
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
          Загрузка...
        </div>
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <NavBar />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-gray-500">
          <p className="text-sm">{error ?? "Не найдено"}</p>
          <Link href="/" className="text-sm text-orange-500 hover:underline">
            ← На главную
          </Link>
        </div>
      </div>
    );
  }

  const fav = isFavorite(opp.id);

  const salary =
    opp.salary_min || opp.salary_max
      ? [
          opp.salary_min &&
            `от ${opp.salary_min.toLocaleString("ru-RU")} ₽`,
          opp.salary_max && `до ${opp.salary_max.toLocaleString("ru-RU")} ₽`,
        ]
          .filter(Boolean)
          .join(" — ")
      : null;

  const canApply = user?.role === "seeker";

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <NavBar />
      <main className="flex-1 py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Link
            href="/opportunities"
            className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: "#F97316" }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            К списку вакансий
          </Link>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[opp.type]}`}>
                  {TYPE_LABELS[opp.type]}
                </span>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                  {FORMAT_LABELS[opp.format]}
                </span>
              </div>
              <button
                onClick={() => toggleFavorite(opp.id)}
                aria-label={fav ? "Убрать из избранного" : "Добавить в избранное"}
                className={`transition-colors flex-shrink-0 ${fav ? "text-orange-500" : "text-gray-300 hover:text-gray-400"}`}
              >
                <svg className="h-5 w-5" fill={fav ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 leading-snug">{opp.title}</h1>

            {opp.employer && (
              <p className="text-base font-medium text-gray-600">{opp.employer.company_name}</p>
            )}

            {salary && (
              <p className="text-xl font-semibold text-orange-500">{salary}</p>
            )}

            {(opp.city || opp.address) && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{opp.address ?? opp.city}</span>
              </div>
            )}

            {/* Description */}
            {opp.description && (
              <div className="border-t border-gray-100 pt-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Описание</h2>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {opp.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {opp.tags.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Навыки и теги</h2>
                <div className="flex flex-wrap gap-1.5">
                  {opp.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-50 text-orange-600 border border-orange-100"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-4 text-xs text-gray-400">
              <span>
                Опубликовано:{" "}
                {new Date(opp.published_at).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              {opp.expires_at && (
                <span className="text-orange-400">
                  Дедлайн:{" "}
                  {new Date(opp.expires_at).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>

            {/* Apply */}
            <div className="border-t border-gray-100 pt-5 space-y-2">
              {applyError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">
                  {applyError}
                </div>
              )}

              {applied ? (
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 text-center font-medium">
                  Вы откликнулись на эту возможность
                </div>
              ) : canApply ? (
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {applying ? "Отправка отклика..." : "Откликнуться"}
                </button>
              ) : user ? (
                <p className="text-sm text-gray-400 text-center py-2">
                  Только соискатели могут откликаться на возможности
                </p>
              ) : (
                <button
                  onClick={() => router.push(`/auth/login?next=/opportunities/${opp.id}`)}
                  className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
                >
                  Войдите, чтобы откликнуться
                </button>
              )}

              <button
                onClick={() => {
                  toggleFavorite(opp.id);
                  if (!fav) showToast("Добавлено в избранное");
                }}
                className={`w-full rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                  fav ? "border-orange-300 text-orange-500" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {fav ? "★ В избранном" : "☆ В избранное"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
