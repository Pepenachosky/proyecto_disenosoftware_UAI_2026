import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import { useLanguage } from "../language.tsx";
import { formatClp, stockState, summarize, type GroupWithOffers } from "../lib/offers.ts";
import { averageRating, formatRating, type RatingStats } from "../lib/ratings.ts";
import { ProductImage } from "./product-image.tsx";

const CATEGORY_NAMES = { cpu: "CPU", gpu: "GPU", ram: "RAM" } as const;

// Tarjeta del catálogo que enlaza a la ficha. `now` llega del catálogo para que todas
// las tarjetas evalúen la vigencia con el mismo instante; `rating` falta si no hay reseñas.
export function ProductCard(
  { group, now, rating }: { group: GroupWithOffers; now: Date; rating?: RatingStats },
) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const { bestPrice, storeCount } = summarize(group, now);
  const hasPrice = bestPrice != null;
  const stock = stockState(group, now);
  // Media real (no la puntuación ponderada), solo si hay reseñas.
  const average = rating && rating.count > 0 ? formatRating(averageRating(rating), locale) : null;
  const stockLabel = {
    si: { className: "card-stock yes", text: t("card.inStock") },
    "sin-info": { className: "card-stock unknown", text: t("store.stockUnknown") },
    no: { className: "card-stock no", text: t("card.outOfStock") },
  }[stock];
  return (
    <Link to={"/producto/" + group.slug} className="card">
      <span className="card-frame">
        <ProductImage
          className="card-img"
          src={group.image_url}
          alt={group.name}
          loading="lazy"
        />
      </span>
      <span className="card-cat">{CATEGORY_NAMES[group.category]}</span>
      <span className="card-name">{group.name}</span>
      {hasPrice ? (
        <span className="card-price mono">{t("card.from", { price: formatClp(bestPrice, locale) })}</span>
      ) : (
        // Sin precio vigente: guion decorativo; el estado de stock de abajo lo explica.
        <span className="card-price none mono" aria-hidden="true">—</span>
      )}
      {/* role="img" con aria-label: se lee como una frase y no como números sueltos. */}
      {average != null && rating && (
        <span
          className="card-rating"
          role="img"
          aria-label={t("card.rating", { value: average, count: rating.count })}
        >
          <Star size={14} aria-hidden="true" fill="currentColor" />
          <span className="mono">{average}</span>
          <span className="mono">({rating.count})</span>
        </span>
      )}
      <span className="card-foot">
        <span className="card-stores">{hasPrice ? t("card.stores", { count: storeCount }) : ""}</span>
        <span className={stockLabel.className}>
          <span className="dot" aria-hidden="true" />
          {stockLabel.text}
        </span>
      </span>
    </Link>
  );
}
