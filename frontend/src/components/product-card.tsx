import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../language.tsx";
import { formatClp, summarize, type GroupWithOffers } from "../lib/offers.ts";
import { ProductImage } from "./product-image.tsx";

const CATEGORY_NAMES = { cpu: "CPU", gpu: "GPU", ram: "RAM" } as const;

export function ProductCard({ group, now }: { group: GroupWithOffers; now: Date }) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const { bestPrice, storeCount } = summarize(group, now);
  return (
    <Link to={"/producto/" + group.slug} className="card">
      <ProductImage
        className="card-img"
        src={group.image_url}
        alt={group.name}
        loading="lazy"
      />
      <span className="card-cat">{CATEGORY_NAMES[group.category]}</span>
      <span className="card-name">{group.name}</span>
      {bestPrice != null ? (
        <>
          <span className="card-price">{t("card.from", { price: formatClp(bestPrice, locale) })}</span>
          <span className="card-stores">
            {t("card.stores", { count: storeCount })}
          </span>
        </>
      ) : (
        <span className="card-price none">{t("card.outOfStock")}</span>
      )}
    </Link>
  );
}
