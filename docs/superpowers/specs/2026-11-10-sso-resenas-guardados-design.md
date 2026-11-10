# Diseño: SSO con Google, subpágina de producto, reseñas, guardados y comparación

Fecha: 2026-11-10 · Estado: borrador para aprobación

## Intención

Hoy el frontend es una tabla con una fila por producto **de cada tienda** (417 filas, 3 tiendas). Se busca que funcione como un comparador real:

- ver cada producto una sola vez, con todas las tiendas que lo venden y sus precios;
- ver cómo cambió su precio en el tiempo;
- dejar reseñas con estrellas (requiere iniciar sesión con Google);
- guardar productos y compararlos lado a lado (también con sesión iniciada).

Es un proyecto universitario (3er año, Informática). El autor registra cada prompt en `docs/autoria.md` y prefiere soluciones simples y explicables a soluciones sofisticadas.

## Objetivos

1. **Inicio de sesión con Google** mediante Supabase Auth (proveedor Google, OAuth). Se usa para reseñas y guardados.
2. **Menú superior fijo** con: *Productos*, *Guardados* y, a la derecha, "Iniciar sesión con Google". Con la sesión iniciada se muestran el nombre de la cuenta y el botón "Salir".
3. **Productos (`/`)**: cuadrícula de tarjetas. Cada tarjeta lleva imagen (placeholder), categoría, nombre, precio "desde" (el más bajo entre tiendas) y "en N tiendas". Se mantienen los filtros que ya existen: texto (sin distinguir mayúsculas ni tildes, todas las palabras), pestañas de categoría con contador, tienda, precio máximo, solo con stock, orden y paginación. Al hacer clic en una tarjeta se abre su subpágina.
4. **Subpágina de producto (`/producto/:slug`)**:
   - imagen a la izquierda; a la derecha, categoría, nombre, "desde $X en <tienda>" y el botón **☆ Guardar para comparar** (pide iniciar sesión si no hay sesión);
   - tabla de tiendas que lo venden, **ordenada de menor a mayor precio**, con stock y enlace "Ir a la tienda ↗";
   - **gráfico de precio histórico**: una línea por tienda (Winpy, PC Express, SP Digital), eje X = fecha, eje Y = precio en CLP, a partir de `price_history`;
   - **reseñas**: cualquiera las lee. Cada una muestra estrellas (1 a 5), comentario, **nombre de la cuenta de Google** del autor y fecha. Con la sesión iniciada aparece un formulario con estrellas, comentario y "Publicar"; sin sesión, el botón "Iniciar sesión con Google para comentar".
5. **Guardados (`/guardados`)**: requiere sesión (si no hay, invita a iniciarla). Muestra la **tabla de comparación lado a lado** (opción A del boceto). Hay una columna por producto guardado, con imagen, nombre (enlace a su subpágina) y botón ✕ para quitarlo. Las filas son categoría, mejor precio, tienda más barata y el precio en Winpy, PC Express y SP Digital ("—" si no lo vende). Los guardados se almacenan en la cuenta del usuario, no en el navegador.
6. **Agrupación de productos**: las filas de distintas tiendas que corresponden al mismo producto se agrupan automáticamente en un "producto agrupado". Se acepta que por ahora haya errores de agrupación, pero el diseño debe permitir **corregirlos a mano más adelante** sin que el proceso automático los deshaga.
7. **Documentación**: actualizar `README.md` (estado, stack, estructura, base de datos y configuración de Google), agregar a `docs/autoria.md` los prompts de esta etapa en versión resumida (mismo formato que los existentes: Prompt, Resultado obtenido, Decisiones propias, Supuestos por confirmar y Pendiente de verificar) y regenerar el grafo de graphify (`graphify update .`, que no tiene costo de API) para que refleje el nuevo código.

## No objetivos

- Imágenes reales de producto: por ahora todas usan `PlaceholderLC.png`. Se deja una columna `image_url`, vacía por ahora, para el futuro.
- Interfaz de administración para corregir agrupaciones: la corrección manual se hace por SQL o en el panel de Supabase.
- Otros proveedores de SSO, multilenguaje, sucursales y moderación de reseñas.
- Gráfico en la página de Guardados (se eligió la opción A, sin gráfico).

## Anti-objetivos (sería un fracaso aunque funcione)

- Que el frontend pueda escribir en `products`, `price_history` o los grupos: las RLS siguen permitiendo que solo los scrapers escriban datos de precios.
- Que un usuario pueda editar o borrar reseñas o guardados ajenos, o hacerse pasar por otro nombre en una reseña.
- Que una corrección manual de agrupación se pierda en la siguiente corrida de los scrapers.
- Que la clave secreta de Supabase o el secreto de Google lleguen al frontend o a git.

## Restricciones

- Stack existente: React 19 + TypeScript + Vite en `frontend/` (archivos en minúscula: `app.tsx`, `app.css`), Deno + TypeScript en `scraper/` y Supabase con RLS. Hay que construir sobre esto.
- Variables del frontend: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (contiene la clave `sb_publishable_...`).
- `supabase/migrations/001_init.sql` está vacío; el esquema se ejecutó a mano. Los cambios nuevos van en `supabase/migrations/002_grupos_resenas_guardados.sql` (explicada en `docs/migracion-002.md`) y **el autor los ejecuta a mano** en el SQL Editor de Supabase. Deben poder ejecutarse más de una vez sin romperse (`if not exists`, `create or replace`, etc.).
- Esquema real conocido:
  - `stores(id, slug, name, website)`: 1 = winpy, 2 = pcexpress, 3 = spdigital.
  - `products(id, store_id, name, url, category ['cpu'|'gpu'|'ram'], price, in_stock, price_updated_at, last_seen_at)`, único por `(store_id, url)`.
  - `price_history(id, product_id, price, in_stock, scraped_at)`, llenada por un trigger.
  - `product_reviews(id, product_id, user_id, rating, comment, created_at)`: **vacía**, se puede modificar libremente.
  - `profiles(id, display_name, language)`: privada por RLS.
- Configurar Google OAuth (Google Cloud Console + panel de Supabase → Authentication → Providers → Google, y las URLs de redirección) lo hace **el autor**. El README debe explicar los pasos; el código no puede automatizarlo.
- Scrapers: respetar el `crawl-delay` y no cambiar cómo se scrapea.

## Decisiones del autor

- Agrupación automática ahora, con errores aceptables, y corrección manual más adelante.
- Lista en cuadrícula con imagen placeholder; la subpágina también lleva imagen.
- Comparación con la opción A (tabla lado a lado), en una página *Guardados* a la que se llega desde el menú superior.
- Reseñas con estrellas y nombre de la cuenta de Google visible.
- Guardados y reseñas ligados al SSO de Google.
- Actualizar el grafo de graphify, el `README.md` y `docs/autoria.md`.

- **Ofertas vigentes** (regla aprobada por el autor). Una oferta (fila de `products`) es *vigente* si cumple las dos condiciones:
  - `last_seen_at` está dentro de los **últimos 3 días**;
  - `in_stock` **no es `false`** (el stock desconocido, `null`, cuenta).

  Solo las ofertas vigentes cuentan para:
  - "desde $X" y "en N tiendas" (tarjeta y subpágina);
  - "mejor precio" y "tienda más barata" (Guardados);
  - el filtro de precio máximo.

  En la subpágina, las ofertas no vigentes se muestran al final de la tabla de tiendas, en gris y con la etiqueta "Agotado" o "Sin datos recientes". En Guardados, la fila de cada tienda muestra su precio en gris con la misma etiqueta. Un producto sin ofertas vigentes muestra "Sin stock" en vez de precio. Para el orden por precio, esos productos van al final.

## Decisiones del asistente (propuestas aceptadas o tomadas al diseñar)

- **Modelo de agrupación**:
  - nueva tabla `product_groups(id, slug único, name, category, image_url null, created_at)`;
  - `products` recibe `group_id` (FK) y `group_locked boolean default false`;
  - reseñas y guardados se asocian a `group_id`, no a la fila de una tienda, para que no se pierdan si una tienda deja de vender el producto.
- **Quién agrupa**: un script nuevo `scraper/group.ts` (Deno, clave secreta) que se ejecuta después de los scrapers dentro de `deno task scrape`.
  - Calcula una clave normalizada a partir del nombre de cada producto y crea o reutiliza el `product_group` con esa clave.
  - No toca las filas con `group_locked = true`. Así funciona la corrección manual: se cambia `group_id`, se pone `group_locked = true` y no se vuelve a pisar.
  - La lógica de la clave va en funciones puras con pruebas (`deno test`) que usan nombres reales. Debe distinguir 7600, 7600X y 7600X3D. Para RAM considera capacidad, tipo y velocidad; para GPU, el modelo del chip y la VRAM.
- **Reseñas**:
  - `product_reviews` se modifica: `group_id` reemplaza a `product_id`, se agrega `author_name` y se mantiene `rating` entre 1 y 5;
  - una reseña por usuario y producto (único por `user_id, group_id`), que el autor puede editar o borrar;
  - `author_name` lo llena un trigger desde `auth.users.raw_user_meta_data` (`full_name`, o `name` como respaldo), no el cliente, para que nadie pueda inventar un nombre;
  - RLS: lectura pública; insertar, editar y borrar solo las propias.
- **Guardados**: tabla `saved_products(user_id, group_id, created_at)` con clave primaria `(user_id, group_id)` y RLS solo para las propias.
- **Rutas**: `react-router` (biblioteca estándar), con `/`, `/producto/:slug` y `/guardados`. Vite en desarrollo ya maneja las rutas directas.
- **Gráfico**: biblioteca `recharts` (React, sencilla de explicar).
- **Imagen placeholder**: `PlaceholderLC.png` se mueve a `frontend/public/placeholder.png`. Si `image_url` es nulo, se usa esa imagen.
- **Datos de la lista**: se mantiene la carga completa en el cliente (hoy son 417 filas). Se leen `products` con su grupo y se agrupan en el navegador para calcular "desde" y el número de tiendas.
- **"Solo con stock" y "tienda"** en la lista: un grupo se muestra si al menos una de sus filas cumple el filtro.
- **Instalación de dependencias** en `frontend/` con el mismo gestor que ya se usa allí (hay `node_modules`, `package.json` y `deno.lock`). Si `npm install` y `deno install` dan resultados distintos, se usa Deno, coherente con el resto del proyecto.

### Decisiones tomadas tras la revisión del diseño (decisión del asistente)

- **Origen del nombre en reseñas**: el trigger lee el nombre desde `auth.identities.identity_data` del proveedor `google` (`full_name`, o `name` como respaldo), **no** desde `raw_user_meta_data`. Este último lo puede editar el propio usuario con `supabase.auth.updateUser`, lo que permitiría inventar un nombre. El nombre se copia al crear la reseña y se vuelve a copiar al editarla.
- **Políticas existentes desconocidas**: el esquema original (`database.sql`) no está en el repositorio. La migración 002 **borra todas las políticas existentes** de `product_reviews` (recorriendo `pg_policies`) antes de crear las nuevas. Así no queda ninguna política vieja que vuelva a abrir el acceso.
- **Datos confirmados en la base real**:
  - `products.id` es un entero;
  - `stores`, `products` y `price_history` ya se leen con la clave pública;
  - `profiles` y su trigger no se tocan.
- **Despliegue**: por ahora solo local (`http://localhost:5173`). El README documenta esa URL de redirección para Google y Supabase, y explica que al desplegar hay que agregar el dominio y configurar el hosting para que todas las rutas sirvan `index.html`. Se usa `BrowserRouter`.
- **Agrupar como tarea aparte**: `deno task group` puede ejecutarse solo, y `deno task scrape` lo ejecuta al final.

## Lo que queda al criterio de quien implemente

- Estructura de archivos y componentes dentro de `frontend/src/` (mantener nombres en minúscula).
- Estilos, que deben respetar el `color-scheme: light dark` actual y ser responsive (el proyecto exige que sea totalmente responsive).
- Detalles de la heurística de agrupación, siempre que esté probada con nombres reales de las 3 tiendas.
- Cómo se muestra el estado de carga o error en cada página.

## Verificación esperada

- `deno test` del agrupador pasa, con casos reales de las 3 tiendas y de las 3 categorías.
- `tsc -b`, `oxlint` y `vite build` del frontend pasan sin errores.
- La migración `002` se ejecuta dos veces seguidas sin error (si hay un Postgres local disponible; si no, se documenta como pendiente).
- Prueba manual del autor, que se documenta en `autoria.md` como pendiente si no se hizo:
  - iniciar sesión con Google;
  - guardar y quitar un producto;
  - publicar, editar y borrar una reseña;
  - ver el gráfico.
