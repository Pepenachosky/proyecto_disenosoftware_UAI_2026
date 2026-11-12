// Scraper de productos de PC Express: nombre, precio y stock (solo fetch + parser HTML).
// Uso:  deno run --env-file=.env --allow-net --allow-env pcexpress.ts [cpu|ram|gpu]
// Sin variables de entorno de Supabase solo muestra los productos (modo prueba).

import { DOMParser } from "npm:linkedom@0.18.5";

const BASE = "https://tienda.pc-express.cl";
const DELAY_MS = 5_000; // robots.txt no declara crawl-delay: 5 s por cortesía
const MAX_PAGES = 10; // tope de páginas por subcategoría
const USER_AGENT = "ComparadorPreciosUniversidad/0.1 (proyecto academico)";

type Category = "cpu" | "ram" | "gpu";

// Cada categoría parte de una página general cuyos botones llevan a subcategorías.
//  - pick: qué botones se recorren (se descartan p. ej. "Ventilacion para CPU", "Pendrive").
//  - accept: seguro extra, solo se guardan nombres que lo cumplan.
// Nunca se usan sort, order, limit ni filter_*: su robots.txt los prohíbe.
// OJO: el formato de cpu se verificó con HTML real de AM4; ram y gpu solo con la página general.
const CATEGORIES: Record<Category, { path: string; pick: RegExp; accept: RegExp }> = {
  cpu: { path: "460_473", pick: /^cpu\b/i, accept: /^procesador/i },
  gpu: {
    path: "460_475",
    // Solo las subpáginas PCIe (AMD Radeon, NVIDIA, Profesionales, Intel Arc); se omite AGP.
    pick: /^t \/ video pcie/i,
    accept: /^tarjeta (de )?(video|gr[aá]fica)/i, // descarta puentes NVLink, soportes, etc.
  },
  ram: {
    path: "72",
    pick: /^memorias para (pc|notebook)$/i,
    accept: /DDR[2-5]|DIMM/i, // descarta memorias SD / flash / pendrives
  },
};

const generalUrl = (path: string) => `${BASE}/index.php?route=product/category&path=${path}`;

export interface Subcategory {
  name: string;
  url: string;
}

/** Lee los botones de subcategoría de una página general y deja los que cumplan "pick". */
export function parseSubcategories(html: string, path: string, pick: RegExp): Subcategory[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const found = new Map<string, Subcategory>();
  for (const a of doc.querySelectorAll(`a.btn[href*="path=${path}_"]`)) {
    const name = a.textContent.replace(/\s+/g, " ").trim();
    const href = a.getAttribute("href");
    if (!name || !href || !pick.test(name)) continue;
    found.set(href, { name, url: new URL(href, BASE).href });
  }
  return [...found.values()];
}

export interface ScrapedProduct {
  name: string;
  url: string;
  price: number | null; // CLP, entero (precio Transferencia, el único que muestra el listado)
  // true = la tarjeta tiene botón "Agregar al carro".
  // null = sin botón: el listado no dice si está agotado (nunca se vio uno agotado).
  inStock: boolean | null;
}

/** "$728.900" -> 728900 (los puntos son separador de miles en CLP). */
function parsePrice(text: string | undefined): number | null {
  const digits = (text ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

/** Extrae productos y número total de páginas de una subcategoría. */
export function parseListing(
  html: string,
): { products: ScrapedProduct[]; totalPages: number } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const products: ScrapedProduct[] = [];

  for (const item of doc.querySelectorAll(".product-list__item")) {
    const a = item.querySelector(".product-list__name a");
    const name = a?.textContent.replace(/\s+/g, " ").trim();
    const href = a?.getAttribute("href");
    if (!name || !href) continue;

    // Precio vigente: <p class="product-list__price">$728.900</p>. En las ofertas aparece
    // además <span class="product-list__price-old"> (precio anterior), que se ignora:
    // el selector ".product-list__price" no lo captura.
    const price = parsePrice(item.querySelector(".product-list__price")?.textContent);

    // Stock: botón "Agregar al carro" dentro de .product-list__actions.
    const hasCart = item.querySelector(".product-list__actions button") !== null;

    products.push({ name, url: new URL(href, BASE).href, price, inStock: hasCart ? true : null });
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
  const headers: Record<string, string> = { apikey: KEY, "Content-Type": "application/json" };
  // Las claves nuevas (sb_secret_...) no son JWT y solo van en "apikey".
  // La clave legacy service_role también se manda como Bearer.
  if (!KEY.startsWith("sb_")) headers.Authorization = `Bearer ${KEY}`;

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
  const cat = (Deno.args[0] ?? "cpu") as Category;
  const cfg = CATEGORIES[cat];
  if (!cfg) {
    console.error("Categoría desconocida: usa cpu, ram o gpu");
    Deno.exit(1);
  }

  console.log(`Buscando subcategorías de ${cat} en la página general...`);
  const subs = parseSubcategories(await fetchHtml(generalUrl(cfg.path)), cfg.path, cfg.pick);
  if (subs.length === 0) {
    console.error("No encontré botones de subcategoría: ¿cambió el HTML de la página general?");
    Deno.exit(1);
  }
  console.log(`Encontradas: ${subs.map((s) => s.name).join(", ")}\n`);

  const found = new Map<string, ScrapedProduct>(); // sin duplicados por URL
  for (let i = 0; i < subs.length; i++) {
    await sleep(DELAY_MS);
    for (const p of await scrapeSubcategory(subs[i])) found.set(p.url, p);
  }

  const items = [...found.values()].filter((p) => cfg.accept.test(p.name));
  const descartados = found.size - items.length;
  console.log(`\n${cat}: ${items.length} productos` + (descartados ? ` (${descartados} descartados por no coincidir con la categoría)` : ""));
  for (const p of items.slice(0, 5)) console.log(`  - ${p.name} | $${p.price} | stock: ${p.inStock}`);
  await save(items, cat);
}