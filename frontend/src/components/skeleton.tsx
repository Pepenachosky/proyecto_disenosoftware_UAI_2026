import { useTranslation } from "react-i18next";

function Block({ className }: { className: string }) {
  return <div className={"sk " + className} aria-hidden="true" />;
}

export function CatalogSkeleton() {
  const { t } = useTranslation();
  return (
    <main className="wrap catalog" aria-busy="true">
      <span className="sr-only" role="status">{t("common.loadingProducts")}</span>
      <Block className="sk-title" />
      <div className="catalog-layout" aria-hidden="true">
        <div className="sk sk-side" />
        <div className="catalog-main">
          <div className="sk sk-search" />
          <div className="grid">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="sk-card">
                <div className="sk sk-img" />
                <div className="sk sk-line sk-short" />
                <div className="sk sk-line" />
                <div className="sk sk-line sk-price" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export function ProductSkeleton() {
  const { t } = useTranslation();
  return (
    <main className="wrap product" aria-busy="true">
      <span className="sr-only" role="status">{t("common.loadingProduct")}</span>
      <div className="product-layout" aria-hidden="true">
        <div className="product-head">
          <div className="sk sk-product-img" />
          <div className="sk-lines">
            <div className="sk sk-line sk-short" />
            <div className="sk sk-line sk-title-line" />
            <div className="sk sk-line" />
          </div>
        </div>
        <div className="product-rest">
          <div className="sk sk-chart" />
          <div className="sk sk-chart" />
        </div>
        <div className="sk sk-panel" />
      </div>
    </main>
  );
}

export function TableSkeleton() {
  const { t } = useTranslation();
  return (
    <main className="wrap" aria-busy="true">
      <span className="sr-only" role="status">{t("common.loadingSaved")}</span>
      <Block className="sk-title" />
      <div className="sk-table" aria-hidden="true">
        <div className="sk-row sk-row-head">
          <div className="sk sk-cell" />
          <div className="sk sk-cell" />
          <div className="sk sk-cell" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="sk-row">
            <div className="sk sk-cell" />
            <div className="sk sk-cell" />
            <div className="sk sk-cell" />
          </div>
        ))}
      </div>
    </main>
  );
}
