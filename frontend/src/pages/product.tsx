import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { fetchBranches, fetchGroup, type Branch } from "../data";
import {
  formatClp,
  sortOffers,
  type SortBy,
  STORES,
  summarize,
  type GroupWithOffers,
} from "../lib/offers.ts";
import { distanceKm } from "../lib/geo.ts";
import { useLanguage } from "../language.tsx";
import { useUserLocation } from "../location.tsx";
import { LocationBar } from "../components/location-bar.tsx";
import { StoreCard } from "../components/store-card.tsx";
import { PriceChart } from "../components/price-chart.tsx";
import { ProductImage } from "../components/product-image.tsx";
import { Reviews } from "../components/reviews.tsx";
import { SaveButton } from "../components/save-button.tsx";

const CATEGORY_NAMES = {
  cpu: "Procesador (CPU)",
  gpu: "Tarjeta de video (GPU)",
  ram: "Memoria RAM",
} as const;

const storeName = (id: number | null) => STORES.find((s) => s.id === id)?.name ?? "Tienda";

type Result = { slug: string; group: GroupWithOffers | null; error: string | null };

export function ProductPage() {
  const { slug = "" } = useParams();
  const { locale } = useLanguage();
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

  if (!result || result.slug !== slug) return <main className="wrap">Cargando…</main>;
  if (result.error) return <main className="wrap error">Error: {result.error}</main>;
  const group = result.group;
  if (!group) {
    return (
      <main className="wrap">
        <h1>Producto no encontrado</h1>
        <Link to="/">Volver a la lista</Link>
      </main>
    );
  }

  const { bestPrice, bestStoreId } = summarize(group, now);
  const offers = sortOffers(group.offers, now, effectiveSort, distanceByStore);

  return (
    <main className="wrap product">
      <header className="product-head">
        <ProductImage className="product-img" src={group.image_url} alt={group.name} />
        <div className="product-info">
          <span className="product-cat">{CATEGORY_NAMES[group.category]}</span>
          <h1 className="product-name">{group.name}</h1>
          {bestPrice != null ? (
            <p className="product-price">
              desde <strong>{formatClp(bestPrice, locale)}</strong> en {storeName(bestStoreId)}
            </p>
          ) : (
            <p className="product-price none">Sin stock</p>
          )}
          <SaveButton groupId={group.id} />
        </div>
      </header>

      <section className="product-section">
        <h2>Tiendas</h2>
        {offers.length === 0 ? (
          <p className="empty">Ninguna tienda tiene este producto.</p>
        ) : (
          <>
            <LocationBar />
            <div className="sort-toggle">
              <span>Ordenar por:</span>
              <button type="button" aria-pressed={effectiveSort === "precio"} onClick={() => setSortBy("precio")}>
                Precio
              </button>
              {point && distanceByStore.size > 0 && (
                <button
                  type="button"
                  aria-pressed={effectiveSort === "distancia"}
                  onClick={() => setSortBy("distancia")}
                >
                  Distancia
                </button>
              )}
            </div>
            {branchesFailed && <p className="store-note">No se pudo cargar la ubicación de las tiendas.</p>}
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
      </section>

      <PriceChart offers={group.offers} />
      <Reviews key={group.id} groupId={group.id} />
    </main>
  );
}
