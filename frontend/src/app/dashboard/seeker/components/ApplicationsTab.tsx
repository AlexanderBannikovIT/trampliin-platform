"use client";

import { useEffect, useState } from "react";
import { applicationsApi } from "@/lib/api";
import type { ApplicationStatus } from "@/types";

interface AppRow {
  id: string;
  opportunity_id: string;
  status: ApplicationStatus;
  applied_at: string;
  opportunity?: {
    title: string;
    type: string;
    format: string;
    city: string | null;
    employer_name: string | null;
  } | null;
}

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; cls: string }
> = {
  submitted: { label: "Отправлен", cls: "bg-blue-50 text-blue-700" },
  reviewed: { label: "Просмотрен", cls: "bg-yellow-50 text-yellow-700" },
  accepted: { label: "Принят", cls: "bg-green-50 text-green-700" },
  rejected: { label: "Отклонён", cls: "bg-red-50 text-red-600" },
  reserve: { label: "Резерв", cls: "bg-purple-50 text-purple-700" },
};

const TYPE_LABELS: Record<string, string> = {
  vacancy: "Вакансия",
  internship: "Стажировка",
  mentorship: "Менторство",
  event: "Событие",
};

export default function ApplicationsTab() {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    applicationsApi
      .myApplications()
      .then(({ data }) => setRows((data as { items?: AppRow[] }).items ?? (data as AppRow[])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-gray-400">
        <svg className="h-10 w-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm">Вы ещё не откликались</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Позиция</th>
            <th className="px-4 py-3">Компания</th>
            <th className="px-4 py-3">Тип</th>
            <th className="px-4 py-3">Город</th>
            <th className="px-4 py-3">Дата</th>
            <th className="px-4 py-3">Статус</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">
          {rows.map((row) => {
            const cfg = STATUS_CONFIG[row.status] ?? {
              label: row.status,
              cls: "bg-gray-100 text-gray-600",
            };
            return (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                  {row.opportunity?.title ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {row.opportunity?.employer_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {row.opportunity?.type
                    ? TYPE_LABELS[row.opportunity.type] ?? row.opportunity.type
                    : "—"}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {row.opportunity?.city ?? "Удалённо"}
                </td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                  {new Date(row.applied_at).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
