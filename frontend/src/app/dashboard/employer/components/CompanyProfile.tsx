"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";

const schema = z.object({
  company_name: z.string().min(1, "Название обязательно").max(200),
  sphere: z.string().max(200).optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  website: z.string().url("Некорректный URL").optional().or(z.literal("")),
  inn: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || v.length === 10 || v.length === 12,
      "ИНН должен содержать 10 или 12 цифр"
    )
    .refine((v) => !v || /^\d+$/.test(v), "ИНН должен содержать только цифры"),
  corporate_email: z
    .string()
    .email("Некорректный email")
    .optional()
    .or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Profile {
  id: string;
  company_name: string;
  inn: string | null;
  sphere: string | null;
  description: string | null;
  website: string | null;
  corporate_email: string | null;
  logo_url: string | null;
  verification_status: "pending" | "verified" | "rejected";
  verified_at: string | null;
  display_name: string;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending: { label: "Ожидает верификации", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  verified: { label: "Верифицирован", cls: "bg-green-50 text-green-700 border-green-200" },
  rejected: { label: "Отклонён", cls: "bg-red-50 text-red-600 border-red-200" },
};

export default function CompanyProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function load() {
    const { data } = await api.get<Profile>("/api/v1/employer/profile");
    setProfile(data);
    reset({
      company_name: data.company_name,
      sphere: data.sphere ?? "",
      description: data.description ?? "",
      website: data.website ?? "",
      inn: data.inn ?? "",
      corporate_email: data.corporate_email ?? "",
    });
  }

  useEffect(() => { load(); }, []);

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      await api.patch("/api/v1/employer/profile", {
        company_name: values.company_name,
        sphere: values.sphere || null,
        description: values.description || null,
        website: values.website || null,
        inn: values.inn || null,
        corporate_email: values.corporate_email || null,
      });
      setSavedMsg("Сохранено");
      setTimeout(() => setSavedMsg(""), 2500);
      load();
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return <div className="py-10 text-center text-sm text-gray-400">Загрузка...</div>;
  }

  const statusCfg = STATUS_CONFIG[profile.verification_status];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Verification banner */}
      <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${statusCfg.cls}`}>
        {statusCfg.label}
        {profile.verification_status === "pending" && (
          <p className="mt-0.5 font-normal opacity-75">
            Куратор рассматривает вашу заявку. Публикация вакансий будет доступна после верификации.
          </p>
        )}
        {profile.verification_status === "rejected" && (
          <p className="mt-0.5 font-normal opacity-75">
            Ваш профиль был отклонён. Обратитесь в поддержку для уточнения причин.
          </p>
        )}
      </div>

      {/* Editable form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Название компании" error={errors.company_name?.message}>
          <input {...register("company_name")} className={inputCls} />
        </Field>
        <Field label="Сфера деятельности" error={errors.sphere?.message}>
          <input {...register("sphere")} className={inputCls} placeholder="IT, Финтех, EdTech..." />
        </Field>
        <Field label="О компании" error={errors.description?.message}>
          <textarea {...register("description")} rows={4} className={inputCls} />
        </Field>
        <Field label="Сайт" error={errors.website?.message}>
          <input {...register("website")} className={inputCls} placeholder="https://company.ru" />
        </Field>
        <Field label="ИНН" error={errors.inn?.message}>
          <input
            {...register("inn")}
            className={inputCls}
            placeholder="10 или 12 цифр"
            maxLength={12}
          />
        </Field>
        <Field label="Корпоративный email" error={errors.corporate_email?.message}>
          <input
            {...register("corporate_email")}
            type="email"
            className={inputCls}
            placeholder="hr@yourcompany.ru"
          />
        </Field>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
          {savedMsg && <span className="text-sm text-green-600 font-medium">{savedMsg}</span>}
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
