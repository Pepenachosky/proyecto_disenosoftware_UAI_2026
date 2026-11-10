import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchHistory } from "../data";
import { buildChartData, type ChartPoint } from "../lib/history.ts";
import { clp, STORES, type Offer } from "../lib/offers.ts";

// Colores por tienda (fijos, legibles en claro y oscuro). SP Digital va
// punteada para no depender solo del color (verde/naranja en deuteranopía).
const STYLE: Record<string, { color: string; dash?: string }> = {
  winpy: { color: "#2563eb" },
  pcexpress: { color: "#ea580c" },
  spdigital: { color: "#16a34a", dash: "6 3" },
};

const compactClp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  notation: "compact",
  maximumFractionDigits: 1,
});

const shortDate = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;
const longDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-CL");

type Result = { offers: Offer[]; data: ChartPoint[] | null; error: string | null };

export function PriceChart({ offers }: { offers: Offer[] }) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let active = true;
    const storeOfProduct = new Map(offers.map((o) => [o.id, o.store_id]));
    fetchHistory(offers.map((o) => o.id))
      .then((rows) => {
        if (active) setResult({ offers, data: buildChartData(rows, storeOfProduct), error: null });
      })
      .catch((e) => {
        if (active) setResult({ offers, data: null, error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      active = false;
    };
  }, [offers]);

  let body;
  if (!result || result.offers !== offers) body = <p className="muted">Cargando historial…</p>;
  else if (result.error) body = <p className="error">Error: {result.error}</p>;
  else if (!result.data || result.data.length === 0) body = <p className="empty">Aún no hay historial</p>;
  else {
    const data = result.data;
    const stores = STORES.filter((s) => data.some((p) => p[s.slug as keyof ChartPoint] != null));
    body = (
      <div className="chart">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(128, 128, 128, 0.25)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: "currentColor", fontSize: 12 }}
              stroke="rgba(128, 128, 128, 0.5)"
              minTickGap={16}
            />
            <YAxis
              width={72}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => compactClp.format(v)}
              tick={{ fill: "currentColor", fontSize: 12 }}
              stroke="rgba(128, 128, 128, 0.5)"
            />
            <Tooltip
              formatter={(v) => (typeof v === "number" ? clp.format(v) : String(v))}
              labelFormatter={(d) => longDate(String(d))}
              contentStyle={{ background: "Canvas", color: "CanvasText", borderRadius: 6 }}
            />
            <Legend formatter={(value) => <span className="chart-legend">{value}</span>} />
            {stores.map((s) => (
              <Line
                key={s.slug}
                dataKey={s.slug}
                name={s.name}
                type="stepAfter"
                stroke={STYLE[s.slug].color}
                strokeDasharray={STYLE[s.slug].dash}
                strokeWidth={2}
                dot={data.length <= 20 ? { r: 3 } : false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <section className="product-section">
      <h2>Historial de precios</h2>
      {body}
    </section>
  );
}
