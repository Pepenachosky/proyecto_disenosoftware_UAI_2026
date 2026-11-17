# Rediseño visual del frontend — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el frontend se vea como un cotizador profesional y moderno ("tech oscuro", naranja + amarillo, liquid glass en los controles) y priorice el mejor precio y la comparación de tiendas, sin cambiar lo que hace.

**Architecture:** CSS plano con variables de diseño: `src/styles/tokens.css` define todos los colores, radios, espacios, vidrio y fuentes para claro y oscuro; los demás archivos de `src/styles/` solo usan `var(--…)`. `app.css` pasa a ser el punto de entrada que importa los demás. Los cambios de distribución (barra lateral de filtros, panel de cotización fijo, tarjetas de tienda compactas) son componentes nuevos o reorganizados; la lógica nueva que se puede probar (barra de precio, conteo de filtros, rango y ahorro) va en `src/lib/` con `deno test`.

**Tech Stack:** React 19 + Vite + TypeScript, react-router 7, react-i18next, recharts 3, `@fontsource-variable/space-grotesk`, `@fontsource-variable/jetbrains-mono`, `lucide-react`, `deno test` para la lógica pura.

**Spec:** `docs/superpowers/specs/2026-11-17-rediseno-visual-design.md`

## Global Constraints

- Rama `feat/rediseno-visual` (ya creada desde `dev`, con el spec en `c66191c`). Commits con `git add` de archivos concretos, nunca `git add -A`. Mensajes en español con el prefijo de siempre (`feat(frontend): …`, `docs: …`).
- **Ningún color, radio, sombra o fuente escrito a mano fuera de `src/styles/tokens.css`**: siempre `var(--…)`. Excepción única: los colores por tienda del gráfico (Task 8), que recharts necesita como texto.
- Contraste mínimo 4.5:1 en texto normal, en claro y en oscuro.
- Nada de colores de acento para estados: en stock = `--ok`, sin stock/error = `--err`, sin datos = `--text-muted`.
- Todo texto visible nuevo va en `src/i18n/es.ts` **y** `src/i18n/en.ts` con las mismas claves (lo verifica `messages.test.ts`). Nada de símbolos de texto como íconos (☆ ★ ✕ ↗ ← → 📍): se usa `lucide-react` con `aria-hidden="true"` y el texto accesible al lado o en `aria-label`.
- Comportamiento intacto: mismos parámetros de URL del catálogo (`q`, `cat`, `store`, `max`, `stock`, `sort`, `page`) con los mismos valores; mismos datos de `data.ts`; sesión, guardados, reseñas, ubicación e idiomas iguales.
- `prefers-reduced-transparency: reduce` y falta de soporte de `backdrop-filter` → vidrio opaco. `prefers-reduced-motion: reduce` → sin transiciones ni animación de esqueletos.
- Foco visible en todo lo interactivo (anillo `--focus`); en celular, objetivos táctiles de al menos 44 × 44 px (botones, enlaces de la barra, controles de filtros, quitar de guardados).
- Puntos de quiebre: celular < 640 px, tablet 640–899 px, escritorio ≥ 900 px. Sin scroll horizontal de la página en 360 px (salvo dentro de la tabla de guardados).
- Nombres de archivo en minúscula.
- Pruebas: `cd frontend && deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/`. Verificación completa de cada task: además `npx tsc -b && npx oxlint && npx vite build`.
- Verificación visual (cada task con interfaz): `deno task dev` y revisar en 360, 768, 1024 y 1440 px, claro y oscuro (emulando `prefers-color-scheme`), español e inglés. Se puede hacer con el navegador de Playwright: `document.documentElement.scrollWidth <= window.innerWidth` debe ser `true` en 360 px.

## Review Focus

1. **Barra de navegación en 360 px con textos en inglés y sin sesión:** no debe desbordarse ni esconder el botón de Google. → verificación de `scrollWidth` en la Task 2.
2. **`?max=` raro en la URL** (`abc`, `-5`, `5000000`, vacío): el catálogo no se rompe; un número válido fuera del rango se respeta como filtro y la barra se muestra en el extremo; uno inválido se ignora. → pruebas de `sliderValue` y `parseMaxPrice` (Task 3).
3. **Producto con una sola oferta vigente, dos al mismo precio, o la más barata sin `url`:** no aparece "Ahorras hasta $0" ni un botón "Ir a la tienda" que no lleva a ningún lado. → pruebas de `priceSpread` (Task 5) y condición del botón (Task 6).
4. **Panel de filtros abierto en celular y luego la ventana se agranda a escritorio:** el `<dialog>` se cierra y queda la barra lateral, sin perder filtros. → paso en la Task 4.
5. **Vidrio sobre la luz ambiental en modo claro:** texto de la barra y del panel de filtros legible. → prueba de contraste de tokens (Task 1) contra `--glass-solid`, el color opaco equivalente.

---

### Task 1: Tokens, base visual y división de `app.css`

**Files:**
- Create: `frontend/src/styles/tokens.css`, `frontend/src/styles/base.css`
- Create (con las reglas actuales movidas desde `app.css`, por área): `frontend/src/styles/nav.css`, `catalog.css`, `product.css`, `store-card.css`, `reviews.css`, `saved.css`, `location.css`, `states.css`
- Modify: `frontend/src/app.css` (queda solo con `@import` en orden: tokens, base y luego las áreas)
- Modify: `frontend/src/main.tsx` (importar las dos fuentes)
- Modify: `frontend/package.json`, `frontend/deno.lock` (vía `cd frontend && deno add npm:@fontsource-variable/space-grotesk npm:@fontsource-variable/jetbrains-mono npm:lucide-react`)
- Test: `frontend/src/styles/tokens.test.ts`

**Interfaces:**
- Produces (variables CSS, definidas en `:root` para claro y en `@media (prefers-color-scheme: dark) { :root { … } }` para oscuro):
  - Color: `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`, `--accent`, `--on-accent`, `--accent-2`, `--ok`, `--err`, `--focus` (= acento).
  - Vidrio: `--glass-bg`, `--glass-border`, `--glass-highlight`, `--glass-solid` (color opaco equivalente para el modo sin transparencia), `--glass-blur` (`blur(18px) saturate(170%)`), `--glow-1`, `--glow-2`.
  - Forma: `--radius-sm` 8px, `--radius-md` 12px, `--radius-lg` 16px, `--radius-pill` 999px; `--space-1`…`--space-6` = 4, 8, 12, 16, 24, 32 px; `--shadow-1`.
  - Tipografía: `--font-ui` (`"Space Grotesk Variable", system-ui, sans-serif`), `--font-num` (`"JetBrains Mono Variable", ui-monospace, monospace`).
  - Movimiento: `--dur-fast` 150ms, `--dur` 250ms (0ms con `prefers-reduced-motion: reduce`).
- Produces (clases de `base.css`): `.glass` (fondo, borde, brillo superior y `backdrop-filter: var(--glass-blur)`; con `@supports not (backdrop-filter: blur(1px))` o `prefers-reduced-transparency: reduce` usa `background: var(--glass-solid)` sin filtro), `.mono` (fuente numérica + `tabular-nums`), `.sr-only` (movida desde el CSS actual), anillo de foco `:focus-visible` con `--focus`, y la luz ambiental como `background` fijo de `body` con dos degradados radiales `--glow-1` / `--glow-2`.
- Valores iniciales de color: los de la tabla "Valores de referencia" del spec (oscuro y claro). `--surface-2` claro: `#f3f5f8`. `--glass-solid`: oscuro `#15191e`, claro `#f8f9fb`.

- [ ] **Step 1: Escribir `tokens.test.ts`.** Lee `tokens.css` con `Deno.readTextFile(new URL("./tokens.css", import.meta.url))`, extrae las variables del bloque claro (`:root {…}` de nivel superior) y del oscuro (el `:root` dentro de `@media (prefers-color-scheme: dark)`), y calcula el contraste WCAG (luminancia relativa sRGB; solo colores `#rrggbb`). Casos, en ambos modos, todos `>= 4.5`:
  - `--text` sobre `--bg`, `--surface`, `--glass-solid`
  - `--text-muted` sobre `--bg`, `--surface`, `--surface-2`
  - `--accent` sobre `--bg` y `--surface`; `--on-accent` sobre `--accent`
  - `--accent-2`, `--ok` y `--err` sobre `--surface`
  - Además: `test("ningún color fuera de tokens.css")` recorre los demás `.css` de `src/styles/` y `src/app.css` y falla si alguno contiene `#[0-9a-fA-F]{3,8}\b`, `rgb(`, `rgba(` o `hsl(`.
- [ ] **Step 2:** `cd frontend && deno test --no-config --allow-read src/styles/` → FAIL (no existe `tokens.css`).
- [ ] **Step 3:** Dependencias (`deno add …`, ver Files) e imports de fuentes en `main.tsx` (`import "@fontsource-variable/space-grotesk"; import "@fontsource-variable/jetbrains-mono";`).
- [ ] **Step 4:** Escribir `tokens.css` y `base.css`. Mover cada regla de `app.css` al archivo de su área **sin cambiar selectores**, reemplazando cada color fijo (`#6d4aff`, `#c0392b`, `#1e8e3e`, `rgba(128,128,128,…)`, etc.) por la variable del rol equivalente. `app.css` queda solo con los `@import`.
- [ ] **Step 5:** `deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/` → PASS; ajustar valores de tokens si algún contraste falla (sin salir de la dirección: naranja/amarillo sobre casi negro).
- [ ] **Step 6:** `npx tsc -b && npx oxlint && npx vite build` → OK. Verificación visual: el sitio ya usa fondo oscuro con luz ambiental, Space Grotesk, acentos naranjas, y funciona igual que antes.
- [ ] **Step 7: Commit** — `git add` de los archivos listados → `feat(frontend): tokens de diseño, fuentes y estilos divididos por área`.

---

### Task 2: Barra de navegación de vidrio e íconos

**Files:**
- Create: `frontend/src/media.ts`
- Modify: `frontend/src/components/nav-bar.tsx`, `frontend/src/components/login-button.tsx`, `frontend/src/google.ts` (tipos), `frontend/src/styles/nav.css`
- Modify (reemplazo de símbolos por íconos): `frontend/src/components/save-button.tsx`, `stars.tsx`, `store-card.tsx`, `location-bar.tsx`, `reviews.tsx`, `frontend/src/pages/catalog.tsx` (paginación), `frontend/src/pages/saved-page.tsx` (botón quitar), `frontend/src/i18n/es.ts`, `frontend/src/i18n/en.ts`

**Interfaces:**
- Produces: `useMediaQuery(query: string): boolean` en `src/media.ts` (con `matchMedia` y su evento `change`; `false` en el primer render si no hay `window`). Constante `NARROW = "(max-width: 639px)"` exportada desde el mismo archivo. La usan las Tasks 4, 6 y 8.
- Produces: `LoginButton({ size?: "medium" | "large"; type?: "standard" | "icon" })`. Con `type: "icon"` dibuja el botón oficial de solo ícono (`shape: "circle"`); con `"standard"`, `shape: "pill"`. `GoogleButtonOptions` amplía `type` a `"standard" | "icon"` y `shape` a `"rectangular" | "pill" | "circle"`.
- Produces (i18n): claves sin símbolos: `saved.save` = "Guardar para comparar", `saved.savedState` = "Guardado", `store.goToStore` = "Ir a la tienda", `catalog.previous` = "Anterior", `catalog.next` = "Siguiente", `location.prompt` sin 📍, `reviews.summary_*` sin ★ (el ícono lo pone el componente). Equivalentes en `en`.

- [ ] **Step 1:** `useMediaQuery` y `NARROW` en `media.ts`.
- [ ] **Step 2:** `nav-bar.tsx`: píldora `.glass` fija arriba (`position: sticky; top: var(--space-2)`). Orden: marca (`<Link to="/" className="brand">` con un cuadro de degradado `--accent`→`--accent-2` y `common.appTitle` en `.brand-name`), `NavLink` Productos (ícono `LayoutGrid`) y Guardados (ícono `Bookmark`), cada uno con el texto en `<span className="nav-label">` y Guardados con `<span className="nav-count" aria-hidden="true">{ids.size}</span>`, `LanguageSwitch`, y la zona de usuario. Con `useMediaQuery(NARROW)`: `LoginButton type="icon"`; con sesión, se oculta `.nav-name` y "Salir" es un botón con ícono `LogOut` y `aria-label={t("nav.signOut")}`. En `nav.css`, bajo 640 px: `.brand-name` oculto, `.nav-label` con la técnica de `.sr-only`, `.nav-count` visible como globo; sobre 640 px `.nav-count` oculto. El `NavLink` activo: fondo de vidrio más opaco.
- [ ] **Step 3:** `login-button.tsx` y `google.ts` según Interfaces (el tema `filled_black`/`outline` se mantiene).
- [ ] **Step 4:** Reemplazar todos los símbolos por íconos de `lucide-react` (`Bookmark`/`BookmarkCheck` en guardar, `Star` con `fill` en estrellas, `ExternalLink` en ir a la tienda, `MapPin` en ubicación, `ChevronLeft`/`ChevronRight` en paginación, `X` en quitar de guardados) y las claves de i18n. Las estrellas conservan su `aria-label` y comportamiento.
- [ ] **Step 5:** `deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/` → PASS. `grep -nP '[☆★✕↗←→📍]' src/i18n/*.ts src/components/*.tsx src/pages/*.tsx` → sin resultados en texto visible (comentarios no cuentan).
- [ ] **Step 6:** `npx tsc -b && npx oxlint && npx vite build` → OK. **Review Focus 1:** en 360 px, con `en` y sin sesión, `scrollWidth <= innerWidth` y el botón de Google (ícono) visible; con sesión, el botón de salir visible. En 1440 px se ve la píldora completa con "Guardados (n)".
- [ ] **Step 7: Commit** → `feat(frontend): barra de navegación de vidrio e íconos lucide`.

### ⏸ Pausa: revisión del autor

Parar aquí. Mostrar al autor el sitio real (catálogo, producto y guardados con la base nueva y la barra) en escritorio y celular, claro y oscuro. Seguir con la Task 3 solo con su visto bueno; si pide ajustes de paleta o tipografía, se hacen en `tokens.css` antes de seguir.

---

### Task 3: Lógica de filtros del catálogo

**Files:**
- Create: `frontend/src/lib/filters.ts`
- Test: `frontend/src/lib/filters.test.ts`

**Interfaces:**
- Produces:
  - `PRICE_STEP = 10_000`
  - `sliderMax(bestPrices: (number | null)[]): number` — mayor precio no nulo redondeado hacia arriba al múltiplo de `PRICE_STEP`; `PRICE_STEP` si no hay ninguno.
  - `parseMaxPrice(param: string | null): number | null` — entero ≥ 0 o `null` (vacío, no numérico, negativo).
  - `sliderValue(max: number | null, limit: number): number` — `limit` si `max` es `null` o `>= limit`; si no, `max`.
  - `maxParamFromSlider(value: number, limit: number): string | null` — `null` (sin filtro) si `value >= limit`; si no, `String(value)`.
  - `activeFilterCount(f: { category: string; storeId: string; maxPrice: number | null; onlyInStock: boolean }): number` — cuenta `category !== "all"`, `storeId !== "all"`, `maxPrice != null`, `onlyInStock`.

- [ ] **Step 1: Escribir `filters.test.ts`** (`assertEquals` de `jsr:@std/assert@1`):
  - `sliderMax([189990, null, 649990])` → `650000`; `sliderMax([650000])` → `650000`; `sliderMax([])` y `sliderMax([null])` → `10000`.
  - `parseMaxPrice("300000")` → `300000`; `"abc"`, `"-5"`, `""`, `null` → `null`; `"5000000"` → `5000000`.
  - `sliderValue(null, 650000)` → `650000`; `sliderValue(5000000, 650000)` → `650000`; `sliderValue(300000, 650000)` → `300000`.
  - `maxParamFromSlider(650000, 650000)` → `null`; `maxParamFromSlider(300000, 650000)` → `"300000"`.
  - `activeFilterCount({ category: "all", storeId: "all", maxPrice: null, onlyInStock: false })` → `0`; con `"gpu"`, `"2"`, `300000`, `true` → `4`.
- [ ] **Step 2:** `deno test --no-config src/lib/filters.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar `filters.ts`.
- [ ] **Step 4:** `deno test --no-config src/lib/filters.test.ts` → PASS.
- [ ] **Step 5: Commit** → `feat(frontend): lógica de la barra de precio y conteo de filtros`.

---

### Task 4: Catálogo con barra lateral de filtros

**Files:**
- Create: `frontend/src/components/filters-panel.tsx`
- Modify: `frontend/src/pages/catalog.tsx`, `frontend/src/components/product-card.tsx`, `frontend/src/styles/catalog.css`, `frontend/src/i18n/es.ts`, `frontend/src/i18n/en.ts`

**Interfaces:**
- Consumes: `sliderMax`, `parseMaxPrice`, `sliderValue`, `maxParamFromSlider`, `activeFilterCount`, `PRICE_STEP` (Task 3); `useMediaQuery`, `NARROW` (Task 2).
- Produces: `FiltersPanel(props: { category: Category | "all"; counts: Record<string, number>; storeId: string; maxPrice: number | null; priceLimit: number; onlyInStock: boolean; hasFilters: boolean; onChange: (key: "cat" | "store" | "max" | "stock", value: string | null, replace?: boolean) => void; onClear: () => void })`. Solo dibuja los controles; no sabe si está en la barra lateral o en el `<dialog>`.
- Produces (i18n): `catalog.filters` ("Filtros"), `catalog.filtersCount` ("Filtros ({{count}})"), `catalog.availability` ("Disponibilidad"), `catalog.noLimit` ("Sin límite"), `common.close` ("Cerrar"), `card.inStock` ("En stock").

- [ ] **Step 1:** `FiltersPanel`: categoría como lista vertical de botones con `aria-pressed` y conteo; tienda con `<select>`; precio máximo con `<input type="range" min=0 max={priceLimit} step={PRICE_STEP}>` y el valor en `formatClp` (o `catalog.noLimit` en el extremo), escribiendo con `onChange("max", maxParamFromSlider(v, priceLimit), true)`; interruptor "Solo con stock" (checkbox con estilo de interruptor, `role="switch"`); "Limpiar filtros" si `hasFilters`.
- [ ] **Step 2:** `catalog.tsx`: `maxPrice` pasa a `parseMaxPrice(params.get("max"))` (el filtro usa ese número); `priceLimit = sliderMax(summaries de todos los grupos)` calculado con `useMemo`. Escritorio: grilla de dos columnas con `<aside className="filters-side glass">` (`position: sticky`) y la columna principal (buscador `.glass`, línea con conteo y orden, cuadrícula, paginación). Celular (`useMediaQuery(NARROW)`): buscador, botón "Filtros (n)" (`activeFilterCount`) que abre un `<dialog>` con `showModal()` que contiene `FiltersPanel` y un botón cerrar; clic en el fondo cierra; al cerrar el foco vuelve al botón. Las categorías dejan de ser `role="tab"`.
- [ ] **Step 3:** **Review Focus 4:** si el `<dialog>` está abierto y `useMediaQuery(NARROW)` pasa a `false`, se cierra (efecto sobre ese valor).
- [ ] **Step 4:** `product-card.tsx`: superficie sólida, imagen en marco `--surface-2`, categoría en `--accent-2`, nombre recortado a 2 líneas (`line-clamp`), precio `.mono` en `--accent`, línea inferior con `card.stores` y estado (punto + `card.inStock` en `--ok` o `card.outOfStock` en `--err`). Hover: borde `--accent` y resplandor.
- [ ] **Step 5:** `catalog.css`: 3 columnas de tarjetas en escritorio (4 desde ~1400 px), 2 en celular y tablet angosta. Transiciones con `--dur-fast`.
- [ ] **Step 6:** `deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/` → PASS; `npx tsc -b && npx oxlint && npx vite build` → OK. Verificación visual: filtros, búsqueda, orden y página siguen en la URL; `?max=abc` y `?max=5000000` no rompen nada; volver desde un producto conserva los filtros; teclado: el `<dialog>` atrapa el foco y Escape lo cierra; 360 px sin scroll horizontal.
- [ ] **Step 7: Commit** → `feat(frontend): catálogo con barra lateral de filtros y tarjetas nuevas`.

---

### Task 5: Rango de precios y ahorro

**Files:**
- Modify: `frontend/src/lib/offers.ts`
- Test: `frontend/src/lib/offers.test.ts`

**Interfaces:**
- Produces: `priceSpread(g: GroupWithOffers, now: Date): { min: number; max: number; savings: number } | null` — sobre las ofertas `isCurrent`; `null` si hay menos de 2 o si `max === min` (no se muestra "Ahorras hasta $0").

- [ ] **Step 1: Pruebas** (usando el helper `offer()` existente):
  - una sola oferta vigente → `null`
  - dos vigentes de 329990 y 359990 → `{ min: 329990, max: 359990, savings: 30000 }`
  - dos vigentes al mismo precio → `null`
  - una vigente y una agotada (`in_stock: false`) más cara → `null`
  - dos ofertas vigentes de la **misma tienda** (300000 y 320000) → `savings: 20000`
- [ ] **Step 2:** `deno test --no-config src/lib/offers.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `priceSpread`.
- [ ] **Step 4:** `deno test --no-config src/lib/offers.test.ts` → PASS.
- [ ] **Step 5: Commit** → `feat(frontend): rango de precios y ahorro de un producto`.

---

### Task 6: Subpágina de producto en dos columnas con panel de cotización

**Files:**
- Create: `frontend/src/components/quote-panel.tsx`
- Modify: `frontend/src/pages/product.tsx`, `frontend/src/styles/product.css`, `frontend/src/i18n/es.ts`, `frontend/src/i18n/en.ts`

**Interfaces:**
- Consumes: `priceSpread` (Task 5), `summarize`, `sortOffers` (existentes), `useMediaQuery`/`NARROW` (Task 2).
- Produces: `QuotePanel(props: { group: GroupWithOffers; now: Date; children: React.ReactNode })` — dibuja el bloque de mejor precio; `children` es la sección "Comparar tiendas" que `product.tsx` sigue armando (barra de ubicación, orden Precio/Distancia, lista de `StoreCard`) con la lógica que ya tiene.
- Produces (i18n): `product.bestToday` ("Mejor precio hoy"), `product.atStore` ("en {{store}}"), `product.savings` ("Ahorras hasta {{price}}"), `product.compare` ("Comparar tiendas"), `product.storesCount_one`/`_other` ("{{count}} tienda"/"{{count}} tiendas"), `product.breadcrumb` ("Ruta de navegación").

- [ ] **Step 1:** `QuotePanel`: `.glass` con el bloque: etiqueta `product.bestToday`, precio `.mono` grande en `--accent`, `product.atStore`, `product.savings` en `--ok` solo si `priceSpread` no es `null`; botón principal "Ir a la tienda" (`<a target="_blank" rel="noreferrer noopener">` con ícono `ExternalLink`) **solo si la oferta más barata (`summarize(...).bestStoreId` y su precio) tiene `url`** (Review Focus 3) y `SaveButton`. Sin precio vigente: `card.outOfStock` en lugar del precio, sin botón ni ahorro. Debajo, `children`. El título de la sección usa `product.compare` y `product.storesCount` con `storeCount` de `summarize`.
- [ ] **Step 2:** `product.tsx`: migas (`<nav aria-label={t("product.breadcrumb")}>` Productos › categoría, enlazando a `/?cat=…`); escritorio: columna izquierda (imagen, categoría, `h1`, `PriceChart`, `Reviews`) y derecha `QuotePanel` con `position: sticky`; el panel limita su alto a la ventana (`max-height: calc(100dvh - alto de la barra - margen)`) y solo la lista de tarjetas se desplaza dentro (`overflow-y: auto`), el bloque de mejor precio queda fijo arriba del panel. Celular: una columna (migas, imagen y nombre, panel sin `sticky`, gráfico, reseñas). Todo el comportamiento actual (pedir ubicación, sucursales, orden por distancia, errores) se conserva.
- [ ] **Step 3:** `deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/` → PASS; `npx tsc -b && npx oxlint && npx vite build` → OK. Verificación visual: producto con 1 y con 3 ofertas; producto sin precio vigente; con y sin ubicación (el control Distancia aparece igual que antes); en 1440 px el panel queda fijo al bajar hasta las reseñas.
- [ ] **Step 4: Commit** → `feat(frontend): subpágina de producto con panel de cotización fijo`.

---

### Task 7: Tarjetas de tienda compactas

**Files:**
- Modify: `frontend/src/components/store-card.tsx`, `frontend/src/pages/product.tsx` (pasa `best`), `frontend/src/styles/store-card.css`, `frontend/src/styles/location.css`, `frontend/src/i18n/es.ts`, `frontend/src/i18n/en.ts`

**Interfaces:**
- Produces: `StoreCard` agrega la prop `best: boolean` (true solo en la tarjeta cuya oferta es la de `summarize(...)`: mismo `store_id` que `bestStoreId` y mismo precio que `bestPrice`, la primera que cumpla en el orden mostrado).
- Produces (i18n): `store.best` ("Mejor"), `store.details` ("Dirección y horario"; reemplaza el uso de `store.viewHours`, que se elimina de ambos idiomas).

- [ ] **Step 1:** Fila superior: nombre + etiqueta `store.best` (fondo `--accent`, texto `--on-accent`) y precio `.mono` (en `--accent` si `best`). Fila de datos: estado de stock (con las clases de estado), distancia `formatKm`, abierta/cerrada (`statusText`, en `--ok` si abierta, `--text-muted` si cerrada) y enlace "Ir a la tienda". `<details>` con `store.details` que contiene la dirección (o `store.noAddress`) y la tabla de horario. Se conserva el atenuado de ofertas no vigentes.
- [ ] **Step 2:** `location.css`: la barra de ubicación con el estilo de vidrio compacto (`.glass`, `--radius-md`).
- [ ] **Step 3:** Pruebas + build como en la Task 6 → PASS/OK. Verificación visual: la etiqueta "Mejor" aparece en una sola tarjeta; el `<details>` se abre con teclado.
- [ ] **Step 4: Commit** → `feat(frontend): tarjetas de tienda compactas con detalle desplegable`.

---

### Task 8: Gráfico y reseñas con el nuevo estilo

**Files:**
- Modify: `frontend/src/components/price-chart.tsx`, `frontend/src/components/reviews.tsx`, `frontend/src/components/stars.tsx`, `frontend/src/styles/reviews.css`, `frontend/src/styles/product.css`

**Interfaces:**
- Consumes: `useMediaQuery` (Task 2) con `"(prefers-color-scheme: dark)"`.

- [ ] **Step 1:** `price-chart.tsx`: `STYLE` pasa a dos paletas por modo, elegidas con `useMediaQuery("(prefers-color-scheme: dark)")`. Oscuro: `winpy #60a5fa`, `pcexpress #c084fc`, `spdigital #34d399` con `dash: "6 3"`. Claro: `winpy #2563eb`, `pcexpress #7c3aed`, `spdigital #047857` con `dash: "6 3"`. (Ninguno naranja ni amarillo; se conserva la línea punteada de SP Digital.) Rejilla, ejes y tooltip leen colores con `getComputedStyle(document.documentElement).getPropertyValue("--border" | "--text-muted" | "--surface" | "--text")` dentro de un `useMemo` que depende del modo. El contenedor del gráfico: superficie sólida, `--radius-lg`.
- [ ] **Step 2:** Reseñas: estrellas `Star` en `--accent-2` (rellenas) y `--border` (vacías); resumen con promedio `.mono`; formulario y lista sobre superficie sólida; botones primario (`--accent`) y peligroso (`--err`) con los tokens.
- [ ] **Step 3:** Pruebas + build → PASS/OK. Verificación visual del gráfico en claro y oscuro (tres líneas distinguibles del acento) y del flujo de reseña (crear, editar, borrar).
- [ ] **Step 4: Commit** → `feat(frontend): gráfico y reseñas con el nuevo estilo`.

---

### Task 9: Guardados con el nuevo estilo

**Files:**
- Modify: `frontend/src/pages/saved-page.tsx`, `frontend/src/styles/saved.css`, `frontend/src/i18n/es.ts`, `frontend/src/i18n/en.ts`

**Interfaces:**
- Produces (i18n): `saved.cheapest` ("Más barato"), `saved.subtitle_one`/`_other` ("{{count}} producto para comparar"/"{{count}} productos para comparar").

- [ ] **Step 1:** Subtítulo con `saved.subtitle`. Tabla dentro de un contenedor de superficie sólida con `--radius-lg`; encabezados de fila en mayúsculas pequeñas y `--text-muted`; precios `.mono`. El "Mejor precio" que es `minPrice` va en `--accent` con la etiqueta `saved.cheapest` (en lugar de solo negrita; si hay empate, en todos los empatados). En cada columna, la celda de la fila de la tienda `bestStoreId` lleva la clase `cheapest` (texto `--accent`, peso 700).
- [ ] **Step 2:** `saved.css`: la primera columna (`tbody th`, `thead th:first-child`) con `position: sticky; left: 0` y fondo `--surface-2`, para que quede fija al deslizar en celular; el contenedor `.table-scroll` es el único con scroll horizontal.
- [ ] **Step 3:** Pruebas + build → PASS/OK. Verificación visual con 1 y con 4 productos guardados en 360 px (la página no se desliza; solo la tabla) y en 1440 px.
- [ ] **Step 4: Commit** → `feat(frontend): página de guardados con el nuevo estilo`.

---

### Task 10: Esqueletos de carga, estados vacíos y 404

**Files:**
- Create: `frontend/src/components/skeleton.tsx`, `frontend/src/pages/not-found.tsx`
- Modify: `frontend/src/pages/catalog.tsx`, `frontend/src/pages/product.tsx`, `frontend/src/pages/saved-page.tsx`, `frontend/src/app.tsx` (ruta `*`), `frontend/src/styles/states.css`, `frontend/src/i18n/es.ts`, `frontend/src/i18n/en.ts`

**Interfaces:**
- Produces: `CatalogSkeleton()`, `ProductSkeleton()`, `TableSkeleton()` en `skeleton.tsx`: bloques con la forma del contenido, contenedor con `aria-busy="true"` y un `.sr-only` con el texto de carga; `NotFound()` en `pages/not-found.tsx`.
- Produces (i18n): `common.loadingProducts` ("Cargando productos…"), `common.loadingProduct` ("Cargando producto…"), `common.loadingSaved` ("Cargando guardados…"), `common.backToProducts` ("Volver a Productos").

- [ ] **Step 1:** Esqueletos en los tres estados de carga que hoy muestran `common.loading` (la clave `common.loading` se mantiene si aún se usa en otro lugar; si no, se elimina de ambos idiomas). Animación de brillo con `--dur`, apagada con `prefers-reduced-motion`.
- [ ] **Step 2:** Estados vacíos (`catalog.empty`, `saved.empty`, `product.notFound`) y `NotFound` con el mismo bloque centrado: ícono (`SearchX`, `Bookmark`, `PackageX`), texto y botón `common.backToProducts` (`Link` a `/` con estilo de botón principal). Los errores (`common.error`) usan `--err`.
- [ ] **Step 3:** Pruebas + build → PASS/OK. Verificación visual: red lenta (throttling) en las tres páginas, una URL inexistente, un producto inexistente y guardados vacío.
- [ ] **Step 4: Commit** → `feat(frontend): esqueletos de carga, estados vacíos y 404`.

---

### Task 11: Documentación, autoría y grafo

**Files:**
- Modify: `README.md`, `docs/autoria.md`

- [ ] **Step 1: README** — "Estado actual": `[x] Rediseño visual (tech oscuro, naranja + amarillo, vidrio en los controles)`; en "Arquitectura/Estructura", que los estilos viven en `frontend/src/styles/` con `tokens.css` como fuente de colores y medidas; en "Pruebas", el comando del frontend pasa a `deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/`.
- [ ] **Step 2: `docs/autoria.md`** — nuevo "Prompt 21: Rediseño visual" con el formato de "Cómo seguir anotando": el pedido ("se ve muy básico, quiero que parezca un cotizador profesional y moderno", con superpowers y las skills instaladas), proceso (brainstorming con bocetos en el navegador vía túnel SSH, ui-ux-pro-max, diseño revisado por un subagente, plan, ejecución), decisiones del autor (dirección B, naranja + amarillo tras comparar con lima y rojo, liquid glass solo en controles, producto P2 con tarjetas, catálogo F2, guardados, enfoque A), supuestos del asistente (tipografía, íconos, esqueletos, barra de precio, colores del gráfico, barra en celular, una tarjeta por oferta), y los commits. En "Por hacer": marcar como hecho el pendiente de que `app.css` se importaba dos veces.
- [ ] **Step 3:** Pruebas + build completos → PASS/OK.
- [ ] **Step 4: Commit** → `docs: README y autoría del rediseño visual (Prompt 21)`.
- [ ] **Step 5:** Actualizar el grafo con `/graphify --update` (no se commitea `graphify-out/`).
