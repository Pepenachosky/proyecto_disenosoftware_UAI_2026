# Orden del catálogo por valoración — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir al catálogo el orden "Mejor valorados" (media ponderada bayesiana) y mostrar la media real y la cantidad de reseñas en cada tarjeta.

**Architecture:** Una función pura en `frontend/src/lib/ratings.ts` agrega las notas y ordena. `data.ts` descarga `group_id, rating` de `product_reviews` con su propia caché (`fetchRatings`), que se invalida al escribir o borrar una reseña. `catalog.tsx` la pide junto al catálogo y la pasa al orden y a `ProductCard`.

**Tech Stack:** React 19, TypeScript, react-router 7, react-i18next, Supabase JS, lucide-react; pruebas con `Deno.test` + `jsr:@std/assert@1`.

**Spec:** `docs/superpowers/specs/2026-11-20-orden-por-valoracion-design.md`

## Global Constraints

- Fórmula: `puntuación = (C × m + suma de estrellas) / (C + n)`, con `C = 5` (constante con nombre `PRIOR_WEIGHT`) y `m` = media de todas las reseñas descargadas.
- Valor en la URL: `?sort=rating`. Etiqueta: "Mejor valorados" (es) / "Top rated" (en).
- Orden: puntuación desc → cantidad de reseñas desc → nombre (`localeCompare` con el locale activo). Sin reseñas: siempre al final, por nombre.
- La tarjeta muestra la **media real** (un decimal, formato del idioma) y la cantidad, solo si `count > 0`; sin reseñas, nada.
- Solo se piden las columnas `group_id, rating` de `product_reviews` (nada de `user_id` ni comentarios).
- No hay migración nueva.
- Colores solo desde tokens (`tokens.test.ts` falla con colores fuera de `tokens.css`); textos en `es.ts` y `en.ts` con las mismas claves y placeholders (`messages.test.ts`).
- Comentarios y textos del código en español, como el resto del proyecto.

## Review Focus

1. **Falla la descarga de reseñas:** el catálogo debe seguir mostrándose (sin notas; con `?sort=rating` todo queda por nombre), no la pantalla de error. Lo cubre la Tarea 2, paso 3.
2. **No hay ninguna reseña en la base:** `globalMean` devuelve 0 sin `NaN` y el orden por valoración queda igual al orden por nombre. Lo cubre la Tarea 1 (`globalMean([])` y la prueba "sin reseñas ordena por nombre").
3. **Volver al catálogo después de reseñar:** la nota nueva se ve y cambia el orden sin recargar la página. Lo cubre la Tarea 2, pasos 2 y 5.
4. **Media con redondeo y formato por idioma:** 4,75 → "4,8" en es y "4.8" en en; 5 → "5,0". Lo cubre la Tarea 1 (pruebas de `formatRating`).
5. **`?sort=rating` combinado con filtros y paginación:** filtrar y luego ordenar, y volver a la página 1 al cambiar el orden (ya lo hace `setFilter`). Lo cubre la Tarea 2, paso 5 (prueba en el navegador).

---

### Task 1: Lógica pura de valoraciones (`ratings.ts`)

**Files:**
- Create: `frontend/src/lib/ratings.ts`
- Test: `frontend/src/lib/ratings.test.ts`

**Interfaces:**
- Produces:
  - `type RatingRow = { group_id: number; rating: number }`
  - `type RatingStats = { count: number; sum: number }`
  - `const PRIOR_WEIGHT = 5`
  - `aggregateRatings(rows: RatingRow[]): Map<number, RatingStats>`
  - `globalMean(stats: Iterable<RatingStats>): number`: suma total entre cantidad total; `0` si no hay reseñas.
  - `averageRating(s: RatingStats): number`: `sum / count`.
  - `weightedScore(s: RatingStats, mean: number, c = PRIOR_WEIGHT): number`
  - `compareByRating(a: Rated, b: Rated, mean: number, locale: string): number`, con `type Rated = { name: string; stats?: RatingStats }`. Negativo si `a` va antes.
  - `formatRating(value: number, locale: string): string`: un decimal fijo (`Intl.NumberFormat`, `minimumFractionDigits: 1`, `maximumFractionDigits: 1`).

- [ ] **Step 1: Escribir las pruebas que fallan** en `ratings.test.ts` (mismo estilo que `filters.test.ts`):

```ts
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  aggregateRatings, averageRating, compareByRating, formatRating,
  globalMean, PRIOR_WEIGHT, weightedScore, type Rated,
} from "./ratings.ts";

Deno.test("PRIOR_WEIGHT es 5", () => assertEquals(PRIOR_WEIGHT, 5));

Deno.test("aggregateRatings suma cantidad y estrellas por grupo", () => {
  const m = aggregateRatings([
    { group_id: 1, rating: 5 }, { group_id: 2, rating: 3 }, { group_id: 1, rating: 4 },
  ]);
  assertEquals(m.get(1), { count: 2, sum: 9 });
  assertEquals(m.get(2), { count: 1, sum: 3 });
  assertEquals(m.get(3), undefined);
});

Deno.test("globalMean es 0 sin reseñas y la media total con ellas", () => {
  assertEquals(globalMean([]), 0);
  assertEquals(globalMean([{ count: 1, sum: 5 }, { count: 3, sum: 7 }]), 3);
});

Deno.test("averageRating es la media real", () => {
  assertEquals(averageRating({ count: 40, sum: 192 }), 4.8);
});

Deno.test("weightedScore con los ejemplos del diseño (m = 4)", () => {
  assertAlmostEquals(weightedScore({ count: 1, sum: 5 }, 4), 25 / 6);
  assertAlmostEquals(weightedScore({ count: 40, sum: 192 }, 4), 212 / 45);
  assertAlmostEquals(weightedScore({ count: 30, sum: 63 }, 4), 83 / 35);
});

const sortNames = (items: Rated[], mean: number) =>
  [...items].sort((a, b) => compareByRating(a, b, mean, "es-CL")).map((i) => i.name);

Deno.test("muchas reseñas buenas ganan a una sola de 5; sin reseñas al final", () => {
  assertEquals(
    sortNames([
      { name: "A", stats: { count: 1, sum: 5 } },
      { name: "Sin", stats: undefined },
      { name: "C", stats: { count: 30, sum: 63 } },
      { name: "B", stats: { count: 40, sum: 192 } },
    ], 4),
    ["B", "A", "C", "Sin"],
  );
});

Deno.test("empate de puntuación: más reseñas primero, luego nombre", () => {
  assertEquals(
    sortNames([
      { name: "Uno", stats: { count: 1, sum: 4 } },
      { name: "Zeta", stats: { count: 2, sum: 8 } },
      { name: "Alfa", stats: { count: 2, sum: 8 } },
    ], 4),
    ["Alfa", "Zeta", "Uno"],
  );
});

Deno.test("sin reseñas ordena por nombre", () => {
  assertEquals(sortNames([{ name: "b" }, { name: "a" }, { name: "c" }], 0), ["a", "b", "c"]);
});

Deno.test("formatRating usa un decimal y el formato del idioma", () => {
  assertEquals(formatRating(4.75, "es-CL"), "4,8");
  assertEquals(formatRating(4.75, "en-US"), "4.8");
  assertEquals(formatRating(5, "es-CL"), "5,0");
});
```

- [ ] **Step 2: Ejecutar y ver que fallan**

Run: `cd frontend && deno test --no-config --allow-read src/lib/ratings.test.ts`
Expected: FAIL (no se encuentra el módulo `./ratings.ts`).

- [ ] **Step 3: Implementar `ratings.ts`** con las firmas del bloque Interfaces. Agregar un comentario de cabecera que explique la fórmula y por qué se usa (una reseña de 5★ no adelanta a muchas muy buenas). En `compareByRating`, los elementos sin `stats` o con `count === 0` cuentan como "sin reseñas".

- [ ] **Step 4: Ejecutar y ver que pasan**

Run: `cd frontend && deno test --no-config --allow-read src/lib/`
Expected: todas PASS (también las pruebas existentes de `lib/`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/ratings.ts frontend/src/lib/ratings.test.ts
git commit -m "feat(frontend): media ponderada de reseñas para ordenar el catálogo"
```

---

### Task 2: Descarga de notas y orden "Mejor valorados"

**Files:**
- Modify: `frontend/src/data.ts` (junto a `fetchCatalog`; `upsertReview` y `deleteReview`)
- Modify: `frontend/src/pages/catalog.tsx:20-26` (tipo `Sort`), el efecto de carga (`:67-76`), el `useMemo` `filtered` (`:87-110`) y el `<select>` (`:188-196`)
- Modify: `frontend/src/i18n/es.ts`, `frontend/src/i18n/en.ts` (sección `catalog`)

**Interfaces:**
- Consumes (Tarea 1): `RatingRow`, `RatingStats`, `aggregateRatings`, `globalMean`, `compareByRating`.
- Produces:
  - `fetchRatings(): Promise<Map<number, RatingStats>>` en `data.ts`.
  - `cachedRatings(): Map<number, RatingStats> | null` en `data.ts`.
  - En `catalog.tsx`, el estado `ratings: Map<number, RatingStats>`, que la Tarea 3 pasa a `ProductCard`.
  - Claves i18n `catalog.sortRating`: es `"Mejor valorados"`, en `"Top rated"`.

- [ ] **Step 1: Añadir `fetchRatings` y `cachedRatings` a `data.ts`.** Siguen el mismo patrón promesa + valor que `fetchCatalog`/`cachedCatalog`. `loadRatings` usa `fetchAll<RatingRow>` sobre `supabase.from("product_reviews").select("group_id, rating").order("id")` y devuelve `aggregateRatings(rows)`.

- [ ] **Step 2: Invalidar las notas al escribir.** Agregar `function invalidateRatings()` (privada): pone la promesa en `null` y **conserva** el valor, para que `cachedRatings()` siga pintando al instante. Se llama cuando `upsertReview` y `deleteReview` terminan sin error.

- [ ] **Step 3: Cargar las notas en `catalog.tsx`.** El estado inicial es `cachedRatings() ?? new Map()`. En el mismo `useEffect` de carga, pedir `fetchRatings()` aparte del catálogo. Si falla, se deja un `console.warn` y se sigue sin notas, **sin** llamar a `setError` (Review Focus 1). `loading` solo depende del catálogo, como hoy.

- [ ] **Step 4: Orden `"rating"`.** `type Sort = "name" | "price-asc" | "price-desc" | "rating"` y `isSort` lo acepta. En `filtered`, con `sort === "rating"`, ordenar con `compareByRating({ name, stats: ratings.get(group.id) }, …, mean, locale)`, donde `mean = globalMean(ratings.values())` se calcula con `useMemo` sobre `ratings`. Añadir `ratings` y `mean` a las dependencias. Añadir `<option value="rating">{t("catalog.sortRating")}</option>` después de las de precio, y las claves en `es.ts`/`en.ts` debajo de `sortPriceDesc`.

- [ ] **Step 5: Verificar**

Run: `cd frontend && deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/ && npx tsc -b && npx oxlint`
Expected: pruebas PASS, `tsc` sin errores, oxlint sin avisos nuevos.

En el navegador (`deno task dev`, skill `run`):
- elegir "Mejor valorados": la URL queda con `?sort=rating` y los productos con reseñas van primero;
- combinar con una categoría y pasar de página;
- entrar a un producto, dejar o editar una reseña, volver con "Volver a Productos" y comprobar que el orden cambia sin recargar.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data.ts frontend/src/pages/catalog.tsx frontend/src/i18n/es.ts frontend/src/i18n/en.ts
git commit -m "feat(frontend): ordenar el catálogo por mejor valorados"
```

---

### Task 3: Nota en la tarjeta y documentación

**Files:**
- Modify: `frontend/src/components/product-card.tsx`
- Modify: `frontend/src/pages/catalog.tsx:207` (pasar `rating`)
- Modify: `frontend/src/styles/catalog.css` (después de `.card-stock .dot`)
- Modify: `frontend/src/i18n/es.ts`, `frontend/src/i18n/en.ts` (sección `card`)
- Modify: `README.md` ("Estado actual", "Estructura" y una sección nueva "Orden por valoración" antes de "Puesta en marcha")

**Interfaces:**
- Consumes: `RatingStats`, `averageRating`, `formatRating` (Tarea 1); `ratings` de `catalog.tsx` (Tarea 2).
- Produces: `ProductCard({ group, now, rating }: { group: GroupWithOffers; now: Date; rating?: RatingStats })`.

- [ ] **Step 1: Claves i18n** en la sección `card`:
  - es: `rating_one: "{{value}} de 5 estrellas, {{count}} reseña"`, `rating_other: "{{value}} de 5 estrellas, {{count}} reseñas"`
  - en: `rating_one: "{{value}} out of 5 stars, {{count}} review"`, `rating_other: "{{value}} out of 5 stars, {{count}} reviews"`

- [ ] **Step 2: Mostrar la nota.** Si `rating && rating.count > 0`, `ProductCard` muestra, debajo del precio, `<span className="card-rating" role="img" aria-label={t("card.rating", { value, count })}>` con un `Star` de lucide (`size={14}`, `fill="currentColor"`, `aria-hidden`), la media `formatRating(averageRating(rating), locale)` y `(count)` en `mono`. En otro caso no muestra nada. `catalog.tsx` pasa `rating={ratings.get(group.id)}`.

- [ ] **Step 3: Estilo `.card-rating`:** `inline-flex`, `gap: var(--space-1)`, `font-size: 0.8rem`, texto en `var(--text-muted)` y estrella en `var(--accent-2)`, el mismo color que `.stars .star.on` en `reviews.css`. Solo tokens.

- [ ] **Step 4: README.**
  - "Estado actual": nuevo `- [x]` que diga que el catálogo se ordena por mejor valorados con media ponderada y que la tarjeta muestra la media y la cantidad de reseñas.
  - "Estructura": en la línea de `lib/`, añadir `ratings` (orden por valoración).
  - Nueva sección `## Orden por valoración` con la fórmula `(C × m + suma de estrellas) / (C + n)`, qué es cada símbolo, `C = 5` (`PRIOR_WEIGHT` en `frontend/src/lib/ratings.ts`, se puede ajustar), el ejemplo A/B/C del diseño (4,17 / 4,71 / 2,37 con m = 4), el desempate, que los productos sin reseñas van al final, que la tarjeta muestra la media real y no la puntuación, y que se calcula en el navegador sin migración (y que una vista en la base sería el siguiente paso si las reseñas crecen mucho).

- [ ] **Step 5: Verificar**

Run: `cd frontend && deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/ && npx tsc -b && npx oxlint && npx vite build`
Expected: todo PASS y la compilación termina sin errores.

En el navegador, en tema claro y oscuro y a 375 px de ancho:
- las tarjetas con reseñas muestran "★ 4,8 (40)";
- las tarjetas sin reseñas no muestran nada;
- en inglés se ve "4.8".

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/product-card.tsx frontend/src/pages/catalog.tsx frontend/src/styles/catalog.css frontend/src/i18n/es.ts frontend/src/i18n/en.ts README.md
git commit -m "feat(frontend): media y cantidad de reseñas en la tarjeta; README con la fórmula"
```
