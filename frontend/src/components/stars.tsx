import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";

// Estrellas de 1 a 5. Sin onChange son de solo lectura (una imagen con aria-label);
// con onChange son un grupo de botones para puntuar (formulario de reseñas).
export function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const { t } = useTranslation();
  const steps = [1, 2, 3, 4, 5];
  if (!onChange) {
    return (
      <span className="stars" role="img" aria-label={t("stars.rating", { value })}>
        {steps.map((n) => (
          <span key={n} aria-hidden="true" className={n <= value ? "star on" : "star"}>
            <Star size={20} aria-hidden="true" fill={n <= value ? "currentColor" : "none"} />
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="stars" role="group" aria-label={t("stars.group")}>
      {steps.map((n) => (
        // Solo la estrella elegida queda pressed; las anteriores se rellenan solo a la vista.
        <button
          key={n}
          type="button"
          className={n <= value ? "star on" : "star"}
          aria-label={t("stars.star", { count: n })}
          aria-pressed={n === value}
          onClick={() => onChange(n)}
        >
          <Star size={20} aria-hidden="true" fill={n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </span>
  );
}
