# Ubicación solo con GPS — diseño corto

Reemplaza a `2026-11-16-comunas-fijas-design.md`.

## Intención

Las distancias a las tiendas solo se calculan si el usuario da permiso de ubicación. Si lo rechaza, la función de distancia no se activa. Se elimina todo lo relacionado con comunas: la API de Overpass estaba saturada y el autor prefirió no mantener una lista de comunas.

## Comportamiento

- Al abrir un producto con tiendas se pide la ubicación (igual que hoy).
- **Acepta:** las tarjetas muestran la distancia y aparece el orden "Distancia". Barra: "📍 Usando tu ubicación" (sin "Cambiar").
- **Rechaza, falla o pasan 10 s:** sin distancias y sin el botón "Distancia" (oculto, no deshabilitado). Barra: "📍 Activa tu ubicación para ver la distancia a cada tienda · [Usar mi ubicación]", con la nota "Si la bloqueaste, permítela en la configuración del navegador."
- Si el usuario acepta el permiso después de los 10 s, se usa igual (se mantiene `onLate`).
- "Usar mi ubicación" vuelve a pedir la posición; mientras tanto la barra dice "📍 Buscando tu ubicación…".

## Decisiones (del asistente)

- No se guarda nada en `localStorage`: solo servía para recordar la comuna; el navegador recuerda el permiso.
- Estados: `inicial`, `buscando`, `gps` (con `point`), `sin-ubicacion`.

## Enfoques considerados

- **Solo GPS (elegido por el autor).** Simple; quien no da permiso no ve distancias.
- Terminar el archivo fijo de comunas con Nominatim (293/294 listas al detenerlo). Descartado por el autor.

## Se borra

- `scraper/comunas.ts`, `scraper/comunas_test.ts`, tarea `comunas` de `scraper/deno.json`, línea `scraper/.cache/` de `.gitignore`.
- En `frontend/src/lib/user-location.ts`: `RegionLike`, `SavedLocation`, `STORAGE_KEY`, `findComuna`, `parseSaved`, `readSaved`, `writeSaved` y sus pruebas. Queda `requestPosition` (y `GeoLike`).
- En `location.tsx`: estado `comuna`/`elegir`, `chooseComuna`, guardado y `previoRef`.
- En `location-bar.tsx`: selectores de región y comuna, "Cambiar" y "Cancelar".

## Se actualiza

- `frontend/src/pages/product.tsx`: el botón "Distancia" solo se muestra con ubicación.
- README y `docs/autoria.md` (Prompt 19); el diseño y plan de comunas fijas quedan marcados como reemplazados.
