# Distancia a las tiendas, orden por distancia y horarios — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la subpágina de producto, cada tienda aparece como una tarjeta con su dirección, la distancia al usuario, si está abierta ahora y su horario semanal, y las tarjetas se pueden ordenar por precio o por distancia.

**Architecture:** La dirección, las coordenadas y el horario de las 3 tiendas se guardan a mano en las tablas existentes `store_branches` y `branch_hours` (migración 004, lectura pública). La ubicación del usuario se obtiene del navegador; si no la da, la elige de un archivo fijo de regiones y comunas generado una sola vez desde OpenStreetMap. La distancia (Haversine), el estado abierta/cerrada (hora de Chile) y el orden se calculan en el navegador con funciones puras de `frontend/src/lib/`.

**Tech Stack:** React 19 + TypeScript + Vite (react-router), Deno (`deno test`, script de comunas), Supabase PostgREST, PostgreSQL 17 (prueba de la migración con podman), OpenStreetMap Overpass API (solo al generar el archivo de comunas).

**Spec:** `docs/superpowers/specs/2026-11-12-geolocalizacion-horarios-design.md`

## Global Constraints

- **Rama:** todo el trabajo va en la rama `feat/geolocalizacion`, creada desde `dev`. **No se commitea en `dev`** (pedido explícito del autor); el merge lo decide el autor al final.
- La ubicación del usuario (coordenadas o comuna) nunca sale del navegador: no se envía a Supabase ni a terceros. Las coordenadas del GPS no se guardan; en `localStorage` solo el modo y, si corresponde, la región y la comuna.
- Ninguna API externa en tiempo de uso. Overpass se usa solo al correr el script de comunas, con `User-Agent: comparador-hardware-chile/1.0 (proyecto universitario)` (sin correo ni datos personales) y 1 s de espera entre consultas.
- No se publican direcciones ni horarios inventados: salen de los sitios oficiales y el autor los aprueba (Task 1) antes de escribir la migración.
- La migración la ejecuta el autor a mano en el SQL Editor y debe poder correrse dos veces sin error ni filas duplicadas.
- `weekday`: **0 = domingo … 6 = sábado**. Un día sin fila en `branch_hours` = cerrado.
- Hora de referencia: `America/Santiago`, nunca la zona horaria del computador.
- Distancia en línea recta (Haversine, radio 6371 km), con coma decimal: `"3,1 km"`.
- Orden por defecto: **Precio**. "Distancia" desactivado mientras no haya ubicación. Vigentes primero, atenuadas después; empate en distancia → precio.
- Funciona a 360 px y en modo oscuro (`color-scheme: light dark`, sin colores fijos de fondo).
- Pruebas del frontend: `cd frontend && deno test --no-config src/lib/` (sin `--no-config` falla). Comentarios y documentación en español, estilo de los archivos existentes.

## Review Focus

1. **Computador en otra zona horaria o cambio de horario de verano en Chile:** "Abierta/Cerrada" debe usar la hora de Santiago en verano (UTC−3) y en invierno (UTC−4). → Task 4, pruebas `openStatus usa hora de Chile en verano` y `... en invierno`.
2. **Fin de semana o domingo cerrado:** el sábado después del cierre debe decir "abre el lunes 10:00", no "abre mañana". → Task 4, prueba `cerrada el sábado tarde abre el lunes`.
3. **Tienda sin fila en `store_branches` o sin coordenadas:** la tarjeta se ve igual, con "Sin dirección registrada", y queda al final al ordenar por distancia. → Task 5, prueba `sin distancia va al final`.
4. **`localStorage` corrupto, con una comuna que ya no existe o que lanza excepción (modo privado):** se ignora y se vuelve a pedir la ubicación. → Task 6, pruebas `parseSaved` y `readSaved con storage que lanza`.
5. **El GPS no responde, no existe (http fuera de localhost) o el permiso se niega:** pasa a las listas de región y comuna sin quedarse en "Buscando tu ubicación…". → Task 6, pruebas `requestPosition` con timeout, sin geolocation y con error.

---

### Task 0: Rama de trabajo

- [ ] **Step 1: Crear la rama y commitear spec y plan en ella**

```bash
git switch -c feat/geolocalizacion dev
git add docs/superpowers/specs/2026-11-12-geolocalizacion-horarios-design.md docs/superpowers/plans/2026-11-12-geolocalizacion-horarios.md
git commit -m "docs: diseño y plan de geolocalización y horarios de tiendas"
```

Expected: `git branch --show-current` → `feat/geolocalizacion`.

---

### Task 1: Datos reales de las tiendas (con aprobación del autor)

**Files:**
- Create: `docs/migracion-004.md` (borrador: solo la sección "Datos de las tiendas")

**Interfaces:**
- Produces: tabla aprobada con, por tienda (`winpy`, `pcexpress`, `spdigital`): `name` (nombre de la sucursal, p. ej. "Casa matriz"), `address` (calle y número), `city` (comuna), `lat`, `lng`, `phone` (o vacío) y horario por día (`weekday`, `opens`, `closes`), con la URL de la fuente de cada dato. La usa Task 2.

- [ ] **Step 1: Buscar en el sitio oficial de cada tienda** la dirección de su local y su horario de **atención presencial** (retiro / pago en tienda). Anotar la URL exacta de cada dato. Si un sitio da varios horarios, usar el de atención en tienda y anotar los otros.

- [ ] **Step 2: Obtener las coordenadas** geocodificando la dirección oficial con Nominatim (`https://nominatim.openstreetmap.org/search?format=json&countrycodes=cl&q=<dirección, comuna>`, mismo `User-Agent` de las restricciones) o desde el mapa del sitio oficial. Anotar cuál.

- [ ] **Step 3: Escribir la sección "Datos de las tiendas" en `docs/migracion-004.md`**: una tabla por tienda con los campos de *Produces*, la fuente de cada uno y un enlace `https://www.openstreetmap.org/?mlat=<lat>&mlon=<lng>#map=18/<lat>/<lng>` para revisar el punto. Marcar explícitamente si **alguna tienda tiene más de un tramo en un mismo día**.

- [ ] **Step 4: PAUSA — pedir al autor que revise y apruebe la tabla** (direcciones, horarios y que cada punto caiga en el local en el mapa). No seguir a Task 2 sin su aprobación. Aplicar sus correcciones.

- [ ] **Step 5: Commit**

```bash
git add docs/migracion-004.md
git commit -m "docs: dirección, coordenadas y horario de las 3 tiendas (fuentes)"
```

---

### Task 2: Migración 004 (`store_branches` y `branch_hours`)

**Files:**
- Create: `supabase/migrations/004_ubicacion_tiendas.sql`
- Create: `supabase/tests/004_test.sql`
- Modify: `supabase/tests/002_stub.sql` (agregar `store_branches` y `branch_hours` con la definición real del spec, sin políticas, con RLS activado)
- Modify: `supabase/tests/run_002.sh` (después de las pruebas de la 003: 004 dos veces y `004_test.sql`; cabecera "Prueba las migraciones 002, 003 y 004")
- Modify: `docs/migracion-004.md` (agregar "Qué hace" y "Cómo ejecutarla", como `docs/migracion-003.md`)

**Interfaces:**
- Consumes: datos aprobados de Task 1.
- Produces: una fila de `store_branches` por tienda (índice único `store_branches_store_id_key` sobre `store_id`) con `address`, `city` (comuna), `lat`, `lng`; filas de `branch_hours` (0 = domingo); `select` para `anon` y `authenticated` en ambas tablas, sin escritura. Lo lee Task 7.

- [ ] **Step 1: Escribir `supabase/tests/004_test.sql`** con el estilo de `003_test.sql` (las tiendas se insertan antes de la migración, ver Step 2). Casos (cada uno `raise exception 'FALLO: …'`):
  - existe exactamente 1 fila de `store_branches` por cada `slug` de `stores` (3 filas en total);
  - toda sucursal tiene `address`, `city`, `lat` y `lng` no nulos;
  - `branch_hours` tiene al menos una fila por sucursal y ninguna con `closes <= opens`;
  - existe un índice único sobre `store_branches(store_id)`;
  - como `anon` (`begin; set local role anon; … rollback;`) se puede leer `store_branches` y `branch_hours` (count = 3 en `store_branches`);
  - como `anon`, `insert into public.branch_hours …` falla (capturar con `exception when insufficient_privilege or others` y fallar si **no** lanzó).

- [ ] **Step 2: Agregar al stub las tablas y las 3 tiendas**

En `002_stub.sql`, después de `stores`: `store_branches` y `branch_hours` tal como en el spec (`store_id bigint not null references public.stores (id)`), `enable row level security` en ambas, y `grant all … to service_role` las cubre ya. **No** insertar tiendas en el stub (`002_test.sql` inserta la 1). En `run_002.sh`, antes de la primera 004, una línea `run_sql` con un archivo nuevo `supabase/tests/004_prep.sql` que inserta las tiendas 1–3 con `on conflict (id) do nothing`.

- [ ] **Step 3: Verificar que falla**

Run: `bash supabase/tests/run_002.sh`
Expected: FAIL (no existe `004_ubicacion_tiendas.sql`).

- [ ] **Step 4: Escribir `004_ubicacion_tiendas.sql`**

Cabecera como la 003 (a mano, idempotente, explicación en `docs/migracion-004.md`) y un comentario con la convención `weekday 0 = domingo … 6 = sábado; día sin fila = cerrado`. Dentro de `begin; … commit;`:
1. `create unique index if not exists store_branches_store_id_key on public.store_branches (store_id);`
2. Solo si Task 1 marcó tiendas con más de un tramo por día: `alter table public.branch_hours drop constraint if exists branch_hours_pkey;` + `alter table … add constraint branch_hours_pkey primary key (branch_id, weekday, opens);` (la tabla está vacía en producción). Si no, omitir este paso.
3. `insert into public.store_branches (store_id, name, address, city, lat, lng, phone) select s.id, v.… from (values …) v(slug, …) join public.stores s on s.slug = v.slug on conflict (store_id) do update set …` con los datos aprobados.
4. `delete from public.branch_hours where branch_id in (select id from public.store_branches);` y luego `insert … select b.id, v.weekday, v.opens::time, v.closes::time from (values …) v(slug, weekday, opens, closes) join public.stores s on s.slug = v.slug join public.store_branches b on b.store_id = s.id;` (borrar y volver a insertar permite corregir horarios ejecutando de nuevo).
5. RLS y permisos, en ambas tablas: `alter table … enable row level security;`, `drop policy if exists store_branches_read …; create policy store_branches_read … for select to anon, authenticated using (true);` (ídem `branch_hours_read`), `grant select on public.store_branches, public.branch_hours to anon, authenticated;`.

- [ ] **Step 5: Verificar que pasa**

Run: `bash supabase/tests/run_002.sh`
Expected: termina sin error e imprime `OK 004` (además de los OK anteriores).

- [ ] **Step 6: Completar `docs/migracion-004.md`** ("Qué hace", "Cómo ejecutarla": pegar en SQL Editor → Run; se puede repetir; para corregir un horario se edita la migración y se vuelve a ejecutar).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/004_ubicacion_tiendas.sql supabase/tests/ docs/migracion-004.md
git commit -m "feat(db): migración 004 con dirección, coordenadas y horario de las tiendas"
```

---

### Task 3: Archivo de regiones y comunas

**Files:**
- Create: `scraper/comunas.ts` (script que genera el archivo)
- Create: `scraper/comunas_test.ts`
- Modify: `scraper/deno.json` (tarea `"comunas": "deno run --allow-net --allow-write=../frontend/src/data comunas.ts"`)
- Create (generado): `frontend/src/data/comunas.ts`

**Interfaces:**
- Produces, en `frontend/src/data/comunas.ts` (archivo generado, con cabecera "Generado por scraper/comunas.ts el <fecha>; no editar a mano"):
  ```ts
  export type Comuna = { name: string; lat: number; lng: number };
  export type Region = { name: string; comunas: Comuna[] };
  export const REGIONES: Region[];
  ```
  16 regiones de norte a sur (orden oficial: Arica y Parinacota … Magallanes), comunas ordenadas alfabéticamente (`localeCompare(…, "es")`), coordenadas con 5 decimales. Lo usan Tasks 6 y 7.
- Funciones exportadas de `scraper/comunas.ts` (puras, probadas): `parseRegion(json: OverpassResponse, regionName: string): { region: Region; dudosas: string[] }` y `toModule(regiones: Region[], fecha: string): string`.

- [ ] **Step 1: Escribir `scraper/comunas_test.ts`** (sin red; respuesta de Overpass pegada como fixture pequeño con 1 relación de región con `bounds` y 3 relaciones de comuna):
  - `parseRegion usa el nodo admin_centre`: comuna con miembro `role: "admin_centre"` (nodo con `lat/lon`) → usa esas coordenadas, no el `center` de la relación.
  - `parseRegion usa label si no hay admin_centre`, y `center` de la relación si no hay ninguno.
  - `parseRegion marca como dudosa una comuna fuera de los bounds de su región` (aparece en `dudosas`, y se mantiene en la lista).
  - `parseRegion ordena alfabéticamente con tildes` (`"Ñuñoa"` después de `"Nogales"`, `"Álamo"`… según `localeCompare("es")`).
  - `toModule produce TypeScript válido` (contiene `export const REGIONES` y `JSON.parse` del arreglo embebido devuelve lo mismo).

- [ ] **Step 2: Verificar que falla**

Run: `cd scraper && deno test comunas_test.ts`
Expected: FAIL (no existe `comunas.ts`).

- [ ] **Step 3: Implementar `scraper/comunas.ts`**

Constante `REGIONES_OFICIALES: { iso: string; name: string }[]` con los 16 códigos ISO 3166-2 en orden norte→sur: `CL-AP` Arica y Parinacota, `CL-TA` Tarapacá, `CL-AN` Antofagasta, `CL-AT` Atacama, `CL-CO` Coquimbo, `CL-VS` Valparaíso, `CL-RM` Metropolitana de Santiago, `CL-LI` Libertador General Bernardo O'Higgins, `CL-ML` Maule, `CL-NB` Ñuble, `CL-BI` Biobío, `CL-AR` La Araucanía, `CL-LR` Los Ríos, `CL-LL` Los Lagos, `CL-AI` Aysén del General Carlos Ibáñez del Campo, `CL-MA` Magallanes y de la Antártica Chilena. Por cada región, una consulta POST a `https://overpass-api.de/api/interpreter`:

```
[out:json][timeout:120];
rel["ISO3166-2"="<iso>"]->.r; .r out bb;
.r map_to_area->.a;
rel(area.a)["boundary"="administrative"]["admin_level"="8"];
out center tags;
>; node._(r:"admin_centre"); out;   // y lo mismo para "label"
```

(la consulta exacta la ajusta el implementador mientras devuelva los bounds de la región, las comunas con `center` y sus nodos `admin_centre`/`label` con su rol). Espera de 1 s entre consultas. `main`: arma las 16 regiones, imprime las dudosas, **falla con código ≠ 0 si el total no es 16 regiones y 346 comunas** (mostrando el conteo por región para corregir), y escribe `../frontend/src/data/comunas.ts` con `toModule`.

- [ ] **Step 4: Verificar las pruebas**

Run: `cd scraper && deno task test`
Expected: PASS (incluye las pruebas existentes).

- [ ] **Step 5: Generar el archivo**

Run: `cd scraper && deno task comunas`
Expected: termina con `16 regiones, 346 comunas` y crea `frontend/src/data/comunas.ts`. Si lista comunas dudosas, revisar cada una en openstreetmap.org y, si el punto es malo, corregirlo en una tabla `CORRECCIONES` del script (nombre → lat/lng, con comentario de por qué) y volver a generar.

- [ ] **Step 6: Commit**

```bash
git add scraper/comunas.ts scraper/comunas_test.ts scraper/deno.json frontend/src/data/comunas.ts
git commit -m "feat: archivo de regiones y comunas con su centro (OpenStreetMap)"
```

---

### Task 4: Distancia y horario (lógica pura)

**Files:**
- Create: `frontend/src/lib/geo.ts`, `frontend/src/lib/geo.test.ts`
- Create: `frontend/src/lib/hours.ts`, `frontend/src/lib/hours.test.ts`

**Interfaces:**
- Produces (`geo.ts`):
  - `type LatLng = { lat: number; lng: number }`
  - `distanceKm(a: LatLng, b: LatLng): number` (Haversine, R = 6371)
  - `formatKm(km: number): string` → `"0,4 km"`, `"3,1 km"`, `"12,0 km"`; desde 100 km sin decimales: `"457 km"` (usa `Intl.NumberFormat("es-CL")`).
- Produces (`hours.ts`):
  - `type HoursRow = { weekday: number; opens: string; closes: string }` (`"HH:MM"` o `"HH:MM:SS"`, como lo entrega PostgREST)
  - `type OpenStatus = { open: true; closes: string } | { open: false; opens: string; when: "hoy" | "mañana" | string } | null` (`closes`/`opens` en `"HH:MM"`; `when` en otro caso es `"el lunes"`, `"el martes"`…; `null` si no hay horario)
  - `chileClock(now: Date): { weekday: number; minutes: number }` (con `Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })`)
  - `openStatus(hours: HoursRow[], now: Date): OpenStatus` (admite varios tramos por día)
  - `statusText(s: OpenStatus): string` → `"Abierta · cierra 19:00"`, `"Cerrada · abre hoy 10:00"`, `"Cerrada · abre mañana 10:00"`, `"Cerrada · abre el lunes 10:00"`, `"Horario no disponible"`.
  - `weekSchedule(hours: HoursRow[]): { day: string; text: string }[]` → 7 filas de lunes a domingo (`"Lunes"`, …), `text` `"10:00 – 19:00"` (varios tramos unidos con `", "`) o `"Cerrado"`.

- [ ] **Step 1: Escribir `geo.test.ts`** (`import { assertEquals, assertAlmostEquals } from "jsr:@std/assert@1"`):
  - `distanceKm entre Plaza de Armas y Plaza Ñuñoa ≈ 6,0 km` (`{lat:-33.4378,lng:-70.6505}` y `{lat:-33.4569,lng:-70.5974}`; tolerancia 0,3).
  - `distanceKm de un punto a sí mismo es 0`.
  - `formatKm`: `0.42 → "0,4 km"`, `3.14 → "3,1 km"`, `12 → "12,0 km"`, `456.7 → "457 km"`.

- [ ] **Step 2: Escribir `hours.test.ts`**. Horario de prueba `H`: lunes a viernes (1–5) 10:00–19:00, sábado (6) 10:00–14:00, domingo sin fila. Fechas en UTC:
  - `openStatus usa hora de Chile en verano`: `2026-11-12T21:30:00Z` (jueves 18:30 en Chile, UTC−3) → `{ open: true, closes: "19:00" }`.
  - `openStatus usa hora de Chile en invierno`: `2026-07-16T22:30:00Z` (jueves 18:30, UTC−4) → abierta, cierra 19:00.
  - `justo a la hora de cierre está cerrada`: jueves 19:00 Chile (`2026-11-12T22:00:00Z`) → `{ open: false, opens: "10:00", when: "mañana" }`.
  - `antes de abrir dice hoy`: jueves 08:00 Chile (`2026-11-12T11:00:00Z`) → `when: "hoy"`.
  - `cerrada el sábado tarde abre el lunes`: sábado 15:00 Chile (`2026-11-14T18:00:00Z`) → `{ open: false, opens: "10:00", when: "el lunes" }`.
  - `pausa de almuerzo`: horario con dos tramos el jueves (10:00–13:30 y 15:00–19:00), a las 14:00 → `{ open: false, opens: "15:00", when: "hoy" }`; a las 12:00 → abierta, cierra `"13:30"`.
  - `sin horario` → `openStatus([], now) === null` y `statusText(null) === "Horario no disponible"`.
  - `statusText` para los cuatro casos de la interfaz (textos exactos).
  - `weekSchedule(H)`: 7 filas, primera `{ day: "Lunes", text: "10:00 – 19:00" }`, sábado `"10:00 – 14:00"`, última `{ day: "Domingo", text: "Cerrado" }`; acepta `"10:00:00"` y lo muestra `"10:00"`.

- [ ] **Step 3: Verificar que fallan**

Run: `cd frontend && deno test --no-config src/lib/geo.test.ts src/lib/hours.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 4: Implementar `geo.ts` y `hours.ts`** con las firmas de *Produces*. En `openStatus`, buscar el próximo tramo recorriendo como máximo 7 días hacia adelante desde el reloj de Chile; "abierta" si `opens <= ahora < closes`.

- [ ] **Step 5: Verificar que pasan**

Run: `cd frontend && deno test --no-config src/lib/`
Expected: PASS (todas, incluidas las existentes).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/geo.ts frontend/src/lib/geo.test.ts frontend/src/lib/hours.ts frontend/src/lib/hours.test.ts
git commit -m "feat(frontend): distancia y estado abierta/cerrada con hora de Chile"
```

---

### Task 5: Orden por precio o distancia

**Files:**
- Modify: `frontend/src/lib/offers.ts` (función `sortOffers`)
- Modify: `frontend/src/lib/offers.test.ts`

**Interfaces:**
- Produces: `type SortBy = "precio" | "distancia"` y
  `sortOffers(offers: Offer[], now: Date, by: SortBy = "precio", distanceByStore: Map<number, number> = new Map()): Offer[]`.
  Con `"precio"` el resultado es idéntico al actual (las llamadas existentes no cambian). Con `"distancia"`: vigentes primero y atenuadas después; dentro de cada bloque, menor distancia primero, ofertas sin distancia al final, empate → precio.

- [ ] **Step 1: Agregar pruebas a `offers.test.ts`**:
  - `sortOffers por distancia`: tres ofertas vigentes de las tiendas 1, 2, 3 con precios 300, 100, 200 y distancias `{1: 2, 2: 9, 3: 5}` → orden de `store_id` `[1, 3, 2]`.
  - `sin distancia va al final`: la tienda 3 no está en el mapa → `[1, 2, 3]`.
  - `vigentes antes que atenuadas también por distancia`: la tienda más cercana con `in_stock: false` queda después de las vigentes.
  - `empate de distancia se resuelve por precio`.
  - `por precio no cambia` (las pruebas existentes de `sortOffers` siguen pasando sin modificarse).

- [ ] **Step 2: Verificar que fallan**

Run: `cd frontend && deno test --no-config src/lib/offers.test.ts`
Expected: FAIL en las pruebas nuevas.

- [ ] **Step 3: Implementar** el parámetro nuevo en `sortOffers` (un comparador `byDistance(d)` que cae a `byPrice`).

- [ ] **Step 4: Verificar que pasan**

Run: `cd frontend && deno test --no-config src/lib/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/offers.ts frontend/src/lib/offers.test.ts
git commit -m "feat(frontend): ordenar ofertas por distancia"
```

---

### Task 6: Ubicación del usuario (preferencia, GPS y barra)

**Files:**
- Create: `frontend/src/lib/user-location.ts`, `frontend/src/lib/user-location.test.ts`
- Create: `frontend/src/location.tsx` (contexto, como `saved.tsx`)
- Create: `frontend/src/components/location-bar.tsx`
- Modify: `frontend/src/app.tsx` (envolver con `<LocationProvider>` dentro de `SavedProvider`)

**Interfaces:**
- Consumes: `REGIONES`, `Region` de `data/comunas.ts` (Task 3); `LatLng` de `lib/geo.ts` (Task 4).
- Produces (`lib/user-location.ts`, puro; recibe los datos por parámetro para poder probarse sin el archivo generado):
  - `type SavedLocation = { modo: "gps" } | { modo: "comuna"; region: string; comuna: string }`
  - `const STORAGE_KEY = "ubicacion"`
  - `parseSaved(raw: string | null, regiones: Region[]): SavedLocation | null` (JSON inválido, modo desconocido o comuna inexistente → `null`)
  - `readSaved(storage: Pick<Storage, "getItem"> | null, regiones: Region[]): SavedLocation | null` y `writeSaved(storage: Pick<Storage, "setItem"> | null, s: SavedLocation): void` (ambas atrapan excepciones)
  - `findComuna(regiones: Region[], region: string, comuna: string): LatLng | null`
  - `requestPosition(geo: Pick<Geolocation, "getCurrentPosition"> | undefined, timeoutMs: number): Promise<LatLng | null>` (`null` si no hay `geo`, si da error o si pasa `timeoutMs`; usa `{ enableHighAccuracy: false, maximumAge: 600000, timeout: timeoutMs }` y además un `setTimeout` propio por si el navegador nunca responde)
- Produces (`location.tsx`):
  - `type UserLocation = { estado: "inicial" } | { estado: "buscando" } | { estado: "gps"; point: LatLng } | { estado: "comuna"; region: string; comuna: string; point: LatLng } | { estado: "elegir" }`
  - `LocationProvider` y `useUserLocation(): { location: UserLocation; start(): void; requestGps(): void; chooseComuna(region: string, comuna: string): void }`
  - `start()` es idempotente (solo actúa en `"inicial"`): lee lo guardado; si es comuna válida → `"comuna"` sin pedir GPS; si no → `"buscando"` y `requestPosition(navigator.geolocation, 10000)` → `"gps"` (guarda `{modo:"gps"}`) o `"elegir"`. `requestGps()` hace lo mismo a pedido (no se llama `useGps` para que el lint no la confunda con un hook). `chooseComuna` pasa a `"comuna"` y guarda.
- Produces (`components/location-bar.tsx`): `LocationBar()` sin props, que muestra según el estado: `"📍 Buscando tu ubicación…"`, `"📍 Usando tu ubicación · Cambiar"`, `"📍 Comuna: <comuna> · Cambiar"`, o el formulario. "Cambiar" (y el estado `"elegir"`) muestra: el texto `"Para ver la distancia a cada tienda, usa tu ubicación o elige tu comuna:"`, `<select>` de región, `<select>` de comuna (filtrado por región, deshabilitado sin región), el botón `"Usar mi ubicación"` y la nota `"La distancia se mide desde el centro de la comuna."`. Elegir comuna aplica de inmediato.

- [ ] **Step 1: Escribir `user-location.test.ts`** con un `Region[]` de prueba de 2 regiones:
  - `parseSaved`: `null` → `null`; `"{"` → `null`; `{"modo":"gps"}` → `{ modo: "gps" }`; comuna válida → igual; comuna que no está en la región → `null`; `{"modo":"otro"}` → `null`.
  - `readSaved con storage que lanza` → `null` (objeto cuyo `getItem` hace `throw`); `readSaved(null, …)` → `null`.
  - `writeSaved con storage que lanza` no lanza.
  - `findComuna` encuentra por nombre exacto y devuelve `null` si no existe.
  - `requestPosition sin geolocation` → `null`.
  - `requestPosition con error` (el fake llama al callback de error) → `null`.
  - `requestPosition con timeout` (el fake nunca llama; `timeoutMs = 20`) → `null`.
  - `requestPosition con éxito` → `{ lat, lng }` del fake.

- [ ] **Step 2: Verificar que falla**

Run: `cd frontend && deno test --no-config src/lib/user-location.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `lib/user-location.ts`**.

- [ ] **Step 4: Verificar que pasa**

Run: `cd frontend && deno test --no-config src/lib/`
Expected: PASS.

- [ ] **Step 5: Implementar `location.tsx`, `location-bar.tsx` y el cambio en `app.tsx`** con las interfaces de arriba (`localStorage` se pasa como `typeof localStorage === "undefined" ? null : localStorage`, dentro de `try`). Estilos de la barra en `app.css` (clase `location-bar`), sin colores fijos de fondo (usar `color-mix`/transparencias como el resto), y los `<select>` en columna bajo 400 px.

- [ ] **Step 6: Verificar compilación y lint**

Run: `cd frontend && npx tsc -b && npx oxlint`
Expected: sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/user-location.ts frontend/src/lib/user-location.test.ts frontend/src/location.tsx frontend/src/components/location-bar.tsx frontend/src/app.tsx frontend/src/app.css
git commit -m "feat(frontend): ubicación del usuario con GPS o comuna"
```

---

### Task 7: Tarjetas de tienda en la subpágina de producto

**Files:**
- Modify: `frontend/src/data.ts` (agregar `fetchBranches`)
- Create: `frontend/src/components/store-card.tsx`
- Modify: `frontend/src/pages/product.tsx` (la sección "Tiendas")
- Modify: `frontend/src/app.css` (estilos `.store-card`, `.sort-toggle`; quitar los de `.offers` solo si ya no se usan en ningún lado)

**Interfaces:**
- Consumes: `sortOffers`, `SortBy` (Task 5); `distanceKm`, `formatKm`, `LatLng` (Task 4); `openStatus`, `statusText`, `weekSchedule`, `HoursRow` (Task 4); `useUserLocation`, `LocationBar` (Task 6).
- Produces:
  - En `data.ts`: `type Branch = { store_id: number; address: string | null; city: string | null; lat: number | null; lng: number | null; branch_hours: HoursRow[] }` y `fetchBranches(): Promise<Branch[]>` — `supabase.from("store_branches").select("store_id, address, city, lat, lng, branch_hours(weekday, opens, closes)")`, pedido una sola vez por carga de página (misma idea que `fetchCatalog`: promesa guardada, se olvida si falla).
  - `StoreCard({ offer, branch, distance, now }: { offer: Offer; branch: Branch | null; distance: number | null; now: Date })`.

- [ ] **Step 1: Agregar `fetchBranches` a `data.ts`.**

- [ ] **Step 2: Crear `StoreCard`** (boceto B): fila superior con nombre de la tienda (`STORES`) y precio (`clp`); línea con `"<address>, <city> · <formatKm>"` (sin distancia si `distance` es `null`; `"Sin dirección registrada"` si no hay `branch` o `address`); línea con `statusText(openStatus(...))` (clase `open`/`closed`), el estado del stock (mismo `statusLabel` que hoy, movido de `product.tsx` a este componente) y `"Ir a la tienda ↗"` (`target="_blank" rel="noreferrer noopener"`); `<details><summary>Ver horario</summary>` con `weekSchedule` como tabla (o nada si no hay horario). Tarjeta atenuada (clase `stale`) si la oferta no es vigente, como hoy.

- [ ] **Step 3: Cambiar la sección "Tiendas" de `product.tsx`**:
  - Al montar: `start()` de `useUserLocation` y `fetchBranches()` (si falla, la página sigue sin direcciones ni horarios y muestra `"No se pudo cargar la ubicación de las tiendas."` en la sección; nunca bloquea la página).
  - Punto del usuario: `location.point` si el estado es `"gps"` o `"comuna"`; si no, `null`.
  - `distanceByStore: Map<number, number>` con `distanceKm` para cada sucursal con `lat`/`lng`.
  - Estado `sortBy` (inicia en `"precio"`, no se guarda). Selector `"Ordenar por:"` con dos botones `"Precio"` / `"Distancia"` (`aria-pressed`); `"Distancia"` `disabled` sin punto, y si el punto desaparece con `"distancia"` elegido, se vuelve a `"precio"`.
  - `<LocationBar />` y el selector arriba; luego un `StoreCard` por oferta de `sortOffers(group.offers, now, sortBy, distanceByStore)`.
  - El "desde $X en <tienda>" del encabezado no cambia.

- [ ] **Step 4: Verificar compilación, lint, pruebas y build**

Run: `cd frontend && deno test --no-config src/lib/ && npx tsc -b && npx oxlint && npx vite build`
Expected: todo pasa, sin errores nuevos de lint.

- [ ] **Step 5: Probar en el navegador** (`deno task dev`, con la migración 004 ejecutada en Supabase por el autor; si aún no está ejecutada, comprobar al menos que la página funciona sin direcciones): aceptar ubicación → distancias y "Usando tu ubicación"; ordenar por distancia; negar ubicación (permiso del sitio en "Bloquear") → listas de región y comuna; elegir Ñuñoa → distancias y "Comuna: Ñuñoa"; recargar → sigue Ñuñoa sin pedir GPS; "Cambiar" → "Usar mi ubicación"; "Ver horario"; ancho 360 px y modo oscuro. Anotar lo que no se pudo probar.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data.ts frontend/src/components/store-card.tsx frontend/src/pages/product.tsx frontend/src/app.css
git commit -m "feat(frontend): tarjetas de tienda con distancia, horario y orden"
```

---

### Task 8: Documentación, autoría y grafo

**Files:**
- Modify: `README.md`, `docs/autoria.md`

- [ ] **Step 1: README**: en "Estado actual" marcar la geolocalización como hecha en código (falta ejecutar la 004) y reemplazar la nota "Por hacer: geolocalización…" por una línea de lo que quedó fuera (stock por sucursal, `nearby_branches` sin usar); agregar la 004 a los pasos manuales y a "Migraciones" de "Puesta en marcha"; en "Estructura": `frontend/src/data/comunas.ts`, `location.tsx`, `scraper/comunas.ts`, `docs/migracion-004.md` y la 004 en `supabase/migrations/`; en "Pruebas", que `run_002.sh` cubre 002–004; la tarea `deno task comunas`. Corregir de paso la frase de la intro de `docs/autoria.md` ("condensadas en 3 prompts").

- [ ] **Step 2: `docs/autoria.md`**: agregar **Prompt 18: Geolocalización y horarios de las tiendas** con el formato de siempre (Prompt condensado, Resultado obtenido con los commits de la rama, Decisiones propias: tarjetas B, comuna desde lista con centro de comuna, archivo fijo desde OpenStreetMap, ignorar stock por sucursal, una sola sucursal por tienda; Supuestos del asistente por confirmar: los de "Decisiones del asistente" del spec; Pendiente de verificar: ejecutar la 004, probar en el navegador). Actualizar "Por hacer": marcar la geolocalización y agregar `[ ] Ejecutar la migración 004 en Supabase y probar distancias y horarios en el navegador`.

- [ ] **Step 3: Regenerar el grafo**

Run: `graphify update .`
Expected: termina sin error (`graphify-out/` está ignorado por git).

- [ ] **Step 4: Commit**

```bash
git add README.md docs/autoria.md
git commit -m "docs: geolocalización y horarios en README y autoría (Prompt 18)"
```
