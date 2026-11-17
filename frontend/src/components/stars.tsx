import { useTranslation } from "react-i18next";

export function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const { t } = useTranslation();
  const steps = [1, 2, 3, 4, 5];
  if (!onChange) {
    return (
      <span className="stars" role="img" aria-label={t("stars.rating", { value })}>
        {steps.map((n) => (
          <span key={n} aria-hidden="true" className={n <= value ? "star on" : "star"}>
            {n <= value ? "★" : "☆"}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="stars" role="group" aria-label={t("stars.group")}>
      {steps.map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? "star on" : "star"}
          aria-label={t("stars.star", { count: n })}
          aria-pressed={n === value}
          onClick={() => onChange(n)}
        >
          {n <= value ? "★" : "☆"}
        </button>
      ))}
    </span>
  );
}
