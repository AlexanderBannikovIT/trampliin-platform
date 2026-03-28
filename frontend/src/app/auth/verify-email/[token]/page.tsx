"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import NavBar from "@/components/NavBar";

export default function VerifyEmailPage({ params }: { params: { token: string } }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    authApi
      .verifyEmail(params.token)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [params.token]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <NavBar />

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">
          {status === "loading" && (
            <p className="text-sm text-gray-400">Подтверждение email...</p>
          )}

          {status === "success" && (
            <>
              <div className="text-4xl">✅</div>
              <p className="text-sm text-gray-700 font-medium">Email подтверждён!</p>
              <p className="text-xs text-gray-400">Теперь вы можете войти в аккаунт.</p>
              <Link
                href="/auth/login"
                className="inline-block rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
              >
                Войти
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-4xl">❌</div>
              <p className="text-sm text-gray-700 font-medium">Ссылка недействительна</p>
              <p className="text-xs text-gray-400">Возможно, ссылка устарела или уже была использована.</p>
              <Link
                href="/auth/login"
                className="inline-block rounded-lg border border-gray-200 px-5 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                На страницу входа
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
