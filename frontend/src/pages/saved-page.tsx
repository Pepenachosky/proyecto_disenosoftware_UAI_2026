import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth";
import { useSaved } from "../saved";
import { fetchGroupsByIds } from "../data";
import { LoginButton } from "../components/login-button.tsx";
import {
  clp,
  offerStatus,
  STORES,
  summarize,
  type GroupWithOffers,
  type Offer,
} from "../lib/offers.ts";

const CATEGORY_NAMES = { cpu: "CPU", gpu: "GPU", ram: "RAM" } as const;

type Loaded = { requested: Set<number>; groups: GroupWithOffers[]; error: string | null };

function storeCell(group: GroupWithOffers, storeId: number, now: Date) {
  const offers = group.offers.filter((o) => o.store_id === storeId && o.price != null);
  const byPrice = (a: Offer, b: Offer) => (a.price as number) - (b.price as number);
  const current = offers.filter((o) => offerStatus(o, now) === "vigente").sort(byPrice);
  if (current[0]) return <>{clp.format(current[0].price as number)}</>;
  const stale = offers.sort(byPrice)[0];
  if (!stale) return <>—</>;
  const label = offerStatus(stale, now) === "agotado" ? "Agotado" : "Sin datos recientes";
  return (
    <span className="stale">
      {clp.format(stale.price as number)}
      <br />
      <small>{label}</small>
    </span>
  );
}

export function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const { ids, toggle, loading: savedLoading, pending } = useSaved();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [now] = useState(() => new Date());

  // Solo se vuelve a pedir si aparece un id que no está cargado; quitar una
  // columna con ✕ filtra lo ya cargado, sin esperar a la red.
  const needFetch = !savedLoading && [...ids].some((id) => !loaded?.requested.has(id));
  const fetchKey = needFetch ? [...ids].sort((a, b) => a - b).join(",") : null;

  useEffect(() => {
    if (fetchKey === null) return;
    const want = fetchKey.split(",").map(Number);
    let active = true;
    fetchGroupsByIds(want)
      .then((groups) => active && setLoaded({ requested: new Set(want), groups, error: null }))
      .catch((e) =>
        active &&
        setLoaded({ requested: new Set(), groups: [], error: e instanceof Error ? e.message : String(e) }),
      );
    return () => {
      active = false;
    };
  }, [fetchKey]);

  const columns = useMemo(
    () =>
      (loaded?.groups ?? [])
        .filter((g) => ids.has(g.id))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [loaded, ids],
  );

  if (authLoading) return <main className="wrap">Cargando…</main>;
  if (!user) {
    return (
      <main className="wrap">
        <h1>Guardados</h1>
        <p>Inicia sesión para guardar productos y compararlos</p>
        <LoginButton />
      </main>
    );
  }
  if (needFetch && loaded?.error) return <main className="wrap error">Error: {loaded.error}</main>;
  if (savedLoading || needFetch) return <main className="wrap">Cargando…</main>;

  if (columns.length === 0) {
    return (
      <main className="wrap">
        <h1>Guardados</h1>
        <p className="empty">Aún no guardas productos</p>
        <Link to="/">Ver productos</Link>
      </main>
    );
  }

  const summaries = columns.map((g) => summarize(g, now));
  const prices = summaries.map((s) => s.bestPrice).filter((p): p is number => p != null);
  const minPrice = prices.length ? Math.min(...prices) : null;

  return (
    <main className="wrap">
      <h1>Guardados</h1>
      <div className="table-scroll">
        <table className="compare">
          <thead>
            <tr>
              <th>
                <span className="sr-only">Característica</span>
              </th>
              {columns.map((g) => (
                <th key={g.id} className="compare-head">
                  <button
                    type="button"
                    className="compare-remove"
                    aria-label={`Quitar ${g.name}`}
                    disabled={pending.has(g.id)}
                    onClick={() => void toggle(g.id)}
                  >
                    ✕
                  </button>
                  <Link to={"/producto/" + g.slug}>
                    <img
                      src={g.image_url ?? "/placeholder.png"}
                      alt=""
                      width={70}
                      height={70}
                    />
                    <span>{g.name}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Categoría</th>
              {columns.map((g) => (
                <td key={g.id}>{CATEGORY_NAMES[g.category]}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Mejor precio</th>
              {summaries.map((s, i) => (
                <td key={columns[i].id}>
                  {s.bestPrice == null ? (
                    "Sin stock"
                  ) : s.bestPrice === minPrice ? (
                    <strong>{clp.format(s.bestPrice)}</strong>
                  ) : (
                    clp.format(s.bestPrice)
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Tienda más barata</th>
              {summaries.map((s, i) => (
                <td key={columns[i].id}>
                  {STORES.find((st) => st.id === s.bestStoreId)?.name ?? "—"}
                </td>
              ))}
            </tr>
            {STORES.map((st) => (
              <tr key={st.id}>
                <th scope="row">{st.name}</th>
                {columns.map((g) => (
                  <td key={g.id}>{storeCell(g, st.id, now)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
