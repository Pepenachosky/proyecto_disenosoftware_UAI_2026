// Página de producto: compara las ofertas de un grupo entre tiendas, con orden por
// precio o por distancia (si el usuario compartió su ubicación).
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, PackageX } from "lucide-react";
import { ProductSkeleton } from "../components/skeleton";
import { EmptyState } from "../components/empty-state";
import { Link, useParams } from "react-router";
import { fetchBranches, fetchGroup, type Branch } from "../data";
import {
  bestOffer,
  sortOffers,
  summarize,
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

// El resultado guarda el slug que lo pidió: al navegar a otro producto, el anterior
// no se muestra mientras llega el nuevo.
type Result = { slug: string; group: GroupWithOffers | null; error: string | null };

/**
 * Detalle de un grupo de producto (/producto/:slug): ofertas por tienda con
 * sucursal y distancia, cotización, historial de precios y reseñas. Depende de
 * LocationProvider para la distancia y de data.ts para grupo y sucursales.
 */
export function ProductPage() {
  const { slug = "" } = useParams();
  const { t } = useTranslation();
  const [result, setResult] = useState<Result | null>(null);
  // "Ahora" fijo al montar: estado de ofertas y horarios coherentes en toda la página.
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

  // Si fallan las sucursales la página sigue: solo faltan dirección, horario y distancia.
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

  // Una sucursal por tienda. Map conserva el último valor de cada clave, por eso se
  // invierte la lista: así gana la primera sucursal de cada tienda.
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
    // `active` descarta la respuesta si el slug cambió antes de que llegara.
    fetchGroup(slug)
      .then((group) => active && setResult({ slug, group, error: null }))
      .catch((e) =>
        active && setResult({ slug, group: null, error: e instanceof Error ? e.message : String(e) }),
      );
    return () => {
      active = false;
    };
  }, [slug]);

  if (!result || result.slug !== slug) return <ProductSkeleton />;
  if (result.error) return <main className="wrap error">{t("common.error", { message: result.error })}</main>;
  const group = result.group;
  if (!group) {
    return (
      <main className="wrap">
        <EmptyState heading icon={<PackageX size={40} aria-hidden="true" />}>{t("product.notFound")}</EmptyState>
      </main>
    );
  }

  const offers = sortOffers(group.offers, now, effectiveSort, distanceByStore);
  const bestId = bestOffer(offers, now, summarize(group, now))?.id;

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
                {/* Ordenar por distancia solo tiene sentido con GPS y sucursales con coordenadas. */}
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
                      best={o.id === bestId}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </QuotePanel>

        <div className="product-rest">
          <PriceChart offers={group.offers} />
          {/* key: al cambiar de producto se reinicia el estado interno de las reseñas. */}
          <Reviews key={group.id} groupId={group.id} />
        </div>
      </div>
    </main>
  );
}
