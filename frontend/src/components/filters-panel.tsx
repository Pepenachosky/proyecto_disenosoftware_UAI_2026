import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../language.tsx";
import { PRICE_STEP, maxParamFromSlider, sliderValue } from "../lib/filters.ts";
import { STORES, formatClp, type Category } from "../lib/offers.ts";

type Props = {
  category: Category | "all";
  // Productos por categoría; la clave "all" es el total.
  counts: Record<string, number>;
  storeId: string;
  maxPrice: number | null;
  // Tope del deslizador; llevarlo al tope equivale a "sin límite" (max = null).
  priceLimit: number;
  onlyInStock: boolean;
  hasFilters: boolean;
  // Cambia un parámetro de la URL (null lo quita). `replace` reemplaza la entrada del
  // historial en vez de apilar una nueva: el deslizador emite muchos cambios seguidos.
  onChange: (key: "cat" | "store" | "max" | "stock", value: string | null, replace?: boolean) => void;
  onClear: () => void;
};

// Lo usa el catálogo: los filtros viven en la URL y este panel solo emite cambios.
// Controles de filtro; no sabe si está en la barra lateral o en el diálogo.
export function FiltersPanel({
  category,
  counts,
  storeId,
  maxPrice,
  priceLimit,
  onlyInStock,
  hasFilters,
  onChange,
  onClear,
}: Props) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const id = useId();
  const value = sliderValue(maxPrice, priceLimit);
  // En el tope se muestra "sin límite" en vez de un precio.
  const unlimited = value >= priceLimit;

  return (
    <div className="filters-panel">
      <section aria-labelledby={id + "-cat"}>
        <h2 id={id + "-cat"} className="filters-title">{t("catalog.categoryLabel")}</h2>
        <ul className="cat-list">
          {(["all", "cpu", "gpu", "ram"] as const).map((c) => (
            <li key={c}>
              <button
                type="button"
                aria-pressed={category === c}
                className={category === c ? "cat-btn active" : "cat-btn"}
                onClick={() => onChange("cat", c === "all" ? null : c)}
              >
                <span>{c === "all" ? t("catalog.all") : t(`catalog.categories.${c}`)}</span>
                <span className="badge mono">{counts[c] ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <label className="filters-title" htmlFor={id + "-store"}>{t("catalog.storeLabel")}</label>
        <select
          id={id + "-store"}
          className="field"
          value={storeId}
          onChange={(e) => onChange("store", e.target.value === "all" ? null : e.target.value)}
        >
          <option value="all">{t("catalog.allStores")}</option>
          {STORES.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </select>
      </section>

      <section>
        <label className="filters-title" htmlFor={id + "-max"}>{t("catalog.maxPriceLabel")}</label>
        {/* aria-valuetext: el lector anuncia el precio formateado (o "sin límite") y no el número crudo. */}
        <input
          id={id + "-max"}
          type="range"
          className="range"
          min={0}
          max={priceLimit}
          step={PRICE_STEP}
          value={value}
          aria-valuetext={unlimited ? t("catalog.noLimit") : formatClp(value, locale)}
          onChange={(e) => onChange("max", maxParamFromSlider(Number(e.target.value), priceLimit), true)}
        />
        <output htmlFor={id + "-max"} className="range-value mono">
          {unlimited ? t("catalog.noLimit") : formatClp(value, locale)}
        </output>
      </section>

      <section>
        <h2 className="filters-title">{t("catalog.availability")}</h2>
        {/* role="switch": se anuncia como interruptor; la pista dibujada es decorativa (aria-hidden). */}
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={onlyInStock}
            onChange={(e) => onChange("stock", e.target.checked ? "1" : null)}
          />
          <span className="switch-track" aria-hidden="true" />
          <span>{t("catalog.onlyInStock")}</span>
        </label>
      </section>

      {hasFilters && (
        <button type="button" className="link" onClick={onClear}>
          {t("catalog.clearFilters")}
        </button>
      )}
    </div>
  );
}
