"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface SeekerBrief {
  id: string;
  user_id: string;
  full_name: string | null;
  display_name: string;
  skills: string[];
  university: string | null;
}

interface AppRow {
  id: string;
  seeker_id: string;
  opportunity_id: string;
  status: string;
  applied_at: string;
  seeker: SeekerBrief | null;
}

interface SeekerDrawerProps {
  seeker: SeekerBrief;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: "submitted", label: "Новый" },
  { value: "reviewed", label: "Просмотрен" },
  { value: "accepted", label: "Принят" },
  { value: "rejected", label: "Отклонён" },
  { value: "reserve", label: "Резерв" },
];

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-50 text-blue-700",
  reviewed: "bg-yellow-50 text-yellow-700",
  accepted: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-600",
  reserve: "bg-purple-50 text-purple-700",
};

function SeekerDrawer({ seeker, onClose }: SeekerDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <div
        className="w-80 bg-white shadow-2xl h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Профиль соискателя</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center text-lg font-bold text-orange-600">
              {(seeker.full_name ?? seeker.display_name).charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {seeker.full_name ?? seeker.display_name}
              </p>
              {seeker.full_name && (
                <p className="text-sm text-gray-400">@{seeker.display_name}</p>
              )}
            </div>
          </div>

          {seeker.university && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                Образование
              </p>
              <p className="text-sm text-gray-700">{seeker.university}</p>
            </div>
          )}

          {seeker.skills.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Навыки
              </p>
              <div className="flex flex-wrap gap-1.5">
                {seeker.skills.map((s) => (
                  <span key={s} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Note about privacy */}
          <p className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-400">
            Полный профиль доступен в зависимости от настроек приватности соискателя
          </p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  opportunityId: string;
  opportunityTitle: string;
}

export default function ApplicationsList({ opportunityId, opportunityTitle }: Props) {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeeker, setSelectedSeeker] = useState<SeekerBrief | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function load() {
    try {
      const { data } = await api.get<AppRow[]>(
        `/api/v1/employer/opportunities/${opportunityId}/applications`
      );
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [opportunityId]);

  async function updateStatus(appId: string, status: string) {
    setUpdatingId(appId);
    try {
      await api.patch(`/api/v1/employer/applications/${appId}`, { status });
      setRows((prev) =>
        prev.map((r) => (r.id === appId ? { ...r, status } : r))
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 mt-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Отклики на «{opportunityTitle}» ({rows.length})
      </h3>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">Откликов пока нет</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Соискатель</th>
                <th className="px-4 py-3">Навыки</th>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {row.seeker?.full_name ?? row.seeker?.display_name ?? "—"}
                    </p>
                    {row.seeker?.university && (
                      <p className="text-xs text-gray-400">{row.seeker.university}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(row.seeker?.skills ?? []).slice(0, 3).map((s) => (
                        <span key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          {s}
                        </span>
                      ))}
                      {(row.seeker?.skills.length ?? 0) > 3 && (
                        <span className="text-xs text-gray-400">
                          +{(row.seeker?.skills.length ?? 0) - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {new Date(row.applied_at).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.status}
                      disabled={updatingId === row.id}
                      onChange={(e) => updateStatus(row.id, e.target.value)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-200 ${STATUS_COLORS[row.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.seeker && (
                      <button
                        onClick={() => setSelectedSeeker(row.seeker!)}
                        className="text-xs text-orange-500 hover:underline whitespace-nowrap"
                      >
                        Профиль →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedSeeker && (
        <SeekerDrawer seeker={selectedSeeker} onClose={() => setSelectedSeeker(null)} />
      )}
    </div>
  );
}
