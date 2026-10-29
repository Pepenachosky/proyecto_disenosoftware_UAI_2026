// Scraper de nombres de productos de SP Digital (solo fetch + parser HTML).
// Uso:  deno run --env-file=.env --allow-net --allow-env spdigital.ts [cpu|gpu|ram]
// Sin variables de entorno de Supabase solo muestra los productos (modo prueba).

import { DOMParser } from "npm:linkedom@0.18.5";

const BASE = "https://www.spdigital.cl";
const DELAY_MS = 5_000; // crawl-delay de SP Digital (robots.txt)
const MAX_PAGES = 10; // tope de seguridad por categoría
const USER_AGENT = "ComparadorPreciosUniversidad/0.1 (proyecto academico)";

type Category = "cpu" | "gpu" | "ram";

// Solo páginas de categoría, sin filtros. robots.txt bloquea carrito y checkout.
// "accept" es un seguro extra: solo se guardan nombres que lo cumplan.
// OJO: cpu (8 productos), gpu (5) y ram (14, incluye notebook/SODIMM) se verificaron
// con HTML real, todas de 1 sola página. El listado por defecto oculta los agotados.
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
}

/** Extrae productos y enlaces de paginación de una página de listado. */
export function parseListing(
  html: string,
): { products: ScrapedProduct[]; pages: string[] } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const products: ScrapedProduct[] = [];

  for (const card of doc.querySelectorAll(".Fractal-ProductCard__productcard--container")) {
    // El primer enlace de la tarjeta solo trae la marca ("AMD"); el nombre
    // completo está en el contenedor de descripción.
    const link = card.querySelector(".Fractal-ProductCard--productDescriptionTextContainer a");
    const name = link?.textContent.replace(/\s+/g, " ").trim();
    const href = link?.getAttribute("href");
    if (!name || !href) continue;
    products.push({ name, url: new URL(href, BASE).href });
  }

  // La página 1 viene como ".../?" (con "?" vacío): se quita para no pedirla dos veces.
  // OJO: el formato de las páginas siguientes no está verificado (la prueba tenía 1 sola).
  const pages = [...doc.querySelectorAll(".Fractal-Pagination--pagination a")]
    .map((a) => a.getAttribute("href"))
    .filter((h): h is string => !!h)
    .map((h) => new URL(h, BASE).href.replace(/\?$/, ""));

  return { products, pages };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if ([403, 429, 503].includes(res.status)) {
    // Si el sitio bloquea o pide verificación, se detiene: no se intenta esquivar.
    throw new Error(`${url} respondió ${res.status}: el sitio bloqueó la consulta. Se detiene el scraper.`);
  }
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  return await res.text();
}

/** Recorre todas las páginas de una categoría respetando el crawl-delay. */
async function scrapeCategory(path: string): Promise<ScrapedProduct[]> {
  const first = new URL(path, BASE).href;
  const queue = [first];
  const visited = new Set<string>();
  const found = new Map<string, ScrapedProduct>(); // sin duplicados por URL

  while (queue.length && visited.size < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    console.log(`Leyendo ${url}`);
    const { products, pages } = parseListing(await fetchHtml(url));
    if (products.length === 0) {
      console.warn("  (sin productos: ¿cambió el HTML o apareció una verificación?)");
    }
    for (const p of products) found.set(p.url, p);
    for (const p of pages) if (!visited.has(p) && !queue.includes(p)) queue.push(p);
    console.log(`  ${products.length} productos`);

    if (queue.length) await sleep(DELAY_MS);
  }
  return [...found.values()];
}

/** Guarda en Supabase (REST). Si ya existe (store_id + url) solo actualiza. */
async function save(items: ScrapedProduct[], category: Category) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !KEY) {
    console.log("Sin SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: modo prueba, no se guarda.");
    return;
  }
  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  };

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
      console.error(`Categoría desconocida o aún no disponible: ${cat} (por ahora usa cpu, gpu o ram)`);
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
    for (const p of items.slice(0, 5)) console.log(`  - ${p.name}`);
    await save(items, cat);
  }
}