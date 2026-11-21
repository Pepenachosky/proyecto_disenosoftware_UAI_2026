# Guardados por categoría — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la página Guardados muestre una tabla de comparación por categoría (CPU, RAM, GPU), con "Más barato" calculado dentro de cada tabla.

**Architecture:** Una función pura nueva en `frontend/src/lib/compare.ts` agrupa los productos guardados por categoría en un orden fijo y otra decide el precio "más barato" de un conjunto. `saved-page.tsx` recorre esos grupos y dibuja la tabla actual una vez por grupo, con un `h2` como título.

**Tech Stack:** React 19, TypeScript, react-i18next; pruebas con `Deno.test` + `jsr:@std/assert@1`.

**Spec:** `docs/superpowers/specs/2026-11-21-guardados-por-categoria-design.md`

## Global Constraints

- Orden de las tablas: **CPU, RAM, GPU** (`["cpu", "ram", "gpu"]`). Una categoría sin guardados no se muestra.
- Dentro de cada tabla: productos por nombre con `localeCompare` y el locale activo (como hoy).
- "Más barato": solo si la tabla tiene **dos o más** productos con precio; marca todos los que empatan con el mínimo (como hoy).
- Títulos de sección con las claves existentes `catalog.categories.cpu|ram|gpu`; no se agregan claves nuevas. Se elimina `saved.category` de `es.ts` y `en.ts`.
- Se quita la fila "Categoría" de la tabla. El subtítulo sigue con el total de guardados.
- Colores solo desde tokens (`tokens.test.ts`); `es.ts` y `en.ts` con las mismas claves (`messages.test.ts`).
- Comentarios y textos del código en español.

## Review Focus

1. **Una categoría con un solo producto guardado:** esa tabla no muestra "Más barato", aunque otras tablas tengan varios. Prueba `cheapestOf` con un solo precio (Tarea 1).
2. **Productos agotados o sin precio en una tabla:** no cuentan para "Más barato"; si queda uno solo con precio, no hay etiqueta. Prueba `cheapestOf([null, 100])` (Tarea 1).
3. **Quitar con ✕ el último producto de una categoría:** esa sección desaparece y las demás siguen; al quitar todos, aparece el estado vacío. Prueba en el navegador (Tarea 2, paso 4).
4. **Empate en el precio más bajo:** se marcan todos los empatados. Prueba `cheapestOf([100, 100])` (Tarea 1).
5. **Pantalla de 360 px:** cada tabla se desliza de lado por su cuenta, sin desbordar la página. Prueba en el navegador (Tarea 2, paso 4).

---

### Task 1: Agrupar por categoría y "más barato" (`compare.ts`)

**Files:**
- Create: `frontend/src/lib/compare.ts`
- Test: `frontend/src/lib/compare.test.ts`

**Interfaces:**
- Consumes: `type Category` de `frontend/src/lib/offers.ts`.
- Produces:
  - `const CATEGORY_ORDER: readonly Category[] = ["cpu", "ram", "gpu"]`
  - `type CategorySection<T> = { category: Category; items: T[] }`
  - `groupByCategory<T extends { category: Category; name: string }>(items: T[], locale: string): CategorySection<T>[]`: secciones en `CATEGORY_ORDER`, sin las vacías, cada `items` ordenado por `name.localeCompare(otro, locale)`. No modifica el arreglo recibido.
  - `cheapestOf(prices: (number | null)[]): number | null`: el mínimo de los precios no nulos si hay dos o más; si no, `null`.

- [ ] **Step 1: Escribir las pruebas que fallan** en `compare.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@1";
import { CATEGORY_ORDER, cheapestOf, groupByCategory } from "./compare.ts";

const p = (name: string, category: "cpu" | "gpu" | "ram") => ({ name, category });

Deno.test("CATEGORY_ORDER es CPU, RAM, GPU", () => {
  assertEquals([...CATEGORY_ORDER], ["cpu", "ram", "gpu"]);
});

Deno.test("groupByCategory separa por categoría en orden CPU, RAM, GPU", () => {
  const out = groupByCategory(
    [p("RTX 4060", "gpu"), p("Ryzen 5", "cpu"), p("DDR5 32GB", "ram"), p("Core i5", "cpu")],
    "es",
  );
  assertEquals(out.map((s) => s.category), ["cpu", "ram", "gpu"]);
  assertEquals(out[0].items.map((x) => x.name), ["Core i5", "Ryzen 5"]);
  assertEquals(out[1].items.map((x) => x.name), ["DDR5 32GB"]);
  assertEquals(out[2].items.map((x) => x.name), ["RTX 4060"]);
});

Deno.test("groupByCategory omite las categorías vacías", () => {
  const out = groupByCategory([p("RTX 4060", "gpu"), p("Ryzen 5", "cpu")], "es");
  assertEquals(out.map((s) => s.category), ["cpu", "gpu"]);
  assertEquals(groupByCategory([], "es"), []);
});

Deno.test("groupByCategory no modifica el arreglo recibido", () => {
  const input = [p("B", "cpu"), p("A", "cpu")];
  groupByCategory(input, "es");
  assertEquals(input.map((x) => x.name), ["B", "A"]);
});

Deno.test("cheapestOf necesita dos o más precios", () => {
  assertEquals(cheapestOf([]), null);
  assertEquals(cheapestOf([100]), null);
  assertEquals(cheapestOf([null, 100]), null);
  assertEquals(cheapestOf([null, null]), null);
});

Deno.test("cheapestOf devuelve el mínimo, también con empates y nulos", () => {
  assertEquals(cheapestOf([300, 100, 200]), 100);
  assertEquals(cheapestOf([100, 100]), 100);
  assertEquals(cheapestOf([null, 250, 150]), 150);
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `cd frontend && deno test --no-config --allow-read src/lib/compare.test.ts`
Expected: FAIL (no se encuentra el módulo `./compare.ts`).

- [ ] **Step 3: Implementar `compare.ts`** con las firmas del bloque Interfaces. `cheapestOf` sustituye la regla que hoy está en línea en `saved-page.tsx` (`prices.length >= 2 ? Math.min(...prices) : null`).

- [ ] **Step 4: Verificar que pasan**

Run: `cd frontend && deno test --no-config --allow-read src/lib/`
Expected: todas PASS (también las pruebas existentes de `lib/`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/compare.ts frontend/src/lib/compare.test.ts
git commit -m "feat(frontend): agrupar guardados por categoría y precio más barato por grupo"
```

---

### Task 2: Una tabla por categoría en Guardados

**Files:**
- Modify: `frontend/src/pages/saved-page.tsx`
- Modify: `frontend/src/styles/saved.css`
- Modify: `frontend/src/i18n/es.ts`, `frontend/src/i18n/en.ts` (quitar `saved.category`)
- Modify: `README.md` (línea de "Estado actual" sobre guardados), `docs/autoria.md` (Prompt 24 y "Por hacer")

**Interfaces:**
- Consumes: `CATEGORY_ORDER`, `groupByCategory`, `cheapestOf` de `frontend/src/lib/compare.ts` (Tarea 1).

- [ ] **Step 1: Reescribir el render de `SavedPage`**
  - `columns` (ya filtrado por `ids`) pasa por `groupByCategory(columns, locale)` dentro del `useMemo`, en lugar del `.sort` actual.
  - Por cada sección: `<section aria-labelledby={"saved-" + category}>` con `<h2 id={"saved-" + category} className="saved-section-title">{t(\`catalog.categories.${category}\`)}</h2>` y debajo la tabla actual (`div.table-scroll.compare-wrap > table.compare`) con solo los productos de esa sección. Extraer la tabla a un componente local `CompareTable({ groups, now, minPrice… })` dentro del mismo archivo si deja el render más legible.
  - `summaries` y `minPrice` se calculan por sección; `minPrice = cheapestOf(summaries.map((s) => s.bestPrice))`.
  - Se elimina la fila "Categoría" y la constante `CATEGORY_NAMES` de este archivo.
  - Sin cambios: subtítulo (`saved.subtitle` con el total), estado vacío, botón ✕, filas por tienda, `storeCell`.

- [ ] **Step 2: Estilos y textos**
  - `saved.css`: `.saved-section-title` (tamaño de `h2` del proyecto, margen superior `var(--space-6)` salvo en la primera sección, margen inferior `var(--space-3)`), solo con tokens existentes.
  - Quitar `category` del bloque `saved` en `es.ts` y `en.ts`.

- [ ] **Step 3: Verificar pruebas, tipos y lint**

Run: `cd frontend && deno test --no-config --allow-read src/ && npm run build && npm run lint`
Expected: pruebas PASS (incluidas `messages.test.ts` y `tokens.test.ts`), build sin errores de tipos, lint sin avisos nuevos.

- [ ] **Step 4: Probar en el navegador** con productos de las tres categorías guardados (o simulando `fetchGroupsByIds` si no hay sesión):
  - Se ven tres secciones en orden CPU, RAM, GPU, cada una con su título traducido (es y en).
  - "Más barato" aparece solo en las tablas con dos o más productos con precio.
  - Quitar con ✕ el único producto de una categoría hace desaparecer su sección; quitar todos muestra el estado vacío.
  - A 360 px cada tabla se desliza de lado sin desbordar la página; modo claro y oscuro legibles.

- [ ] **Step 5: Documentación**
  - `README.md`, "Estado actual": la comparación de guardados es "una tabla por categoría (CPU, RAM, GPU)".
  - `docs/autoria.md`: sección **Prompt 24: Guardados con una tabla por categoría** con el formato del archivo (Prompt / Resultado obtenido / Decisiones propias: tablas apiladas, orden CPU, RAM, GPU, "Más barato" por tabla) y una línea marcada en "Por hacer". Los hashes de commit se completan al final.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/saved-page.tsx frontend/src/styles/saved.css frontend/src/i18n/es.ts frontend/src/i18n/en.ts README.md docs/autoria.md
git commit -m "feat(frontend): una tabla de comparación por categoría en Guardados"
```
