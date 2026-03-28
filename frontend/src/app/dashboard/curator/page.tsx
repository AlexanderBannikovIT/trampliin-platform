"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import VerificationQueue from "./components/VerificationQueue";
import ModerationQueue from "./components/ModerationQueue";
import TagsManager from "./components/TagsManager";
import CuratorsManager from "./components/CuratorsManager";

type Section = "verification" | "moderation" | "tags" | "users" | "curators";

interface EmployerItem {
  id: string;
  company_name: string;
  inn: string | null;
  sphere: string | null;
  website: string | null;
  corporate_email: string | null;
  logo_url: string | null;
  verification_status: string;
  display_name: string;
  email: string;
  created_at: string;
  is_suspicious: boolean;
}

interface OppItem {
  id: string;
  employer_id: string;
  company_name: string;
  title: string;
  type: string;
  format: string;
  city: string | null;
  salary_min: number | null;
  salary_max: number | null;
  published_at: string;
  expires_at: string | null;
  status: string;
  moderation_comment: string | null;
}

interface TagItem {
  id: string;
  name: string;
  category: string | null;
}

interface QueueData {
  verification: EmployerItem[];
  moderation: OppItem[];
  tags: TagItem[];
}

interface UserItem {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-50 text-red-700",
  curator: "bg-purple-50 text-purple-700",
  employer: "bg-blue-50 text-blue-700",
  seeker: "bg-green-50 text-green-700",
  guest: "bg-gray-100 text-gray-500",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  curator: "Куратор",
  employer: "Работодатель",
  seeker: "Соискатель",
  guest: "Гость",
};

type AuthUser = { id: string; email: string; display_name: string; role: string };

function CuratorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const section = (searchParams.get("section") as Section | null) ?? "verification";

  const [queue, setQueue] = useState<QueueData | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState<string | null>(null);
  const [userEdits, setUserEdits] = useState<Record<string, Partial<UserItem>>>({});

  useEffect(() => {
    api.get<AuthUser>("/api/v1/auth/me")
      .then((res) => {
        if (!["curator", "admin"].includes(res.data.role)) {
          router.push("/");
        } else {
          setUser(res.data);
          setLoading(false);
        }
      })
      .catch(() => router.push("/auth/login?next=/dashboard/curator"));
  }, []);

  async function loadQueue() {
    try {
      const { data } = await api.get<QueueData>("/api/v1/curator/queue");
      setQueue(data);
    } catch {
      setQueue({ verification: [], moderation: [], tags: [] });
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const params = roleFilter ? `?role=${roleFilter}` : "";
      const { data } = await api.get<UserItem[]>(`/api/v1/curator/users${params}`);
      setUsers(data);
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  useEffect(() => {
    if (section === "users") loadUsers();
  }, [section, roleFilter]);

  function setSection(s: Section) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("section", s);
    router.push(`?${p.toString()}`, { scroll: false });
  }

  async function saveUserEdit(userId: string) {
    const edits = userEdits[userId];
    if (!edits) return;
    setSavingUser(userId);
    try {
      await api.patch(`/api/v1/curator/users/${userId}`, edits);
      setEditingUser(null);
      setUserEdits((prev) => { const c = { ...prev }; delete c[userId]; return c; });
      loadUsers();
    } finally {
      setSavingUser(null);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Загрузка...
      </div>
    );
  }

  const queueCounts = {
    verification: queue?.verification.length ?? 0,
    moderation: queue?.moderation.length ?? 0,
    tags: queue?.tags.length ?? 0,
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-3 bg-white border-b border-gray-100">
        <Link href="/" className="text-xl font-bold tracking-tight text-orange-500">
          Трамплин
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">{user.display_name}</span>
          <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-600">
            {user.role === "admin" ? "Администратор" : "Куратор"}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-56 flex-shrink-0 flex-col py-4 bg-white border-r border-gray-100">
          <nav className="flex flex-col gap-1 px-2">
            {(
              [
                { id: "verification", label: "Верификация" },
                { id: "moderation", label: "Модерация" },
                { id: "tags", label: "Теги" },
                { id: "users", label: "Пользователи" },
              ] as { id: Section; label: string }[]
            ).map(({ id, label }) => {
              const count = queueCounts[id as keyof typeof queueCounts] ?? 0;
              const isActive = section === id;
              return (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors flex items-center justify-between ${
                    isActive ? "bg-orange-50 text-orange-600" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{label}</span>
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold leading-none ${
                      isActive ? "bg-orange-200 text-orange-700" : "bg-orange-100 text-orange-500"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
            {user.role === "admin" && (
              <button
                onClick={() => setSection("curators")}
                className={`rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors ${
                  section === "curators" ? "bg-orange-50 text-orange-600" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Кураторы
              </button>
            )}
          </nav>
        </aside>

        {/* Mobile tabs */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-100 bg-white shadow-lg overflow-x-auto">
          <div className="flex min-w-max px-2">
            {(
              [
                { id: "verification", label: "Верификация" },
                { id: "moderation", label: "Модерация" },
                { id: "tags", label: "Теги" },
                { id: "users", label: "Пользователи" },
                ...(user.role === "admin" ? [{ id: "curators", label: "Кураторы" }] : []),
              ] as { id: Section; label: string }[]
            ).map(({ id, label }) => (
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
          <div className="max-w-4xl mx-auto">

            {/* ── Verification ─────────────────────────────────────────────── */}
            {section === "verification" && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Верификация компаний
                  {queueCounts.verification > 0 && (
                    <span className="ml-2 rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 text-xs">
                      {queueCounts.verification}
                    </span>
                  )}
                </h2>
                {queue ? (
                  <VerificationQueue employers={queue.verification} onRefresh={loadQueue} />
                ) : (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Moderation ────────────────────────────────────────────────── */}
            {section === "moderation" && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Модерация карточек
                  {queueCounts.moderation > 0 && (
                    <span className="ml-2 rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs">
                      {queueCounts.moderation}
                    </span>
                  )}
                </h2>
                {queue ? (
                  <ModerationQueue opportunities={queue.moderation} onRefresh={loadQueue} />
                ) : (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Tags ─────────────────────────────────────────────────────── */}
            {section === "tags" && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-4">Управление тегами</h2>
                {queue ? (
                  <TagsManager pendingTags={queue.tags} onRefresh={loadQueue} />
                ) : (
                  <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />
                )}
              </div>
            )}

            {/* ── Curators ─────────────────────────────────────────────────── */}
            {section === "curators" && user.role === "admin" && (
              <CuratorsManager currentUserId={user.id} />
            )}

            {/* ── Users ────────────────────────────────────────────────────── */}
            {section === "users" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Пользователи</h2>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 focus:outline-none"
                  >
                    <option value="">Все роли</option>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                {usersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100 -mx-2 sm:mx-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-3">Пользователь</th>
                          <th className="px-4 py-3">Роль</th>
                          <th className="px-4 py-3">Статус</th>
                          <th className="px-4 py-3">Дата</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 bg-white">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{u.display_name}</p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </td>
                            <td className="px-4 py-3">
                              {editingUser === u.id ? (
                                <select
                                  value={userEdits[u.id]?.role ?? u.role}
                                  onChange={(e) =>
                                    setUserEdits((prev) => ({
                                      ...prev,
                                      [u.id]: { ...prev[u.id], role: e.target.value },
                                    }))
                                  }
                                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none"
                                >
                                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                                    <option key={v} value={v}>{l}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                                  {ROLE_LABELS[u.role] ?? u.role}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {editingUser === u.id ? (
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={userEdits[u.id]?.is_active ?? u.is_active}
                                    onChange={(e) =>
                                      setUserEdits((prev) => ({
                                        ...prev,
                                        [u.id]: { ...prev[u.id], is_active: e.target.checked },
                                      }))
                                    }
                                    className="h-3.5 w-3.5"
                                  />
                                  <span className="text-xs text-gray-600">Активен</span>
                                </label>
                              ) : (
                                <span className={`text-xs font-medium ${u.is_active ? "text-green-600" : "text-red-500"}`}>
                                  {u.is_active ? "Активен" : "Неактивен"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                              {new Date(u.created_at).toLocaleDateString("ru-RU")}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {editingUser === u.id ? (
                                <div className="flex gap-1.5 justify-end">
                                  <button
                                    disabled={savingUser === u.id}
                                    onClick={() => saveUserEdit(u.id)}
                                    className="text-xs text-green-600 hover:underline disabled:opacity-50"
                                  >
                                    Сохранить
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingUser(null);
                                      setUserEdits((prev) => { const c = { ...prev }; delete c[u.id]; return c; });
                                    }}
                                    className="text-xs text-gray-400 hover:underline"
                                  >
                                    Отмена
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingUser(u.id)}
                                  className="text-xs text-orange-500 hover:underline"
                                >
                                  Изменить
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {users.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                              Пользователи не найдены
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
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

export default function CuratorDashboardPage() {
  return (
    <div className="h-screen">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Загрузка...
          </div>
        }
      >
        <CuratorContent />
      </Suspense>
    </div>
  );
}
