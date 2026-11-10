import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { cachedCatalog, fetchCatalog } from "../data.ts";
import {
  STORES,
  summarize,
  type Category,
  type GroupWithOffers,
} from "../lib/offers.ts";
import { matchesQuery } from "../lib/search.ts";
import { ProductCard } from "../components/product-card.tsx";

type Sort = "name" | "price-asc" | "price-desc";

const CATEGORY_LABELS: Record<Category, string> = {
  cpu: "Procesadores (CPU)",
  gpu: "Tarjetas de video (GPU)",
  ram: "Memorias RAM",
};

const PAGE_SIZE = 48;

const isCategory = (v: string | null): v is Category => v === "cpu" || v === "gpu" || v === "ram";
const isSort = (v: string | null): v is Sort =>
  v === "name" || v === "price-asc" || v === "price-desc";

export function Catalog() {
  const [groups, setGroups] = useState<GroupWithOffers[]>(() => cachedCatalog() ?? []);
  const [loading, setLoading] = useState(() => cachedCatalog() === null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  // Filtros, búsqueda y página viven en la URL (?q=&cat=&store=&max=&stock=&sort=&page=)
  // para conservarlos al volver desde un producto o tras iniciar sesión.
  // Los valores por defecto no se escriben.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const catParam = params.get("cat");
  const category: Category | "all" = isCategory(catParam) ? catParam : "all";
  const storeId = params.get("store") ?? "all";
  const maxPrice = params.get("max") ?? "";
  const onlyInStock = params.get("stock") === "1";
  const sortParam = params.get("sort");
  const sort: Sort = isSort(sortParam) ? sortParam : "name";
  const page = Math.max(1, Math.floor(Number(params.get("page"))) || 1);

  const update = (changes: Record<string, string | null>, replace = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v == null || v === "") next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace },
    );
  // Cualquier cambio de filtro vuelve a la primera página.
  const setFilter = (k: string, v: string | null, replace = false) =>
    update({ [k]: v, page: null }, replace);
  const setPage = (p: number) => update({ page: p > 1 ? String(p) : null });

  useEffect(() => {
    let active = true;
    fetchCatalog()
      .then((g) => active && setGroups(g))
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const entries = useMemo(
    () =>
      groups.map((group) => ({
        group,
        summary: summarize(group, now),
        text: group.name + " " + group.offers.map((o) => o.name).join(" "),
      })),
    [groups, now],
  );

  const filtered = useMemo(() => {
    const max = maxPrice ? Number(maxPrice) : null;
    const list = entries.filter(({ group, summary, text }) => {
      if (category !== "all" && group.category !== category) return false;
      if (storeId !== "all" && !group.offers.some((o) => String(o.store_id) === storeId))
        return false;
      if (onlyInStock && summary.storeCount === 0) return false;
      if (max != null && (summary.bestPrice == null || summary.bestPrice > max)) return false;
      return matchesQuery(text, query);
    });
    const byPrice = (a: (typeof list)[number], b: (typeof list)[number], dir: 1 | -1) => {
      const pa = a.summary.bestPrice;
      const pb = b.summary.bestPrice;
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return (pa - pb) * dir;
    };
    return list.sort((a, b) =>
      sort === "price-asc" ? byPrice(a, b, 1)
      : sort === "price-desc" ? byPrice(a, b, -1)
      : a.group.name.localeCompare(b.group.name, "es"),
    );
  }, [entries, query, category, storeId, onlyInStock, maxPrice, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: groups.length };
    for (const g of groups) c[g.category] = (c[g.category] ?? 0) + 1;
    return c;
  }, [groups]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const hasFilters =
    query || category !== "all" || storeId !== "all" || onlyInStock || maxPrice;

  const clear = () => update({ q: null, cat: null, store: null, stock: null, max: null, page: null });

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
            onClick={() => setFilter("cat", c === "all" ? null : c)}
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
          onChange={(e) => setFilter("q", e.target.value, true)}
          aria-label="Buscar producto"
        />
        <select
          value={storeId}
          onChange={(e) => setFilter("store", e.target.value === "all" ? null : e.target.value)}
          aria-label="Tienda"
        >
          <option value="all">Todas las tiendas</option>
          {STORES.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          step={10000}
          placeholder="Precio máx. (CLP)"
          value={maxPrice}
          onChange={(e) => setFilter("max", e.target.value, true)}
          aria-label="Precio máximo"
        />
        <select
          value={sort}
          onChange={(e) => setFilter("sort", e.target.value === "name" ? null : e.target.value)}
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
            onChange={(e) => setFilter("stock", e.target.checked ? "1" : null)}
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
        {filtered.length} de {groups.length} productos
      </p>

      {filtered.length === 0 ? (
        <p className="empty">No hay productos que coincidan con los filtros.</p>
      ) : (
        <div className="grid">
          {visible.map(({ group }) => (
            <ProductCard key={group.id} group={group} now={now} />
          ))}
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
