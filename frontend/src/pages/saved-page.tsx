import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useLanguage } from "../language.tsx";
import { useAuth } from "../auth";
import { useSaved } from "../saved";
import { fetchGroupsByIds } from "../data";
import { LoginButton } from "../components/login-button.tsx";
import { ProductImage } from "../components/product-image.tsx";
import {
  formatClp,
  offerStatus,
  STORES,
  summarize,
  type GroupWithOffers,
  type Offer,
} from "../lib/offers.ts";

const CATEGORY_NAMES = { cpu: "CPU", gpu: "GPU", ram: "RAM" } as const;

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
  const label = offerStatus(stale, now) === "agotado" ? t("saved.soldOut") : t("saved.noRecentData");
  return (
    <span className="stale">
      {formatClp(stale.price as number, locale)}
      <br />
      <small>{label}</small>
    </span>
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

  const columns = useMemo(
    () =>
      (loaded?.groups ?? [])
        .filter((g) => ids.has(g.id))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [loaded, ids, locale],
  );

  if (authLoading) return <main className="wrap">{t("common.loading")}</main>;
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
  if (savedLoading || needFetch) return <main className="wrap">{t("common.loading")}</main>;

  if (columns.length === 0) {
    return (
      <main className="wrap">
        <h1>{t("saved.title")}</h1>
        <p className="empty">{t("saved.empty")}</p>
        <Link to="/">{t("saved.viewProducts")}</Link>
      </main>
    );
  }

  const summaries = columns.map((g) => summarize(g, now));
  const prices = summaries.map((s) => s.bestPrice).filter((p): p is number => p != null);
  const minPrice = prices.length ? Math.min(...prices) : null;

  return (
    <main className="wrap">
      <h1>{t("saved.title")}</h1>
      <div className="table-scroll">
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
                    onClick={() => void toggle(g.id)}
                  >
                    ✕
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
              <th scope="row">{t("saved.category")}</th>
              {columns.map((g) => (
                <td key={g.id}>{CATEGORY_NAMES[g.category]}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">{t("saved.bestPrice")}</th>
              {summaries.map((s, i) => (
                <td key={columns[i].id}>
                  {s.bestPrice == null ? (
                    t("saved.noStock")
                  ) : s.bestPrice === minPrice ? (
                    <strong>{formatClp(s.bestPrice, locale)}</strong>
                  ) : (
                    formatClp(s.bestPrice, locale)
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
                {columns.map((g) => (
                  <td key={g.id}>{storeCell(g, st.id, now, t, locale)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
