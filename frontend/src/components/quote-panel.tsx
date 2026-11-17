import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { useLanguage } from "../language.tsx";
import {
  bestOffer,
  formatClp,
  priceSpread,
  sortOffers,
  STORES,
  summarize,
  type GroupWithOffers,
} from "../lib/offers.ts";
import { SaveButton } from "./save-button.tsx";

export function QuotePanel(
  { group, now, children }: { group: GroupWithOffers; now: Date; children: ReactNode },
) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const { bestPrice, bestStoreId, storeCount } = summarize(group, now);
  const spread = priceSpread(group, now);
  const storeName = STORES.find((s) => s.id === bestStoreId)?.name ?? t("store.fallbackName");
  const url = bestOffer(sortOffers(group.offers, now), now, { bestPrice, bestStoreId })?.url ?? null;

  return (
    <aside className="quote glass">
      <div className="quote-best">
        {bestPrice != null
          ? (
            <>
              <span className="quote-label">{t("product.bestToday")}</span>
              <span className="quote-price mono">{formatClp(bestPrice, locale)}</span>
              <span className="quote-store">{t("product.atStore", { store: storeName })}</span>
              {spread && (
                <span className="quote-savings">
                  {t("product.savings", { price: formatClp(spread.savings, locale) })}
                </span>
              )}
            </>
          )
          : <span className="quote-none">{t("card.outOfStock")}</span>}
        <div className="quote-actions">
          {url && (
            <a className="quote-go" href={url} target="_blank" rel="noreferrer noopener">
              <ExternalLink size={18} aria-hidden="true" />
              {t("store.goToStore")}
            </a>
          )}
          <SaveButton groupId={group.id} />
        </div>
      </div>
      <section className="quote-compare">
        <h2 className="quote-title">
          {t("product.compare")}
          <span className="quote-count">{t("product.storesCount", { count: storeCount })}</span>
        </h2>
        <div className="quote-scroll">{children}</div>
      </section>
    </aside>
  );
}
