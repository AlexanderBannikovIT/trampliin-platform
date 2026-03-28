"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ViewMode } from "@/types";

interface ViewToggleProps {
  value: ViewMode;
}

export default function ViewToggle({ value }: ViewToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setView(mode: ViewMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", mode);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      className="inline-flex p-0.5"
      style={{ background: "#F1F5F9", borderRadius: 10 }}
    >
      {(["map", "list"] as ViewMode[]).map((mode) => {
        const isActive = value === mode;
        return (
          <button
            key={mode}
            onClick={() => setView(mode)}
            aria-pressed={isActive}
            className="flex items-center gap-1.5 transition-all"
            style={{
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 500,
              background: isActive ? "white" : "transparent",
              color: isActive ? "#0F172A" : "#64748B",
              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            {mode === "map" ? (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  style={{ color: isActive ? "#F97316" : "currentColor" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Карта
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Список
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
