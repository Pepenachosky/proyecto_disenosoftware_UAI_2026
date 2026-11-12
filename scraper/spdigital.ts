// Scraper de productos de SP Digital: nombre, precio y stock (solo fetch, sin navegador).
// Uso:  deno run --env-file=.env --allow-net --allow-env spdigital.ts [cpu|gpu|ram]
// Sin variables de entorno de Supabase solo muestra los productos (modo prueba).
//
// SP Digital está hecho con Gatsby: cada página de categoría tiene un JSON público
// (/page-data/<categoría>/page-data.json) que la propia página pide para dibujarse.
// Ese JSON trae nombre, precios y stock de cada producto, así que no hace falta
// parsear HTML ni usar Playwright.

const BASE = "https://www.spdigital.cl";
const DELAY_MS = 5_000; // crawl-delay de SP Digital (robots.txt)
const USER_AGENT = "ComparadorPreciosUniversidad/0.1 (proyecto academico)";

type Category = "cpu" | "gpu" | "ram";

// Solo páginas de categoría, sin filtros. robots.txt bloquea carrito y checkout.
// "accept" es un seguro extra: solo se guardan nombres que lo cumplan.
// OJO: el formato del JSON se verificó con la categoría de procesadores (8 productos).
// RAM y GPU se asumen iguales (misma plantilla "product-list"); sus URLs de JSON
// no se han probado.
const CATEGORIES: Record<Category, { paths: string[]; accept: RegExp }> = {
  cpu: { paths: ["/categories/componentes-procesador/"], accept: /^procesador/i },
  gpu: {
    paths: ["/categories/componentes-tarjeta-de-video/"],
    accept: /^tarjeta de video/i, // descarta soportes, cables, etc.
  },
  ram: {
    paths: ["/categories/componentes-memorias-ram/"],
    accept: /DDR[2-5]/i, // descarta pendrives, tarjetas SD, etc.
  },
};

export interface ScrapedProduct {
  name: string;
  url: string;
  price: number | null; // CLP, entero (precio de transferencia = "cash" en el JSON)
  // true = quantityAvailable > 0; false = 0. El listado por defecto oculta los agotados,
  // así que en la práctica casi siempre será true.
  inStock: boolean | null;
}

// Forma mínima del JSON que usamos (el resto se ignora).
interface PageData {
  result?: {
    pageContext?: {
      defaultTotalPages?: number;
      defaultTotalProducts?: number;
      defaultProductsPerPage?: number;
      content?: {
        items?: Array<{
          slug?: string;
          name?: string;
          metadata?: Array<{ key: string; value: string }>;
          defaultVariant?: { quantityAvailable?: number | null } | null;
        }>;
      };
    };
  };
}

/** URL del JSON de una categoría: /categories/x/ -> /page-data/categories/x/page-data.json */
export const pageDataUrl = (path: string) => `${BASE}/page-data${path}page-data.json`;

/** Extrae los productos del JSON de una categoría. */
export function parseListing(
  jsonText: string,
): { products: ScrapedProduct[]; totalPages: number; totalProducts: number } {
  const ctx = (JSON.parse(jsonText) as PageData).result?.pageContext;
  const items = ctx?.content?.items ?? [];
  const products: ScrapedProduct[] = [];

  for (const it of items) {
    const name = it.name?.replace(/\s+/g, " ").trim();
    if (!name || !it.slug) continue;

    // El precio de transferencia viene en metadata "pricing": {"sp-digital":{"cash":229990,"other":240340}}
    // ("other" es el precio con otros medios de pago). No se usa pricing.priceRange: no coincide con la web.
    let price: number | null = null;
    const raw = it.metadata?.find((m) => m.key === "pricing")?.value;
    if (raw) {
      try {
        const cash = JSON.parse(raw)?.["sp-digital"]?.cash;
        if (Number.isInteger(cash) && cash > 0) price = cash;
      } catch { /* JSON de precios mal formado: se deja null */ }
    }

    const qty = it.defaultVariant?.quantityAvailable;
    const inStock = typeof qty === "number" ? qty > 0 : null;

    products.push({ name, url: new URL(`/${it.slug}/`, BASE).href, price, inStock });
  }

  return {
    products,
    totalPages: ctx?.defaultTotalPages ?? 1,
    totalProducts: ctx?.defaultTotalProducts ?? products.length,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if ([403, 429, 503].includes(res.status)) {
    // Si el sitio bloquea o pide verificación, se detiene: no se intenta esquivar.
    throw new Error(`${url} respondió ${res.status}: el sitio bloqueó la consulta. Se detiene el scraper.`);
  }
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  return await res.text();
}

/** Lee el JSON de una categoría. */
async function scrapeCategory(path: string): Promise<ScrapedProduct[]> {
  const url = pageDataUrl(path);
  console.log(`Leyendo ${url}`);
  const { products, totalPages, totalProducts } = parseListing(await fetchText(url));
  if (products.length === 0) console.warn("  (sin productos: ¿cambió el JSON o la URL?)");
  // El JSON solo trae la primera página (hasta 48 productos). Las otras se piden desde el navegador
  // con otra API; no se leen aquí.
  if (totalPages > 1 || totalProducts > products.length) {
    console.warn(`  OJO: la categoría tiene ${totalProducts} productos en ${totalPages} páginas; solo se leyó la primera (${products.length}).`);
  }
  console.log(`  ${products.length} productos`);
  return products;
}

/** Guarda en Supabase (REST). Si ya existe (store_id + url) solo actualiza. */
async function save(items: ScrapedProduct[], category: Category) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !KEY) {
    console.log("Sin SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: modo prueba, no se guarda.");
    return;
  }
  const headers: Record<string, string> = { apikey: KEY, "Content-Type": "application/json" };
  // Las claves nuevas (sb_secret_...) no son JWT y solo van en "apikey".
  // La clave legacy service_role también se manda como Bearer.
  if (!KEY.startsWith("sb_")) headers.Authorization = `Bearer ${KEY}`;

  const storeRes = await fetch(`${SUPABASE_URL}/rest/v1/stores?slug=eq.spdigital&select=id`, { headers });
  const stores = await storeRes.json();
  if (!storeRes.ok || !stores[0]) throw new Error(`No encontré la tienda spdigital: ${JSON.stringify(stores)}`);
  const storeId = stores[0].id;

  const now = new Date().toISOString();
  const rows = items.map((p) => ({
    store_id: storeId,
    name: p.name,
    url: p.url,
    category,
    price: p.price,
    in_stock: p.inStock,
    price_updated_at: now,
    last_seen_at: now,
  }));

  for (let i = 0; i < rows.length; i += 100) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?on_conflict=store_id,url`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 100)),
    });
    if (!res.ok) throw new Error(`Error al guardar: ${res.status} ${await res.text()}`);
  }
  console.log(`Guardados ${rows.length} productos (${category}).`);
}

if (import.meta.main) {
  const arg = Deno.args[0] as Category | undefined;
  const cats = (arg ? [arg] : Object.keys(CATEGORIES)) as Category[];
  for (const cat of cats) {
    if (!CATEGORIES[cat]) {
      console.error(`Categoría desconocida: ${cat} (usa cpu, gpu o ram)`);
      Deno.exit(1);
    }
    const { paths, accept } = CATEGORIES[cat];
    const found = new Map<string, ScrapedProduct>(); // sin duplicados por URL
    for (let i = 0; i < paths.length; i++) {
      if (i > 0) await sleep(DELAY_MS);
      for (const p of await scrapeCategory(paths[i])) found.set(p.url, p);
    }
    const items = [...found.values()].filter((p) => accept.test(p.name));
    const descartados = found.size - items.length;
    if (descartados) console.log(`(${descartados} descartados por no coincidir con la categoría)`);
    console.log(`\n${cat}: ${items.length} productos`);
    for (const p of items.slice(0, 5)) console.log(`  - ${p.name} | $${p.price} | stock: ${p.inStock}`);
    await save(items, cat);
    if (cats.indexOf(cat) < cats.length - 1) await sleep(DELAY_MS);
  }
}