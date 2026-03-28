"use client";

import { useEffect, useState, KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import PrivacyToggle from "@/components/ui/PrivacyToggle";
import { profileApi } from "@/lib/api";

const schema = z.object({
  full_name: z.string().max(200).optional().or(z.literal("")),
  university: z.string().max(200).optional().or(z.literal("")),
  graduation_year: z.coerce.number().int().min(1950).max(2100).optional().or(z.literal("")),
  bio: z.string().optional().or(z.literal("")),
  link_github: z.string().url("Некорректный URL").optional().or(z.literal("")),
  link_linkedin: z.string().url("Некорректный URL").optional().or(z.literal("")),
  link_portfolio: z.string().url("Некорректный URL").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Profile {
  full_name: string | null;
  university: string | null;
  graduation_year: number | null;
  bio: string | null;
  skills: string[];
  links: Record<string, string>;
  privacy: "private" | "contacts" | "public";
}

export default function ResumeTab() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [privacy, setPrivacy] = useState<"private" | "contacts" | "public">("contacts");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    profileApi.getSeeker().then(({ data }) => {
      const p = data as Profile;
      setProfile(p);
      setSkills(p.skills ?? []);
      setPrivacy(p.privacy ?? "contacts");
      reset({
        full_name: p.full_name ?? "",
        university: p.university ?? "",
        graduation_year: p.graduation_year ?? "",
        bio: p.bio ?? "",
        link_github: p.links?.github ?? "",
        link_linkedin: p.links?.linkedin ?? "",
        link_portfolio: p.links?.portfolio ?? "",
      });
    });
  }, [reset]);

  function addSkill() {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setSkillInput("");
  }

  function handleSkillKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill();
    }
    if (e.key === "Backspace" && skillInput === "" && skills.length > 0) {
      setSkills((prev) => prev.slice(0, -1));
    }
  }

  function removeSkill(skill: string) {
    setSkills((prev) => prev.filter((s) => s !== skill));
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      await profileApi.updateSeeker({
        full_name: values.full_name || null,
        university: values.university || null,
        graduation_year: values.graduation_year || null,
        bio: values.bio || null,
        skills,
        links: {
          ...(values.link_github ? { github: values.link_github } : {}),
          ...(values.link_linkedin ? { linkedin: values.link_linkedin } : {}),
          ...(values.link_portfolio ? { portfolio: values.link_portfolio } : {}),
        },
        privacy,
      });
      setSavedMsg("Сохранено");
      setTimeout(() => setSavedMsg(""), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        Загрузка...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      {/* Privacy */}
      <PrivacyToggle value={privacy} onChange={setPrivacy} />

      {/* Main fields */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="ФИО" error={errors.full_name?.message}>
          <input {...register("full_name")} className={inputCls} placeholder="Иван Иванов" />
        </Field>
        <Field label="Вуз" error={errors.university?.message}>
          <input {...register("university")} className={inputCls} placeholder="МГУ, МФТИ..." />
        </Field>
        <Field label="Год выпуска" error={errors.graduation_year?.message}>
          <input
            {...register("graduation_year")}
            type="number"
            className={inputCls}
            placeholder="2026"
          />
        </Field>
      </div>

      <Field label="О себе" error={errors.bio?.message}>
        <textarea
          {...register("bio")}
          rows={4}
          className={inputCls}
          placeholder="Расскажите о своём опыте и целях..."
        />
      </Field>

      {/* Skills */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Навыки</label>
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-gray-200 bg-white p-2 min-h-[44px] focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100">
          {skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-sm text-orange-700"
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                className="text-orange-400 hover:text-orange-600"
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={handleSkillKeyDown}
            onBlur={addSkill}
            className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
            placeholder={skills.length === 0 ? "Python, React, Docker... (Enter)" : ""}
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">Нажмите Enter или запятую для добавления</p>
      </div>

      {/* Links */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Ссылки</p>
        <Field label="GitHub" error={errors.link_github?.message}>
          <input {...register("link_github")} className={inputCls} placeholder="https://github.com/username" />
        </Field>
        <Field label="LinkedIn" error={errors.link_linkedin?.message}>
          <input {...register("link_linkedin")} className={inputCls} placeholder="https://linkedin.com/in/username" />
        </Field>
        <Field label="Портфолио" error={errors.link_portfolio?.message}>
          <input {...register("link_portfolio")} className={inputCls} placeholder="https://mysite.ru" />
        </Field>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
        {savedMsg && (
          <span className="text-sm text-green-600 font-medium">{savedMsg}</span>
        )}
      </div>
    </form>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

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
