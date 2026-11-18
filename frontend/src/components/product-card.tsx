import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../language.tsx";
import { formatClp, stockState, summarize, type GroupWithOffers } from "../lib/offers.ts";
import { ProductImage } from "./product-image.tsx";

const CATEGORY_NAMES = { cpu: "CPU", gpu: "GPU", ram: "RAM" } as const;

export function ProductCard({ group, now }: { group: GroupWithOffers; now: Date }) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const { bestPrice, storeCount } = summarize(group, now);
  const hasPrice = bestPrice != null;
  const stock = stockState(group, now);
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
        <span className="card-price none mono" aria-hidden="true">—</span>
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
