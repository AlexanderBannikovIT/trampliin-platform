"use client";

import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import NavBar from "@/components/NavBar";

type Role = "seeker" | "employer";

export default function RegisterPage() {
  const [role, setRole] = useState<Role>("seeker");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [corporateEmail, setCorporateEmail] = useState("");
  const [inn, setInn] = useState("");
  const [innError, setInnError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setInnError("");
    if (role === "employer" && inn && !/^\d{10}$|^\d{12}$/.test(inn)) {
      setInnError("ИНН должен содержать 10 или 12 цифр");
      return;
    }
    setLoading(true);
    try {
      await authApi.register({
        email,
        display_name: displayName,
        password,
        role,
        ...(role === "employer"
          ? { company_name: companyName, corporate_email: corporateEmail, ...(inn ? { inn } : {}) }
          : {}),
      });
      setSuccess(
        role === "seeker"
          ? "Аккаунт создан! Войдите чтобы начать поиск возможностей."
          : "Заявка отправлена! Куратор платформы проверит данные вашей компании и подтвердит аккаунт. После верификации вы сможете публиковать вакансии и мероприятия."
      );
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (detail === "Email already registered") {
        setError("Email уже зарегистрирован. Попробуйте войти.");
      } else {
        setError(detail ?? "Ошибка регистрации. Попробуйте ещё раз.");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100";

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <NavBar />

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <p className="text-sm text-gray-500">Создайте аккаунт</p>
          </div>

          {success ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center space-y-4">
              <div className="text-4xl">{role === "seeker" ? "🎉" : "📋"}</div>
              <p className="text-sm text-gray-700">{success}</p>
              <Link
                href="/auth/login"
                className="inline-block rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
              >
                Перейти к входу
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Role toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(["seeker", "employer"] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      role === r ? "bg-orange-500 text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {r === "seeker" ? "Соискатель" : "Работодатель"}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Имя / псевдоним</label>
                <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Иван Иванов" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 8 символов" className={inputCls} />
              </div>

              {role === "employer" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Название компании</label>
                    <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="ООО Рога и Копыта" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Корпоративный email</label>
                    <input type="email" required value={corporateEmail} onChange={(e) => setCorporateEmail(e.target.value)} placeholder="hr@yourcompany.ru" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ИНН <span className="text-gray-400 font-normal">(необязательно)</span>
                    </label>
                    <input
                      type="text"
                      value={inn}
                      onChange={(e) => { setInn(e.target.value); setInnError(""); }}
                      placeholder="10 или 12 цифр"
                      maxLength={12}
                      className={inputCls}
                    />
                    {innError && <p className="mt-1 text-xs text-red-500">{innError}</p>}
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {loading ? "Регистрация..." : "Зарегистрироваться"}
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-gray-500">
            Уже есть аккаунт?{" "}
            <Link href="/auth/login" className="text-orange-500 hover:underline font-medium">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
