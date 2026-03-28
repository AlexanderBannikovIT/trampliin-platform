"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import ResumeTab from "./components/ResumeTab";
import ApplicationsTab from "./components/ApplicationsTab";
import FavoritesTab from "./components/FavoritesTab";
import ContactsTab from "./components/ContactsTab";

type TabId = "resume" | "applications" | "favorites" | "contacts";

type AuthUser = { id: string; email: string; display_name: string; role: string };

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const activeTab = (searchParams.get("tab") as TabId | null) ?? "resume";

  const TABS: { id: TabId; label: string; badge?: number }[] = [
    { id: "resume", label: "Резюме" },
    { id: "applications", label: "Отклики" },
    { id: "favorites", label: "Избранное" },
    { id: "contacts", label: "Контакты", badge: pendingCount || undefined },
  ];

  useEffect(() => {
    api.get<AuthUser>("/api/v1/auth/me")
      .then((res) => {
        if (res.data.role !== "seeker") {
          router.push("/");
        } else {
          setUser(res.data);
          setLoading(false);
        }
      })
      .catch(() => router.push("/auth/login?next=/dashboard/seeker"));
  }, []);

  // Poll badge counts every 30s
  useEffect(() => {
    function fetchBadges() {
      api.get<{ pending_requests: number; unread_recommendations: number }>(
        "/api/v1/contacts/badges"
      )
        .then(({ data }) => setPendingCount(data.pending_requests))
        .catch(() => {});
    }
    fetchBadges();
    const interval = setInterval(fetchBadges, 30_000);
    return () => clearInterval(interval);
  }, []);

  function setTab(tab: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
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
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user.display_name}</span>
          <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-sm font-semibold text-orange-600">
            {user.display_name.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar nav */}
        <aside className="hidden md:flex w-56 flex-shrink-0 flex-col py-4 bg-white border-r border-gray-100">
          <p className="px-4 mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Кабинет
          </p>
          <nav className="flex flex-col gap-1 px-2">
            {TABS.map(({ id, label, badge }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors ${
                  activeTab === id
                    ? "bg-orange-50 text-orange-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
                {badge ? (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1">
                    {badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile tab bar */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-100 bg-white shadow-lg overflow-x-auto">
          <div className="flex min-w-max px-2">
            {TABS.map(({ id, label, badge }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`relative flex-shrink-0 px-5 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === id ? "text-orange-500 border-t-2 border-orange-500 -mt-px" : "text-gray-500"
                }`}
              >
                {label}
                {badge ? (
                  <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[9px] font-bold min-w-[14px] h-3.5 px-0.5">
                    {badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb-style title */}
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-gray-900">
                {TABS.find((t) => t.id === activeTab)?.label}
              </h1>
            </div>

            {activeTab === "resume" && <ResumeTab />}
            {activeTab === "applications" && <ApplicationsTab />}
            {activeTab === "favorites" && <FavoritesTab />}
            {activeTab === "contacts" && (
              <ContactsTab onBadgeUpdate={setPendingCount} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SeekerDashboardPage() {
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
