// Scraper de nombres de productos de PC Express (solo fetch + parser HTML).
// Uso:  deno run --env-file=.env --allow-net --allow-env pcexpress.ts [cpu]
// Sin variables de entorno de Supabase solo muestra los productos (modo prueba).

import { DOMParser } from "npm:linkedom@0.18.5";

const BASE = "https://tienda.pc-express.cl";
const DELAY_MS = 5_000; // robots.txt no declara crawl-delay: 5 s por cortesía
const MAX_PAGES = 10; // tope de páginas por subcategoría
const USER_AGENT = "ComparadorPreciosUniversidad/0.1 (proyecto academico)";

type Category = "cpu";

// Página general de procesadores: sus botones llevan a una subcategoría por socket.
// Nunca se usan sort, order, limit ni filter_*: su robots.txt los prohíbe.
const GENERAL_URL = `${BASE}/index.php?route=product/category&path=460_473`;

export interface Subcategory {
  name: string;
  url: string;
}

/** Lee los botones de socket de la página general. Solo deja los "CPU ..." (descarta p. ej. "Ventilacion para CPU"). */
export function parseSubcategories(html: string): Subcategory[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const found = new Map<string, Subcategory>();
  for (const a of doc.querySelectorAll('a.btn[href*="path=460_473_"]')) {
    const name = a.textContent.replace(/\s+/g, " ").trim();
    const href = a.getAttribute("href");
    if (!name || !href || !/^cpu\b/i.test(name)) continue;
    found.set(href, { name, url: new URL(href, BASE).href });
  }
  return [...found.values()];
}

export interface ScrapedProduct {
  name: string;
  url: string;
}

/** Extrae productos y número total de páginas de una subcategoría. */
export function parseListing(
  html: string,
): { products: ScrapedProduct[]; totalPages: number } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const products: ScrapedProduct[] = [];

  for (const a of doc.querySelectorAll(".product-list__item .product-list__name a")) {
    const name = a.textContent.replace(/\s+/g, " ").trim();
    const href = a.getAttribute("href");
    if (!name || !href) continue;
    products.push({ name, url: new URL(href, BASE).href });
  }

  // Texto del pie: "Mostrando del 1 al 7 de 7 (1 páginas)"
  const m = doc.body.textContent.match(/\((\d+)\s*p[aá]ginas?\)/i);
  return { products, totalPages: m ? Number(m[1]) : 1 };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  return await res.text();
}

/** Recorre una subcategoría (y sus páginas, si tiene más de una). */
async function scrapeSubcategory(sub: Subcategory): Promise<ScrapedProduct[]> {
  const all: ScrapedProduct[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = sub.url + (page > 1 ? `&page=${page}` : "");
    console.log(`Leyendo ${sub.name} (página ${page})`);
    const res = parseListing(await fetchHtml(url));
    totalPages = res.totalPages;
    all.push(...res.products);
    console.log(`  ${res.products.length} productos`);
    page++;
    if (page <= totalPages && page <= MAX_PAGES) await sleep(DELAY_MS);
  } while (page <= totalPages && page <= MAX_PAGES);
  return all;
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

  const storeRes = await fetch(`${SUPABASE_URL}/rest/v1/stores?slug=eq.pcexpress&select=id`, { headers });
  const stores = await storeRes.json();
  if (!storeRes.ok || !stores[0]) throw new Error(`No encontré la tienda pcexpress: ${JSON.stringify(stores)}`);
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
  const cat = (Deno.args[0] ?? "cpu") as Category;
  if (cat !== "cpu") {
    console.error("Por ahora solo está disponible: cpu");
    Deno.exit(1);
  }

  console.log("Buscando los sockets en la página general de procesadores...");
  const subs = parseSubcategories(await fetchHtml(GENERAL_URL));
  if (subs.length === 0) {
    console.error("No encontré botones de socket: ¿cambió el HTML de la página general?");
    Deno.exit(1);
  }
  console.log(`Sockets encontrados: ${subs.map((s) => s.name).join(", ")}\n`);

  const found = new Map<string, ScrapedProduct>(); // sin duplicados por URL
  for (let i = 0; i < subs.length; i++) {
    await sleep(DELAY_MS);
    for (const p of await scrapeSubcategory(subs[i])) found.set(p.url, p);
  }

  // Seguro extra: solo se guardan nombres que empiezan con "procesador".
  const items = [...found.values()].filter((p) => /^procesador/i.test(p.name));
  const descartados = found.size - items.length;
  console.log(`\n${cat}: ${items.length} productos` + (descartados ? ` (${descartados} descartados por no ser procesadores)` : ""));
  for (const p of items.slice(0, 5)) console.log(`  - ${p.name}`);
  await save(items, cat);
}