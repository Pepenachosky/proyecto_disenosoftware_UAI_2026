// Agrupador: asigna group_id a los productos (mismo producto en distintas tiendas).
// Uso:  deno run --env-file=.env --allow-net --allow-env group.ts
// Sin variables de entorno de Supabase solo avisa (modo prueba, no toca nada).

import { type Category, groupKey } from "./group_key.ts";

interface Row {
  id: number;
  store_id: number;
  name: string;
  category: Category;
  group_id: number | null;
  image_url: string | null;
}

// Tiendas cuya foto se puede usar, en orden de prioridad (PC Express bloquea hotlinking).
const IMAGE_PRIORITY = ["spdigital", "winpy"];

/** Elige la foto del grupo: la primera imagen no nula de la tienda más prioritaria. */
export function pickGroupImage(
  candidates: { storeSlug: string; imageUrl: string | null }[],
): string | null {
  for (const slug of IMAGE_PRIORITY) {
    const hit = candidates.find((c) => c.storeSlug === slug && c.imageUrl);
    if (hit) return hit.imageUrl;
  }
  return null;
}

const PAGE = 1000; // filas por página al leer productos
const BATCH = 100; // filas por lote al escribir

/** Lee todos los productos con group_locked = false (paginado con Range). */
async function fetchProducts(base: string, headers: Record<string, string>): Promise<Row[]> {
  const rows: Row[] = [];
  const select = "id,store_id,name,category,group_id,group_locked,image_url";
  for (let from = 0;; from += PAGE) {
    const res = await fetch(
      `${base}/rest/v1/products?select=${select}&group_locked=eq.false&order=id`,
      { headers: { ...headers, Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items" } },
    );
    if (!res.ok) throw new Error(`Error al leer productos: ${res.status} ${await res.text()}`);
    const page: Row[] = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/** Crea/actualiza grupos por slug y devuelve slug -> id. */
async function upsertGroups(
  base: string,
  headers: Record<string, string>,
  groups: Map<string, { slug: string; name: string; category: Category; image_url: string | null }>,
): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  const all = [...groups.values()];
  for (let i = 0; i < all.length; i += BATCH) {
    const res = await fetch(`${base}/rest/v1/product_groups?on_conflict=slug`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(all.slice(i, i + BATCH)),
    });
    if (!res.ok) throw new Error(`Error al guardar grupos: ${res.status} ${await res.text()}`);
    for (const g of await res.json()) ids.set(g.slug, g.id);
  }
  return ids;
}

/** Asigna group_id a los productos, un PATCH por grupo y lote de ids. */
async function assign(
  base: string,
  headers: Record<string, string>,
  byGroup: Map<number, number[]>,
) {
  for (const [groupId, productIds] of byGroup) {
    for (let i = 0; i < productIds.length; i += BATCH) {
      const list = productIds.slice(i, i + BATCH).join(",");
      const res = await fetch(`${base}/rest/v1/products?id=in.(${list})&group_locked=eq.false`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ group_id: groupId }),
      });
      if (!res.ok) throw new Error(`Error al asignar grupo: ${res.status} ${await res.text()}`);
    }
  }
}

async function main() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !KEY) {
    console.log("Sin SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: modo prueba, no se lee ni se guarda nada.");
    return;
  }
  const headers: Record<string, string> = { apikey: KEY, "Content-Type": "application/json" };
  // Las claves nuevas (sb_secret_...) no son JWT y solo van en "apikey".
  if (!KEY.startsWith("sb_")) headers.Authorization = `Bearer ${KEY}`;

  const rows = await fetchProducts(SUPABASE_URL, headers);

  // id de tienda -> slug, para saber de qué tienda es cada foto.
  const storesRes = await fetch(`${SUPABASE_URL}/rest/v1/stores?select=id,slug`, { headers });
  if (!storesRes.ok) throw new Error(`Error al leer tiendas: ${storesRes.status} ${await storesRes.text()}`);
  const storeSlug = new Map<number, string>(
    (await storesRes.json()).map((s: { id: number; slug: string }) => [s.id, s.slug]),
  );

  // Clave de grupo por producto; sin patrón, el producto queda en un grupo propio.
  const groups = new Map<string, { slug: string; name: string; category: Category; image_url: string | null }>();
  const candidates = new Map<string, { storeSlug: string; imageUrl: string | null }[]>();
  const slugOf = new Map<number, string>();
  let sinPatron = 0;
  for (const r of rows) {
    const g = groupKey(r.name, r.category);
    if (!g) sinPatron++;
    const slug = g ? g.key : `p-${r.id}`;
    slugOf.set(r.id, slug);
    if (!groups.has(slug)) {
      groups.set(slug, { slug, name: g ? g.title : r.name, category: r.category, image_url: null });
    }
    const list = candidates.get(slug) ?? [];
    list.push({ storeSlug: storeSlug.get(r.store_id) ?? "", imageUrl: r.image_url });
    candidates.set(slug, list);
  }
  // Foto del grupo. Las filas con group_locked = true no entran (no se leen), y si una
  // tienda deja de mostrar la foto, el grupo vuelve a null en la siguiente corrida.
  // Todos los grupos llevan la clave image_url (PostgREST exige las mismas claves).
  let conImagen = 0;
  for (const [slug, g] of groups) {
    g.image_url = pickGroupImage(candidates.get(slug)!);
    if (g.image_url) conImagen++;
  }

  const groupIds = await upsertGroups(SUPABASE_URL, headers, groups);

  // Solo se reasignan las filas cuyo group_id cambió.
  const byGroup = new Map<number, number[]>();
  let reasignados = 0;
  for (const r of rows) {
    const gid = groupIds.get(slugOf.get(r.id)!)!;
    if (gid === r.group_id) continue;
    byGroup.set(gid, [...(byGroup.get(gid) ?? []), r.id]);
    reasignados++;
  }
  await assign(SUPABASE_URL, headers, byGroup);

  console.log(`Grupos: ${groups.size} · productos reasignados: ${reasignados} · sin patrón: ${sinPatron} · con imagen: ${conImagen}`);
}

if (import.meta.main) await main();
