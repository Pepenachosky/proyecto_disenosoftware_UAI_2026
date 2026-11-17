import type { Branch } from "../data";
import { formatKm } from "../lib/geo.ts";
import { openStatus, statusText, weekSchedule } from "../lib/hours.ts";
import { useLanguage } from "../language.tsx";
import { formatClp, offerStatus, STORES, type Offer } from "../lib/offers.ts";

function statusLabel(o: Offer, now: Date): { text: string; className: string } {
  const status = offerStatus(o, now);
  if (status === "agotado") return { text: "Agotado", className: "stock no" };
  if (status === "sin-datos") return { text: "Sin datos recientes", className: "stock" };
  if (o.in_stock === true) return { text: "Disponible", className: "stock yes" };
  return { text: "Stock no informado", className: "stock" };
}

type Props = { offer: Offer; branch: Branch | null; distance: number | null; now: Date };

export function StoreCard({ offer, branch, distance, now }: Props) {
  const { locale } = useLanguage();
  const stock = statusLabel(offer, now);
  const hours = branch?.branch_hours ?? [];
  const open = openStatus(hours, now);
  const place = [branch?.address, branch?.city].filter(Boolean).join(", ");
  const name = STORES.find((s) => s.id === offer.store_id)?.name ?? "Tienda";

  return (
    <article className={offerStatus(offer, now) === "vigente" ? "store-card" : "store-card stale"}>
      <div className="store-top">
        <h3>{name}</h3>
        <strong>{offer.price != null ? formatClp(offer.price, locale) : "—"}</strong>
      </div>
      <p className="store-address">
        {branch?.address ? place : "Sin dirección registrada"}
        {distance != null && ` · ${formatKm(distance)}`}
      </p>
      <p className="store-meta">
        <span className={open == null ? "unknown" : open.open ? "open" : "closed"}>{statusText(open)}</span>
        <span className={stock.className}>{stock.text}</span>
        {offer.url ? (
          <a href={offer.url} target="_blank" rel="noreferrer noopener">
            Ir a la tienda ↗
          </a>
        ) : null}
      </p>
      {hours.length > 0 && (
        <details>
          <summary>Ver horario</summary>
          <table className="schedule">
            <tbody>
              {weekSchedule(hours).map((d) => (
                <tr key={d.day}>
                  <th scope="row">{d.day}</th>
                  <td>{d.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </article>
  );
}
