import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { Branch } from "../data";
import { formatKm } from "../lib/geo.ts";
import { openStatus, weekSchedule, type OpenStatus } from "../lib/hours.ts";
import { useLanguage } from "../language.tsx";
import { formatClp, offerStatus, STORES, type Offer } from "../lib/offers.ts";

function statusLabel(
  o: Offer,
  now: Date,
  t: TFunction,
): { text: string; className: string } {
  const status = offerStatus(o, now);
  if (status === "agotado") return { text: t("saved.soldOut"), className: "stock no" };
  if (status === "sin-datos") return { text: t("saved.noRecentData"), className: "stock" };
  if (o.in_stock === true) return { text: t("store.inStock"), className: "stock yes" };
  return { text: t("store.stockUnknown"), className: "stock" };
}

// 2026-11-15 es domingo: sumando el día de la semana se obtiene ese día en UTC.
const dayName = (locale: string, weekday: number) =>
  new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, 10, 15 + weekday)),
  );

const capitalize = (s: string, locale: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);

function statusText(s: OpenStatus, locale: string, t: TFunction): string {
  if (s === null) return t("hours.unknown");
  if (s.open) return t("hours.open", { time: s.closes });
  if (s.inDays === 0) return t("hours.opensToday", { time: s.opens });
  if (s.inDays === 1) return t("hours.opensTomorrow", { time: s.opens });
  return t("hours.opensOn", { day: dayName(locale, s.weekday), time: s.opens });
}

type Props = { offer: Offer; branch: Branch | null; distance: number | null; now: Date };

export function StoreCard({ offer, branch, distance, now }: Props) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const stock = statusLabel(offer, now, t);
  const hours = branch?.branch_hours ?? [];
  const open = openStatus(hours, now);
  const place = [branch?.address, branch?.city].filter(Boolean).join(", ");
  const name = STORES.find((s) => s.id === offer.store_id)?.name ?? t("store.fallbackName");

  return (
    <article className={offerStatus(offer, now) === "vigente" ? "store-card" : "store-card stale"}>
      <div className="store-top">
        <h3>{name}</h3>
        <strong>{offer.price != null ? formatClp(offer.price, locale) : "—"}</strong>
      </div>
      <p className="store-address">
        {branch?.address ? place : t("store.noAddress")}
        {distance != null && ` · ${formatKm(distance, locale)}`}
      </p>
      <p className="store-meta">
        <span className={open == null ? "unknown" : open.open ? "open" : "closed"}>{statusText(open, locale, t)}</span>
        <span className={stock.className}>{stock.text}</span>
        {offer.url ? (
          <a href={offer.url} target="_blank" rel="noreferrer noopener">
            {t("store.goToStore")}
          </a>
        ) : null}
      </p>
      {hours.length > 0 && (
        <details>
          <summary>{t("store.viewHours")}</summary>
          <table className="schedule">
            <tbody>
              {weekSchedule(hours).map((d) => (
                <tr key={d.weekday}>
                  <th scope="row">{capitalize(dayName(locale, d.weekday), locale)}</th>
                  <td>{d.ranges.length ? d.ranges.join(", ") : t("hours.closed")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </article>
  );
}
