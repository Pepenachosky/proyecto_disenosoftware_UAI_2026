# Guardados: una tabla de comparación por categoría — Diseño

Fecha: 2026-11-21 · Tamaño: cambio pequeño

## Intención

La página **Guardados** (`frontend/src/pages/saved-page.tsx`) pone todos los
productos guardados en una sola tabla. Así se compara una CPU con una RAM, lo que
no tiene sentido. Además, la etiqueta **"Más barato"** se calcula sobre todas las
columnas, de modo que una RAM barata queda como "más barata" frente a una GPU.

- **Objetivo:** una tabla de comparación por categoría, en el orden CPU, RAM, GPU
  (el orden que pidió el autor).
- **No objetivo:** cambiar cómo se guardan los productos, la consulta a Supabase
  o las filas por tienda de la tabla.
- **Anti-objetivo:** que "Más barato" vuelva a comparar productos de categorías
  distintas.

## Enfoques considerados

1. **Tablas apiladas, una por categoría (elegido).** Se ve todo de un vistazo y
   cada tabla compara solo productos comparables.
2. **Pestañas por categoría.** Obligan a hacer clic para ver lo demás y, con pocos
   guardados, la página se ve vacía. Descartado.
3. **Filtro de categoría sobre la tabla única.** Si el filtro queda en "todas",
   el problema sigue. Descartado.

## Diseño (aprobado por el autor)

- Una sección por categoría, con su título, en el orden **CPU, RAM, GPU**.
  Dentro de cada tabla los productos siguen ordenados por nombre.
- **"Más barato" se calcula por tabla**, y solo si esa tabla tiene dos o más
  productos con precio (misma regla que hoy, aplicada por categoría).
- Una categoría sin productos guardados **no se muestra**.
- Se quita la fila "Categoría": ya la dice el título de la sección.
- El subtítulo sigue mostrando el total de guardados; la ✕ para quitar un
  producto funciona igual.

## Cómo se construye

- **Lógica pura en `frontend/src/lib/`** (con prueba): agrupa los productos
  guardados por categoría en el orden CPU, RAM, GPU, omite las categorías vacías y
  ordena por nombre dentro de cada una. *(Decisión del asistente, siguiendo el
  patrón del proyecto de lógica pura con pruebas.)*
- **`saved-page.tsx`:** renderiza una tabla por grupo, reutilizando la tabla
  actual; `minPrice` se calcula por grupo.
- **Títulos:** se reutilizan las traducciones existentes
  `catalog.categories.*` ("Procesadores (CPU)", "Memorias RAM", "Tarjetas de video
  (GPU)"), así que no hacen falta claves nuevas para los títulos. *(Decisión del
  asistente.)* La clave `saved.category`, que queda sin uso, se elimina de `es.ts`
  y `en.ts`.

## Lo que queda al criterio de quien implemente

- El nivel de encabezado de cada sección (`h2`) y el espaciado entre tablas, con
  los tokens de diseño existentes.
- El nombre exacto de la función pura y su archivo.
