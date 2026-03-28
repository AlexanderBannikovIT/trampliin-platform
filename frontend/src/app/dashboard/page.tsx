"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/hooks/useAuth";

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/auth/login?next=/dashboard");
      return;
    }
    if (user.role === "seeker") {
      router.replace("/dashboard/seeker");
    } else if (user.role === "employer") {
      router.replace("/dashboard/employer");
    } else if (user.role === "curator" || user.role === "admin") {
      router.replace("/dashboard/curator");
    } else {
      router.replace("/");
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex h-screen items-center justify-center text-sm text-gray-400">
      Загрузка...
    </div>
  );
}
