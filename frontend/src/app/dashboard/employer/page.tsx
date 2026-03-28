"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import dynamic from "next/dynamic";
import CompanyProfile from "./components/CompanyProfile";
import ApplicationsList from "./components/ApplicationsList";

const OpportunityForm = dynamic(
  () => import("./components/OpportunityForm"),
  { ssr: false }
);

type Section = "profile" | "opportunities" | "applications";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "profile", label: "Профиль компании" },
  { id: "opportunities", label: "Возможности" },
  { id: "applications", label: "Отклики" },
];

interface OppRow {
  id: string;
  title: string;
  type: string;
  format: string;
  city: string | null;
  status: string;
  published_at: string;
  salary_min: number | null;
  salary_max: number | null;
  application_count: number;
}

interface Stats {
  total_opportunities: number;
  active_opportunities: number;
  total_applications: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  moderation: "На модерации",
  active: "Активна",
  closed: "Закрыта",
};

const TYPE_LABELS: Record<string, string> = {
  vacancy: "Вакансия",
  internship: "Стажировка",
  mentorship: "Менторство",
  event: "Событие",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  moderation: "bg-yellow-50 text-yellow-700",
  active: "bg-green-50 text-green-700",
  closed: "bg-red-50 text-red-500",
};

function formatSalary(min: number | null, max: number | null): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(n);
  if (min && max) return `${fmt(min)} — ${fmt(max)}`;
  if (min) return `от ${fmt(min)}`;
  if (max) return `до ${fmt(max)}`;
  return "—";
}

type AuthUser = { id: string; email: string; display_name: string; role: string };

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const section = (searchParams.get("section") as Section | null) ?? "profile";

  const [opportunities, setOpportunities] = useState<OppRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<OppRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    api.get<AuthUser>("/api/v1/auth/me")
      .then((res) => {
        if (res.data.role !== "employer") {
          router.push("/");
        } else {
          setUser(res.data);
          setLoading(false);
        }
      })
      .catch(() => router.push("/auth/login?next=/dashboard/employer"));
  }, []);

  async function loadOpportunities() {
    const params = statusFilter ? `?status=${statusFilter}` : "";
    const { data } = await api.get<OppRow[]>(`/api/v1/employer/opportunities${params}`);
    setOpportunities(data);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Удалить вакансию? Это действие необратимо.")) return;
    try {
      await api.delete(`/api/v1/opportunities/${id}`);
      setOpportunities((prev) => prev.filter((o) => o.id !== id));
    } catch {
      alert("Не удалось удалить вакансию. Попробуйте ещё раз.");
    }
  }

  useEffect(() => {
    api
      .get<Stats>("/api/v1/employer/stats")
      .then(({ data }) => setStats(data))
      .catch(() => {});
    loadOpportunities();
  }, []);

  useEffect(() => {
    if (section === "opportunities") loadOpportunities();
  }, [section, statusFilter]);

  function setSection(s: Section) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("section", s);
    router.push(`?${p.toString()}`, { scroll: false });
  }

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-3 bg-white border-b border-gray-100">
        <Link href="/" className="text-xl font-bold tracking-tight text-orange-500">
          Трамплин
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">{user.display_name}</span>
          <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600">
            Работодатель
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-56 flex-shrink-0 flex-col py-4 bg-white border-r border-gray-100">
          <nav className="flex flex-col gap-1 px-2">
            {SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors ${
                  section === id
                    ? "bg-orange-50 text-orange-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile tabs */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-100 bg-white shadow-lg overflow-x-auto">
          <div className="flex min-w-max px-2">
            {SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`flex-shrink-0 px-5 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
                  section === id ? "text-orange-500 border-t-2 border-orange-500 -mt-px" : "text-gray-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* ── Stats banner (always visible) ─────────────────────────── */}
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Всего возможностей", value: stats.total_opportunities },
                  { label: "Активных", value: stats.active_opportunities },
                  { label: "Откликов получено", value: stats.total_applications },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm">
                    <p className="text-2xl font-bold text-orange-500">{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Section: Profile ───────────────────────────────────────── */}
            {section === "profile" && <CompanyProfile />}

            {/* ── Section: Opportunities ────────────────────────────────── */}
            {section === "opportunities" && (
              <div>
                {showForm || editingId ? (
                  <OpportunityForm
                    opportunityId={editingId ?? undefined}
                    onSuccess={() => {
                      setShowForm(false);
                      setEditingId(null);
                      loadOpportunities();
                    }}
                    onCancel={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-base font-semibold text-gray-900">Мои возможности</h2>
                      <button
                        onClick={() => setShowForm(true)}
                        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
                      >
                        + Создать
                      </button>
                    </div>

                    {/* Search and filters */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <input
                        type="text"
                        placeholder="Поиск по названию..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-orange-400 focus:outline-none flex-1 min-w-[160px]"
                      />
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 focus:outline-none"
                      >
                        <option value="">Все статусы</option>
                        {Object.entries(STATUS_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 focus:outline-none"
                      >
                        <option value="">Все типы</option>
                        {Object.entries(TYPE_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>

                    {opportunities.length === 0 ? (
                      <div className="flex flex-col items-center py-16 text-gray-400">
                        <p className="text-sm">Возможностей нет</p>
                        <button
                          onClick={() => setShowForm(true)}
                          className="mt-3 text-sm text-orange-500 hover:underline"
                        >
                          Создать первую
                        </button>
                      </div>
                    ) : (() => {
                      const filtered = opportunities.filter((o) => {
                        const matchesSearch = !searchQuery || o.title.toLowerCase().includes(searchQuery.toLowerCase());
                        const matchesType = !typeFilter || o.type === typeFilter;
                        return matchesSearch && matchesType;
                      });
                      return filtered.length === 0 ? (
                        <p className="py-8 text-center text-sm text-gray-400">Ничего не найдено</p>
                      ) : (
                        <div className="space-y-2">
                          {filtered.map((opp) => (
                            <div
                              key={opp.id}
                              className="rounded-xl border border-gray-100 bg-white px-4 py-3 hover:border-gray-200 transition-colors overflow-x-auto"
                            >
                              <div className="flex items-start justify-between gap-3 min-w-[420px] sm:min-w-0">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-gray-900 truncate">{opp.title}</p>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[opp.status] ?? "bg-gray-100 text-gray-600"}`}>
                                      {STATUS_LABELS[opp.status] ?? opp.status}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 flex gap-3 text-xs text-gray-400">
                                    {opp.city && <span>{opp.city}</span>}
                                    <span>{formatSalary(opp.salary_min, opp.salary_max)}</span>
                                    <span>{opp.application_count} откликов</span>
                                  </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => {
                                      setSelectedOpp(opp);
                                      setSection("applications");
                                    }}
                                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                                  >
                                    Отклики
                                  </button>
                                  <button
                                    onClick={() => setEditingId(opp.id)}
                                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                                  >
                                    Изменить
                                  </button>
                                  <button
                                    onClick={() => handleDelete(opp.id)}
                                    className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors"
                                  >
                                    Удалить
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* ── Section: Applications ─────────────────────────────────── */}
            {section === "applications" && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-4">Отклики</h2>
                {selectedOpp ? (
                  <>
                    <button
                      onClick={() => setSelectedOpp(null)}
                      className="text-sm text-gray-500 hover:text-gray-700 mb-3"
                    >
                      ← Все возможности
                    </button>
                    <ApplicationsList
                      opportunityId={selectedOpp.id}
                      opportunityTitle={selectedOpp.title}
                    />
                  </>
                ) : (
                  <div className="space-y-2">
                    {opportunities.length === 0 && (
                      <p className="text-sm text-gray-400">Нет возможностей</p>
                    )}
                    {opportunities.map((opp) => (
                      <button
                        key={opp.id}
                        onClick={() => setSelectedOpp(opp)}
                        className="w-full rounded-xl border border-gray-100 bg-white px-4 py-3 text-left hover:border-orange-200 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">{opp.title}</p>
                          <span className="text-xs text-gray-400">
                            {opp.application_count} откликов →
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function EmployerDashboardPage() {
  return (
    <div className="h-screen">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Загрузка...
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </div>
  );
}
