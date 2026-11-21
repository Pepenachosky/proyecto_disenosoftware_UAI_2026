# Orden del catálogo por valoración — Diseño

Fecha: 2026-11-20 · Tamaño: cambio pequeño

## Intención

Que el usuario vea primero los productos mejor valorados y después los peores
y los que no tienen valoración. Debe pesar la nota, pero sin que un producto
con una sola reseña de 5★ adelante a uno con muchas reseñas muy buenas.

- **Objetivo:** una opción "Mejor valorados" en el selector de orden del catálogo.
- **No objetivo:** filtrar por estrellas mínimas, cambiar la página de producto
  o el formulario de reseñas.
- **Anti-objetivo:** un orden que parezca arbitrario. Por eso la tarjeta muestra
  la media real y la cantidad de reseñas.

## Enfoques considerados

1. **Todo en el navegador (elegido).** `fetchCatalog()` también descarga
   `group_id, rating` de `product_reviews` (lectura pública por RLS) y una
   función pura calcula la puntuación. No necesita migración y sigue el patrón
   del catálogo, que ya filtra y ordena en el navegador. Coste: una fila por
   reseña, irrelevante con el volumen actual (`fetchAll` pagina de 1000 en 1000).
2. **Vista agregada en la base (migración 006).** Descarga menos datos, pero hay
   que hacer una migración con pruebas y ejecutarla a mano. Se descartó por ahora.
   Si las reseñas crecen mucho, migrar solo cambia `data.ts`.
3. **Función RPC que devuelve la puntuación.** No aporta nada sobre la 2 y
   complica ajustar la constante. Descartada.

Para el criterio de orden se consideraron solo la media (manipulable con una
reseña), solo la cantidad (mide popularidad, no calidad) y la **media
ponderada (bayesiana)**, que es la elegida.

## Fórmula (decidida)

```
puntuación = (C × m + suma de estrellas del producto) / (C + n)
```

- `n`: número de reseñas del producto.
- `m`: media de todas las reseñas de la tienda (calculada con los datos descargados).
- `C = 5`: peso de la media global, equivale a 5 reseñas "imaginarias" de nota `m`.
  Es una constante con nombre en el código para poder ajustarla.

Orden con `?sort=rating`:

1. Productos con reseñas, por puntuación descendente.
2. Empate en la puntuación: primero el que tiene más reseñas, luego por nombre.
3. Productos sin reseñas, siempre al final y ordenados por nombre (no se les
   asigna `m`).

## Cómo se construye

- **`frontend/src/lib/ratings.ts`** (nuevo, puro, con `ratings.test.ts`):
  - agrupa filas `{ group_id, rating }` en `{ count, sum }` por grupo;
  - calcula la media global `m`;
  - calcula la puntuación ponderada de un grupo;
  - ofrece un comparador para el orden descrito arriba.
- **`frontend/src/data.ts`:** una consulta nueva, `fetchRatings()`, pide
  `product_reviews(group_id, rating)` con `fetchAll` y tiene su propia caché
  (mismo patrón que `fetchCatalog`). El catálogo la pide junto a los grupos y
  ofertas; si falla, el catálogo se muestra igual, sin notas.
  `upsertReview` y `deleteReview` marcan las notas como desactualizadas: se
  olvida la promesa pero se conserva el valor en caché, así que al volver al
  catálogo se pinta al instante y se refresca con la nota nueva (no se vuelve
  a descargar el catálogo entero).
- **`frontend/src/pages/catalog.tsx`:** `Sort` gana `"rating"`, `isSort` lo
  acepta y la opción "Mejor valorados" / "Top rated" aparece en el selector.
- **`frontend/src/components/product-card.tsx`:** si el producto tiene
  reseñas, muestra "★ 4,8 (40)" (media real con un decimal según el idioma, y
  la cantidad), con etiqueta accesible. Sin reseñas, no muestra nada.
- **i18n (`es.ts`, `en.ts`):** claves nuevas para la opción de orden y la
  etiqueta accesible de la nota.
- **README:** sección que explica la fórmula, el valor de `C`, por qué se usa y
  dónde vive el código. También se actualizan "Estado actual" y la estructura
  (`lib/ratings.ts`).

## Decisiones tomadas por Claude (revisables)

- `C = 5`.
- La tarjeta no muestra "Sin reseñas" cuando no hay reseñas, para no recargarla.
- Desempate: cantidad de reseñas y después nombre.
- Invalidar la caché de notas al escribir o borrar una reseña.
- Si falla la descarga de reseñas, el catálogo se muestra sin notas en vez de un error.

## Lo que queda al implementador

Nombres exactos de funciones y claves i18n, y el estilo CSS de la nota en la
tarjeta, coherente con `stars.tsx` y los tokens del rediseño visual.
