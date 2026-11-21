# Marca Rigly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renombrar la plataforma a Rigly y usar los logos, favicon y placeholder nuevos de `frontend/public/`.

**Architecture:** Textos en `i18n/es.ts`/`en.ts`; logo como `<img>` en `nav-bar.tsx` elegido con `useMediaQuery(BELOW_DESKTOP)`; assets corregidos en `public/` (favicon renombrado, placeholder comprimido).

**Tech Stack:** React 19 + Vite, i18next, pruebas con `deno test`, ImageMagick (`magick`) para comprimir.

**Spec:** `docs/superpowers/specs/2026-11-21-marca-rigly-design.md`

## Global Constraints

- `common.appTitle` = `"Rigly"` en ES y EN.
- `catalog.title` = `"Encuentra el mejor precio en hardware"` (ES) / `"Find the best price on hardware"` (EN).
- `placeholder.png` < 100 KB, 800 px de ancho, mismo nombre de archivo.
- Favicon servido como `/favicon.png`, `type="image/png"`.
- Pruebas: `(cd frontend && deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/)`.

## Review Focus

- Logo en modo oscuro: el PNG es transparente; verificar que se ve sobre `--glass-bg` oscuro.
- Barra compacta (<640px): el logo vertical no debe empujar los iconos ni desbordar la píldora.
- El enlace de marca sigue teniendo nombre accesible (`alt` del logo = `appTitle`).
- `document.title` cambia a "Rigly" también al cambiar de idioma (`language.tsx` usa `appTitle`).
- El placeholder comprimido sigue sirviendo como fallback en `product-image.tsx` (mismo path).

---

### Task 1: Textos de marca

**Files:**
- Modify: `frontend/src/i18n/es.ts`, `frontend/src/i18n/en.ts`
- Test: `frontend/src/i18n/messages.test.ts`

- [ ] **Step 1:** Añadir test `"la marca es Rigly"`: `assertEquals(es.common.appTitle, "Rigly")`, `assertEquals(en.common.appTitle, "Rigly")`, `assertEquals(es.catalog.title, "Encuentra el mejor precio en hardware")`, `assertEquals(en.catalog.title, "Find the best price on hardware")`.
- [ ] **Step 2:** Correr pruebas → FAIL.
- [ ] **Step 3:** Cambiar los cuatro textos.
- [ ] **Step 4:** Correr pruebas → PASS.
- [ ] **Step 5:** Commit `feat(frontend): renombrar la plataforma a Rigly`.

### Task 2: Logo en la barra, favicon y placeholder

**Files:**
- Modify: `frontend/src/components/nav-bar.tsx`, `frontend/src/styles/nav.css`, `frontend/index.html`
- Rename: `frontend/public/favicon.svg` → `frontend/public/favicon.png`
- Modify (binario): `frontend/public/placeholder.png`
- Add: `frontend/public/logohorizontal.png`, `frontend/public/logovertical.png`
- Test: `frontend/src/styles/brand.test.ts`

- [ ] **Step 1:** Crear `brand.test.ts` (rutas relativas a `import.meta.url`) con:
  - `index.html` contiene `href="/favicon.png"` y `type="image/png"`, y no contiene `favicon.svg`.
  - `public/favicon.png` empieza con la firma PNG `89 50 4E 47`.
  - `public/placeholder.png` pesa < 100 000 bytes.
  - `nav.css` contiene `.brand-logo` y no contiene `.brand-mark`.
- [ ] **Step 2:** Correr pruebas → FAIL.
- [ ] **Step 3:** `git mv public/favicon.svg public/favicon.png`; actualizar `index.html`.
- [ ] **Step 4:** `magick public/placeholder.png -resize 800x -strip -quality 80 jpg:public/placeholder.png` (se mantiene JPEG con nombre `.png`, igual que el original; el navegador lo detecta por contenido).
- [ ] **Step 5:** En `nav-bar.tsx`, reemplazar `.brand-mark` + `.brand-name` por `<img className="brand-logo" src={compact ? "/logovertical.png" : "/logohorizontal.png"} alt={t("common.appTitle")} />`. En `nav.css` borrar `.brand-mark` y `.brand-name` (incluida la regla en el `@media`) y añadir `.brand-logo { display:block; height: 32px; width:auto; }` y en `width < 900px` `height: 40px`.
- [ ] **Step 6:** Correr pruebas → PASS; `npm run build` y `npm run lint` sin errores.
- [ ] **Step 7:** Verificar visualmente (claro/oscuro, 1280 px y 375 px) con Playwright sobre `npm run dev`.
- [ ] **Step 8:** Commit `feat(frontend): logos, favicon y placeholder de Rigly`.

### Task 3: README

- [ ] **Step 1:** Título `# Rigly` y primera frase "Rigly es una plataforma web que compara precios…"; añadir `brand.test.ts` en la descripción del comando de pruebas si hace falta (la carpeta `src/styles/` ya está incluida).
- [ ] **Step 2:** Commit `docs: README con la marca Rigly` (junto con spec y plan).
