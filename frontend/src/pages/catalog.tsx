import { useEffect, useMemo, useRef, useState } from "react";
import { CatalogSkeleton } from "../components/skeleton";
import { EmptyState } from "../components/empty-state";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, SearchX, SlidersHorizontal, X } from "lucide-react";
import { useLanguage } from "../language.tsx";
import { cachedCatalog, fetchCatalog } from "../data.ts";
import {
  summarize,
  type Category,
  type GroupWithOffers,
} from "../lib/offers.ts";
import { matchesQuery } from "../lib/search.ts";
import { activeFilterCount, parseMaxPrice, sliderMax } from "../lib/filters.ts";
import { BELOW_DESKTOP, useMediaQuery } from "../media.ts";
import { FiltersPanel } from "../components/filters-panel.tsx";
import { ProductCard } from "../components/product-card.tsx";

type Sort = "name" | "price-asc" | "price-desc";

const PAGE_SIZE = 48;

const isCategory = (v: string | null): v is Category => v === "cpu" || v === "gpu" || v === "ram";
const isSort = (v: string | null): v is Sort =>
  v === "name" || v === "price-asc" || v === "price-desc";

export function Catalog() {
  const { t } = useTranslation();
  const { locale } = useLanguage();
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
  const maxPrice = parseMaxPrice(params.get("max"));
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
    const list = entries.filter(({ group, summary, text }) => {
      if (category !== "all" && group.category !== category) return false;
      if (storeId !== "all" && !group.offers.some((o) => String(o.store_id) === storeId))
        return false;
      if (onlyInStock && summary.storeCount === 0) return false;
      if (maxPrice != null && (summary.bestPrice == null || summary.bestPrice > maxPrice)) return false;
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
      : a.group.name.localeCompare(b.group.name, locale),
    );
  }, [entries, query, category, storeId, onlyInStock, maxPrice, sort, locale]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: groups.length };
    for (const g of groups) c[g.category] = (c[g.category] ?? 0) + 1;
    return c;
  }, [groups]);

  const belowDesktop = useMediaQuery(BELOW_DESKTOP);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const downOnBackdrop = useRef(false);
  // El diálogo se desmonta al pasar a escritorio, lo que lo cierra.

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const hasFilters =
    query !== "" || category !== "all" || storeId !== "all" || onlyInStock || maxPrice != null;
  const filterCount = activeFilterCount({ category, storeId, maxPrice, onlyInStock });
  const priceLimit = useMemo(() => sliderMax(entries.map((e) => e.summary.bestPrice)), [entries]);

  const clear = () => update({ q: null, cat: null, store: null, stock: null, max: null, page: null });

  if (loading) return <CatalogSkeleton />;
  if (error) return <main className="wrap error">{t("common.error", { message: error })}</main>;

  const filtersPanel = (
    <FiltersPanel
      category={category}
      counts={counts}
      storeId={storeId}
      maxPrice={maxPrice}
      priceLimit={priceLimit}
      onlyInStock={onlyInStock}
      hasFilters={hasFilters}
      onChange={setFilter}
      onClear={clear}
    />
  );

  return (
    <main className="wrap catalog">
      <h1>{t("catalog.title")}</h1>

      <div className="catalog-layout">
        {!belowDesktop && (
          <aside className="filters-side glass" aria-label={t("catalog.filters")}>
            {filtersPanel}
          </aside>
        )}

        <div className="catalog-main">
          <input
            type="search"
            className="search glass"
            placeholder={t("catalog.searchPlaceholder")}
            value={query}
            onChange={(e) => setFilter("q", e.target.value, true)}
            aria-label={t("catalog.searchLabel")}
          />

          <div className="toolbar">
            {belowDesktop && (
              <button
                type="button"
                ref={openerRef}
                className="filters-open glass"
                onClick={() => dialogRef.current?.showModal()}
              >
                <SlidersHorizontal size={18} aria-hidden="true" />
                {filterCount > 0
                  ? t("catalog.filtersCount", { count: filterCount })
                  : t("catalog.filters")}
              </button>
            )}
            <p className="count">
              {t("catalog.count", { shown: filtered.length, count: groups.length })}
            </p>
            <select
              className="field sort"
              value={sort}
              onChange={(e) => setFilter("sort", e.target.value === "name" ? null : e.target.value)}
              aria-label={t("catalog.sortLabel")}
            >
              <option value="name">{t("catalog.sortName")}</option>
              <option value="price-asc">{t("catalog.sortPriceAsc")}</option>
              <option value="price-desc">{t("catalog.sortPriceDesc")}</option>
            </select>
          </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<SearchX size={40} aria-hidden="true" />}>{t("catalog.empty")}</EmptyState>
        ) : (
          <div className="grid">
            {visible.map(({ group }) => (
              <ProductCard key={group.id} group={group} now={now} />
            ))}
          </div>
        )}

        {pages > 1 && (
          <nav className="pager" aria-label={t("catalog.pagination")}>
            <button className="glass" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              <ChevronLeft size={18} aria-hidden="true" />
              {t("catalog.previous")}
            </button>
            <span>
              {t("catalog.pageOf", { current, pages })}
            </span>
            <button className="glass" disabled={current >= pages} onClick={() => setPage(current + 1)}>
              {t("catalog.next")}
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </nav>
        )}
        </div>
      </div>

      {belowDesktop && (
        <dialog
          ref={dialogRef}
          className="filters-dialog"
          aria-label={t("catalog.filters")}
          onPointerDown={(e) => {
            downOnBackdrop.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            // Solo cierra si el toque empezó y terminó sobre el fondo (no en el panel).
            if (e.target === e.currentTarget && downOnBackdrop.current) e.currentTarget.close();
            downOnBackdrop.current = false;
          }}
          onClose={() => openerRef.current?.focus()}
        >
          <div className="dialog-panel">
          <div className="dialog-head">
            <h2>{t("catalog.filters")}</h2>
            <button type="button" className="dialog-close" onClick={() => dialogRef.current?.close()}>
              <X size={18} aria-hidden="true" />
              {t("common.close")}
            </button>
          </div>
          {filtersPanel}
          </div>
        </dialog>
      )}
    </main>
  );
}
