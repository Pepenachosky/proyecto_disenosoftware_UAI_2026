import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { fetchGroup } from "../data";
import {
  clp,
  offerStatus,
  sortOffers,
  STORES,
  summarize,
  type GroupWithOffers,
  type Offer,
} from "../lib/offers.ts";
import { PriceChart } from "../components/price-chart.tsx";
import { Reviews } from "../components/reviews.tsx";
import { SaveButton } from "../components/save-button.tsx";

const CATEGORY_NAMES = {
  cpu: "Procesador (CPU)",
  gpu: "Tarjeta de video (GPU)",
  ram: "Memoria RAM",
} as const;

const storeName = (id: number | null) => STORES.find((s) => s.id === id)?.name ?? "Tienda";

function statusLabel(o: Offer, now: Date): { text: string; className: string } {
  const status = offerStatus(o, now);
  if (status === "agotado") return { text: "Agotado", className: "stock no" };
  if (status === "sin-datos") return { text: "Sin datos recientes", className: "stock" };
  if (o.in_stock === true) return { text: "Disponible", className: "stock yes" };
  return { text: "Stock no informado", className: "stock" };
}

type Result = { slug: string; group: GroupWithOffers | null; error: string | null };

export function ProductPage() {
  const { slug = "" } = useParams();
  const [result, setResult] = useState<Result | null>(null);
  const [now] = useState(() => new Date());

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
  const offers = sortOffers(group.offers, now);

  return (
    <main className="wrap product">
      <header className="product-head">
        <img
          className="product-img"
          src={group.image_url ?? "/placeholder.png"}
          alt={group.name}
        />
        <div className="product-info">
          <span className="product-cat">{CATEGORY_NAMES[group.category]}</span>
          <h1 className="product-name">{group.name}</h1>
          {bestPrice != null ? (
            <p className="product-price">
              desde <strong>{clp.format(bestPrice)}</strong> en {storeName(bestStoreId)}
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
          <div className="table-scroll">
            <table className="offers">
              <thead>
                <tr>
                  <th>Tienda</th>
                  <th>Estado</th>
                  <th className="num">Precio</th>
                  <th>
                    <span className="sr-only">Enlace</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => {
                  const status = statusLabel(o, now);
                  return (
                    <tr key={o.id} className={offerStatus(o, now) === "vigente" ? undefined : "stale"}>
                      <td>{storeName(o.store_id)}</td>
                      <td className={status.className}>{status.text}</td>
                      <td className="num">{o.price != null ? clp.format(o.price) : "—"}</td>
                      <td>
                        {o.url ? (
                          <a href={o.url} target="_blank" rel="noreferrer noopener">
                            Ir a la tienda ↗
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PriceChart offers={group.offers} />
      <Reviews key={group.id} groupId={group.id} />
    </main>
  );
}
