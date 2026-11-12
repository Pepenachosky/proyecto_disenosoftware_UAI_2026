import { supabase } from "./supabase";
import { groupOffers } from "./lib/offers.ts";
import type { Group, GroupWithOffers, Offer } from "./lib/offers.ts";
import type { HistoryRow } from "./lib/history.ts";

const PAGE = 1000;
const GROUP_COLS = "id, slug, name, category, image_url";
const OFFER_COLS = "id, store_id, group_id, name, url, category, price, in_stock, last_seen_at";

async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

// El catálogo se pide una vez por carga de página y se reutiliza (volver atrás
// desde un producto no lo vuelve a descargar). Si falla, se olvida para reintentar.
let catalogPromise: Promise<GroupWithOffers[]> | null = null;
let catalogValue: GroupWithOffers[] | null = null;

export function fetchCatalog(): Promise<GroupWithOffers[]> {
  if (!catalogPromise) {
    const p = loadCatalog();
    catalogPromise = p;
    p.then(
      (groups) => {
        if (catalogPromise === p) catalogValue = groups;
      },
      () => {
        if (catalogPromise === p) catalogPromise = null;
      },
    );
  }
  return catalogPromise;
}

// El catálogo ya descargado, para pintarlo sin pasar por "Cargando…".
export function cachedCatalog(): GroupWithOffers[] | null {
  return catalogValue;
}

async function loadCatalog(): Promise<GroupWithOffers[]> {
  const [groups, offers] = await Promise.all([
    fetchAll<Group>((a, b) =>
      supabase.from("product_groups").select(GROUP_COLS).order("id").range(a, b)
    ),
    fetchAll<Offer>((a, b) =>
      supabase.from("products").select(OFFER_COLS).not("group_id", "is", null).order("id").range(a, b)
    ),
  ]);
  return groupOffers(groups, offers);
}

export async function fetchGroup(slug: string): Promise<GroupWithOffers | null> {
  const { data, error } = await supabase
    .from("product_groups")
    .select(GROUP_COLS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const group = data as Group;
  const { data: offers, error: e2 } = await supabase
    .from("products")
    .select(OFFER_COLS)
    .eq("group_id", group.id);
  if (e2) throw new Error(e2.message);
  return { ...group, offers: (offers ?? []) as Offer[] };
}

// Grupos pedidos por id, incluidos los que se quedaron sin ofertas (a
// diferencia de fetchCatalog, que los omite).
export async function fetchGroupsByIds(ids: number[]): Promise<GroupWithOffers[]> {
  if (ids.length === 0) return [];
  const [groups, offers] = await Promise.all([
    fetchAll<Group>((a, b) =>
      supabase.from("product_groups").select(GROUP_COLS).in("id", ids).order("id").range(a, b)
    ),
    fetchAll<Offer>((a, b) =>
      supabase.from("products").select(OFFER_COLS).in("group_id", ids).order("id").range(a, b)
    ),
  ]);
  const byGroup = new Map<number, Offer[]>(groups.map((g) => [g.id, []]));
  for (const o of offers) byGroup.get(o.group_id)?.push(o);
  return groups.map((g) => ({ ...g, offers: byGroup.get(g.id)! }));
}

export async function fetchHistory(productIds: number[]): Promise<HistoryRow[]> {
  if (productIds.length === 0) return [];
  const { data, error } = await supabase
    .from("price_history")
    .select("product_id, price, scraped_at")
    .in("product_id", productIds)
    .order("scraped_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as HistoryRow[];
}

export type Review = {
  id: number;
  group_id: number;
  user_id: string;
  rating: number;
  comment: string;
  author_name: string;
  created_at: string;
  updated_at: string;
};

export async function fetchReviews(groupId: number): Promise<Review[]> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, group_id, user_id, rating, comment, author_name, created_at, updated_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Review[];
}

export async function upsertReview(
  groupId: number,
  rating: number,
  comment: string,
  existingId?: number,
): Promise<void> {
  const q = existingId !== undefined
    ? supabase.from("product_reviews").update({ rating, comment }).eq("id", existingId)
    : supabase.from("product_reviews").insert({ group_id: groupId, rating, comment });
  const { error } = await q;
  if (error) throw new Error(error.message);
}

export async function deleteReview(id: number): Promise<void> {
  const { error } = await supabase.from("product_reviews").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchSavedIds(): Promise<number[]> {
  const { data, error } = await supabase.from("saved_products").select("group_id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { group_id: number }) => r.group_id);
}

export async function addSaved(groupId: number): Promise<void> {
  // Guardar dos veces no es error (ON CONFLICT DO NOTHING; no requiere UPDATE).
  const { error } = await supabase
    .from("saved_products")
    .upsert({ group_id: groupId }, { onConflict: "user_id,group_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function removeSaved(groupId: number): Promise<void> {
  const { error } = await supabase.from("saved_products").delete().eq("group_id", groupId);
  if (error) throw new Error(error.message);
}
