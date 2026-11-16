# Ubicación solo con GPS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Reemplaza a `2026-11-16-comunas-fijas.md`.

**Goal:** Calcular distancias a las tiendas solo con permiso de ubicación, y eliminar todo lo relacionado con comunas.

**Architecture:** `LocationProvider` queda con cuatro estados (`inicial`, `buscando`, `gps`, `sin-ubicacion`) y sin `localStorage`. `LocationBar` muestra el estado y, sin ubicación, un botón para reintentar. `ProductPage` oculta el orden "Distancia" sin ubicación.

**Tech Stack:** React 19 + Vite + TypeScript, pruebas con `deno test`.

**Spec:** `docs/superpowers/specs/2026-11-16-ubicacion-solo-gps-design.md`

## Global Constraints

- Textos exactos: "📍 Usando tu ubicación", "📍 Buscando tu ubicación…", "📍 Activa tu ubicación para ver la distancia a cada tienda", botón "Usar mi ubicación", nota "Si la bloqueaste, permítela en la configuración del navegador."
- Nada se guarda en `localStorage`.
- El botón "Distancia" se oculta (no se deshabilita) sin ubicación.
- Respaldo de 10 s y aceptación tardía (`onLate`) se mantienen.
- Rama `feat/geolocalizacion`.

## Review Focus

1. Permiso aceptado después de los 10 s → pasa a `gps` y aparecen distancias (lo cubre `requestPosition: éxito después del timeout`; revisar que `location.tsx` siga pasando `onLate`).
2. Clic en "Usar mi ubicación" dos veces seguidas → solo cuenta la última petición (`seqRef`).
3. Permiso bloqueado en el navegador → el reintento falla rápido y vuelve a `sin-ubicacion` con la nota visible.
4. Con `sortBy === "distancia"` y luego sin ubicación → se ordena por precio (`effectiveSort`).
5. Tiendas sin coordenadas con ubicación activa → tarjeta sin distancia; "Distancia" se oculta si ninguna tienda tiene coordenadas.

---

### Task 1: Frontend solo con GPS

**Files:**
- Modify: `frontend/src/lib/user-location.ts` (dejar solo `GeoLike` y `requestPosition`)
- Modify: `frontend/src/lib/user-location.test.ts` (quitar pruebas de `parseSaved`, `readSaved`, `writeSaved`, `findComuna`)
- Modify: `frontend/src/location.tsx`, `frontend/src/components/location-bar.tsx`, `frontend/src/pages/product.tsx`

**Interfaces:**
- Produces: `type UserLocation = { estado: "inicial" } | { estado: "buscando" } | { estado: "gps"; point: LatLng } | { estado: "sin-ubicacion" }`; `useUserLocation(): { location: UserLocation; start(): void; requestGps(): void }`.

- [ ] **Step 1:** Quitar de `user-location.test.ts` las pruebas de funciones eliminadas; correr `cd frontend && deno test --no-config src/lib/` y confirmar que pasan (las de `requestPosition` siguen).
- [ ] **Step 2:** Recortar `user-location.ts`; correr las pruebas de nuevo → PASS.
- [ ] **Step 3:** `location.tsx`: `start()` llama a `requestGps()` una sola vez; `requestGps()` pasa a `buscando` y termina en `gps` o `sin-ubicacion`; sin `chooseComuna`, `previoRef` ni almacenamiento.
- [ ] **Step 4:** `location-bar.tsx`: `inicial` → nada; `buscando` y `gps` → una línea con su texto; `sin-ubicacion` → texto, botón "Usar mi ubicación" (llama a `requestGps`) y la nota.
- [ ] **Step 5:** `product.tsx`: `point` solo de `estado === "gps"`; el botón "Distancia" se renderiza solo si `point && distanceByStore.size > 0`.
- [ ] **Step 6:** Verificar: `cd frontend && deno test --no-config src/lib/ && npx tsc -b && npx oxlint && npx vite build` → todo OK; `grep -rn "comuna\|REGIONES\|localStorage" src/` → sin resultados de ubicación.
- [ ] **Step 7:** Probar en el navegador (Vite dev): con permiso aceptado se ven distancias y "Distancia"; con permiso negado se ve la barra con el botón y la nota, sin distancias ni "Distancia".
- [ ] **Step 8:** Commit `feat(frontend): distancias solo con permiso de ubicación, sin comunas`.

### Task 2: Eliminar el script de comunas y actualizar la documentación

**Files:**
- Delete: `scraper/comunas.ts`, `scraper/comunas_test.ts`
- Modify: `scraper/deno.json`, `.gitignore`, `README.md`, `docs/autoria.md`, `docs/superpowers/specs/2026-11-16-comunas-fijas-design.md`, `docs/superpowers/plans/2026-11-16-comunas-fijas.md`

- [ ] **Step 1:** Borrar script, prueba, tarea `comunas` y línea `scraper/.cache/`.
- [ ] **Step 2:** `cd scraper && deno task test` → PASS.
- [ ] **Step 3:** README: estado de la geolocalización (falta migración 004 y probar), quitar instrucciones de `deno task comunas` y `data/comunas.ts`, orden para fusionar (migración 004 → probar → fusionar), prueba en navegador sin comunas, árbol de archivos sin `comunas.ts`.
- [ ] **Step 4:** `docs/autoria.md`: pendientes de comunas marcados como reemplazados; nueva sección `## Prompt 19: Distancias solo con permiso de ubicación` (prompt, resultado con commits, decisiones propias); lista "Por hacer" actualizada.
- [ ] **Step 5:** Primera línea del diseño y plan de comunas fijas: `> **Reemplazado** por 2026-11-16-ubicacion-solo-gps (el autor eligió no usar comunas).`
- [ ] **Step 6:** `grep -rn "deno task comunas\|data/comunas\|scraper/.cache" --exclude-dir=node_modules --exclude-dir=graphify-out --exclude-dir=.superpowers .` → solo menciones históricas.
- [ ] **Step 7:** Commit `chore: eliminar script de comunas y documentar ubicación solo con GPS`.
