# Imagen de producto — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada producto muestre su foto real (de SP Digital o Winpy) en el catálogo, la subpágina y Guardados, con el placeholder cuando no haya foto o no cargue.

**Architecture:** Los scrapers de SP Digital y Winpy leen la URL de la imagen de las mismas páginas que ya recorren y la guardan en la nueva columna `products.image_url`. `group.ts` elige una imagen por grupo (SP Digital antes que Winpy) y la escribe en `product_groups.image_url`, que el frontend ya lee. Las imágenes se enlazan directo desde la tienda: no se descargan ni se suben a Supabase.

**Tech Stack:** Deno + TypeScript (scrapers, `deno test`), linkedom (HTML), Supabase PostgREST, PostgreSQL 17 (prueba de migración con podman), React 19 + Vite.

**Spec:** acordado en la conversación del 2026-11-12 (cambio acotado, sin documento de diseño). Resumen: migración 003; SP Digital usa `media[0].limitedUrl` (512 px) o `thumbnail.url`; Winpy usa el `<img>` del artículo sin `tumb_`; **PC Express no extrae imagen** porque su servidor responde 403 a imágenes pedidas desde otro sitio y se respeta ese bloqueo; prioridad de grupo SP Digital > Winpy; pruebas sin red; README, explicación de la migración, Prompt 16 en `docs/autoria.md` y `graphify update .`.

## Global Constraints

- No usar ni guardar imágenes de PC Express, ni esquivar su bloqueo (nada de `referrerPolicy="no-referrer"`).
- Sin peticiones nuevas a las tiendas: la imagen sale del mismo HTML/JSON del listado.
- Solo se aceptan URLs `https://` como imagen; cualquier otra cosa se guarda como `null`.
- Placeholder: `/placeholder.png` (ya existe en `frontend/public/`).
- La migración se ejecuta a mano en el SQL Editor y debe poder correrse dos veces sin error.
- Pruebas de Deno sin red (fragmentos de HTML/JSON reales pegados en la prueba).
- Comentarios y documentación en español, con el estilo de los archivos existentes.

## Review Focus

1. **Scrapers corriendo antes de la migración 003** (p. ej. el cron diario después de hacer merge a `main`): PostgREST rechaza `image_url` y no se guarda nada. Se espera que la documentación (Task 1 y Task 6) diga claramente "migración 003 antes de correr los scrapers nuevos".
2. **Foto que ya no existe en la tienda (404):** se espera el placeholder, no un ícono roto (Task 5).
3. **Producto de SP Digital sin `media` o con el primer medio de tipo video:** se espera `thumbnail.url` o `null`, no una URL de video (Task 2, prueba).
4. **Artículo de Winpy sin `<img>` o con imagen ya en tamaño completo:** se espera `null` o la misma URL sin cambios (Task 3, prueba).
5. **Grupo con productos solo de PC Express, o con SP Digital sin foto y Winpy con foto:** `null` en el primer caso y la de Winpy en el segundo (Task 4, prueba).

---

### Task 1: Migración 003 (`products.image_url`)

**Files:**
- Create: `supabase/migrations/003_imagen_producto.sql`
- Create: `supabase/tests/003_test.sql`
- Modify: `supabase/tests/run_002.sh` (correr 003 dos veces después de 002 y luego `003_test.sql`)
- Create: `docs/migracion-003.md`

**Interfaces:**
- Produces: columna `public.products.image_url text` (nullable). La usan Tasks 2–4.

- [ ] **Step 1: Escribir la prueba `supabase/tests/003_test.sql`**

Con el estilo de `002_test.sql` (bloque `do $$ ... raise exception ... $$`): falla si no existe `public.products.image_url` de tipo `text` y nullable (consulta a `information_schema.columns`), y comprueba que `anon` puede leerla (`set role anon; select image_url from public.products limit 1; reset role;`).

- [ ] **Step 2: Agregar a `run_002.sh` las líneas de la 003 y verificar que falla**

Después de la segunda ejecución de la 002: `run_sql supabase/migrations/003_imagen_producto.sql ...` dos veces y `run_sql supabase/tests/003_test.sql ""`. Actualizar el comentario de cabecera ("Prueba las migraciones 002 y 003").

Run: `bash supabase/tests/run_002.sh`
Expected: FAIL (no existe `003_imagen_producto.sql`).

- [ ] **Step 3: Crear `003_imagen_producto.sql`**

Cabecera como la de la 002 (se ejecuta a mano, idempotente, explicación en `docs/migracion-003.md`), `begin; alter table public.products add column if not exists image_url text; commit;`.

- [ ] **Step 4: Verificar que pasa**

Run: `bash supabase/tests/run_002.sh`
Expected: termina con código 0 y sin `ERROR`.

- [ ] **Step 5: Escribir `docs/migracion-003.md`**

Con el formato de `migracion-002.md`: qué agrega, cómo ejecutarla y el orden **migración 003 → scrapers → agrupado → página**. Hay que destacar que los scrapers nuevos fallan al guardar si la 003 no se ha ejecutado, y que esto incluye el cron diario: hay que ejecutar la 003 antes de hacer merge a `main`. Explicar también por qué PC Express no aporta imágenes.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/003_imagen_producto.sql supabase/tests/003_test.sql supabase/tests/run_002.sh docs/migracion-003.md
git commit -m "feat(db): migración 003, columna image_url en products"
```

### Task 2: Imagen en el scraper de SP Digital (y nota en PC Express)

**Files:**
- Modify: `scraper/spdigital.ts` (`ScrapedProduct`, `PageData`, `parseListing`, `save`, línea de modo prueba)
- Modify: `scraper/pcexpress.ts` (solo comentario en la cabecera)
- Create: `scraper/spdigital_test.ts`

**Interfaces:**
- Consumes: columna `products.image_url` (Task 1).
- Produces: `ScrapedProduct.imageUrl: string | null`; `save` envía `image_url: p.imageUrl`.

- [ ] **Step 1: Escribir `scraper/spdigital_test.ts`**

Arma un JSON mínimo con la forma de `PageData` y llama a `parseListing(JSON.stringify(data))`:
- `"SP Digital: usa la imagen de 512 px del primer medio IMAGE"`: item con `media: [{ type: "IMAGE", url: ".../x_thumbnail_4096.jpg", limitedUrl: "https://media.spdigital.cl/thumbnails/products/x_thumbnail_512.jpg", thumbnailUrl: ".../x_thumbnail_256.jpg" }]` y `thumbnail: { url: ".../x_thumbnail_256.jpg" }` → `imageUrl === "https://media.spdigital.cl/thumbnails/products/x_thumbnail_512.jpg"`.
- `"SP Digital: sin media usa thumbnail.url"`: `media: []`, `thumbnail: { url: "https://media.spdigital.cl/thumbnails/products/y_thumbnail_256.jpg" }` → esa URL.
- `"SP Digital: ignora medios que no son IMAGE"`: `media: [{ type: "VIDEO", limitedUrl: "https://media.spdigital.cl/v.mp4" }]`, sin `thumbnail` → `null`.
- `"SP Digital: URL que no es https queda null"`: `limitedUrl: "http://media.spdigital.cl/a.jpg"`, sin `thumbnail` → `null`.
- Los items llevan `slug` y `name` válidos (`"procesador-intel-13100f"`, `"PROCESADOR INTEL 13100F"`) para que `parseListing` no los descarte.

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd scraper && deno test spdigital_test.ts`
Expected: FAIL (`imageUrl` es `undefined`).

- [ ] **Step 3: Implementar**

- En `PageData` agregar a los items: `thumbnail?: { url?: string | null } | null` y `media?: Array<{ type?: string; limitedUrl?: string | null; thumbnailUrl?: string | null }> | null`.
- En `parseListing`: `imageUrl` = `limitedUrl` del primer medio con `type === "IMAGE"`; si no hay, `thumbnail.url`; luego se aplica la regla de solo `https://` (helper local `httpsOrNull(u: unknown): string | null`).
- En `save`: `image_url: p.imageUrl` en cada fila.
- Actualizar el comentario de cabecera ("nombre, precio, stock e imagen") y la línea de modo prueba para que muestre si trae imagen (`img: sí/no`).
- En `pcexpress.ts`, en la cabecera: "No se guarda la imagen: PC Express responde 403 a sus imágenes cuando las pide otra página (protección contra hotlinking) y se respeta ese bloqueo."

- [ ] **Step 4: Verificar que pasa**

Run: `cd scraper && deno test`
Expected: todas las pruebas PASS (incluidas las de `group_key_test.ts`).

- [ ] **Step 5: Commit**

```bash
git add scraper/spdigital.ts scraper/spdigital_test.ts scraper/pcexpress.ts
git commit -m "feat(scraper): SP Digital guarda la imagen del producto"
```

### Task 3: Imagen en el scraper de Winpy

**Files:**
- Modify: `scraper/winpy.ts` (`ScrapedProduct`, `parseListing`, `save`, línea de modo prueba)
- Create: `scraper/winpy_test.ts`

**Interfaces:**
- Consumes: columna `products.image_url` (Task 1).
- Produces: `ScrapedProduct.imageUrl: string | null`; `export function fullImageUrl(src: string | null | undefined): string | null`.

- [ ] **Step 1: Escribir `scraper/winpy_test.ts`**

- `"Winpy: fullImageUrl quita tumb_ y resuelve contra el dominio"`: `fullImageUrl("/files/tumb_48719-6a623847ba314.jpg") === "https://www.winpy.cl/files/48719-6a623847ba314.jpg"`.
- `"Winpy: fullImageUrl deja igual la imagen grande"`: `fullImageUrl("/files/28724-6a7f4328c9322.jpg") === "https://www.winpy.cl/files/28724-6a7f4328c9322.jpg"`.
- `"Winpy: fullImageUrl sin src devuelve null"`: `fullImageUrl(undefined) === null` y `fullImageUrl("") === null`.
- `"Winpy: parseListing lee la imagen de cada artículo"`: HTML `<section id="productos">` con los dos `<article>` reales de abajo, más un tercero sin `<img>`. Se espera `imageUrl` = las dos URLs de arriba y `null` para el tercero, y que nombre y precio sigan iguales (`"Procesador AMD Ryzen 5 4500 (AM4, 6 Núcleos, 12 Hilos, 3.6/4.1GHz, 8MB de Caché L3)"`, `94240`).

```html
<article>
  <a href="/venta/procesador-amd-ryzen-5-4500/" title="..."><img src="/files/tumb_48719-6a623847ba314.jpg" width="140" height="140" alt="..."></a>
  <p><a href="/venta/procesador-amd-ryzen-5-4500/">AMD</a></p>
  <p class="model"><a href="/venta/procesador-amd-ryzen-5-4500/">Procesador AMD Ryzen 5 4500 (AM4, 6 Núcleos, 12 Hilos, 3.6/4.1GHz, 8MB de Caché L3)</a></p>
  <p class="valor">$ 94.240</p>
  <div class="opciones"><button title="Despacho Express" class="btnExpress"><b>Despacho Express</b></button></div>
</article>
```

(el segundo artículo es igual, con `/files/28724-6a7f4328c9322.jpg`, `/venta/procesador-intel-core-i3-12100f/` y `$ 102.752`).

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd scraper && deno test winpy_test.ts`
Expected: FAIL (`fullImageUrl` no está exportada).

- [ ] **Step 3: Implementar**

- `fullImageUrl`: resuelve `src` contra `BASE`, quita `tumb_` solo al inicio del último segmento de la ruta y aplica la regla de solo `https://`.
- `parseListing`: `imageUrl: fullImageUrl(article.querySelector("img")?.getAttribute("src"))`.
- `save`: `image_url: p.imageUrl`. Actualizar la cabecera y la línea de modo prueba como en Task 2.

- [ ] **Step 4: Verificar que pasa**

Run: `cd scraper && deno test`
Expected: todas PASS.

- [ ] **Step 5: Commit**

```bash
git add scraper/winpy.ts scraper/winpy_test.ts
git commit -m "feat(scraper): Winpy guarda la imagen del producto en tamaño completo"
```

### Task 4: `group.ts` elige la imagen del grupo

**Files:**
- Modify: `scraper/group.ts`
- Create: `scraper/group_test.ts`

**Interfaces:**
- Consumes: `products.image_url` (llenada por Tasks 2 y 3).
- Produces: `export function pickGroupImage(candidates: { storeSlug: string; imageUrl: string | null }[]): string | null` y `product_groups.image_url` escrita en cada corrida.

- [ ] **Step 1: Escribir `scraper/group_test.ts`**

- `"pickGroupImage: SP Digital antes que Winpy"`: `[{winpy, "https://w/a.jpg"}, {spdigital, "https://s/b.jpg"}]` → `"https://s/b.jpg"`.
- `"pickGroupImage: SP Digital sin foto usa Winpy"`: `[{spdigital, null}, {winpy, "https://w/a.jpg"}]` → `"https://w/a.jpg"`.
- `"pickGroupImage: solo PC Express queda null"`: `[{pcexpress, "https://imagenes.pc-express.cl/x.jpg"}]` → `null` (aunque traiga URL, PC Express nunca se usa).
- `"pickGroupImage: sin candidatos queda null"`: `[]` → `null`.
- `"pickGroupImage: dos de la misma tienda, gana el primero"`: `[{spdigital, "https://s/1.jpg"}, {spdigital, "https://s/2.jpg"}]` → `"https://s/1.jpg"`.

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd scraper && deno test group_test.ts`
Expected: FAIL (`pickGroupImage` no está exportada).

- [ ] **Step 3: Implementar**

- `pickGroupImage` recorre la lista de prioridad `["spdigital", "winpy"]` y devuelve la primera `imageUrl` no nula de esa tienda, respetando el orden de entrada.
- En `main`: leer `stores?select=id,slug` y armar un `Map<number, string>` de id → slug; agregar `image_url` al `select` de `fetchProducts` y a `Row`; juntar los candidatos por slug de grupo (las filas ya vienen ordenadas por `id`); incluir `image_url: pickGroupImage(...)` en cada objeto que va a `upsertGroups`. Todos los objetos llevan la clave, aunque sea `null`, porque PostgREST exige las mismas claves en un insert múltiple.
- Agregar `con imagen: N` al `console.log` final.
- Comentario junto a la elección: las filas con `group_locked = true` no entran (no se leen), y si una tienda deja de mostrar la foto, el grupo vuelve a `null` en la siguiente corrida.

- [ ] **Step 4: Verificar que pasa**

Run: `cd scraper && deno test && deno check group.ts winpy.ts spdigital.ts pcexpress.ts`
Expected: todas PASS y `deno check` sin errores.

- [ ] **Step 5: Commit**

```bash
git add scraper/group.ts scraper/group_test.ts
git commit -m "feat(scraper): el agrupado elige la imagen del grupo (SP Digital > Winpy)"
```

### Task 5: Placeholder cuando la imagen no carga

**Files:**
- Create: `frontend/src/components/product-image.tsx`
- Modify: `frontend/src/components/product-card.tsx:10-15`, `frontend/src/pages/product.tsx:70-74`, `frontend/src/pages/saved-page.tsx:120-125`

**Interfaces:**
- Produces: `export function ProductImage(props: { src: string | null; alt: string; className?: string; width?: number; height?: number; loading?: "lazy" | "eager" })`.

- [ ] **Step 1: Implementar `ProductImage`**

Muestra `src` y, si es `null` o si el `<img>` dispara `onError`, muestra `/placeholder.png`. Guarda en el estado *cuál* `src` falló (`useState<string | null>`), no un booleano: así un `src` nuevo se vuelve a intentar y el placeholder nunca entra en un ciclo de errores. Sin `referrerPolicy`.

- [ ] **Step 2: Usarlo en los tres lugares**

Se mantienen las props actuales de cada uno: tarjeta con `className="card-img"` y `loading="lazy"`; subpágina con `className="product-img"`; Guardados con `alt=""`, `width={70}`, `height={70}` y `loading="lazy"`.

- [ ] **Step 3: Verificar**

Run: `cd frontend && deno task lint && deno task build && deno test --no-config src/lib/`
Expected: lint sin errores, build OK y pruebas PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/product-image.tsx frontend/src/components/product-card.tsx frontend/src/pages/product.tsx frontend/src/pages/saved-page.tsx
git commit -m "feat(frontend): placeholder cuando la imagen del producto no carga"
```

### Task 6: Documentación, autoría y grafo

**Files:**
- Modify: `README.md` (Estado actual, Estructura, Base de datos, Puesta en marcha)
- Modify: `docs/autoria.md` (Prompt 16 antes de "Por hacer"; actualizar "Por hacer")

- [ ] **Step 1: README**

- Marcar como hecho el ítem de la imagen y decir de dónde sale (SP Digital y Winpy; PC Express no, por su bloqueo).
- Agregar `003_imagen_producto.sql` a la estructura y a "Base de datos".
- En "Puesta en marcha", agregar el paso de la migración 003 junto al de la 002 y el orden migración → scrapers → agrupado.
- Agregar `docs/migracion-003.md` a la lista de docs.
- Mencionar las pruebas nuevas en "Pruebas" (`deno task test` ya las incluye).

- [ ] **Step 2: `docs/autoria.md`**

Sección `## Prompt 16: Imagen de los productos` con el formato de la 15 (prompt condensado, resultado con los commits, decisiones propias, supuestos por confirmar y pendiente de verificar):
- Decisión propia: respetar el bloqueo de PC Express y usar el placeholder.
- Supuestos: el tamaño de las imágenes y la prioridad SP Digital > Winpy.
- Pendiente: ejecutar la 003 en Supabase antes de que corra el cron con este código y revisar las fotos en el navegador.

En "Por hacer": marcar el ítem de la imagen y agregar "[ ] Ejecutar la migración 003 en Supabase".

- [ ] **Step 3: Commit**

```bash
git add README.md docs/autoria.md docs/superpowers/plans/2026-11-12-imagen-producto.md
git commit -m "docs: imagen de producto, migración 003 y Prompt 16 en autoría"
```

- [ ] **Step 4: Actualizar el grafo**

Run: `graphify update .` (desde la raíz; `graphify-out/` está en `.gitignore`, no se commitea).
Expected: termina sin error y `graphify-out/GRAPH_REPORT.md` muestra el nuevo commit en "Built from commit".
