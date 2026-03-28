"use client";

import { useState } from "react";
import api from "@/lib/api";

interface OppItem {
  id: string;
  employer_id: string;
  company_name: string;
  title: string;
  type: string;
  format: string;
  city: string | null;
  salary_min: number | null;
  salary_max: number | null;
  published_at: string;
  expires_at: string | null;
  status: string;
  moderation_comment: string | null;
}

interface Props {
  opportunities: OppItem[];
  onRefresh: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  vacancy: "Вакансия",
  internship: "Стажировка",
  mentorship: "Менторство",
  event: "Событие",
};

const FORMAT_LABELS: Record<string, string> = {
  office: "Офис",
  hybrid: "Гибрид",
  remote: "Удалённо",
};

function formatSalary(min: number | null, max: number | null): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
  if (min && max) return `${fmt(min)} — ${fmt(max)}`;
  if (min) return `от ${fmt(min)}`;
  if (max) return `до ${fmt(max)}`;
  return "—";
}

export default function ModerationQueue({ opportunities, onRefresh }: Props) {
  const [rejectModal, setRejectModal] = useState<{ id: string; title: string } | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function handleModerate(id: string, status: "active" | "draft", comment?: string) {
    setSubmitting(id);
    try {
      await api.patch(`/api/v1/curator/opportunities/${id}/moderate`, {
        status,
        comment: comment || null,
      });
      onRefresh();
    } finally {
      setSubmitting(null);
      setRejectModal(null);
      setRejectComment("");
    }
  }

  if (opportunities.length === 0) {
    return <p className="text-sm text-gray-400 py-4">Нет карточек на модерации</p>;
  }

  return (
    <div className="space-y-4">
      {opportunities.map((opp) => (
        <div key={opp.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900">{opp.title}</p>
                <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium">
                  {TYPE_LABELS[opp.type] ?? opp.type}
                </span>
                <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs">
                  {FORMAT_LABELS[opp.format] ?? opp.format}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                <span><span className="font-medium text-gray-600">Компания:</span> {opp.company_name}</span>
                {opp.city && <span><span className="font-medium text-gray-600">Город:</span> {opp.city}</span>}
                <span><span className="font-medium text-gray-600">Зарплата:</span> {formatSalary(opp.salary_min, opp.salary_max)}</span>
                {opp.expires_at && (
                  <span><span className="font-medium text-gray-600">До:</span> {new Date(opp.expires_at).toLocaleDateString("ru-RU")}</span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Отправлено {new Date(opp.published_at).toLocaleDateString("ru-RU")}
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              disabled={submitting === opp.id}
              onClick={() => handleModerate(opp.id, "active")}
              className="rounded-lg bg-green-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              Одобрить
            </button>
            <button
              disabled={submitting === opp.id}
              onClick={() => setRejectModal({ id: opp.id, title: opp.title })}
              className="rounded-lg border border-red-200 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Отклонить
            </button>
          </div>
        </div>
      ))}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-semibold text-gray-900 mb-1">Отклонить карточку</h3>
            <p className="text-sm text-gray-500 mb-4">«{rejectModal.title}»</p>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
              placeholder="Укажите причину отказа (необязательно)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => { setRejectModal(null); setRejectComment(""); }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                disabled={submitting === rejectModal.id}
                onClick={() => handleModerate(rejectModal.id, "draft", rejectComment)}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
