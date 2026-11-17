# Multilenguaje propio (español e inglés) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La interfaz completa en español o inglés con i18next, con el idioma guardado en el navegador y en `profiles.language`.

**Architecture:** Las traducciones son dos objetos TypeScript escritos a mano (`es.ts`, `en.ts`) que i18next carga al iniciar, sin red. Un `LanguageProvider` (dentro de `AuthProvider`) es dueño del idioma activo: lo aplica a i18next, `localStorage`, `<html lang>` y, con sesión, a `profiles`. La lógica pura de `src/lib/` deja de producir texto en español: devuelve datos o recibe el locale de `Intl`, y los componentes arman el texto con `t()`.

**Tech Stack:** React 19 + Vite + TypeScript, i18next + react-i18next, `@supabase/supabase-js` 2, `deno test` para la lógica pura, Postgres 17 en podman para la migración.

**Spec:** `docs/superpowers/specs/2026-11-16-multilenguaje-design.md`

## Global Constraints

- Idiomas: `es` (por defecto) y `en`. Nada de servicios de traducción externos ni texto traducido automáticamente.
- Locale de `Intl`: `es-CL` para `es`, `en-US` para `en`. Precios siempre en CLP: `$89.990` / `CLP 89,990`.
- Zona horaria de abierta/cerrada: siempre `America/Santiago`.
- No se traducen nombres de productos, direcciones, comentarios de reseñas ni el nombre real del usuario.
- `localStorage` con clave `idioma`; todo acceso dentro de `try/catch` (puede fallar en modo privado).
- Mensajes de consola y errores internos (`throw new Error(...)` de desarrollo, `console.warn`) quedan en español: no son interfaz.
- Pruebas del frontend: `cd frontend && deno test --no-config src/lib/ src/i18n/`. Verificación completa: además `npx tsc -b && npx oxlint && npx vite build`.
- Trabajo en la rama `feat/multilenguaje` (desde `dev`); commits con `git add` de archivos concretos, nunca `git add -A`. Solo la Task 6 toca `README.md` y `docs/autoria.md`.

## Review Focus

1. **Placeholders distintos entre idiomas** (`{{hora}}` en `es`, `{{time}}` en `en`): el texto en inglés saldría con la variable sin reemplazar. → prueba de paridad de placeholders en Task 2.
2. **Cambiar de idioma mientras se lee el perfil al iniciar sesión:** la respuesta tardía del perfil no debe pisar la elección que el usuario acaba de hacer. → prueba de `onLogin` + regla en `LanguageProvider` (Task 5).
3. **`localStorage` bloqueado o con basura** (`"fr"`, `"EN"`, `""`): la página debe abrir en el idioma detectado, sin romperse. → pruebas de `initialLang` (Task 2).
4. **Perfil inexistente o error de red al guardar el idioma:** la página sigue en el idioma elegido localmente; solo un `console.warn`. → Task 5, paso de verificación manual.
5. **Reejecutar la 005 después de que los usuarios eligieron idioma** no debe borrar su elección. → `005_rerun_test.sql` (Task 1).

---

### Task 0: Rama de trabajo

- [ ] **Step 1:** `git switch dev && git switch -c feat/multilenguaje`. Expected: `git branch --show-current` → `feat/multilenguaje`.

---

### Task 1: Migración 005 (idioma del perfil) con pruebas locales

**Files:**
- Create: `supabase/migrations/005_idioma_perfil.sql`
- Create: `supabase/tests/005_prep.sql`, `supabase/tests/005_test.sql`, `supabase/tests/005_rerun_test.sql`
- Modify: `supabase/tests/run_002.sh` (agregar al final; actualizar el comentario de cabecera a "002 a 005")
- Create: `docs/migracion-005.md`

**Interfaces:**
- Produces: `public.profiles.language` sin default, `check (language in ('es','en'))` llamado `profiles_language_check`; `authenticated` puede `select` y `update (language)` solo de su fila (política `profiles_update_own_language`). Lo consume la Task 5.

- [ ] **Step 1: Escribir `005_prep.sql`** — reproduce el estado real de Supabase (spec, "Estado real de `profiles`") sobre el stub de la 002:
  - `alter table auth.users add column if not exists email text;`
  - `alter table public.profiles alter column language set default 'es';`
  - `grant all on public.profiles to anon, authenticated;`
  - `drop policy profiles_read_own` y crear `"perfil propio: leer"` (`for select`, sin `to` = `public`, `using (id = auth.uid())`) y `"perfil propio: editar"` (`for update`, `using (id = auth.uid())`).
  - Función `public.handle_new_user()` **idéntica** a la real (insert `(id, display_name)` con `coalesce(new.raw_user_meta_data ->> 'full_name', new.email)`, `security definer`, `set search_path to 'public'`) y trigger `on_auth_user_created after insert on auth.users for each row`.
  - Usuarios A `…00a1` y B `…00b2` insertados en `auth.users` (el trigger crea sus perfiles con `language = 'es'`).

- [ ] **Step 2: Escribir `005_test.sql`** (estilo de `004_test.sql`: bloques `do $$ … raise exception 'FALLO: …'`; roles con `begin; set local role …; set local request.jwt.claim.sub = '…'; … rollback;`). Casos:
  - `language` no tiene default (`information_schema.columns.column_default is null`).
  - A y B quedaron con `language is null` (el `'es'` del default se borró).
  - Un usuario nuevo insertado en `auth.users` obtiene perfil con `language is null`.
  - Como A: `update profiles set language = 'en' where id = A` → 1 fila y queda `en`.
  - Como A: `update … set language = 'en' where id = B` → 0 filas (`get diagnostics`), B sigue `null`.
  - Como A: `update … set display_name = 'x' where id = A` → `insufficient_privilege`.
  - Como A: `language = 'fr'` → `check_violation`.
  - Como `anon`: `update … set language = 'en'` → `insufficient_privilege`.
  - Como A: `insert into profiles` y `delete from profiles` → `insufficient_privilege`.
  - Al final, **fuera de transacción y como superusuario**: `update profiles set language = 'en' where id = A;` (lo usa el paso siguiente).

- [ ] **Step 3: Escribir `005_rerun_test.sql`**: A sigue con `'en'` después de reejecutar la 005; `language` sigue sin default.

- [ ] **Step 4: Agregar a `run_002.sh`** después de `004_test.sql`: `005_prep.sql` → `005` → `005` → `005_test.sql` → `005` → `005_rerun_test.sql` (las ejecuciones de la migración con `-c client_min_messages=warning`).

- [ ] **Step 5:** `bash supabase/tests/run_002.sh` → falla porque `005_idioma_perfil.sql` no existe.

- [ ] **Step 6: Escribir `005_idioma_perfil.sql`** (idempotente, comentado en español como la 004). Puntos fijados por el spec:
  - Dentro de un `do $$`: **solo si** `language` todavía tiene default → `update public.profiles set language = null;` y `alter column language drop default`. Así una segunda ejecución no borra elecciones reales (Review Focus 5).
  - `profiles_language_check` (`language in ('es','en')`), creada solo si no existe.
  - `revoke all on public.profiles from anon, authenticated; grant select on public.profiles to authenticated; grant update (language) on public.profiles to authenticated;`
  - `drop policy if exists "perfil propio: editar"`, `drop policy if exists profiles_update_own_language`, y `create policy profiles_update_own_language on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());`. `"perfil propio: leer"` no se toca.

- [ ] **Step 7:** `bash supabase/tests/run_002.sh` → termina sin `FALLO` y con código 0.

- [ ] **Step 8: Escribir `docs/migracion-005.md`** con el formato de `docs/migracion-004.md`: qué hace (los cuatro puntos del Step 6 en lenguaje simple, incluyendo que el idioma de los perfiles existentes queda vacío y que ya no se puede editar `display_name`), cómo ejecutarla (SQL Editor de Supabase, se puede repetir) y la consulta de verificación (la misma que usó el autor para ver columnas, permisos y políticas de `profiles`).

- [ ] **Step 9: Commit**
```bash
git add supabase/migrations/005_idioma_perfil.sql supabase/tests/005_prep.sql supabase/tests/005_test.sql supabase/tests/005_rerun_test.sql supabase/tests/run_002.sh docs/migracion-005.md
git commit -m "feat(db): migración 005, idioma editable solo en el perfil propio"
```

---

### Task 2: Base de i18n: idiomas, traducciones y prueba de paridad

**Files:**
- Modify: `frontend/package.json` (dependencias, vía `cd frontend && deno add npm:i18next npm:react-i18next`; anotar las versiones resultantes en el commit)
- Create: `frontend/src/lib/locale.ts`, `frontend/src/lib/locale.test.ts`
- Create: `frontend/src/i18n/es.ts`, `frontend/src/i18n/en.ts`, `frontend/src/i18n/messages.test.ts`, `frontend/src/i18n/index.ts`, `frontend/src/i18n/i18next.d.ts`
- Modify: `frontend/src/main.tsx` (importar `./i18n/index.ts` antes de `App`), `frontend/index.html` (`lang="es"`, `<title>Comparador de precios</title>`)

**Interfaces:**
- Produces (`src/lib/locale.ts`, sin dependencias):
  - `type Lang = "es" | "en"`; `const LANGS: readonly Lang[] = ["es", "en"]`; `const STORAGE_KEY = "idioma"`
  - `parseLang(v: unknown): Lang | null` — solo `"es"` o `"en"` exactos.
  - `detectLang(navLang: string | undefined): Lang` — `en` si empieza con `en` (sin distinguir mayúsculas), si no `es`.
  - `initialLang(stored: string | null, navLang: string | undefined): Lang` — `parseLang(stored) ?? detectLang(navLang)`.
  - `intlLocale(lang: Lang): "es-CL" | "en-US"`.
  - `onLogin(profileLang: unknown, current: Lang): { lang: Lang; saveToProfile: boolean }` — perfil válido → `{ lang: perfil, saveToProfile: false }`; si no → `{ lang: current, saveToProfile: true }`.
- Produces (`src/i18n/es.ts`): `export const es = { … }` y `export type Messages = typeof es`; `src/i18n/en.ts`: `export const en: Messages = { … }` (una clave faltante o sobrante es error de `tsc`).
- Produces (`src/i18n/index.ts`): `export default i18n` ya inicializado con `resources: { es: { translation: es }, en: { translation: en } }`, `lng: initialLang(leerStorage(), navigator.language)`, `fallbackLng: "es"`, `interpolation: { escapeValue: false }`, inicialización síncrona (`initAsync: false`; en versiones antiguas se llamaba `initImmediate`) para que el primer render ya tenga los textos.
- Produces (`src/i18n/i18next.d.ts`): `CustomTypeOptions` con `defaultNS: "translation"` y `resources: { translation: Messages }` → `t("clave.inexistente")` no compila.

- [ ] **Step 1: Escribir `locale.test.ts`**: `parseLang` (`"es"`, `"en"` → igual; `"EN"`, `"fr"`, `""`, `null`, `3` → `null`); `detectLang` (`"en-US"`, `"EN-gb"` → `en`; `"es-CL"`, `"fr"`, `undefined` → `es`); `initialLang` (`("en", "es-CL")` → `en`; `("fr", "en-US")` → `en`; `(null, "es-CL")` → `es`); `intlLocale`; `onLogin` (`("en","es")` → `{lang:"en",saveToProfile:false}`; `(null,"en")` → `{lang:"en",saveToProfile:true}`; `("fr","es")` → `{lang:"es",saveToProfile:true}`).
- [ ] **Step 2:** `cd frontend && deno test --no-config src/lib/locale.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3: Implementar `locale.ts`.**
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5: Escribir `messages.test.ts`** sobre `es` y `en` aplanados a `"a.b.c" → string`: mismas claves; ningún texto vacío; por cada clave, el mismo conjunto de placeholders `{{…}}` en ambos idiomas.
- [ ] **Step 6: Crear `es.ts` y `en.ts`** con solo el grupo `common` (`notFound: "Página no encontrada"` / `"Page not found"`) y `nav` (textos de `nav-bar.tsx`). Las Tasks 3 y 4 agregan sus grupos.
- [ ] **Step 7:** `deno test --no-config src/lib/ src/i18n/` → PASS.
- [ ] **Step 8:** dependencias, `index.ts`, `i18next.d.ts`, `main.tsx`, `index.html`; luego `npx tsc -b && npx oxlint && npx vite build` → OK.
- [ ] **Step 9: Commit**
```bash
git add frontend/package.json frontend/deno.lock frontend/src/lib/locale.ts frontend/src/lib/locale.test.ts frontend/src/i18n frontend/src/main.tsx frontend/index.html
git commit -m "feat(frontend): base de i18n con i18next y traducciones tipadas"
```

---

### Task 3: Idioma activo, selector y textos de catálogo, navegación y guardados

**Files:**
- Create: `frontend/src/language.tsx`, `frontend/src/components/language-switch.tsx`
- Modify: `frontend/src/app.tsx` (`LanguageProvider` dentro de `AuthProvider`, envolviendo `SavedProvider`; ruta `*` con `t("common.notFound")`)
- Modify: `frontend/src/lib/offers.ts` (+ `offers.test.ts`): reemplazar `export const clp` por `formatClp(value: number, locale: string): string`
- Modify: `frontend/src/auth.tsx` (`toAppUser`: sin nombre → `name: ""`), `frontend/src/components/nav-bar.tsx` (`user.name || t("nav.user")`; `<LanguageSwitch />` junto al usuario)
- Modify (textos con `t()` y formatos con el locale activo): `pages/catalog.tsx`, `components/product-card.tsx`, `components/product-image.tsx`, `components/save-button.tsx`, `pages/saved-page.tsx`, `saved.tsx`, `components/stars.tsx`
- Modify: `frontend/src/i18n/es.ts`, `en.ts` (grupos `nav`, `catalog`, `card`, `saved`, `stars`, `common`)
- Modify: `frontend/src/app.css` (estilo del selector, coherente con la barra en claro/oscuro y a 360 px)

**Interfaces:**
- Consumes: `Lang`, `STORAGE_KEY`, `intlLocale`, `parseLang` (Task 2); `i18n` de `src/i18n/index.ts`.
- Produces (`src/language.tsx`): `LanguageProvider({ children })` y `useLanguage(): { lang: Lang; locale: "es-CL" | "en-US"; setLang(l: Lang): void }`. En esta task `setLang` hace `i18n.changeLanguage(l)`, guarda en `localStorage` (con `try/catch`) y pone `document.documentElement.lang = l`; al montar también fija `<html lang>`. La Task 5 le agrega el perfil.
- Produces (`src/lib/offers.ts`): `formatClp(value: number, locale: string): string` (CLP, sin decimales).
- Produces: `LanguageSwitch()` — dos botones "ES" y "EN", `aria-pressed` en el activo, `aria-label` traducido ("Idioma"/"Language") en el grupo.

- [ ] **Step 1: Prueba en `offers.test.ts`**: `formatClp(89990, "es-CL")` → `"$89.990"`; `formatClp(89990, "en-US").replace(/\s/g, " ")` → `"CLP 89,990"`.
- [ ] **Step 2:** `deno test --no-config src/lib/offers.test.ts` → FAIL.
- [ ] **Step 3:** implementar `formatClp` y quitar `clp`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** `language.tsx`, `language-switch.tsx`, `app.tsx`, `auth.tsx`, `nav-bar.tsx`.
- [ ] **Step 6:** pasar a `t()` todo texto visible (JSX, `placeholder`, `aria-label`, `title`, `alt` genérico) de los archivos de esta task, y `formatClp(…, locale)` / `localeCompare(…, locale)` con `locale` de `useLanguage()`. Plurales con `_one`/`_other` y `count` (por ejemplo "1 tienda"/"3 tiendas" si existe). Los textos en inglés los redacta el implementador.
- [ ] **Step 7:** `deno test --no-config src/lib/ src/i18n/ && npx tsc -b && npx oxlint && npx vite build` → OK. `grep -nE '>[^<>{}]*[A-Za-záéíóúñ]{3,}[^<>{}]*<' ` sobre los archivos de esta task → sin texto visible fijo.
- [ ] **Step 8:** `deno task dev`: el catálogo, la tarjeta, guardados y la barra cambian al pulsar EN/ES sin recargar; al recargar se mantiene el idioma; `<html lang>` cambia.
- [ ] **Step 9: Commit**
```bash
git add frontend/src/language.tsx frontend/src/components/language-switch.tsx frontend/src/app.tsx frontend/src/auth.tsx frontend/src/lib/offers.ts frontend/src/lib/offers.test.ts frontend/src/components/nav-bar.tsx frontend/src/pages/catalog.tsx frontend/src/components/product-card.tsx frontend/src/components/product-image.tsx frontend/src/components/save-button.tsx frontend/src/pages/saved-page.tsx frontend/src/saved.tsx frontend/src/components/stars.tsx frontend/src/i18n/es.ts frontend/src/i18n/en.ts frontend/src/app.css
git commit -m "feat(frontend): selector de idioma y textos de catálogo y guardados"
```

---

### Task 4: Textos de la subpágina de producto (tiendas, horarios, ubicación, gráfico, reseñas, Google)

**Files:**
- Modify: `frontend/src/lib/hours.ts` (+ `hours.test.ts`), `frontend/src/lib/geo.ts` (+ `geo.test.ts`)
- Modify: `pages/product.tsx`, `components/store-card.tsx`, `components/location-bar.tsx`, `location.tsx` (solo si tiene texto visible), `components/price-chart.tsx`, `components/reviews.tsx`, `components/login-button.tsx`, `google.ts`
- Modify: `frontend/src/i18n/es.ts`, `en.ts` (grupos `product`, `store`, `hours`, `location`, `chart`, `reviews`)

**Interfaces:**
- Consumes: `useLanguage()` (Task 3), `formatClp` (Task 3).
- Produces (`src/lib/hours.ts`, sin texto en ningún idioma):
  - `type OpenStatus = { open: true; closes: string } | { open: false; opens: string; inDays: number; weekday: number } | null` — `inDays` 0 = hoy, 1 = mañana, ≥ 2 otro día; `weekday` 0 = domingo (día en que abre).
  - `weekSchedule(hours: HoursRow[]): { weekday: number; ranges: string[] }[]` — 7 filas de lunes (`weekday` 1) a domingo (`0`); `ranges` como `"10:00 – 19:00"`, ordenados; vacío = cerrado.
  - `statusText` se elimina; el texto lo arma `store-card.tsx` con `t("hours.open", { time })`, `t("hours.opensToday" | "hours.opensTomorrow", { time })`, `t("hours.opensOn", { day, time })`, `t("hours.unknown")`, y `t("hours.closed")` para un día sin tramos. El nombre del día sale de `Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" })` sobre una fecha UTC fija con ese día de la semana (por ejemplo 2026-11-15 + `weekday` días; 2026-11-15 es domingo).
- Produces (`src/lib/geo.ts`): `formatKm(km: number, locale: string): string`.
- `google.ts`: `GoogleButtonOptions.locale: "es" | "en"`; `LoginButton` pasa `lang` de `useLanguage()` y lo agrega a las dependencias del efecto (el botón se redibuja al cambiar el idioma).

- [ ] **Step 1: Actualizar `hours.test.ts`** a la nueva forma: los casos actuales con `inDays`/`weekday` en vez de `when` ("antes de abrir" → `inDays: 0, weekday: 4`; "justo a la hora de cierre" → `inDays: 1, weekday: 5`; "sábado tarde abre el lunes" → `inDays: 2, weekday: 1`; pausa de almuerzo → `inDays: 0, weekday: 4`); quitar las pruebas de `statusText`; `weekSchedule(H)[0]` → `{ weekday: 1, ranges: ["10:00 – 19:00"] }`, `[5]` → `{ weekday: 6, ranges: ["10:00 – 14:00"] }`, `[6]` → `{ weekday: 0, ranges: [] }`; los dos casos de tramos (segundos recortados y dos tramos ordenados) con `ranges`.
- [ ] **Step 2: Actualizar `geo.test.ts`**: los cuatro casos actuales con `"es-CL"`, y `formatKm(3.14, "en-US")` → `"3.1 km"`, `formatKm(456.7, "en-US")` → `"457 km"`.
- [ ] **Step 3:** `deno test --no-config src/lib/` → FAIL en `hours` y `geo`.
- [ ] **Step 4:** implementar los cambios en `hours.ts` y `geo.ts`.
- [ ] **Step 5:** → PASS.
- [ ] **Step 6:** pasar a `t()` todo texto visible de los archivos de esta task. Formatos con `locale`: `compactClp`, `shortDate`, `longDate` (crear los `Intl` con `useMemo` según `locale`), promedio de estrellas y fecha de reseña (`toLocaleDateString(locale)`). Autor de reseña: `r.author_name === "Usuario" ? t("reviews.anonymous") : r.author_name` (`"Usuario"` es el valor que pone el trigger de la 002). Los nombres de sucursal de la 004 no se muestran en la interfaz (`fetchBranches` no los lee), así que no hacen falta en la lista.
- [ ] **Step 7:** verificación completa (Global Constraints) → OK; el mismo `grep` de la Task 3 sobre los archivos de esta task → sin texto visible fijo.
- [ ] **Step 8:** `deno task dev`, subpágina de un producto en ES y EN: estado abierta/cerrada ("Closed · opens Monday 10:00"), "Ver horario" con días traducidos, distancias (`3.1 km`), gráfico (ejes y tooltip), reseñas y botón de Google en el idioma activo.
- [ ] **Step 9: Commit**
```bash
git add frontend/src/lib/hours.ts frontend/src/lib/hours.test.ts frontend/src/lib/geo.ts frontend/src/lib/geo.test.ts frontend/src/pages/product.tsx frontend/src/components/store-card.tsx frontend/src/components/location-bar.tsx frontend/src/location.tsx frontend/src/components/price-chart.tsx frontend/src/components/reviews.tsx frontend/src/components/login-button.tsx frontend/src/google.ts frontend/src/i18n/es.ts frontend/src/i18n/en.ts
git commit -m "feat(frontend): subpágina de producto, horarios, gráfico y reseñas traducidos"
```

---

### Task 5: Idioma guardado en el perfil

**Files:**
- Modify: `frontend/src/data.ts`, `frontend/src/language.tsx`

**Interfaces:**
- Consumes: `onLogin` (Task 2), `useAuth()` (`user: { id; name } | null`), la 005 (Task 1).
- Produces (`src/data.ts`): `fetchProfileLanguage(userId: string): Promise<unknown>` (`select language … eq("id", userId).maybeSingle()`; sin fila → `null`; error → lanza) y `saveProfileLanguage(userId: string, lang: Lang): Promise<void>` (`update({ language: lang }).eq("id", userId)`; error → lanza).

- [ ] **Step 1: `LanguageProvider`** — cuando `user?.id` pasa a un id nuevo: `fetchProfileLanguage` → `onLogin(valor, langActual)` → aplicar `lang` (igual que `setLang` pero sin escribir el perfil) y, si `saveToProfile`, `saveProfileLanguage`. Regla de carrera (Review Focus 2): un contador/ref que `setLang` incrementa; si cambió mientras se leía el perfil, se ignora la respuesta y se guarda en el perfil el idioma elegido. `setLang` con sesión también llama `saveProfileLanguage`. Cualquier error → `console.warn` y la página sigue con el idioma local. Al cerrar sesión no cambia el idioma.
- [ ] **Step 2:** verificación completa (Global Constraints) → OK.
- [ ] **Step 3: Prueba manual** (con la 005 ejecutada en Supabase): (a) en EN sin sesión, iniciar sesión con un perfil en `null` → sigue en EN y la fila queda `en`; (b) cambiar a ES con sesión → la fila queda `es`; (c) borrar `localStorage`, poner el navegador en inglés, iniciar sesión → cambia a ES (el perfil manda); (d) con la red cortada en DevTools, cambiar de idioma → cambia igual y aparece un `console.warn`.
- [ ] **Step 4: Commit**
```bash
git add frontend/src/data.ts frontend/src/language.tsx
git commit -m "feat(frontend): el idioma se guarda en el perfil y lo sigue al iniciar sesión"
```

---

### Task 6: Documentación y autoría

**Files:**
- Modify: `README.md`, `docs/autoria.md`

- [ ] **Step 1: README** — "Estado actual": `[x] Multilenguaje propio (español e inglés, i18next; idioma en el navegador y en el perfil)`; pasos manuales: ejecutar también la 005 (`docs/migracion-005.md`); "Pruebas": `run_002.sh` cubre 002 a 005 y el comando del frontend es `deno test --no-config src/lib/ src/i18n/`; mencionar dónde viven las traducciones (`frontend/src/i18n/`) y que agregar un idioma es crear otro archivo con el tipo `Messages` y sumarlo a `LANGS`.
- [ ] **Step 2: `docs/autoria.md`** — nuevo "Prompt 20: Multilenguaje propio" con el formato de la sección "Cómo seguir anotando" (prompt, resultado con los commits, decisiones del autor: idioma en el perfil y i18next; supuestos del asistente: formatos, selector, lista de valores fijos, permisos de la 005; pendiente de verificar: ejecutar la 005 en Supabase y la prueba manual de la Task 5). En "Por hacer": marcar `Multilenguaje propio` y agregar `[ ] Ejecutar la migración 005 en Supabase`.
- [ ] **Step 3: Commit**
```bash
git add README.md docs/autoria.md
git commit -m "docs: multilenguaje en README y autoría (Prompt 20)"
```
