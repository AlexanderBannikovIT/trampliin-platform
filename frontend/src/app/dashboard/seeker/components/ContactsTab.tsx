"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SeekerBrief {
  id: string;
  user_id: string;
  full_name: string | null;
  display_name: string;
  university: string | null;
  skills: string[];
}

interface ContactRow {
  seeker_id: string;
  contact_id: string;
  status: "pending" | "accepted";
  created_at: string;
  profile?: SeekerBrief | null;
}

interface SeekerSearchResult {
  id: string;
  user_id: string;
  full_name: string | null;
  display_name: string;
  university: string | null;
  skills: string[];
  is_contact: boolean;
  request_sent: boolean;
}

interface RecommendationRow {
  id: string;
  from_seeker_id: string;
  opportunity_id: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
  from_seeker?: SeekerBrief | null;
  opportunity_title?: string | null;
}

type Tab = "search" | "requests" | "contacts" | "recommendations";

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  return (
    <div className="h-9 w-9 flex-shrink-0 rounded-full bg-orange-100 flex items-center justify-center text-sm font-semibold text-orange-600">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Recommend Modal ───────────────────────────────────────────────────────────

interface RecommendModalProps {
  toSeekerId: string;
  contactName: string;
  onClose: () => void;
}

function RecommendModal({ toSeekerId, contactName, onClose }: RecommendModalProps) {
  const [query, setQuery] = useState("");
  const [opps, setOpps] = useState<{ id: string; title: string; city: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const params: Record<string, string> = { limit: "30" };
    if (query) params.q = query;
    setLoading(true);
    api
      .get<{ items: { id: string; title: string; city: string | null }[] }>(
        "/api/v1/opportunities",
        { params }
      )
      .then(({ data }) => setOpps(data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query]);

  async function send() {
    if (!selected) return;
    setSending(true);
    try {
      await api.post(`/api/v1/contacts/${toSeekerId}/recommend`, {
        opportunity_id: selected,
        message: message || null,
      });
      setSent(true);
      setTimeout(onClose, 1200);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">
            Рекомендовать вакансию — {contactName}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-5 pt-4 flex-shrink-0">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск вакансий..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading && <p className="text-sm text-gray-400 text-center py-4">Загрузка...</p>}
          {!loading && opps.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Ничего не найдено</p>
          )}
          {opps.map((opp) => (
            <label
              key={opp.id}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                selected === opp.id
                  ? "border-orange-400 bg-orange-50"
                  : "border-gray-100 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="opportunity"
                value={opp.id}
                checked={selected === opp.id}
                onChange={() => setSelected(opp.id)}
                className="mt-0.5 accent-orange-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{opp.title}</p>
                {opp.city && <p className="text-xs text-gray-500">{opp.city}</p>}
              </div>
            </label>
          ))}
        </div>

        <div className="px-5 pt-2 pb-3 flex-shrink-0">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Добавить сообщение (необязательно)"
            rows={2}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-5 py-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={send}
            disabled={!selected || sending || sent}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {sent ? "Отправлено ✓" : sending ? "Отправка..." : "Рекомендовать"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Search Tab ────────────────────────────────────────────────────────────────

function SearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SeekerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get<SeekerSearchResult[]>("/api/v1/seekers/search", { params: { q } });
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 400);
    return () => clearTimeout(t);
  }, [query, search]);

  async function sendRequest(seekerId: string) {
    setSending(seekerId);
    try {
      await api.post(`/api/v1/contacts/${seekerId}`);
      setResults((prev) =>
        prev.map((r) => r.id === seekerId ? { ...r, request_sent: true } : r)
      );
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Введите имя соискателя..."
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
      />

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && query.length >= 2 && results.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">Никого не найдено</p>
      )}

      {!loading && query.length < 2 && (
        <p className="text-sm text-gray-400 text-center py-6">Введите минимум 2 символа</p>
      )}

      <ul className="space-y-2">
        {results.map((r) => {
          const name = r.full_name ?? r.display_name;
          return (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Avatar name={name} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{name}</p>
                  {r.university && (
                    <p className="text-xs text-gray-400">{r.university}</p>
                  )}
                  {r.skills.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.skills.slice(0, 3).join(", ")}
                      {r.skills.length > 3 && " ..."}
                    </p>
                  )}
                </div>
              </div>

              {r.is_contact ? (
                <span className="text-xs text-green-600 font-medium">В контактах</span>
              ) : r.request_sent ? (
                <span className="text-xs text-gray-400">Запрос отправлен</span>
              ) : (
                <button
                  onClick={() => sendRequest(r.id)}
                  disabled={sending === r.id}
                  className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {sending === r.id ? "..." : "Добавить"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Requests Tab ──────────────────────────────────────────────────────────────

function RequestsTab({ onUpdate }: { onUpdate: () => void }) {
  const [incoming, setIncoming] = useState<ContactRow[]>([]);
  const [sent, setSent] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [inc, snt] = await Promise.all([
        api.get<ContactRow[]>("/api/v1/contacts/requests"),
        api.get<ContactRow[]>("/api/v1/contacts/sent"),
      ]);
      setIncoming(inc.data);
      setSent(snt.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function respond(seekerId: string, accept: boolean) {
    setResponding(seekerId);
    try {
      await api.patch(`/api/v1/contacts/${seekerId}`, { accept });
      await load();
      onUpdate();
    } finally {
      setResponding(null);
    }
  }

  async function cancel(seekerId: string) {
    setCancelling(seekerId);
    try {
      await api.delete(`/api/v1/contacts/${seekerId}`);
      await load();
      onUpdate();
    } finally {
      setCancelling(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Incoming */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Входящие ({incoming.length})
        </h3>
        {incoming.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Новых запросов нет</p>
        ) : (
          <ul className="space-y-2">
            {incoming.map((c) => {
              const name = c.profile?.full_name ?? c.profile?.display_name ?? "Пользователь";
              return (
                <li
                  key={`${c.seeker_id}-${c.contact_id}`}
                  className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={name} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{name}</p>
                      {c.profile?.university && (
                        <p className="text-xs text-gray-400">{c.profile.university}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => respond(c.seeker_id, true)}
                      disabled={responding === c.seeker_id}
                      className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      Принять
                    </button>
                    <button
                      onClick={() => respond(c.seeker_id, false)}
                      disabled={responding === c.seeker_id}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Отклонить
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Sent */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Отправленные ({sent.length})
        </h3>
        {sent.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Нет исходящих запросов</p>
        ) : (
          <ul className="space-y-2">
            {sent.map((c) => {
              const name = c.profile?.full_name ?? c.profile?.display_name ?? "Пользователь";
              return (
                <li
                  key={`${c.seeker_id}-${c.contact_id}`}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={name} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{name}</p>
                      <p className="text-xs text-gray-400">Ожидает подтверждения</p>
                    </div>
                  </div>
                  <button
                    onClick={() => cancel(c.contact_id)}
                    disabled={cancelling === c.contact_id}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Отменить
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Contacts Tab ──────────────────────────────────────────────────────────────

function ContactsListTab() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [recommendTarget, setRecommendTarget] = useState<ContactRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<ContactRow[]>("/api/v1/contacts/accepted");
      setContacts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(c: ContactRow) {
    const otherId = c.seeker_id !== c.contact_id
      ? c.contact_id  // we'll figure out which side we are on server
      : c.contact_id;
    // Use the profile id (the other person's seeker profile id)
    const otherProfileId = c.profile?.id;
    if (!otherProfileId) return;
    setRemoving(otherProfileId);
    try {
      await api.delete(`/api/v1/contacts/${otherProfileId}`);
      await load();
    } finally {
      setRemoving(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}
      </div>
    );
  }

  return (
    <>
      {contacts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <svg className="h-10 w-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">Контактов пока нет</p>
          <p className="text-xs mt-1">Найдите соискателей через поиск</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => {
            const name = c.profile?.full_name ?? c.profile?.display_name ?? "Пользователь";
            const otherId = c.profile?.id ?? "";
            return (
              <li
                key={`${c.seeker_id}-${c.contact_id}`}
                className="rounded-xl border border-gray-100 bg-white px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={name} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      {c.profile?.university && (
                        <p className="text-xs text-gray-400 truncate">{c.profile.university}</p>
                      )}
                      {c.profile && c.profile.skills.length > 0 && (
                        <p className="text-xs text-gray-400 truncate">
                          {c.profile.skills.slice(0, 3).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setRecommendTarget(c)}
                      className="rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 transition-colors"
                    >
                      Рекомендовать
                    </button>
                    <button
                      onClick={() => remove(c)}
                      disabled={removing === otherId}
                      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-400 hover:bg-gray-50 hover:text-red-400 disabled:opacity-50 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {recommendTarget && (
        <RecommendModal
          toSeekerId={recommendTarget.profile?.id ?? ""}
          contactName={
            recommendTarget.profile?.full_name ??
            recommendTarget.profile?.display_name ??
            "контакту"
          }
          onClose={() => { setRecommendTarget(null); }}
        />
      )}
    </>
  );
}

// ── Recommendations Tab ───────────────────────────────────────────────────────

function RecommendationsTab() {
  const [recs, setRecs] = useState<RecommendationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<RecommendationRow[]>("/api/v1/contacts/recommendations")
      .then(({ data }) => setRecs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-gray-400">
        <svg className="h-10 w-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">Рекомендаций пока нет</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {recs.map((r) => {
        const fromName =
          r.from_seeker?.full_name ?? r.from_seeker?.display_name ?? "Контакт";
        return (
          <li
            key={r.id}
            className="rounded-xl border border-gray-100 bg-white px-4 py-3 space-y-1"
          >
            <div className="flex items-center gap-2">
              <Avatar name={fromName} />
              <div>
                <p className="text-sm font-medium text-gray-900">{fromName}</p>
                <p className="text-xs text-gray-400">
                  {new Date(r.created_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
            </div>
            {r.opportunity_title && (
              <div className="pl-12 flex items-center gap-2">
                <Link
                  href={`/opportunities/${r.opportunity_id}`}
                  style={{
                    color: "#F97316",
                    fontWeight: 500,
                    fontSize: 14,
                    textDecoration: "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.textDecoration = "underline";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.textDecoration = "none";
                  }}
                >
                  {r.opportunity_title}
                </Link>
                <Link
                  href={`/opportunities/${r.opportunity_id}`}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    background: "#FFF7ED",
                    color: "#F97316",
                    border: "1px solid #FED7AA",
                    borderRadius: 20,
                    textDecoration: "none",
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  Открыть →
                </Link>
              </div>
            )}
            {r.message && (
              <p className="text-xs text-gray-500 pl-12 italic">{r.message}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ContactsTabProps {
  onBadgeUpdate?: (pending: number) => void;
}

export default function ContactsTab({ onBadgeUpdate }: ContactsTabProps) {
  const [tab, setTab] = useState<Tab>("search");
  const [badges, setBadges] = useState({ pending_requests: 0, unread_recommendations: 0 });

  async function loadBadges() {
    try {
      const { data } = await api.get<{ pending_requests: number; unread_recommendations: number }>(
        "/api/v1/contacts/badges"
      );
      setBadges(data);
      onBadgeUpdate?.(data.pending_requests);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadBadges();
  }, []);

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "search", label: "Поиск" },
    { id: "requests", label: "Заявки", badge: badges.pending_requests || undefined },
    { id: "contacts", label: "Контакты" },
    { id: "recommendations", label: "Рекомендации", badge: badges.unread_recommendations || undefined },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              if (t.id === "recommendations") {
                setBadges((b) => ({ ...b, unread_recommendations: 0 }));
              }
              if (t.id === "requests") {
                loadBadges();
              }
            }}
            className={`relative flex-shrink-0 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.id
                ? "text-orange-600 border-b-2 border-orange-500 -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.badge ? (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "search" && <SearchTab />}
      {tab === "requests" && <RequestsTab onUpdate={loadBadges} />}
      {tab === "contacts" && <ContactsListTab />}
      {tab === "recommendations" && <RecommendationsTab />}
    </div>
  );
}
