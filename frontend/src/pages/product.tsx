import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router";
import { fetchBranches, fetchGroup, type Branch } from "../data";
import {
  sortOffers,
  type SortBy,
  type GroupWithOffers,
} from "../lib/offers.ts";
import { distanceKm } from "../lib/geo.ts";
import { useUserLocation } from "../location.tsx";
import { LocationBar } from "../components/location-bar.tsx";
import { StoreCard } from "../components/store-card.tsx";
import { PriceChart } from "../components/price-chart.tsx";
import { ProductImage } from "../components/product-image.tsx";
import { Reviews } from "../components/reviews.tsx";
import { QuotePanel } from "../components/quote-panel.tsx";

type Result = { slug: string; group: GroupWithOffers | null; error: string | null };

export function ProductPage() {
  const { slug = "" } = useParams();
  const { t } = useTranslation();
  const [result, setResult] = useState<Result | null>(null);
  const [now] = useState(() => new Date());
  const { location, start } = useUserLocation();
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [branchesFailed, setBranchesFailed] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("precio");

  const point = location.estado === "gps" ? location.point : null;

  // Sin ubicación no hay orden por distancia: se usa precio sin perder la elección.
  const effectiveSort: SortBy = point ? sortBy : "precio";

  // Se pide la ubicación solo cuando hay tiendas que mostrar.
  const hasOffers = result?.slug === slug && (result.group?.offers.length ?? 0) > 0;
  useEffect(() => {
    if (hasOffers) start();
  }, [hasOffers, start]);

  useEffect(() => {
    let active = true;
    fetchBranches().then(
      (b) => active && setBranches(b),
      () => active && setBranchesFailed(true),
    );
    return () => {
      active = false;
    };
  }, []);

  const branchByStore = useMemo(
    () => new Map((branches ?? []).map((b) => [b.store_id, b] as const).reverse()),
    [branches],
  );
  const distanceByStore = useMemo(() => {
    const m = new Map<number, number>();
    if (!point) return m;
    for (const [id, b] of branchByStore) {
      if (b.lat != null && b.lng != null) m.set(id, distanceKm(point, { lat: b.lat, lng: b.lng }));
    }
    return m;
  }, [point, branchByStore]);

  useEffect(() => {
    let active = true;
    fetchGroup(slug)
      .then((group) => active && setResult({ slug, group, error: null }))
      .catch((e) =>
        active && setResult({ slug, group: null, error: e instanceof Error ? e.message : String(e) }),
      );
    return () => {
      active = false;
    };
  }, [slug]);

  if (!result || result.slug !== slug) return <main className="wrap">{t("common.loading")}</main>;
  if (result.error) return <main className="wrap error">{t("common.error", { message: result.error })}</main>;
  const group = result.group;
  if (!group) {
    return (
      <main className="wrap">
        <h1>{t("product.notFound")}</h1>
        <Link to="/">{t("product.backToList")}</Link>
      </main>
    );
  }

  const offers = sortOffers(group.offers, now, effectiveSort, distanceByStore);

  return (
    <main className="wrap product">
      <nav className="crumbs" aria-label={t("product.breadcrumb")}>
        <Link to="/">{t("nav.products")}</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link to={`/?cat=${group.category}`}>{t(`product.categories.${group.category}`)}</Link>
      </nav>

      <div className="product-layout">
        <header className="product-head">
          <ProductImage className="product-img" src={group.image_url} alt={group.name} />
          <div className="product-info">
            <span className="product-cat">{t(`product.categories.${group.category}`)}</span>
            <h1 className="product-name">{group.name}</h1>
          </div>
        </header>

        <QuotePanel group={group} now={now}>
          {offers.length === 0 ? (
            <p className="empty">{t("product.noOffers")}</p>
          ) : (
            <>
              <LocationBar />
              <div className="sort-toggle">
                <span>{t("product.sortBy")}</span>
                <button type="button" aria-pressed={effectiveSort === "precio"} onClick={() => setSortBy("precio")}>
                  {t("product.sortPrice")}
                </button>
                {point && distanceByStore.size > 0 && (
                  <button
                    type="button"
                    aria-pressed={effectiveSort === "distancia"}
                    onClick={() => setSortBy("distancia")}
                  >
                    {t("product.sortDistance")}
                  </button>
                )}
              </div>
              {branchesFailed && <p className="store-note">{t("product.branchesFailed")}</p>}
              <ul className="store-list">
                {offers.map((o) => (
                  <li key={o.id}>
                    <StoreCard
                      offer={o}
                      branch={branchByStore.get(o.store_id) ?? null}
                      distance={distanceByStore.get(o.store_id) ?? null}
                      now={now}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </QuotePanel>

        <div className="product-rest">
          <PriceChart offers={group.offers} />
          <Reviews key={group.id} groupId={group.id} />
        </div>
      </div>
    </main>
  );
}
