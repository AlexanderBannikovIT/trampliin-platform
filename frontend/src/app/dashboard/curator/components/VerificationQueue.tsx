"use client";

import { useState } from "react";
import api from "@/lib/api";

interface EmployerItem {
  id: string;
  company_name: string;
  inn: string | null;
  sphere: string | null;
  website: string | null;
  corporate_email: string | null;
  logo_url: string | null;
  verification_status: string;
  display_name: string;
  email: string;
  created_at: string;
  is_suspicious: boolean;
}

interface Props {
  employers: EmployerItem[];
  onRefresh: () => void;
}

export default function VerificationQueue({ employers, onRefresh }: Props) {
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function handleVerify(id: string, status: "verified" | "rejected", comment?: string) {
    setSubmitting(id);
    try {
      await api.patch(`/api/v1/curator/employers/${id}/verify`, { status, comment: comment || null });
      onRefresh();
    } finally {
      setSubmitting(null);
      setRejectModal(null);
      setRejectComment("");
    }
  }

  if (employers.length === 0) {
    return <p className="text-sm text-gray-400 py-4">Нет заявок на верификацию</p>;
  }

  return (
    <div className="space-y-4">
      {employers.map((emp) => (
        <div
          key={emp.id}
          className={`rounded-xl border bg-white p-5 shadow-sm ${
            emp.is_suspicious ? "border-yellow-300" : "border-gray-100"
          }`}
        >
          {emp.is_suspicious && (
            <div className="mb-3 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-700 font-medium">
              Внимание: личный email или отсутствует ИНН
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900">{emp.company_name}</p>
                {emp.sphere && (
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{emp.sphere}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500">
                <span><span className="font-medium text-gray-600">ИНН:</span> {emp.inn ?? "—"}</span>
                <span><span className="font-medium text-gray-600">Корп. email:</span> {emp.corporate_email ?? "—"}</span>
                <span><span className="font-medium text-gray-600">Аккаунт:</span> {emp.email}</span>
                <span><span className="font-medium text-gray-600">Имя:</span> {emp.display_name}</span>
                {emp.website && (
                  <span className="col-span-2">
                    <span className="font-medium text-gray-600">Сайт:</span>{" "}
                    <a href={emp.website} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                      {emp.website}
                    </a>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Заявка от {new Date(emp.created_at).toLocaleDateString("ru-RU")}
              </p>
            </div>

            {emp.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={emp.logo_url} alt="Логотип" className="h-14 w-14 rounded-xl object-cover border border-gray-100 flex-shrink-0" />
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              disabled={submitting === emp.id}
              onClick={() => handleVerify(emp.id, "verified")}
              className="rounded-lg bg-green-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              Одобрить
            </button>
            <button
              disabled={submitting === emp.id}
              onClick={() => setRejectModal({ id: emp.id, name: emp.company_name })}
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
            <h3 className="font-semibold text-gray-900 mb-1">Отклонить компанию</h3>
            <p className="text-sm text-gray-500 mb-4">«{rejectModal.name}»</p>
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
                onClick={() => handleVerify(rejectModal.id, "rejected", rejectComment)}
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
