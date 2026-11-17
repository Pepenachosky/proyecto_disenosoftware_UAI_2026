import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../language.tsx";
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
      : a.group.name.localeCompare(b.group.name, locale),
    );
  }, [entries, query, category, storeId, onlyInStock, maxPrice, sort, locale]);

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

  if (loading) return <main className="wrap">{t("common.loading")}</main>;
  if (error) return <main className="wrap error">{t("common.error", { message: error })}</main>;

  return (
    <main className="wrap">
      <h1>{t("catalog.title")}</h1>

      <div className="tabs" role="tablist" aria-label={t("catalog.categoryLabel")}>
        {(["all", "cpu", "gpu", "ram"] as const).map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={category === c}
            className={category === c ? "tab active" : "tab"}
            onClick={() => setFilter("cat", c === "all" ? null : c)}
          >
            {c === "all" ? t("catalog.all") : t(`catalog.categories.${c}`)}
            <span className="badge">{counts[c] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder={t("catalog.searchPlaceholder")}
          value={query}
          onChange={(e) => setFilter("q", e.target.value, true)}
          aria-label={t("catalog.searchLabel")}
        />
        <select
          value={storeId}
          onChange={(e) => setFilter("store", e.target.value === "all" ? null : e.target.value)}
          aria-label={t("catalog.storeLabel")}
        >
          <option value="all">{t("catalog.allStores")}</option>
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
          placeholder={t("catalog.maxPricePlaceholder")}
          value={maxPrice}
          onChange={(e) => setFilter("max", e.target.value, true)}
          aria-label={t("catalog.maxPriceLabel")}
        />
        <select
          value={sort}
          onChange={(e) => setFilter("sort", e.target.value === "name" ? null : e.target.value)}
          aria-label={t("catalog.sortLabel")}
        >
          <option value="name">{t("catalog.sortName")}</option>
          <option value="price-asc">{t("catalog.sortPriceAsc")}</option>
          <option value="price-desc">{t("catalog.sortPriceDesc")}</option>
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={onlyInStock}
            onChange={(e) => setFilter("stock", e.target.checked ? "1" : null)}
          />
          {t("catalog.onlyInStock")}
        </label>
        {hasFilters && (
          <button className="link" onClick={clear}>
            {t("catalog.clearFilters")}
          </button>
        )}
      </div>

      <p className="count">
        {t("catalog.count", { shown: filtered.length, count: groups.length })}
      </p>

      {filtered.length === 0 ? (
        <p className="empty">{t("catalog.empty")}</p>
      ) : (
        <div className="grid">
          {visible.map(({ group }) => (
            <ProductCard key={group.id} group={group} now={now} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="pager" aria-label={t("catalog.pagination")}>
          <button disabled={current <= 1} onClick={() => setPage(current - 1)}>
            {t("catalog.previous")}
          </button>
          <span>
            {t("catalog.pageOf", { current, pages })}
          </span>
          <button disabled={current >= pages} onClick={() => setPage(current + 1)}>
            {t("catalog.next")}
          </button>
        </nav>
      )}
    </main>
  );
}
