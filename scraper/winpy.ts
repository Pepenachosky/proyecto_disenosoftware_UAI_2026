// Scraper de nombres de productos de Winpy (solo fetch + parser HTML).
// Uso:  deno run --env-file=.env --allow-net --allow-env winpy.ts [cpu|gpu|ram]
// Sin variables de entorno de Supabase solo muestra los productos (modo prueba).

import { DOMParser } from "npm:linkedom@0.18.5";

const BASE = "https://www.winpy.cl";
const DELAY_MS = 10_000; // crawl-delay de Winpy (robots.txt)
const MAX_PAGES = 50; // tope de seguridad por categoría
const USER_AGENT = "ComparadorPreciosUniversidad/0.1 (proyecto academico)";

type Category = "cpu" | "gpu" | "ram";

// Solo se usan URLs sin filtros: Winpy prohíbe /*filtro=* en su robots.txt.
// Se usan las subpáginas de RAM para PC y notebook (se deja fuera la RAM de servidores).
// "accept" es un seguro extra: solo se guardan nombres que lo cumplan.
// OJO: cpu, gpu y el formato de /memorias/ se verificaron con HTML real; las
// subpáginas de ram se asumen iguales.
const CATEGORIES: Record<Category, { paths: string[]; accept?: RegExp }> = {
  cpu: { paths: ["/partes-y-piezas/procesadores/"] },
  gpu: {
    paths: ["/partes-y-piezas/tarjetas-graficas/"],
    accept: /^tarjeta gr[aá]fica/i, // descarta los "Kit Tarjeta gráfica + procesador"
  },
  ram: {
    paths: ["/memorias/ram-computadores/", "/memorias/ram-notebook/"],
    accept: /\bDDR[2-5]\b/i, // descarta pendrives, tarjetas SD, etc.
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

  for (const article of doc.querySelectorAll("section#productos article")) {
    const link = article.querySelector("p.model a");
    const name = link?.textContent.replace(/\s+/g, " ").trim();
    const href = link?.getAttribute("href");
    if (!name || !href) continue;
    products.push({ name, url: new URL(href, BASE).href });
  }

  const pages = [...doc.querySelectorAll(".paginador a")]
    .map((a) => a.getAttribute("href"))
    .filter((h): h is string => !!h)
    .map((h) => new URL(h, BASE).href);

  return { products, pages };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  return await res.text();
}

/** Recorre todas las páginas de una categoría respetando el crawl-delay. */
async function scrapeCategory(path: string): Promise<ScrapedProduct[]> {
  const queue = [new URL(path, BASE).href];
  const visited = new Set<string>();
  const found = new Map<string, ScrapedProduct>(); // sin duplicados por URL

  while (queue.length && visited.size < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    console.log(`Leyendo ${url}`);
    const { products, pages } = parseListing(await fetchHtml(url));
    if (products.length === 0) console.warn("  (sin productos: ¿cambió el HTML?)");
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

  const storeRes = await fetch(`${SUPABASE_URL}/rest/v1/stores?slug=eq.winpy&select=id`, { headers });
  const stores = await storeRes.json();
  if (!storeRes.ok || !stores[0]) throw new Error(`No encontré la tienda winpy: ${JSON.stringify(stores)}`);
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
      console.error(`Categoría desconocida: ${cat} (usa cpu, gpu o ram)`);
      Deno.exit(1);
    }
    const { paths, accept } = CATEGORIES[cat];
    const found = new Map<string, ScrapedProduct>(); // sin duplicados por URL
    for (const path of paths) {
      for (const p of await scrapeCategory(path)) found.set(p.url, p);
      await sleep(DELAY_MS);
    }
    const items = [...found.values()].filter((p) => !accept || accept.test(p.name));
    const descartados = found.size - items.length;
    if (descartados) console.log(`(${descartados} descartados por no coincidir con la categoría)`);
    console.log(`\n${cat}: ${items.length} productos`);
    for (const p of items.slice(0, 5)) console.log(`  - ${p.name}`);
    await save(items, cat);
  }
}