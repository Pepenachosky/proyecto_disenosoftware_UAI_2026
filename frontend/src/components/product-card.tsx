import { Link } from "react-router";
import { clp, summarize, type GroupWithOffers } from "../lib/offers.ts";

const CATEGORY_NAMES = { cpu: "CPU", gpu: "GPU", ram: "RAM" } as const;

export function ProductCard({ group, now }: { group: GroupWithOffers; now: Date }) {
  const { bestPrice, storeCount } = summarize(group, now);
  return (
    <Link to={"/producto/" + group.slug} className="card">
      <img
        className="card-img"
        src={group.image_url ?? "/placeholder.png"}
        alt={group.name}
        loading="lazy"
      />
      <span className="card-cat">{CATEGORY_NAMES[group.category]}</span>
      <span className="card-name">{group.name}</span>
      {bestPrice != null ? (
        <>
          <span className="card-price">desde {clp.format(bestPrice)}</span>
          <span className="card-stores">
            en {storeCount} {storeCount === 1 ? "tienda" : "tiendas"}
          </span>
        </>
      ) : (
        <span className="card-price none">Sin stock</span>
      )}
    </Link>
  );
}
