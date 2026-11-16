> **Reemplazado** por 2026-11-16-ubicacion-solo-gps (el autor eligió no usar comunas).

# Comunas fijas para la ubicación sin GPS — diseño corto

## Intención

Si el usuario no da permiso de ubicación, elige región y comuna de una lista y la distancia a cada tienda se mide desde el centro de esa comuna. Ese flujo ya está en código (`location.tsx`, `location-bar.tsx`), pero depende de `frontend/src/data/comunas.ts`, que iba a generar `scraper/comunas.ts` consultando Overpass. Overpass está saturado (502/504) y el archivo nunca se generó, así que hoy el frontend no compila.

## Objetivo

- Reemplazar el script por un archivo fijo construido desde el JSON de regiones y comunas que entregó el autor (16 regiones, 346 comunas).
- Cada comuna lleva latitud y longitud de su centro, obtenidas **una sola vez** desde una fuente pública.

## Fuera de alcance

- Cambiar el flujo de GPS, la barra de ubicación o el cálculo de distancia (ya funcionan).
- Mantener cualquier script de generación en el repositorio.

## Enfoques considerados

- **A (elegido por el autor):** buscar una vez el centro de cada comuna en una fuente pública (Nominatim/OpenStreetMap) y dejarlo fijo en el archivo junto a los nombres del JSON. Coordenadas con fuente, sin script en el repositorio.
- B: coordenadas escritas de memoria. Descartado por riesgo de errores sin fuente.
- C: solo el centro de cada región. Descartado: distancias muy imprecisas.

## Diseño

- `frontend/src/data/comunas.ts` exporta `REGIONES: Region[]` con la misma forma que esperaba el código (`{ name, comunas: { name, lat, lng }[] }`), así `location.tsx` y `location-bar.tsx` no cambian.
- Nombres de regiones y comunas **tal como vienen en el JSON**, en el mismo orden (decisión mía: respetar el JSON entregado).
- Coordenadas: un script desechable en el scratchpad (no se commitea) consulta Nominatim una comuna a la vez (1 por segundo, User-Agent genérico sin datos personales), pidiendo el límite administrativo de la comuna dentro de su región. Casos especiales: "Cabo de Hornos (Ex Navarino)" se busca como "Cabo de Hornos".
- Validación del resultado antes de escribir el archivo: 16 regiones, 346 comunas, todas con coordenadas, cada punto dentro de Chile (incluye Isla de Pascua, Juan Fernández y Antártica) y en la región correcta según Nominatim. Las dudosas se listan al autor.
- Prueba (`frontend/src/data/comunas.test.ts` o equivalente según cómo corren las pruebas del frontend): conteo 16/346, nombres únicos por región y coordenadas en rangos válidos.
- Eliminar `scraper/comunas.ts`, `scraper/comunas_test.ts`, la tarea `comunas` de `scraper/deno.json` y la línea `scraper/.cache/` de `.gitignore`.
- Actualizar README y `docs/autoria.md` (quitar `deno task comunas`, explicar el origen de las coordenadas, registrar este prompt).
- Preferencias guardadas en `localStorage` con nombres de región antiguos se ignoran solas (`parseSaved` valida contra `REGIONES`).

## Queda para quien implemente

- Ruta exacta de la prueba según el runner del frontend.
- Formato del archivo (una comuna por línea, coordenadas con 5 decimales).
