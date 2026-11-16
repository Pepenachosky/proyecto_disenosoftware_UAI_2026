> **Reemplazado** por 2026-11-16-ubicacion-solo-gps (el autor eligió no usar comunas).

# Comunas fijas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el script de Overpass por un archivo fijo `frontend/src/data/comunas.ts` con las 346 comunas del JSON del autor y las coordenadas del centro de cada una.

**Architecture:** Un script desechable en el scratchpad consulta Nominatim una vez por comuna y escribe el archivo TS; el archivo queda en el repositorio y el script no. El resto del flujo de ubicación (`location.tsx`, `location-bar.tsx`, `lib/geo.ts`) no cambia.

**Tech Stack:** Deno (script y pruebas), React + Vite + TypeScript (frontend), Nominatim (OpenStreetMap).

**Spec:** `docs/superpowers/specs/2026-11-16-comunas-fijas-design.md`

## Global Constraints

- Nombres de regiones y comunas exactamente como en el JSON del autor, en el mismo orden (incluye "O’Higgins" con apóstrofo tipográfico y "Cabo de Hornos (Ex Navarino)").
- 16 regiones, 346 comunas.
- Forma exportada: `export type Comuna = { name: string; lat: number; lng: number }; export type Region = { name: string; comunas: Comuna[] }; export const REGIONES: Region[]`.
- Coordenadas con 5 decimales.
- Nominatim: máximo 1 consulta por segundo, User-Agent genérico (`comparador-hardware-chile/1.0 (proyecto universitario)`), sin datos personales.
- El script de consulta vive solo en el scratchpad; no se commitea.
- Trabajo en la rama `feat/geolocalizacion`.

## Review Focus

1. Comunas con el mismo nombre que su región o provincia (Los Lagos, Maule, Antofagasta, Coquimbo, Valparaíso, Atacama): Nominatim puede devolver la región (admin_level 4) en vez de la comuna (admin_level 8). Se espera el punto de la comuna → prueba `comunas homónimas de región apuntan a la comuna`.
2. Nombres del JSON que difieren de OSM (Calera → La Calera, Llaillay → Llay-Llay, Aisén → Aysén, Coihaique → Coyhaique, Paiguano → Paihuano, Cabo de Hornos (Ex Navarino) → Cabo de Hornos, O’Higgins → O'Higgins): se busca con el alias, se muestra el nombre del JSON → prueba `nombres del JSON se conservan`.
3. Un resultado de Nominatim que cae en otra comuna con el mismo nombre en otra región (San Pedro de la RM, San Pablo, Los Álamos) → el script exige que la región del resultado coincida; la prueba `sin coordenadas repetidas` detecta copias.
4. Comunas lejanas (Isla de Pascua, Juan Fernández, Antártica) deben aceptarse como válidas → rango de la prueba cubre longitud −110 a −53 y latitud −90 a −17.
5. Preferencia guardada en `localStorage` con un nombre de región que ya no existe → se ignora y se pide ubicación de nuevo (ya cubierto por `parseSaved` en `user-location.test.ts`; no requiere prueba nueva).

---

### Task 1: Archivo fijo de comunas con coordenadas

**Files:**
- Create: `frontend/src/data/comunas.ts` (generado)
- Create: `frontend/src/data/comunas.test.ts`
- Scratchpad (no se commitea): `<scratchpad>/comunas/entrada.json` (el JSON del autor), `<scratchpad>/comunas/geocodificar.ts`, `<scratchpad>/comunas/cache/` (respuestas de Nominatim por comuna)

**Interfaces:**
- Produces: `REGIONES: Region[]`, `Region`, `Comuna` desde `frontend/src/data/comunas.ts` (lo consumen `frontend/src/location.tsx` y `frontend/src/components/location-bar.tsx`, que ya importan `REGIONES` desde `./data/comunas` / `../data/comunas`).

- [ ] **Step 1: Escribir la prueba `frontend/src/data/comunas.test.ts`** (importa con `jsr:@std/assert@1` y `./comunas.ts`, como las pruebas de `lib/`)

  - `16 regiones y 346 comunas`: `REGIONES.length === 16`, suma de comunas `=== 346`.
  - `regiones en el orden del JSON`: `REGIONES.map(r => r.name)` igual a la lista de 16 nombres del JSON del autor, en orden (de "Arica y Parinacota" a "Región Metropolitana de Santiago").
  - `nombres del JSON se conservan`: existen "Calera" (Valparaíso), "Llaillay", "Aisén", "Coihaique", "Paiguano", "Cabo de Hornos (Ex Navarino)" y "O’Higgins" (con `’`).
  - `nombres únicos por región`.
  - `coordenadas válidas`: todas finitas, `-90 <= lat <= -17`, `-110 <= lng <= -53`, con a lo más 5 decimales.
  - `sin coordenadas repetidas`: ningún par `lat,lng` aparece dos veces.
  - `puntos conocidos` (tolerancia 0,15° en lat y lng): Arica (−18,48, −70,31), Santiago (−33,44, −70,65), Punta Arenas (−53,16, −70,91), Isla de Pascua (−27,15, −109,43).
  - `comunas homónimas de región apuntan a la comuna` (tolerancia 0,15°): Los Lagos (−39,86, −72,81), Antofagasta (−23,65, −70,40), Coquimbo (−29,95, −71,34), Valparaíso (−33,05, −71,62).

- [ ] **Step 2: Correr la prueba y verla fallar**

  Run: `cd frontend && deno test --no-config src/data/`
  Expected: FAIL, no encuentra el módulo `./comunas.ts`.

- [ ] **Step 3: Escribir `<scratchpad>/comunas/geocodificar.ts`**

  - Lee `entrada.json` (forma `{ regiones: { region: string; comunas: string[] }[] }`).
  - Para cada comuna, nombre de búsqueda = alias si existe (tabla de Review Focus 2), si no el nombre del JSON.
  - Consulta `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&countrycodes=cl&limit=10&q=<nombre>, <región sin "Región de/del">, Chile`, con 1,1 s entre consultas y caché en disco por comuna (si se corta, retoma).
  - Elige el primer resultado con `category === "boundary"`, `type === "administrative"` y `extratags.admin_level === "8"` (o `place_rank` 16 si falta); si ninguno, la comuna queda como **faltante**.
  - Comprueba que la región del resultado (`address.state` o `address.region`, sin tildes ni prefijo "Región de/del") contenga la palabra clave de la región del JSON; si no, la marca como **dudosa** pero conserva el punto.
  - Usa `lat`/`lon` del resultado (Nominatim entrega el admin_centre/label de la comuna) redondeados a 5 decimales.
  - Si hay faltantes, las imprime y termina sin escribir. Si no, escribe `frontend/src/data/comunas.ts` con un comentario de cabecera (origen: JSON del autor + Nominatim/OpenStreetMap, fecha 2026-11-16, © OpenStreetMap contributors, ODbL), los tipos de Global Constraints y una comuna por línea; luego imprime las dudosas.

- [ ] **Step 4: Ejecutar el script**

  Run: `deno run --allow-net=nominatim.openstreetmap.org --allow-read --allow-write <scratchpad>/comunas/geocodificar.ts`
  Expected: "16 regiones, 346 comunas", 0 faltantes. Si hay faltantes, agregar alias y repetir (la caché evita reconsultar las ya resueltas).

- [ ] **Step 5: Revisar dudosas con el autor**

  Mostrar al autor la lista de dudosas con su punto y la región que devolvió Nominatim. Corregir con alias o con el punto que el autor apruebe antes de seguir.

- [ ] **Step 6: Correr las pruebas y verlas pasar**

  Run: `cd frontend && deno test --no-config src/data/ src/lib/`
  Expected: todas PASS.

- [ ] **Step 7: Compilar el frontend**

  Run: `cd frontend && npm run build`
  Expected: termina sin errores (antes fallaba por falta de `data/comunas.ts`).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data/comunas.ts frontend/src/data/comunas.test.ts
git commit -m "feat(frontend): archivo fijo de comunas con coordenadas de Nominatim"
```

### Task 2: Eliminar el script de Overpass y actualizar la documentación

**Files:**
- Delete: `scraper/comunas.ts`, `scraper/comunas_test.ts`
- Modify: `scraper/deno.json` (quitar la tarea `comunas`), `.gitignore` (quitar `scraper/.cache/`)
- Modify: `README.md` (líneas 15, 25, 26, 54, 59-60, 143, 160 y la línea de pruebas 170), `docs/autoria.md` (sección Prompt 18 pendientes en 524, 545, 546; nueva sección Prompt 19)

**Interfaces:**
- Consumes: `frontend/src/data/comunas.ts` de Task 1.

- [ ] **Step 1: Borrar el script, su prueba, la tarea y la línea de `.gitignore`**

- [ ] **Step 2: Verificar que el scraper sigue probando bien**

  Run: `cd scraper && deno task test`
  Expected: PASS, sin referencias a `comunas.ts`.

- [ ] **Step 3: Verificar que no quedan referencias**

  Run: `grep -rn "deno task comunas\|scraper/comunas\|scraper/.cache\|Overpass" --exclude-dir=node_modules --exclude-dir=graphify-out --exclude-dir=superpowers .`
  Expected: solo menciones históricas en `docs/autoria.md` (Prompt 18), ninguna instrucción vigente.

- [ ] **Step 4: Actualizar README**

  - Estado (línea 15): falta solo la migración 004 y probar en el navegador.
  - Reemplazar las instrucciones de `deno task comunas` por: `frontend/src/data/comunas.ts` es un archivo fijo (nombres del JSON entregado por el autor, coordenadas de Nominatim/OpenStreetMap consultadas una vez el 2026-11-16); si cambian las comunas se edita a mano.
  - Orden antes de fusionar: (1) migración 004 en Supabase, (2) probar en el navegador (con y sin permiso de ubicación), (3) fusionar.
  - Árbol de archivos: `data/comunas.ts` deja de decir "generado"; `scraper/` deja de listar `comunas.ts`.
  - Pruebas: `(cd frontend && deno test --no-config src/lib/ src/data/)`.

- [ ] **Step 5: Actualizar `docs/autoria.md`**

  - En Prompt 18, marcar los pendientes de generar `comunas.ts` como reemplazados por Prompt 19 (no borrar la historia).
  - Agregar `## Prompt 19: Comunas fijas sin Overpass` con el formato del archivo: prompt condensado (Overpass saturado, usar JSON entregado, eliminar script, opción A de coordenadas), resultado (commits de esta rama), decisiones propias (nombres tal cual el JSON, coordenadas desde Nominatim una vez, dudosas revisadas).
  - Actualizar la lista de pendientes final: quitar "Generar comunas.ts", dejar migración 004 y prueba en navegador.

- [ ] **Step 6: Commit**

```bash
git add -A scraper/ .gitignore README.md docs/autoria.md
git commit -m "chore: eliminar script de Overpass y documentar comunas fijas"
```
