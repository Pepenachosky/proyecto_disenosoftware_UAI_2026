# SSO, subpágina de producto, reseñas y guardados — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Nota (2026-11-12):** el botón de inicio de sesión de este plan (`LoginButton` con `label` e inicio por redirección con `signInWithOAuth`) fue reemplazado por el botón oficial de Google. Ver [`2026-11-12-boton-google-oficial.md`](2026-11-12-boton-google-oficial.md). Este plan queda como registro histórico.

**Goal:** Agrupar las filas de las 3 tiendas en productos únicos y construir sobre eso un frontend con cuadrícula, subpágina de producto (tiendas, gráfico histórico, reseñas con estrellas), guardados con tabla comparativa e inicio de sesión con Google.

**Architecture:** La migración SQL 002 agrega `product_groups`, `products.group_id`/`group_locked`, rehace `product_reviews` (por grupo, con nombre puesto por trigger) y crea `saved_products`, con RLS. Un script Deno (`scraper/group.ts`) calcula una clave por producto y asigna grupos. El frontend React carga el catálogo completo, agrupa en el cliente con funciones puras probadas y usa `react-router` para `/`, `/producto/:slug` y `/guardados`. Supabase Auth maneja Google.

**Tech Stack:** React 19 + TypeScript + Vite, react-router 7, recharts 3, @supabase/supabase-js 2, Deno 2.9 (scripts y `deno test`), PostgreSQL de Supabase. Para probar la migración: Postgres 17 local con podman.

**Spec:** `docs/superpowers/specs/2026-11-10-sso-resenas-guardados-design.md` (leerlo antes de cada tarea). Explicación de la migración para el autor: `docs/migracion-002.md`.

## Global Constraints

- Archivos del frontend en minúscula (`app.tsx`, `app.css`, `kebab-case.tsx`); variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- El frontend solo usa la clave pública; nunca escribe en `products`, `price_history` ni `product_groups`.
- La migración se llama `supabase/migrations/002_grupos_resenas_guardados.sql`, el autor la ejecuta a mano y debe poder ejecutarse dos veces seguidas sin error.
- Una oferta es **vigente** si `last_seen_at` está dentro de los últimos 3 días **y** `in_stock !== false`. Solo las vigentes cuentan para "desde", "en N tiendas", "mejor precio", "tienda más barata" y el filtro de precio máximo. Las no vigentes se muestran en gris con la etiqueta "Agotado" (si `in_stock === false`) o "Sin datos recientes". Un grupo sin ofertas vigentes muestra "Sin stock" y va al final al ordenar por precio.
- Reseñas: estrellas del 1 al 5, una por usuario y producto, editable y borrable por su autor. `author_name` viene de `auth.identities.identity_data` del proveedor `google` (`full_name`, o `name` como respaldo), copiado en insert y update.
- Tiendas: 1 = Winpy (`winpy`), 2 = PC Express (`pcexpress`), 3 = SP Digital (`spdigital`). Orden de columnas en las tablas: Winpy, PC Express, SP Digital.
- Imagen: `image_url` del grupo o, si es nula, `/placeholder.png`, que es `PlaceholderLC.png` movido a `frontend/public/`.
- Interfaz en español; precios en CLP con `Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })`.
- Responsive: sin scroll horizontal de página a 360 px de ancho (las tablas pueden tener su propio scroll).
- Los scrapers no cambian su forma de scrapear.
- Commits en la rama `dev`, terminando con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Usuario sin sesión que entra directo a `/guardados` o presiona "Guardar"**: debe ver la invitación a iniciar sesión, nunca un error ni una página vacía. Lo prueban los pasos manuales de las tareas 6 y 7.
2. **Volver de Google después de iniciar sesión**: debe regresar a la misma página donde se pulsó el botón (`redirectTo = window.location.href`), no a `/`. Se verifica en la tarea 4.
3. **Slug inexistente en `/producto/:slug`**: debe mostrar "Producto no encontrado" con un enlace a la lista. Se verifica en la tarea 6.
4. **Producto con una sola oferta, o sin historial de precios**: el gráfico no debe romperse. Con 0 puntos muestra "Aún no hay historial". Lo cubre el test `buildChartData con historial vacío` de la tarea 3.
5. **Nombres con tildes y mayúsculas en la búsqueda, y productos de PC Express en minúsculas**: "nucleos" debe encontrar "Núcleos". Lo cubre el test `matchesQuery ignora tildes` de la tarea 3.

---

## Estructura de archivos

```
supabase/migrations/002_grupos_resenas_guardados.sql   migración (tarea 1)
supabase/tests/002_stub.sql                            esquema mínimo que imita Supabase (tarea 1)
supabase/tests/002_test.sql                            pruebas de RLS y triggers (tarea 1)
supabase/tests/run_002.sh                              levanta Postgres con podman y corre todo (tarea 1)
scraper/group_key.ts        funciones puras: groupKey(name, category) (tarea 2)
scraper/group_key_test.ts   pruebas con nombres reales (tarea 2)
scraper/group.ts            script: lee products, crea grupos y asigna group_id (tarea 2)
scraper/deno.json           tareas "group" y "test"; "scrape" corre group al final (tarea 2)
frontend/src/lib/offers.ts        tipos y funciones puras de ofertas vigentes (tarea 3)
frontend/src/lib/search.ts        normalize / matchesQuery (tarea 3)
frontend/src/lib/history.ts       buildChartData (tarea 3)
frontend/src/lib/*.test.ts        pruebas con deno test (tarea 3)
frontend/src/data.ts              consultas a Supabase (tarea 4)
frontend/src/auth.tsx             AuthProvider / useAuth (tarea 4)
frontend/src/saved.tsx            SavedProvider / useSaved (tarea 4)
frontend/src/app.tsx              router + layout (tarea 4)
frontend/src/components/nav-bar.tsx, login-button.tsx, stars.tsx, save-button.tsx, product-card.tsx, price-chart.tsx, reviews.tsx
frontend/src/pages/catalog.tsx, product.tsx, saved-page.tsx
frontend/public/placeholder.png
README.md, docs/autoria.md, docs/migracion-002.md (tarea 8)
```

---

### Tarea 1: Migración 002 con pruebas locales

**Files:**
- Create: `supabase/migrations/002_grupos_resenas_guardados.sql`
- Create: `supabase/tests/002_stub.sql`, `supabase/tests/002_test.sql`, `supabase/tests/run_002.sh`

**Interfaces:**
- Produces (esquema que usan las demás tareas):
  - `product_groups(id bigint identity pk, slug text unique not null, name text not null, category text not null check in ('cpu','gpu','ram'), image_url text null, created_at timestamptz default now())`
  - `products.group_id bigint null references product_groups(id) on delete set null`, `products.group_locked boolean not null default false`, índice en `group_id`
  - `product_reviews(id, group_id bigint not null references product_groups on delete cascade, user_id uuid not null default auth.uid() references auth.users on delete cascade, rating int not null check 1..5, comment text not null default '', author_name text not null default '', created_at, updated_at timestamptz default now())`, único `(user_id, group_id)`; se elimina `product_id`
  - `saved_products(user_id uuid default auth.uid() references auth.users on delete cascade, group_id bigint references product_groups on delete cascade, created_at timestamptz default now(), primary key (user_id, group_id))`

- [ ] **Step 1: Escribir `002_stub.sql`**: esquema mínimo que imita Supabase.
  - roles `anon`, `authenticated` y `service_role` (este último con `bypassrls`);
  - esquema `auth` con `auth.users(id uuid pk, raw_user_meta_data jsonb)`, `auth.identities(user_id uuid, provider text, identity_data jsonb)` y `auth.uid()`, que devuelve `nullif(current_setting('request.jwt.claim.sub', true), '')::uuid`;
  - tablas `stores`, `products` (columnas del spec, `id integer`), `price_history` y `profiles`, todas con RLS y una política de lectura pública como las reales;
  - `product_reviews(id bigint identity, product_id integer references products, user_id uuid, rating int, comment text, created_at timestamptz)` con RLS y una política vieja `"old_open"` `for all using (true)` que la migración debe eliminar.

- [ ] **Step 2: Escribir `002_test.sql`**: bloques `DO` que lanzan una excepción si algo falla. Para cambiar de usuario se usa `set local role authenticated; set local request.jwt.claim.sub = '<uuid>'`. Hay que preparar dos usuarios, A y B: A con la identidad de Google `{"full_name":"Ana Pérez"}` y `raw_user_meta_data` `{"full_name":"Nombre Falso"}`; B con identidad `{"name":"Beto"}`. Casos:
  - `old_open` ya no existe en `pg_policies`;
  - con `anon`, `select` de `product_reviews` y `product_groups` funciona;
  - con `anon`, `insert` en `product_groups` falla;
  - A inserta una reseña (rating 5): `author_name = 'Ana Pérez'` y `user_id = A`;
  - B inserta la suya y queda `author_name = 'Beto'`;
  - A inserta una segunda reseña en el mismo grupo: falla por la restricción de unicidad;
  - `rating = 6`: falla;
  - A intenta insertar una reseña con `author_name = 'X'`: queda `'Ana Pérez'`;
  - B hace `update` o `delete` de la reseña de A: 0 filas afectadas;
  - A guarda el grupo 1 y B hace `select` de `saved_products`: 0 filas;
  - B inserta en `saved_products` con `user_id = A`: falla.

- [ ] **Step 3: Escribir `run_002.sh`.**
  - Levanta el contenedor: `podman run --rm -d --name pg002 -e POSTGRES_PASSWORD=x -p 55432:5432 docker.io/library/postgres:17`; espera a que `pg_isready` responda.
  - Ejecuta, con `psql -v ON_ERROR_STOP=1` dentro del contenedor: stub, migración, **migración otra vez** y tests.
  - Al salir, detiene el contenedor (con `trap`).

- [ ] **Step 4: Correr `bash supabase/tests/run_002.sh`.** Expected: FAIL, porque la migración todavía no existe.

- [ ] **Step 5: Escribir la migración.** Todo dentro de `begin; … commit;` y re-ejecutable:
  - `create table if not exists` y `add column if not exists`;
  - para las restricciones: `alter table … drop constraint if exists <nombre>` y luego `add constraint`;
  - `create unique index if not exists` y `create or replace function`;
  - `drop trigger if exists` + `create trigger`.

  Contenido:
  - **Políticas viejas de `product_reviews`:** se borran todas.

    ```sql
    do $$ declare p record; begin
      for p in select policyname from pg_policies where schemaname='public' and tablename='product_reviews' loop
        execute format('drop policy %I on public.product_reviews', p.policyname);
      end loop; end $$;
    ```
  - **Columnas de `product_reviews`:** `drop column if exists product_id cascade`; agregar `group_id`, `author_name` y `updated_at`.
  - **Trigger `product_reviews_set_author`:** `before insert or update`, con función `security definer set search_path = ''`. Hace `new.user_id := auth.uid()` (si `auth.uid()` es nulo, mantiene `new.user_id`, para que el script de servicio pueda insertar), `new.updated_at := now()` y `new.author_name := coalesce(identity_data->>'full_name', identity_data->>'name', 'Usuario')` de `auth.identities` con `provider = 'google'` (cualquier proveedor como respaldo).
  - **Políticas nuevas** (nombres fijos, cada una precedida de `drop policy if exists`):
    - `product_groups`: `product_groups_read` `for select to anon, authenticated using (true)`;
    - `product_reviews`: `reviews_read` (select, `anon` y `authenticated`, `true`), `reviews_insert_own` (`with check (user_id = auth.uid())`), `reviews_update_own` (`using` y `with check (user_id = auth.uid())`) y `reviews_delete_own`;
    - `saved_products`: `saved_select_own`, `saved_insert_own` y `saved_delete_own` con `user_id = auth.uid()`, solo para `authenticated`.
  - **Permisos:**
    - `grant select on product_groups to anon, authenticated`;
    - `grant select on product_reviews to anon, authenticated`;
    - `grant insert, update, delete on product_reviews to authenticated`;
    - `grant select, insert, delete on saved_products to authenticated`;
    - `grant usage` de la secuencia a `authenticated`.
  - `enable row level security` en las tres tablas.

- [ ] **Step 6: Correr `bash supabase/tests/run_002.sh`.** Expected: termina con código 0 e imprime `OK 002`, que es el último `raise notice` de los tests.

- [ ] **Step 7: Commit.**

```bash
git add supabase/ && git commit -m "feat(db): migración 002 con grupos, reseñas por grupo y guardados"
```

---

### Tarea 2: Agrupador (`scraper/group_key.ts` + `scraper/group.ts`)

**Files:**
- Create: `scraper/group_key.ts`, `scraper/group_key_test.ts`, `scraper/group.ts`
- Modify: `scraper/deno.json`

**Interfaces:**
- Produces: `export type Category = "cpu" | "gpu" | "ram"` y `export function groupKey(name: string, category: Category): { key: string; title: string } | null`. `key` es el slug (`[a-z0-9-]`) y `title` el nombre visible. Devuelve `null` si no reconoce el patrón.
- `deno task group` asigna `group_id` a todos los productos con `group_locked = false`.

- [ ] **Step 1: Escribir `group_key_test.ts`** con `jsr:@std/assert`. Los nombres son reales de la base.

```ts
// CPU: misma clave entre tiendas, distinta para 7600 / 7600X / 7600X3D
assertEquals(groupKey("Procesador AMD Ryzen 5 7600 (AM5, 6 Cores, 12 Hilos, 3.8/5.1GHz, 32MB Caché)", "cpu")?.key, "amd-ryzen-5-7600");
assertEquals(groupKey("procesador amd ryzen 5 7600 3.8ghz@5.1ghz 6 nucleos 12 hilos sam5 p/n 100-100001015box", "cpu")?.key, "amd-ryzen-5-7600");
assertEquals(groupKey("procesador amd ryzen 5 7600x 4.7ghz@5.3ghz 6 nucleos 12 hilos sam5 p/n 100-100000593wof", "cpu")?.key, "amd-ryzen-5-7600x");
assertEquals(groupKey("Procesador AMD Ryzen 5 7600X3D (AM5, 6 Núcleos, 12 Hilos, 4.1/4.7GHz, 96MB de Caché L3)", "cpu")?.key, "amd-ryzen-5-7600x3d");
assertEquals(groupKey("Procesador AMD Ryzen 5 7600X3D (AM5, ...)", "cpu")?.title, "AMD Ryzen 5 7600X3D");
assertEquals(groupKey("procesador intel i7-12700kf 3.6ghz s1700 p/n bx8071512700kf", "cpu")?.key, "intel-core-i7-12700kf");
assertEquals(groupKey("procesador intel i5 12600k 3.7ghz s1700 p/n bx8071512600k", "cpu")?.key, "intel-core-i5-12600k");
assertEquals(groupKey("Procesador Intel Core i7-12700, Socket LGA 1700, 12 Core/20 Thread, 3.6/5.0 GHz, 25MB Caché", "cpu")?.key, "intel-core-i7-12700");
assertEquals(groupKey("procesador intel core ultra 5 245k 5.2ghz 24mb cache s1851 p/n bx80768245k", "cpu")?.key, "intel-core-ultra-5-245k");
assertEquals(groupKey("Procesador Intel Core Ultra 9 285 (LGA1851, 2.5/5.6 GHz 8 P-Cores, 16 E-cores, 36MB Cache)", "cpu")?.key, "intel-core-ultra-9-285");
// GPU: fabricante + chip + VRAM
assertEquals(groupKey("tarjeta gráfica gigabyte radeon rx 9050 gaming oc 8gb gddr6 pcie 5.0 hdmi 2.1 displayport 2.1a", "gpu")?.key, "gigabyte-rx-9050-8gb");
assertEquals(groupKey("Tarjeta de Video Gigabyte Radeon RX 9050 Gaming OC, 8GB GDDR6, 128-bits, PCI-e 5.0, 2x DP, 1x HDMI", "gpu")?.key, "gigabyte-rx-9050-8gb");
assertEquals(groupKey("Tarjeta gráfica MSI GeForce RTX 5070 Ti SHADOW 3X OC de 16GB GDDR7", "gpu")?.key, "msi-rtx-5070-ti-16gb");
assertEquals(groupKey("tarjeta de video asus prime radeon rx 9070 gre oc 12gb - prime-rx9070gre-o12g", "gpu")?.key, "asus-rx-9070-gre-12gb");
assertEquals(groupKey("tarjeta de video asrock intel arc b580 challenger gaming 12gb gddr6 192 bit p/n 90-ga5lzz-00uanf", "gpu")?.key, "asrock-arc-b580-12gb");
assertEquals(groupKey("tarjeta de video asrock radeon rx7600 challenger 8gb oc p/n 90-ga41zz-00uanz", "gpu")?.key, "asrock-rx-7600-8gb");
assertEquals(groupKey("tarjeta de video zotac gaming geforce rtx 3050 twin edge", "gpu"), null); // sin VRAM
// RAM: marca + línea + tipo + (kit) capacidad + velocidad + formato
assertEquals(groupKey("Memoria RAM Kingston Fury Beast de 64GB (DDR5, 5600MHz, CL36, DIMM)", "ram")?.key, "kingston-fury-beast-ddr5-64gb-5600-dimm");
assertEquals(groupKey("Kit Memorias RAM Kingston Fury Beast de 32GB (2 x 16GB, DDR5, 5600MHz, CL36, EXPO, DIMM)", "ram")?.key, "kingston-fury-beast-ddr5-2x16gb-5600-dimm");
assertEquals(groupKey("memoria sodimm kingston 16gb ddr4 3200mhz - unbuffered p/n kvr32s22s8/16", "ram")?.key, "kingston-ddr4-16gb-3200-sodimm");
assertEquals(groupKey("Memoria RAM DDR4 Kingston 32GB, DDR4 3200MT/S, NON-ECC, UNBUFFERED, CL22, DIMM", "ram")?.key, "kingston-ddr4-32gb-3200-dimm");
assertEquals(groupKey("Memoria RAM Kingston de 32GB (DDR4, 3200Mhz, Non-ECC, Unbuffered, DIMM)", "ram")?.key, "kingston-ddr4-32gb-3200-dimm");
assertEquals(groupKey("memoria ddr5 xpg lancer udimm adata 8gb 5600mhz black rgb p/n ax5u5600c468g-slabrbk", "ram")?.key, "xpg-lancer-ddr5-8gb-5600-dimm");
assertEquals(groupKey("Memoria RAM para Notebook ADATA 16GB DDR5, 4800Mhz, SODIMM, Negro", "ram")?.key, "adata-ddr5-16gb-4800-sodimm");
```

- [ ] **Step 2: Correr `cd scraper && deno test group_key_test.ts`.** Expected: FAIL (no existe el módulo).

- [ ] **Step 3: Implementar `groupKey` en `group_key.ts`.** Primero se normaliza el nombre: minúsculas, sin tildes (NFD), se quita lo que va después de `p/n` y se cambia `@`/`,`/`(`/`)` por espacio. Reglas por categoría:
  - **CPU**:
    - `ryzen (3|5|7|9) (\d{4}[a-z0-9]*)` da `amd-ryzen-N-MODEL` y el título `AMD Ryzen N MODEL` (modelo en mayúsculas);
    - `ultra (5|7|9) (\d{3}[a-z]*)` da `intel-core-ultra-N-MODEL`;
    - `\bi([3579])[- ]?(\d{4,5}[a-z]*)` da `intel-core-iN-MODEL` y el título `Intel Core iN-MODEL`;
    - si nada coincide, `null`.
  - **GPU**:
    - fabricante: el primer token encontrado de `asus|msi|gigabyte|zotac|asrock|sapphire|xfx|powercolor|palit|pny|inno3d|galax|gainward|evga|amd|nvidia|intel`;
    - chip: `rtx ?(\d{4})( ?ti)?( super)?`, `rx ?(\d{4})( ?xt)?( ?gre)?` o `arc ?([ab]\d{3})`;
    - VRAM: `(\d{1,2}) ?gb?` como token aparte (evitar `gddr`), y `8g` también vale;
    - si falta cualquiera de los tres, `null`. Título: `Gigabyte Radeon RX 9050 8GB`.
  - **RAM**:
    - marca: `kingston|xpg|adata|corsair|g\.?skill|crucial|teamgroup|patriot|lexar|samsung|hikvision`. XPG gana sobre ADATA si aparecen los dos;
    - línea opcional, de la lista `fury beast|fury renegade|fury impact|lancer blade|lancer|spectrix|vengeance|trident|ripjaws`;
    - tipo: `ddr[2-5]`;
    - kit: `(\d) ?x ?(\d+) ?gb` da `2x16gb`; si no hay kit, la capacidad es el primer `(\d+(\.\d+)?) ?gb`;
    - velocidad: `(\d{4}) ?(mhz|mt/s)`;
    - formato: `sodimm` si aparece `so-?dimm|notebook`; si no, `dimm`;
    - si falta la marca, el tipo, la capacidad o la velocidad, `null`.

  Las piezas ausentes no se agregan a la clave (sin guiones dobles).

- [ ] **Step 4: Correr `deno test group_key_test.ts`.** Expected: PASS. Además, con el script `deno run -A` sobre `scratchpad/products.json` (o una consulta a la base), contar cuántos de los 417 nombres dan `null`, e informar ese número en el commit.

- [ ] **Step 5: Implementar `group.ts`** (mismo estilo que `winpy.ts`: `fetch` a REST, encabezado `apikey` y `Authorization` solo si la clave no empieza con `sb_`):
  1. `GET /rest/v1/products?select=id,store_id,name,category,group_id,group_locked&group_locked=eq.false` (paginado con `Range` de a 1000).
  2. Para cada fila: `groupKey(...)`, o si es `null`, `{ key: "p-" + id, title: name }`.
  3. Upsert de los grupos: `POST /rest/v1/product_groups?on_conflict=slug` con `Prefer: resolution=merge-duplicates,return=representation`, en lotes de 100, enviando `{slug, name, category}`. El `name` de un grupo existente se sobrescribe; como `title` es determinista, no cambia nada.
  4. Agrupar las filas cuyo `group_id` cambió por grupo destino y hacer `PATCH /rest/v1/products?id=in.(…)&group_locked=eq.false` con `{group_id}`.
  5. Imprimir `Grupos: N · productos reasignados: M · sin patrón: K`.

  Sin variables de entorno, funciona en modo prueba: imprime los grupos sin guardar.

- [ ] **Step 6: Actualizar `scraper/deno.json`.**
  - Agregar `"group": "deno run --allow-net --allow-env --env-file=.env group.ts"` y `"test": "deno test"`.
  - Cambiar `scrape` para que agrupe al final: renombrar la tarea actual a `scrape:all` (con las mismas `dependencies`) y crear `"scrape": { "command": "deno task group", "dependencies": ["scrape:all"] }`.

- [ ] **Step 7: Verificar.** Correr `deno task test` (PASS) y `deno task group` **sin** `.env` (modo prueba: no debe fallar e imprime el resumen). El autor lo ejecuta de verdad después de la migración.

- [ ] **Step 8: Commit.**

```bash
git add scraper/ && git commit -m "feat(scraper): agrupador de productos entre tiendas"
```

---

### Tarea 3: Lógica pura del frontend (ofertas, búsqueda, historial)

**Files:**
- Create: `frontend/src/lib/offers.ts`, `frontend/src/lib/search.ts`, `frontend/src/lib/history.ts`
- Create: `frontend/src/lib/offers.test.ts`, `frontend/src/lib/search.test.ts`, `frontend/src/lib/history.test.ts`
- Modify: `frontend/tsconfig.app.json` (`"exclude": ["src/**/*.test.ts"]`)

**Interfaces (Produces):**

```ts
// offers.ts
export type Category = "cpu" | "gpu" | "ram";
export type Offer = { id: number; store_id: number; group_id: number; name: string; url: string | null;
  category: Category; price: number | null; in_stock: boolean | null; last_seen_at: string };
export type Group = { id: number; slug: string; name: string; category: Category; image_url: string | null };
export type GroupWithOffers = Group & { offers: Offer[] };
export const STORES: { id: number; slug: string; name: string }[]; // [{1,winpy,Winpy},{2,pcexpress,PC Express},{3,spdigital,SP Digital}]
export const CURRENT_DAYS = 3;
export function isCurrent(o: Offer, now: Date): boolean;               // last_seen_at >= now-3d && in_stock !== false && price != null
export function offerStatus(o: Offer, now: Date): "vigente" | "agotado" | "sin-datos"; // agotado si in_stock===false, si no sin-datos si es vieja
export function summarize(g: GroupWithOffers, now: Date): { bestPrice: number | null; bestStoreId: number | null; storeCount: number };
export function sortOffers(offers: Offer[], now: Date): Offer[];       // vigentes por precio asc, luego no vigentes por precio asc
export function groupOffers(groups: Group[], offers: Offer[]): GroupWithOffers[]; // descarta grupos sin ofertas
export const clp: Intl.NumberFormat;
// search.ts
export function normalize(s: string): string;
export function matchesQuery(text: string, query: string): boolean;   // todas las palabras, sin tildes ni mayúsculas
// history.ts
export type HistoryRow = { product_id: number; price: number | null; scraped_at: string };
export type ChartPoint = { date: string } & Partial<Record<"winpy" | "pcexpress" | "spdigital", number>>;
export function buildChartData(rows: HistoryRow[], storeOfProduct: Map<number, number>): ChartPoint[];
// un punto por día (YYYY-MM-DD, orden asc); por tienda, el último precio de ese día; ignora price null
```

- [ ] **Step 1: Escribir las pruebas** (`deno test`, `jsr:@std/assert`), con `now = new Date("2026-11-10T12:00:00Z")`:
  - `isCurrent`:
    - visto el 2026-11-09 con `in_stock` null: `true`;
    - visto el 2026-11-05: `false`;
    - `in_stock` false: `false`;
    - `price` null: `false`.
  - `offerStatus`: agotado gana sobre viejo.
  - `summarize`:
    - con ofertas de Winpy a 184900 y PC Express a 179990 (vigentes) y SP Digital a 150000 vista el 2026-10-29, da `{bestPrice: 179990, bestStoreId: 2, storeCount: 2}`;
    - sin ofertas vigentes, da `{bestPrice: null, bestStoreId: null, storeCount: 0}`.
  - `sortOffers`: la vieja de 150000 queda al final.
  - `groupOffers`: un grupo sin ofertas no aparece.
  - `matchesQuery` ignora tildes:
    - `matchesQuery("Procesador AMD Ryzen 5 (6 Núcleos)", "nucleos ryzen")` da `true`;
    - con `"ryzen 9"`, `false`.
  - `buildChartData`:
    - dos filas del mismo producto de Winpy el mismo día dan un punto con el último precio;
    - Winpy y PC Express el mismo día dan un punto con las dos claves;
    - historial vacío da `[]`.

- [ ] **Step 2: Correr `cd frontend && deno test src/lib/`.** Expected: FAIL.
- [ ] **Step 3: Implementar los tres módulos** con las firmas de arriba. Los módulos no importan nada de Vite ni de Supabase, para que `deno test` los ejecute.
- [ ] **Step 4: Correr `deno test src/lib/` (PASS) y `npx tsc -b` (sin errores).**
- [ ] **Step 5: Commit.**

```bash
git add frontend/src/lib frontend/tsconfig.app.json && git commit -m "feat(frontend): lógica de ofertas vigentes, búsqueda e historial"
```

---

### Tarea 4: Dependencias, rutas, sesión con Google y guardados (infraestructura)

**Files:**
- Modify: `frontend/package.json` (+ lock), `frontend/src/main.tsx`, `frontend/src/app.tsx`, `frontend/src/app.css`
- Create: `frontend/src/data.ts`, `frontend/src/auth.tsx`, `frontend/src/saved.tsx`, `frontend/src/components/nav-bar.tsx`, `frontend/src/components/login-button.tsx`
- Move: `PlaceholderLC.png` a `frontend/public/placeholder.png` (`git mv`, o `mv` si no está trackeado)

**Interfaces:**
- Consumes: los tipos de `lib/offers.ts`.
- Produces:

```ts
// data.ts
export async function fetchCatalog(): Promise<GroupWithOffers[]>;   // product_groups + products (paginado de a 1000), usa groupOffers
export async function fetchGroup(slug: string): Promise<GroupWithOffers | null>;
export async function fetchHistory(productIds: number[]): Promise<HistoryRow[]>;
export type Review = { id: number; group_id: number; user_id: string; rating: number; comment: string; author_name: string; created_at: string; updated_at: string };
export async function fetchReviews(groupId: number): Promise<Review[]>;          // created_at desc
export async function upsertReview(groupId: number, rating: number, comment: string, existingId?: number): Promise<void>;
export async function deleteReview(id: number): Promise<void>;
export async function fetchSavedIds(): Promise<number[]>;
export async function addSaved(groupId: number): Promise<void>;
export async function removeSaved(groupId: number): Promise<void>;
// auth.tsx
export function AuthProvider(props: { children: React.ReactNode }): JSX.Element;
export function useAuth(): { user: { id: string; name: string } | null; loading: boolean; signIn(): Promise<void>; signOut(): Promise<void> };
// saved.tsx (dentro de AuthProvider; se vacía al cerrar sesión)
export function SavedProvider(props: { children: React.ReactNode }): JSX.Element;
export function useSaved(): { ids: Set<number>; toggle(groupId: number): Promise<void>; loading: boolean };
// components/login-button.tsx
export function LoginButton(props: { label?: string }): JSX.Element;  // por defecto "Iniciar sesión con Google"
```

- [ ] **Step 1: Instalar dependencias.** Correr `cd frontend && deno add npm:react-router@^7 npm:recharts@^3`. Revisar que `package.json` tenga las dos y que `node_modules/react-router` exista; si `deno add` no actualiza `package.json`, usar `npm install react-router@^7 recharts@^3`.
- [ ] **Step 2: Implementar `auth.tsx`.**
  - `signIn` llama a `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } })`.
  - El nombre sale de `user.user_metadata.full_name ?? user.user_metadata.name ?? user.email`. En la barra solo es visual; el nombre de las reseñas lo pone el trigger.
  - Escucha `onAuthStateChange`.
- [ ] **Step 3: Implementar `data.ts` y `saved.tsx`.** `toggle` hace una actualización optimista y, si falla, la revierte.
- [ ] **Step 4: Implementar `nav-bar.tsx`.**
  - Usa `NavLink` a `/` ("Productos") y a `/guardados` ("Guardados (N)", donde N sale de `useSaved`).
  - A la derecha: `LoginButton`, o el nombre del usuario y el botón "Salir".
  - Es sticky.
- [ ] **Step 5: Mover el contenido actual de `app.tsx` (lista con filtros, aún sin commitear) a `pages/catalog.tsx` como `export function Catalog()`, para que siga funcionando hasta la tarea 5. Después, reescribir `app.tsx` como router.** `BrowserRouter`, `AuthProvider`, `SavedProvider`, `NavBar` y `Routes` con `/` → `Catalog`, `/producto/:slug` → `ProductPage`, `/guardados` → `SavedPage` y `*` → "Página no encontrada". Mientras no existan las tareas 6 y 7, `ProductPage` y `SavedPage` son stubs que exportan un componente con su título.
- [ ] **Step 6: Quitar de `main.tsx`** el import duplicado de `./app.css`; queda solo el de `app.tsx`.
- [ ] **Step 7: Verificar** con `npx tsc -b && npx oxlint && npx vite build` (sin errores).
- [ ] **Step 8: Prueba manual (Review Focus 2).** Con `npm run dev`, abrir `/guardados` sin sesión y luego pulsar "Iniciar sesión con Google".
  - Si el autor ya configuró Google, debe volver a `/guardados` con la sesión iniciada.
  - Si no, Supabase muestra "provider is not enabled"; se anota como pendiente.
- [ ] **Step 9: Commit.**

```bash
git add frontend/ PlaceholderLC.png && git commit -m "feat(frontend): rutas, sesión con Google y contexto de guardados"
```

---

### Tarea 5: Página de productos en cuadrícula

**Files:**
- Create: `frontend/src/pages/catalog.tsx`, `frontend/src/components/product-card.tsx`
- Modify: `frontend/src/app.css`

**Interfaces:**
- Consumes: `fetchCatalog`, `summarize`, `matchesQuery`, `STORES` y `clp`.
- Produces: `export function ProductCard(props: { group: GroupWithOffers; now: Date }): JSX.Element`.

- [ ] **Step 1: Mover a `catalog.tsx` la lógica de filtros del `app.tsx` actual**, adaptada a grupos:
  - pestañas Todos/CPU/GPU/RAM con contador de grupos;
  - búsqueda con `matchesQuery(group.name + " " + nombres de sus ofertas, query)`;
  - tienda: el grupo tiene alguna oferta de esa tienda;
  - "solo con stock": `storeCount > 0`;
  - precio máximo: `bestPrice != null && bestPrice <= max`;
  - orden por nombre, o por `bestPrice` ascendente o descendente con los `null` al final;
  - paginación de 48 tarjetas;
  - "Limpiar filtros".
- [ ] **Step 2: Implementar `ProductCard`.**
  - Es un `<Link to={"/producto/" + slug}>`.
  - Muestra imagen cuadrada (`image_url ?? "/placeholder.png"`, `loading="lazy"`), categoría, nombre (máximo 3 líneas), "desde $X" o "Sin stock" y "en N tienda(s)".
- [ ] **Step 3: Agregar los estilos.** Cuadrícula `repeat(auto-fill, minmax(170px, 1fr))` y, por debajo de 400 px, `minmax(140px, 1fr)`.
- [ ] **Step 4: Verificar.** `tsc`, `oxlint` y `build` pasan. Luego, con `npm run dev` (después de la migración y el agrupado), buscar "ryzen 5 7600":
  - debe haber tarjetas separadas para 7600, 7600X y 7600X3D;
  - la del 7600 debe decir "en 2 tiendas".
- [ ] **Step 5: Commit** `feat(frontend): lista de productos en cuadrícula`.

---

### Tarea 6: Subpágina de producto (tiendas, gráfico, reseñas)

**Files:**
- Create: `frontend/src/pages/product.tsx`, `frontend/src/components/price-chart.tsx`, `frontend/src/components/reviews.tsx`, `frontend/src/components/stars.tsx`, `frontend/src/components/save-button.tsx`

**Interfaces:**
- Consumes: `fetchGroup`, `fetchHistory`, `fetchReviews`, `upsertReview`, `deleteReview`, `buildChartData`, `sortOffers`, `offerStatus`, `useAuth`, `useSaved` y `LoginButton`.
- Produces:

```ts
export function Stars(props: { value: number; onChange?: (v: number) => void }): JSX.Element; // de solo lectura si no hay onChange; botones con aria-label "N estrellas"
export function SaveButton(props: { groupId: number }): JSX.Element; // "☆ Guardar para comparar" / "★ Guardado"; sin sesión muestra LoginButton label="Inicia sesión para guardar"
export function PriceChart(props: { offers: Offer[] }): JSX.Element; // recharts LineChart, una Line por tienda presente, connectNulls, eje Y en CLP; si no hay puntos, "Aún no hay historial"
export function Reviews(props: { groupId: number }): JSX.Element;
```

- [ ] **Step 1: `product.tsx`.**
  - Cabecera de dos columnas que pasa a una sola en móvil: imagen a la izquierda; a la derecha categoría, nombre, "desde $X en <tienda>" (o "Sin stock") y `SaveButton`.
  - Tabla de tiendas con `sortOffers`: tienda, estado ("Disponible" / "Stock no informado" / "Agotado" / "Sin datos recientes"), precio y "Ir a la tienda ↗" (`target=_blank rel="noreferrer noopener"`). Las no vigentes van con la clase `.stale`, en gris.
  - Debajo, `PriceChart` y luego `Reviews`.
  - Si el slug no existe (Review Focus 3): "Producto no encontrado" y un `Link` a `/`.
- [ ] **Step 2: `reviews.tsx`.**
  - Lista con estrellas, nombre del autor, fecha (`toLocaleDateString("es-CL")`) y comentario.
  - Encima, el promedio de estrellas y la cantidad de reseñas.
  - Sin sesión: `LoginButton label="Iniciar sesión con Google para comentar"`.
  - Con sesión:
    - si el usuario ya tiene una reseña, el formulario aparece precargado con "Guardar cambios" y "Borrar";
    - si no, el formulario está vacío con "Publicar";
    - las estrellas son obligatorias: "Publicar" queda deshabilitado si la nota es 0.
  - Después de guardar o borrar, se vuelve a cargar la lista. Los errores se muestran en texto rojo.
- [ ] **Step 3: Verificar** que `tsc`, `oxlint` y `build` pasen.
- [ ] **Step 4: Prueba manual.**
  - Abrir `/producto/amd-ryzen-5-7600`: 2 tiendas ordenadas y el gráfico con líneas de Winpy y PC Express.
  - Abrir `/producto/no-existe`: "Producto no encontrado".
  - Con sesión iniciada: publicar una reseña de 4★, editarla a 5★ y borrarla; el nombre debe ser el de la cuenta de Google.
- [ ] **Step 5: Commit** `feat(frontend): subpágina de producto con gráfico y reseñas`.

---

### Tarea 7: Página Guardados con tabla comparativa

**Files:**
- Create: `frontend/src/pages/saved-page.tsx`
- Modify: `frontend/src/app.css`

**Interfaces:**
- Consumes: `useAuth`, `useSaved`, `fetchCatalog` (o los grupos de `ids`), `summarize`, `offerStatus`, `STORES` y `LoginButton`.

- [ ] **Step 1: Implementar la página.**
  - Sin sesión: el texto "Inicia sesión para guardar productos y compararlos" y `LoginButton`.
  - Con sesión y 0 guardados: "Aún no guardas productos" y un enlace a `/`.
  - Con guardados: tabla con una columna por producto (imagen de 70 px, nombre enlazado a la subpágina y botón ✕ que llama a `toggle`). Filas:
    - Categoría;
    - Mejor precio (en negrita el menor de toda la fila);
    - Tienda más barata;
    - Winpy, PC Express y SP Digital: precio de la oferta de esa tienda; "—" si no existe; en gris con la etiqueta si no es vigente.
  - La tabla va dentro de `.table-scroll` y tiene la primera columna sticky.
- [ ] **Step 2: Verificar** que `tsc`, `oxlint` y `build` pasen.
- [ ] **Step 3: Prueba manual (Review Focus 1).**
  - Sin sesión: abrir `/guardados` muestra la invitación; en una subpágina, "Guardar" muestra el botón de login.
  - Con sesión: guardar dos productos; el contador del menú dice (2) y la tabla tiene 2 columnas.
  - ✕ quita la columna; al recargar, sigue quitada.
- [ ] **Step 4: Commit** `feat(frontend): página de guardados con comparación lado a lado`.

---

### Tarea 8: Documentación y grafo

**Files:**
- Modify: `README.md`, `docs/autoria.md`, `docs/migracion-002.md` (solo si cambió algo respecto de lo implementado)

- [ ] **Step 1: Actualizar `README.md`.**
  - **Estado:** marcar frontend (buscador, filtros, paginación), SSO y reseñas. Multilenguaje sigue pendiente.
  - **Stack:** agregar react-router, recharts y Supabase Auth (Google).
  - **Estructura:** `frontend/src/{pages,components,lib}`, `scraper/group.ts` y `supabase/tests/`.
  - **Base de datos:** `product_groups`, `saved_products`, reseñas por grupo y el enlace a `docs/migracion-002.md`.
  - **Sección nueva "Configurar inicio de sesión con Google":**
    1. Google Cloud Console: crear un cliente OAuth "Aplicación web", con la URI de redirección `https://<proyecto>.supabase.co/auth/v1/callback`.
    2. Supabase → Authentication → Sign In / Providers → Google: pegar el Client ID y el Secret.
    3. Supabase → Authentication → URL Configuration: Site URL `http://localhost:5173` y Redirect URLs `http://localhost:5173/**`.
    4. Al desplegar: agregar el dominio y configurar el hosting para que todas las rutas sirvan `index.html`.
  - **Sección "Cómo correrlo":** migración → `deno task scrape` (o `deno task group`) → `cd frontend && npm run dev`, y los comandos de prueba (`deno task test`, `deno test src/lib/` y `bash supabase/tests/run_002.sh`).
- [ ] **Step 2: Agregar a `docs/autoria.md` dos prompts nuevos** en el formato existente (Prompt condensado / Resultado obtenido / Decisiones propias / Supuestos del asistente por confirmar / Pendiente de verificar), numerados después del último:
  - **Prompt 13, "Buscador y filtros en el frontend"**: pedí filtrar por tipo de producto y categoría, y un buscador de texto. Resultado: pestañas de categoría, búsqueda sin tildes, tienda, precio máximo, stock, orden, paginación y carga de más de 1000 filas.
  - **Prompt 14, "SSO con Google, subpágina de producto, reseñas, guardados y comparación"**. Decisiones propias del autor:
    - agrupación automática aceptando errores y con corrección manual después;
    - cuadrícula con imagen placeholder;
    - comparación con la opción A en una página Guardados del menú superior;
    - estrellas y nombre de Google en las reseñas;
    - la regla de 3 días para las ofertas vigentes;
    - explicar la migración 002 antes de seguir.

    Supuestos del asistente: el nombre se toma de `auth.identities` y se borran las políticas viejas de `product_reviews`. Pendiente: lo que no se haya probado a mano, como Google OAuth y la migración en Supabase real.

  Mantener el tono y la extensión de los prompts 11 y 12.
- [ ] **Step 3: Regenerar el grafo** con `graphify update .` en la raíz (sin costo de API). Revisar que `graphify-out/GRAPH_REPORT.md` muestre un commit reciente en "Built from commit" e incluya nodos de `group.ts`, `auth.tsx` y `product.tsx`. `graphify-out/` está en `.gitignore`, así que no se commitea.
- [ ] **Step 4: Verificación final** con `cd scraper && deno task test`, `cd frontend && deno test src/lib/ && npx tsc -b && npx oxlint && npx vite build` y `bash supabase/tests/run_002.sh`; todo debe pasar.
- [ ] **Step 5: Commit.**

```bash
git add README.md docs/ && git commit -m "docs: README, autoría, migración 002, diseño y plan"
```
