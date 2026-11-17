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
  const inStock = bestPrice != null;
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
      {inStock ? (
        <span className="card-price mono">{t("card.from", { price: formatClp(bestPrice, locale) })}</span>
      ) : (
        <span className="card-price none mono" aria-hidden="true">—</span>
      )}
      <span className="card-foot">
        <span className="card-stores">{inStock ? t("card.stores", { count: storeCount }) : ""}</span>
        <span className={inStock ? "card-stock yes" : "card-stock no"}>
          <span className="dot" aria-hidden="true" />
          {inStock ? t("card.inStock") : t("card.outOfStock")}
        </span>
      </span>
    </Link>
  );
}
