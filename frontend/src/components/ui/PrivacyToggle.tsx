"use client";

type PrivacyLevel = "private" | "contacts" | "public";

const OPTIONS: { value: PrivacyLevel; label: string; description: string }[] = [
  { value: "private", label: "Закрытый", description: "Только вы" },
  { value: "contacts", label: "Контакты", description: "Ваши контакты" },
  { value: "public", label: "Открытый", description: "Все пользователи" },
];

interface PrivacyToggleProps {
  value: PrivacyLevel;
  onChange: (value: PrivacyLevel) => void;
  disabled?: boolean;
}

export default function PrivacyToggle({ value, onChange, disabled }: PrivacyToggleProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Видимость профиля
      </span>
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 gap-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            title={opt.description}
            className={`flex flex-col items-center rounded-md px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              value === opt.value
                ? "bg-white shadow-sm font-semibold text-orange-600"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
