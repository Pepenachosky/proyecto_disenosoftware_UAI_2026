import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import "./app.css";

type Category = "cpu" | "gpu" | "ram";

type Product = {
  id: string | number;
  store_id: string | number;
  name: string;
  url: string | null;
  category: Category | null;
  price: number | null;
  in_stock: boolean | null;
};

type Store = { id: string | number; name?: string; slug?: string };

type Sort = "name" | "price-asc" | "price-desc";

const CATEGORY_LABELS: Record<Category, string> = {
  cpu: "Procesadores (CPU)",
  gpu: "Tarjetas de video (GPU)",
  ram: "Memorias RAM",
};

const PAGE_SIZE = 50;
const SUPABASE_PAGE = 1000;

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

/** Minúsculas y sin tildes, para que "memoria" encuentre "Memória". */
const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

async function fetchAllProducts(): Promise<Product[]> {
  const all: Product[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE) {
    const { data, error } = await supabase
      .from("products")
      .select("id, store_id, name, url, category, price, in_stock")
      .order("id")
      .range(from, from + SUPABASE_PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...(data as Product[]));
    if (data.length < SUPABASE_PAGE) break;
  }
  return all;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [storeId, setStoreId] = useState("all");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const [prods, storesRes] = await Promise.all([
          fetchAllProducts(),
          supabase.from("stores").select("*"),
        ]);
        setProducts(prods);
        setStores((storesRes.data as Store[] | null) ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const storeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of stores) map.set(String(s.id), s.name ?? s.slug ?? String(s.id));
    return (id: string | number) => map.get(String(id)) ?? "—";
  }, [stores]);

  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    const max = maxPrice ? Number(maxPrice) : null;
    const list = products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (storeId !== "all" && String(p.store_id) !== storeId) return false;
      if (onlyInStock && p.in_stock === false) return false;
      if (max != null && (p.price == null || p.price > max)) return false;
      if (words.length) {
        const name = normalize(p.name);
        if (!words.every((w) => name.includes(w))) return false;
      }
      return true;
    });
    const byPrice = (a: Product, b: Product, dir: 1 | -1) =>
      a.price == null ? 1 : b.price == null ? -1 : (a.price - b.price) * dir;
    return list.sort((a, b) =>
      sort === "price-asc" ? byPrice(a, b, 1)
      : sort === "price-desc" ? byPrice(a, b, -1)
      : a.name.localeCompare(b.name, "es"),
    );
  }, [products, query, category, storeId, onlyInStock, maxPrice, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: products.length };
    for (const p of products) if (p.category) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [products]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Cualquier cambio de filtro vuelve a la primera página.
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const hasFilters =
    query || category !== "all" || storeId !== "all" || onlyInStock || maxPrice;

  const clear = () => {
    setQuery("");
    setCategory("all");
    setStoreId("all");
    setOnlyInStock(false);
    setMaxPrice("");
    setPage(1);
  };

  if (loading) return <main className="wrap">Cargando…</main>;
  if (error) return <main className="wrap error">Error: {error}</main>;

  return (
    <main className="wrap">
      <h1>Comparador de hardware</h1>

      <div className="tabs" role="tablist" aria-label="Categoría">
        {(["all", "cpu", "gpu", "ram"] as const).map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={category === c}
            className={category === c ? "tab active" : "tab"}
            onClick={() => reset(setCategory)(c)}
          >
            {c === "all" ? "Todos" : CATEGORY_LABELS[c]}
            <span className="badge">{counts[c] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Buscar producto (ej: ryzen 5 7600, rtx 4060, ddr5 32gb)…"
          value={query}
          onChange={(e) => reset(setQuery)(e.target.value)}
          aria-label="Buscar producto"
        />
        <select
          value={storeId}
          onChange={(e) => reset(setStoreId)(e.target.value)}
          aria-label="Tienda"
        >
          <option value="all">Todas las tiendas</option>
          {stores.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name ?? s.slug}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          step={10000}
          placeholder="Precio máx. (CLP)"
          value={maxPrice}
          onChange={(e) => reset(setMaxPrice)(e.target.value)}
          aria-label="Precio máximo"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Ordenar"
        >
          <option value="name">Nombre (A-Z)</option>
          <option value="price-asc">Precio: menor a mayor</option>
          <option value="price-desc">Precio: mayor a menor</option>
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={onlyInStock}
            onChange={(e) => reset(setOnlyInStock)(e.target.checked)}
          />
          Solo con stock
        </label>
        {hasFilters && (
          <button className="link" onClick={clear}>
            Limpiar filtros
          </button>
        )}
      </div>

      <p className="count">
        {filtered.length} de {products.length} productos
      </p>

      {filtered.length === 0 ? (
        <p className="empty">No hay productos que coincidan con los filtros.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Tienda</th>
                <th>Stock</th>
                <th className="num">Precio</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer noopener">
                        {p.name}
                      </a>
                    ) : (
                      p.name
                    )}
                  </td>
                  <td>{p.category ? CATEGORY_LABELS[p.category] ?? p.category : "—"}</td>
                  <td>{storeName(p.store_id)}</td>
                  <td>
                    {p.in_stock === true ? (
                      <span className="stock yes">Disponible</span>
                    ) : p.in_stock === false ? (
                      <span className="stock no">Agotado</span>
                    ) : (
                      <span className="stock">—</span>
                    )}
                  </td>
                  <td className="num">
                    {p.price != null ? clp.format(p.price) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="pager" aria-label="Paginación">
          <button disabled={current <= 1} onClick={() => setPage(current - 1)}>
            ← Anterior
          </button>
          <span>
            Página {current} de {pages}
          </span>
          <button disabled={current >= pages} onClick={() => setPage(current + 1)}>
            Siguiente →
          </button>
        </nav>
      )}
    </main>
  );
}
