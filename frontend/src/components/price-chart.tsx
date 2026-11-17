import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { buildChartData, currentPrices, type ChartPoint } from "../lib/history.ts";
import { useMediaQuery } from "../media.ts";
import { useLanguage } from "../language.tsx";
import { formatClp, STORES, type Offer } from "../lib/offers.ts";

// Colores por tienda por modo (ni naranja ni amarillo, para no chocar con el
// acento). SP Digital va punteada para no depender solo del color.
type StoreStyle = { color: string; dash?: string };
const STYLE_DARK: Record<string, StoreStyle> = {
  winpy: { color: "#60a5fa" },
  pcexpress: { color: "#c084fc" },
  spdigital: { color: "#34d399", dash: "6 3" },
};
const STYLE_LIGHT: Record<string, StoreStyle> = {
  winpy: { color: "#2563eb" },
  pcexpress: { color: "#7c3aed" },
  spdigital: { color: "#047857", dash: "6 3" },
};

type Result = { offers: Offer[]; data: ChartPoint[] | null; error: string | null };

export function PriceChart({ offers }: { offers: Offer[] }) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  // Los días son fechas UTC (YYYY-MM-DD); t es su medianoche UTC en ms.
  const { compactClp, shortDate, longDate } = useMemo(
    () => ({
      compactClp: new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "CLP",
        notation: "compact",
        maximumSignificantDigits: 3,
      }),
      shortDate: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }),
      longDate: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }),
    }),
    [locale],
  );
  const dark = useMediaQuery("(prefers-color-scheme: dark)");
  // Colores del tema leídos de los tokens; se recalculan al cambiar el modo.
  const theme = useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string) => cs.getPropertyValue(n).trim();
    return { style: dark ? STYLE_DARK : STYLE_LIGHT, border: v("--border"), muted: v("--text-muted"), surface: v("--surface"), text: v("--text") };
  }, [dark]);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let active = true;
    const storeOfProduct = new Map(offers.map((o) => [o.id, o.store_id]));
    fetchHistory(offers.map((o) => o.id))
      .then((rows) => {
        if (!active) return;
        const data = buildChartData(rows, storeOfProduct, currentPrices(offers, new Date())).map(
          (p) => ({ ...p, t: Date.parse(p.date + "T00:00:00Z") }),
        );
        setResult({ offers, data, error: null });
      })
      .catch((e) => {
        if (active) setResult({ offers, data: null, error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      active = false;
    };
  }, [offers]);

  let body;
  if (!result || result.offers !== offers) body = <p className="muted">{t("chart.loading")}</p>;
  else if (result.error) body = <p className="error">{t("common.error", { message: result.error })}</p>;
  else if (!result.data || result.data.length === 0) body = <p className="empty">{t("chart.empty")}</p>;
  else {
    const data = result.data;
    const stores = STORES.filter((s) => data.some((p) => p[s.slug as keyof ChartPoint] != null));
    body = (
      <div className="chart">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={theme.border} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(ms: number) => shortDate.format(ms)}
              tick={{ fill: theme.muted, fontSize: 12 }}
              stroke={theme.border}
              minTickGap={16}
            />
            <YAxis
              width={72}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => compactClp.format(v)}
              tick={{ fill: theme.muted, fontSize: 12 }}
              stroke={theme.border}
            />
            <Tooltip
              formatter={(v) => (typeof v === "number" ? formatClp(v, locale) : String(v))}
              labelFormatter={(ms) => longDate.format(Number(ms))}
              contentStyle={{ background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 8 }}
              labelStyle={{ color: theme.text }}
            />
            <Legend formatter={(value) => <span className="chart-legend">{value}</span>} />
            {stores.map((s) => (
              <Line
                key={s.slug}
                dataKey={s.slug}
                name={s.name}
                type="stepAfter"
                stroke={theme.style[s.slug].color}
                strokeDasharray={theme.style[s.slug].dash}
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
      <h2>{t("chart.title")}</h2>
      {body}
    </section>
  );
}
