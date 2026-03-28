"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface Tag {
  id: string;
  name: string;
  category: string | null;
  is_active: boolean;
}

interface Props {
  pendingTags: Tag[];
  onRefresh: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  language: "Язык",
  framework: "Фреймворк",
  level: "Уровень",
  employment: "Занятость",
  direction: "Направление",
};

const CATEGORY_COLORS: Record<string, string> = {
  language: "bg-blue-50 text-blue-700",
  framework: "bg-purple-50 text-purple-700",
  level: "bg-yellow-50 text-yellow-700",
  employment: "bg-green-50 text-green-700",
  direction: "bg-orange-50 text-orange-700",
};

const CATEGORY_OPTIONS = [
  { value: "language",  label: "Язык" },
  { value: "framework", label: "Фреймворк" },
  { value: "level",     label: "Уровень" },
  { value: "employment",label: "Занятость" },
  { value: "direction", label: "Направление" },
] as const;

export default function TagsManager({ pendingTags, onRefresh }: Props) {
  const [activeTags, setActiveTags] = useState<Tag[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ── Create tag form ──
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    api
      .get<{ items: Tag[]; total: number }>("/api/v1/tags/all")
      .then(({ data }) => setActiveTags(data.items))
      .catch(() => {});
  }, [pendingTags]);

  async function handleModerateTag(id: string, action: "approve" | "reject") {
    setSubmitting(id);
    try {
      await api.patch(`/api/v1/curator/tags/${id}`, { action });
      onRefresh();
    } finally {
      setSubmitting(null);
    }
  }

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const { data } = await api.post<Tag>("/api/v1/tags/admin", {
        name: newName.trim(),
        category: newCategory || null,
      });
      setActiveTags((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewCategory("");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCreateError(detail === "Tag already exists" ? "Тег с таким названием уже существует" : (detail ?? "Ошибка создания тега"));
    } finally {
      setCreating(false);
    }
  }

  async function handleDeactivateTag(id: string) {
    setSubmitting(id);
    try {
      // Mark as inactive via curator update — use the tag rejection as deactivation
      await api.patch(`/api/v1/curator/tags/${id}`, { action: "reject" });
      setActiveTags((prev) => prev.filter((t) => t.id !== id));
      onRefresh();
    } finally {
      setSubmitting(null);
    }
  }

  const filteredActive = activeTags.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.category ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* ── Create tag form ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Добавить тег</h3>
        <form onSubmit={handleCreateTag} className="flex flex-wrap items-start gap-2">
          <div className="flex-1 min-w-[160px]">
            <input
              type="text"
              placeholder="Название тега"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setCreateError(""); }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              required
            />
          </div>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 focus:border-orange-400 focus:outline-none"
          >
            <option value="">— Категория —</option>
            {CATEGORY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {creating ? "Добавление..." : "Добавить тег"}
          </button>
          {createError && (
            <p className="w-full text-xs text-red-500 mt-1">{createError}</p>
          )}
        </form>
      </div>

      {/* Pending section */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Предложенные теги ({pendingTags.length})
        </h3>
        {pendingTags.length === 0 ? (
          <p className="text-sm text-gray-400">Нет тегов на одобрении</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pendingTags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 pl-3 pr-1.5 py-1"
              >
                <span className="text-sm font-medium text-yellow-800">{tag.name}</span>
                {tag.category && (
                  <span className="text-xs text-yellow-600 opacity-75">{CATEGORY_LABELS[tag.category] ?? tag.category}</span>
                )}
                <div className="flex gap-1 ml-1">
                  <button
                    disabled={submitting === tag.id}
                    onClick={() => handleModerateTag(tag.id, "approve")}
                    title="Одобрить"
                    className="rounded-full bg-green-100 text-green-700 hover:bg-green-200 h-5 w-5 flex items-center justify-center text-xs font-bold disabled:opacity-50"
                  >
                    ✓
                  </button>
                  <button
                    disabled={submitting === tag.id}
                    onClick={() => handleModerateTag(tag.id, "reject")}
                    title="Отклонить"
                    className="rounded-full bg-red-100 text-red-600 hover:bg-red-200 h-5 w-5 flex items-center justify-center text-xs font-bold disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active tags table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Активные теги ({activeTags.length})
          </h3>
          <input
            type="text"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-orange-400 w-44"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Категория</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {filteredActive.map((tag) => (
                <tr key={tag.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{tag.name}</td>
                  <td className="px-4 py-2">
                    {tag.category ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[tag.category] ?? "bg-gray-100 text-gray-600"}`}>
                        {CATEGORY_LABELS[tag.category] ?? tag.category}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      disabled={submitting === tag.id}
                      onClick={() => handleDeactivateTag(tag.id)}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      Деактивировать
                    </button>
                  </td>
                </tr>
              ))}
              {filteredActive.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">
                    Теги не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
