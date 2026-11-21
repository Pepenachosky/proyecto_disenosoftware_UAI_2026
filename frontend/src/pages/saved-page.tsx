import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { TableSkeleton } from "../components/skeleton";
import { EmptyState } from "../components/empty-state";
import { useTranslation } from "react-i18next";
import { Bookmark, X } from "lucide-react";
import type { TFunction } from "i18next";
import { useLanguage } from "../language.tsx";
import { useAuth } from "../auth";
import { useSaved } from "../saved";
import { fetchGroupsByIds } from "../data";
import { LoginButton } from "../components/login-button.tsx";
import { cheapestOf, groupByCategory } from "../lib/compare.ts";
import { ProductImage } from "../components/product-image.tsx";
import {
  formatClp,
  offerStatus,
  STORES,
  summarize,
  type GroupWithOffers,
  type Offer,
} from "../lib/offers.ts";

type Loaded = { requested: Set<number>; groups: GroupWithOffers[]; error: string | null };

function storeCell(
  group: GroupWithOffers,
  storeId: number,
  now: Date,
  t: TFunction,
  locale: string,
) {
  const offers = group.offers.filter((o) => o.store_id === storeId && o.price != null);
  const byPrice = (a: Offer, b: Offer) => (a.price as number) - (b.price as number);
  const current = offers.filter((o) => offerStatus(o, now) === "vigente").sort(byPrice);
  if (current[0]) return <>{formatClp(current[0].price as number, locale)}</>;
  const stale = offers.sort(byPrice)[0];
  if (!stale) return <>—</>;
  const soldOut = offerStatus(stale, now) === "agotado";
  const label = soldOut ? t("saved.soldOut") : t("saved.noRecentData");
  return (
    <span className={soldOut ? "stale stale-out" : "stale"}>
      {formatClp(stale.price as number, locale)}
      <br />
      <small>{label}</small>
    </span>
  );
}

function CompareTable({
  columns,
  now,
  pending,
  onRemove,
}: {
  columns: GroupWithOffers[];
  now: Date;
  pending: Set<number>;
  onRemove: (id: number) => void;
}) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const summaries = columns.map((g) => summarize(g, now));
  // "Más barato" se decide dentro de esta tabla, nunca entre categorías.
  const minPrice = cheapestOf(summaries.map((s) => s.bestPrice));

  return (
    <div className="table-scroll compare-wrap">
      <table className="compare">
        <thead>
          <tr>
            <th>
              <span className="sr-only">{t("saved.feature")}</span>
            </th>
            {columns.map((g) => (
              <th key={g.id} className="compare-head">
                <button
                  type="button"
                  className="compare-remove"
                  aria-label={t("saved.remove", { name: g.name })}
                  disabled={pending.has(g.id)}
                  onClick={() => onRemove(g.id)}
                >
                  <X size={16} aria-hidden="true" />
                </button>
                <Link to={"/producto/" + g.slug}>
                  <ProductImage
                    src={g.image_url}
                    alt=""
                    width={70}
                    height={70}
                    loading="lazy"
                  />
                  <span>{g.name}</span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{t("saved.bestPrice")}</th>
            {summaries.map((s, i) => (
              <td key={columns[i].id}>
                {s.bestPrice == null ? (
                  t("saved.noStock")
                ) : s.bestPrice === minPrice ? (
                  <>
                    <span className="mono cheapest">{formatClp(s.bestPrice, locale)}</span>
                    <span className="compare-tag">{t("saved.cheapest")}</span>
                  </>
                ) : (
                  <span className="mono">{formatClp(s.bestPrice, locale)}</span>
                )}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">{t("saved.cheapestStore")}</th>
            {summaries.map((s, i) => (
              <td key={columns[i].id}>
                {STORES.find((st) => st.id === s.bestStoreId)?.name ?? "—"}
              </td>
            ))}
          </tr>
          {STORES.map((st) => (
            <tr key={st.id}>
              <th scope="row">{st.name}</th>
              {columns.map((g, i) => (
                <td
                  key={g.id}
                  className={summaries[i].bestStoreId === st.id ? "mono cheapest" : "mono"}
                >
                  {storeCell(g, st.id, now, t, locale)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SavedPage() {
  const { t } = useTranslation();
  const { locale } = useLanguage();
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

  // Una tabla por categoría (CPU, RAM, GPU): no se compara una CPU con una RAM.
  const sections = useMemo(
    () => groupByCategory((loaded?.groups ?? []).filter((g) => ids.has(g.id)), locale),
    [loaded, ids, locale],
  );
  const total = sections.reduce((n, s) => n + s.items.length, 0);

  if (authLoading) return <TableSkeleton />;
  if (!user) {
    return (
      <main className="wrap">
        <h1>{t("saved.title")}</h1>
        <p>{t("saved.loginPrompt")}</p>
        <LoginButton />
      </main>
    );
  }
  if (needFetch && loaded?.error) return <main className="wrap error">{t("common.error", { message: loaded.error })}</main>;
  if (savedLoading || needFetch) return <TableSkeleton />;

  if (total === 0) {
    return (
      <main className="wrap">
        <h1>{t("saved.title")}</h1>
        <EmptyState icon={<Bookmark size={40} aria-hidden="true" />}>{t("saved.empty")}</EmptyState>
      </main>
    );
  }

  return (
    <main className="wrap">
      <h1>{t("saved.title")}</h1>
      <p className="saved-subtitle">{t("saved.subtitle", { count: total })}</p>
      {sections.map(({ category, items }) => (
        <section key={category} className="saved-section" aria-labelledby={"saved-" + category}>
          <h2 id={"saved-" + category} className="saved-section-title">
            {t(`catalog.categories.${category}`)}
          </h2>
          <CompareTable
            columns={items}
            now={now}
            pending={pending}
            onRemove={(id) => void toggle(id)}
          />
        </section>
      ))}
    </main>
  );
}
