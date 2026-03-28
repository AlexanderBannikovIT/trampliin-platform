"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { opportunitiesApi, tagsApi } from "@/lib/api";
import CityAutocomplete from "@/components/ui/CityAutocomplete";

// ── Geocoding ─────────────────────────────────────────────────────────────────
async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = new URL("https://geocode-maps.yandex.ru/1.x/");
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("geocode", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("results", "1");
    const res = await fetch(url.toString());
    const json = await res.json();
    const pos: string =
      json?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos;
    if (!pos) return null;
    const [lng, lat] = pos.split(" ").map(Number);
    return { lat, lng };
  } catch {
    return null;
  }
}

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  title: z.string().min(3, "Минимум 3 символа").max(300),
  description: z.string().optional().or(z.literal("")),
  type: z.enum(["vacancy", "internship", "mentorship", "event"]),
  format: z.enum(["office", "hybrid", "remote"]),
  city: z.string().max(200).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  salary_min: z.coerce.number().min(0).optional().or(z.literal("")),
  salary_max: z.coerce.number().min(0).optional().or(z.literal("")),
  expires_at: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Tag { id: string; name: string; category: string | null; }

const CATEGORY_LABELS: Record<string, string> = {
  language: "Языки",
  framework: "Фреймворки",
  level: "Уровень",
  employment: "Занятость",
  direction: "Направление",
  null: "Прочее",
};

interface Props {
  opportunityId?: string;  // if provided → edit mode
  onSuccess: () => void;
  onCancel: () => void;
}

const TYPE_OPTIONS = [
  { value: "vacancy", label: "Вакансия" },
  { value: "internship", label: "Стажировка" },
  { value: "mentorship", label: "Менторство" },
  { value: "event", label: "Событие" },
] as const;

const FORMAT_OPTIONS = [
  { value: "office", label: "Офис" },
  { value: "hybrid", label: "Гибрид" },
  { value: "remote", label: "Удалённо" },
] as const;

export default function OpportunityForm({ opportunityId, onSuccess, onCancel }: Props) {
  const isEdit = Boolean(opportunityId);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [tagsOpen, setTagsOpen] = useState(false);
  const [cityValue, setCityValue] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geoResult, setGeoResult] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const format = watch("format");
  const needsGeo = format === "office" || format === "hybrid";

  useEffect(() => {
    tagsApi.list().then(({ data }) => setTags(Array.isArray(data) ? data : []));
    if (isEdit && opportunityId) {
      opportunitiesApi.get(opportunityId).then(({ data }) => {
        reset({
          title: data.title,
          description: data.description ?? "",
          type: data.type as FormValues["type"],
          format: data.format as FormValues["format"],
          city: data.city ?? "",
          address: data.address ?? "",
          salary_min: data.salary_min ?? "",
          salary_max: data.salary_max ?? "",
          expires_at: data.expires_at
            ? new Date(data.expires_at).toISOString().split("T")[0]
            : "",
        });
        setCityValue(data.city ?? "");
        setSelectedTagIds(data.tags.map((t) => t.id));
        if (data.lat && data.lng) setGeoResult({ lat: data.lat, lng: data.lng });
      });
    }
  }, [isEdit, opportunityId, reset]);

  async function handleGeocode() {
    const address = watch("address");
    const query = [address, cityValue].filter(Boolean).join(", ");
    if (!query) return;
    setGeocoding(true);
    setGeoError("");
    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "";
    const result = await geocodeAddress(query, apiKey);
    if (result) {
      setGeoResult(result);
    } else {
      setGeoError("Адрес не найден. Проверьте написание.");
    }
    setGeocoding(false);
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setVerificationError("");
    try {
      const payload = {
        title: values.title,
        description: values.description || null,
        type: values.type,
        format: values.format,
        city: cityValue || null,
        address: values.address || null,
        lat: needsGeo && geoResult ? geoResult.lat : null,
        lng: needsGeo && geoResult ? geoResult.lng : null,
        salary_min: values.salary_min ? Number(values.salary_min) : null,
        salary_max: values.salary_max ? Number(values.salary_max) : null,
        expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null,
        tags: selectedTagIds,
      };

      if (isEdit && opportunityId) {
        await opportunitiesApi.update(opportunityId, payload);
      } else {
        await opportunitiesApi.create(payload);
      }
      onSuccess();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "";
      if (detail.toLowerCase().includes("verif")) {
        setVerificationError("Ожидает верификации куратором. Публикация возможна только после подтверждения профиля.");
      } else {
        setVerificationError(detail || "Ошибка при сохранении");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(tagSearch.toLowerCase())
  );
  const selectedTagNames = tags.filter((t) => selectedTagIds.includes(t.id)).map((t) => t.name);

  // Group filtered tags by category
  const groupedTags = filteredTags.reduce<Record<string, Tag[]>>((acc, tag) => {
    const key = tag.category ?? "null";
    if (!acc[key]) acc[key] = [];
    acc[key].push(tag);
    return acc;
  }, {});
  const categoryOrder = ["language", "framework", "level", "employment", "direction", "null"];
  const sortedCategories = Object.keys(groupedTags).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900">
        {isEdit ? "Редактировать" : "Новая возможность"}
      </h2>

      {verificationError && (
        <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-700">
          {verificationError}
        </div>
      )}

      <Field label="Заголовок" error={errors.title?.message} required>
        <input {...register("title")} className={inputCls} placeholder="Python Backend Developer" />
      </Field>

      <Field label="Описание" error={errors.description?.message}>
        <textarea {...register("description")} rows={5} className={inputCls} placeholder="Что предстоит делать, требования, условия..." />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Тип" error={errors.type?.message} required>
          <select {...register("type")} className={inputCls}>
            <option value="">Выберите тип</option>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Формат" error={errors.format?.message} required>
          <select {...register("format")} className={inputCls}>
            <option value="">Выберите формат</option>
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Город" error={errors.city?.message}>
          <CityAutocomplete
            value={cityValue}
            onChange={setCityValue}
            placeholder="Москва"
          />
        </Field>
        {needsGeo && (
          <Field label="Адрес" error={errors.address?.message}>
            <div className="flex gap-2">
              <input {...register("address")} className={`${inputCls} flex-1`} placeholder="ул. Ленина, 1" />
              <button
                type="button"
                onClick={handleGeocode}
                disabled={geocoding}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
              >
                {geocoding ? "..." : "Геокод"}
              </button>
            </div>
            {geoResult && (
              <p className="mt-1 text-xs text-green-600">
                ✓ {geoResult.lat.toFixed(4)}, {geoResult.lng.toFixed(4)}
              </p>
            )}
            {geoError && <p className="mt-1 text-xs text-red-500">{geoError}</p>}
          </Field>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Зарплата от (₽)" error={errors.salary_min?.message}>
          <input {...register("salary_min")} type="number" min={0} step={1000} className={inputCls} placeholder="100000" />
        </Field>
        <Field label="Зарплата до (₽)" error={errors.salary_max?.message}>
          <input {...register("salary_max")} type="number" min={0} step={1000} className={inputCls} placeholder="200000" />
        </Field>
      </div>

      <Field label="Дедлайн / дата события" error={errors.expires_at?.message}>
        <input {...register("expires_at")} type="date" className={inputCls} />
      </Field>

      {/* Tags multiselect */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">Теги</label>
        <button
          type="button"
          onClick={() => setTagsOpen((o) => !o)}
          className={`w-full text-left ${inputCls}`}
        >
          {selectedTagNames.length
            ? selectedTagNames.slice(0, 4).join(", ") +
              (selectedTagNames.length > 4 ? ` +${selectedTagNames.length - 4}` : "")
            : "Выбрать теги..."}
        </button>
        {tagsOpen && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="p-2">
              <input
                type="text"
                placeholder="Поиск тегов..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none"
              />
            </div>
            <div className="max-h-64 overflow-y-auto pb-1">
              {sortedCategories.length === 0 && (
                <p className="px-3 py-2 text-sm text-gray-400">Ничего не найдено</p>
              )}
              {sortedCategories.map((cat) => (
                <div key={cat}>
                  <p className="px-3 pt-2 pb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </p>
                  {groupedTags[cat].map((tag) => (
                    <label
                      key={tag.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-gray-50 select-none text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTagIds.includes(tag.id)}
                        onChange={() => toggleTag(tag.id)}
                        className="h-4 w-4 rounded border-gray-300 text-orange-500"
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Сохранение..." : isEdit ? "Сохранить" : "Создать"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-5 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100";

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
