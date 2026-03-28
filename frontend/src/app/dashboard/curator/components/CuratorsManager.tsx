"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";

interface CuratorUser {
  id: string;
  email: string;
  display_name: string;
  role: "curator" | "admin";
  is_active: boolean;
  created_at: string;
}

const schema = z.object({
  email: z.string().email("Некорректный email"),
  display_name: z.string().min(1, "Обязательное поле").max(200),
  password: z.string().min(8, "Минимум 8 символов"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  currentUserId: string;
}

export default function CuratorsManager({ currentUserId }: Props) {
  const [curators, setCurators] = useState<CuratorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [createError, setCreateError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<CuratorUser[]>("/api/v1/curator/curators");
      setCurators(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function deactivate(id: string) {
    setDeactivating(id);
    try {
      await api.patch(`/api/v1/curator/curators/${id}`, { is_active: false });
      setCurators((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_active: false } : c))
      );
    } finally {
      setDeactivating(null);
    }
  }

  async function onCreate(values: FormValues) {
    setCreateError("");
    try {
      const { data } = await api.post<CuratorUser>("/api/v1/curator/curators", values);
      setCurators((prev) => [data, ...prev]);
      reset();
      showToast(`Куратор ${values.email} успешно создан`);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setCreateError("Пользователь с таким email уже существует");
      } else {
        setCreateError("Ошибка при создании куратора");
      }
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">
          {toast}
        </div>
      )}

      {/* Curators list */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Кураторы и администраторы
        </h2>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : curators.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Нет кураторов</p>
        ) : (
          <ul className="space-y-2">
            {curators.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                    {c.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {c.display_name}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.role === "admin"
                            ? "bg-orange-50 text-orange-600"
                            : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {c.role === "admin" ? "Администратор" : "Куратор"}
                      </span>
                      {!c.is_active && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-50 text-red-500">
                          Неактивен
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{c.email}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(c.created_at).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                </div>

                {c.is_active && c.id !== currentUserId && c.role === "curator" && (
                  <button
                    onClick={() => deactivate(c.id)}
                    disabled={deactivating === c.id}
                    className="flex-shrink-0 rounded-lg border border-red-100 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {deactivating === c.id ? "..." : "Деактивировать"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Create form */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Создать куратора</h2>
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4 max-w-md">
          {createError && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              {createError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              {...register("email")}
              type="email"
              className={inputCls}
              placeholder="curator@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Отображаемое имя <span className="text-red-400">*</span>
            </label>
            <input
              {...register("display_name")}
              className={inputCls}
              placeholder="Иван Иванов"
            />
            {errors.display_name && (
              <p className="mt-1 text-xs text-red-500">{errors.display_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Пароль <span className="text-red-400">*</span>
            </label>
            <input
              {...register("password")}
              type="password"
              className={inputCls}
              placeholder="Минимум 8 символов"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Создание..." : "Создать куратора"}
          </button>
        </form>
      </section>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100";
