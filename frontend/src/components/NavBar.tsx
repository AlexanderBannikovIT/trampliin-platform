"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/hooks/useAuth";
import type { UserRole } from "@/types";

function getDashboardUrl(role: UserRole): string {
  if (role === "seeker") return "/dashboard/seeker";
  if (role === "employer") return "/dashboard/employer";
  if (role === "curator" || role === "admin") return "/dashboard/curator";
  return "/";
}

const ROLE_LABELS: Record<UserRole, string> = {
  guest: "Гость",
  seeker: "Соискатель",
  employer: "Работодатель",
  curator: "Куратор",
  admin: "Администратор",
};

export default function NavBar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="flex-shrink-0 flex items-center justify-between gap-4 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-xl font-bold text-orange-500 tracking-tight">
          Трамплин
        </span>
        <span className="hidden sm:inline text-xs text-gray-400 font-normal mt-0.5">
          карьера в IT
        </span>
      </Link>

      <nav className="flex items-center gap-2">
        {user ? (
          <>
            <Link
              href={getDashboardUrl(user.role)}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Кабинет
            </Link>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-gray-700 leading-tight">
                  {user.display_name}
                </span>
                <span className="text-xs text-gray-400 leading-tight">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
              <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-sm font-semibold text-orange-600 flex-shrink-0">
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Выйти
              </button>
            </div>
          </>
        ) : (
          <>
            <Link
              href="/auth/login"
              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Войти
            </Link>
            <Link
              href="/auth/register"
              className="hidden sm:inline-flex rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
            >
              Регистрация
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
