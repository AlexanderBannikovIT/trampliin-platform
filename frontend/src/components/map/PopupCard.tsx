import type { GeoJsonFeature, OpportunityType, OpportunityFormat } from "@/types";

const TYPE_LABELS: Record<OpportunityType, string> = {
  vacancy: "Вакансия",
  internship: "Стажировка",
  mentorship: "Менторство",
  event: "Событие",
};

const FORMAT_LABELS: Record<OpportunityFormat, string> = {
  office: "Офис",
  hybrid: "Гибрид",
  remote: "Удалённо",
};

const TYPE_COLORS: Record<OpportunityType, string> = {
  vacancy: "bg-blue-100 text-blue-700",
  internship: "bg-green-100 text-green-700",
  mentorship: "bg-purple-100 text-purple-700",
  event: "bg-amber-100 text-amber-700",
};

interface PopupCardProps {
  feature: GeoJsonFeature;
  companyName?: string;
}

export function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
  if (min && max) return `${fmt(min)} — ${fmt(max)}`;
  if (min) return `от ${fmt(min)}`;
  if (max) return `до ${fmt(max)}`;
  return null;
}

export default function PopupCard({ feature, companyName }: PopupCardProps) {
  const { properties } = feature;
  const salary = formatSalary(properties.salary_min, properties.salary_max);
  const tags = properties.tags.slice(0, 3);

  return (
    <div className="w-64 rounded-xl bg-white shadow-lg border border-gray-100 p-3 pointer-events-none">
      {/* Type badge */}
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[properties.type]}`}
      >
        {TYPE_LABELS[properties.type]}
      </span>

      {/* Title */}
      <p className="mt-1.5 text-sm font-semibold text-gray-900 line-clamp-2">
        {properties.title}
      </p>

      {/* Company */}
      {companyName && (
        <p className="mt-0.5 text-xs text-gray-500">{companyName}</p>
      )}

      {/* Salary + format */}
      <div className="mt-2 flex items-center justify-between gap-2">
        {salary ? (
          <span className="text-xs font-medium text-gray-700">{salary}</span>
        ) : (
          <span className="text-xs text-gray-400">Зарплата не указана</span>
        )}
        <span className="text-xs text-gray-500">
          {FORMAT_LABELS[properties.format]}
        </span>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
