// Acceso a datos del frontend: todas las consultas a Supabase pasan por aquí.
// Las funciones lanzan Error con el mensaje de PostgREST si la consulta falla.
import { supabase } from "./supabase";
import type { Lang } from "./lib/locale.ts";
import { groupOffers } from "./lib/offers.ts";
import type { Group, GroupWithOffers, Offer } from "./lib/offers.ts";
import type { HistoryRow } from "./lib/history.ts";
import type { HoursRow } from "./lib/hours.ts";
import { aggregateRatings, type RatingRow, type RatingStats } from "./lib/ratings.ts";

// Tamaño de página: coincide con el máximo de filas por respuesta de PostgREST por defecto.
const PAGE = 1000;
const GROUP_COLS = "id, slug, name, category, image_url";
const OFFER_COLS = "id, store_id, group_id, name, url, category, price, in_stock, last_seen_at";

// Pide páginas de PAGE filas hasta recibir una incompleta. `page` debe ordenar
// por una columna única para que las páginas no se solapen ni salten filas.
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

/** Grupos con al menos una oferta, cada uno con todas sus ofertas (vigentes o no). */
export function fetchCatalog(): Promise<GroupWithOffers[]> {
  if (!catalogPromise) {
    const p = loadCatalog();
    catalogPromise = p;
    p.then(
      (groups) => {
        // Solo si sigue siendo la promesa actual (no se reemplazó mientras cargaba).
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
      // Las ofertas aún sin agrupar (group_id null) no se pueden mostrar en el catálogo.
      supabase.from("products").select(OFFER_COLS).not("group_id", "is", null).order("id").range(a, b)
    ),
  ]);
  return groupOffers(groups, offers);
}

// Notas de las reseñas por grupo, para ordenar el catálogo y mostrar la media
// en las tarjetas. Solo se piden group_id y rating. Mismo patrón de caché que
// el catálogo; al escribir o borrar una reseña se marca como desactualizada
// (se olvida la promesa, pero el valor sigue disponible para pintar al instante).
let ratingsPromise: Promise<Map<number, RatingStats>> | null = null;
let ratingsValue: Map<number, RatingStats> | null = null;

export function fetchRatings(): Promise<Map<number, RatingStats>> {
  if (!ratingsPromise) {
    const p = loadRatings();
    ratingsPromise = p;
    p.then(
      (ratings) => {
        if (ratingsPromise === p) ratingsValue = ratings;
      },
      () => {
        if (ratingsPromise === p) ratingsPromise = null;
      },
    );
  }
  return ratingsPromise;
}

/** Último valor descargado, aunque esté marcado como desactualizado; null si nunca cargó. */
export function cachedRatings(): Map<number, RatingStats> | null {
  return ratingsValue;
}

function invalidateRatings(): void {
  ratingsPromise = null;
}

async function loadRatings(): Promise<Map<number, RatingStats>> {
  const rows = await fetchAll<RatingRow>((a, b) =>
    supabase.from("product_reviews").select("group_id, rating").order("id").range(a, b)
  );
  return aggregateRatings(rows);
}

/** Sucursal física con su horario; lat/lng null si no se conocen (no se calcula distancia). */
export type Branch = {
  store_id: number;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  branch_hours: HoursRow[];
};

// Las sucursales se piden una vez por carga de página; si falla, se olvida
// la promesa para poder reintentar.
let branchesPromise: Promise<Branch[]> | null = null;

export function fetchBranches(): Promise<Branch[]> {
  if (!branchesPromise) {
    const p = loadBranches();
    branchesPromise = p;
    p.catch(() => {
      if (branchesPromise === p) branchesPromise = null;
    });
  }
  return branchesPromise;
}

async function loadBranches(): Promise<Branch[]> {
  return fetchAll<Branch>((a, b) =>
    supabase
      .from("store_branches")
      // branch_hours viene embebido (relación por clave foránea): una sola consulta.
      .select("store_id, address, city, lat, lng, branch_hours(weekday, opens, closes)")
      .order("store_id")
      .range(a, b)
  );
}

/** Grupo por slug con todas sus ofertas; null si el slug no existe. No usa caché. */
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

/** Historial de precios de esas ofertas, ordenado por fecha. Lista vacía → [] sin consultar. */
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

/** Reseña tal como se muestra; user_id, author_name y las fechas los pone un trigger de la base. */
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

/** Reseñas de un grupo, la más reciente primero. */
export async function fetchReviews(groupId: number): Promise<Review[]> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, group_id, user_id, rating, comment, author_name, created_at, updated_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Review[];
}

/**
 * Crea la reseña o, con existingId, edita la propia. user_id no se envía: la base
 * lo rellena con auth.uid() y RLS impide tocar reseñas ajenas. Invalida la caché de notas.
 */
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
  invalidateRatings();
}

/** Borra una reseña (RLS solo permite las propias) e invalida la caché de notas. */
export async function deleteReview(id: number): Promise<void> {
  const { error } = await supabase.from("product_reviews").delete().eq("id", id);
  if (error) throw new Error(error.message);
  invalidateRatings();
}

/** group_id guardados por el usuario con sesión; sin filtro explícito porque RLS solo devuelve los propios. */
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

/** Quita un guardado; el filtro por user_id lo pone RLS. */
export async function removeSaved(groupId: number): Promise<void> {
  const { error } = await supabase.from("saved_products").delete().eq("group_id", groupId);
  if (error) throw new Error(error.message);
}

/** Idioma guardado en el perfil: valor crudo (puede ser null o inválido); sin fila → null. */
export async function fetchProfileLanguage(userId: string): Promise<unknown> {
  const { data, error } = await supabase
    .from("profiles")
    .select("language")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.language ?? null;
}

/** Guarda el idioma elegido en el perfil del usuario. */
export async function saveProfileLanguage(userId: string, lang: Lang): Promise<void> {
  const { error } = await supabase.from("profiles").update({ language: lang }).eq("id", userId);
  if (error) throw new Error(error.message);
}
