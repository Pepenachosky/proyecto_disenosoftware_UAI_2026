# Migración 002: grupos de productos, reseñas y guardados

Archivo: `supabase/migrations/002_grupos_resenas_guardados.sql`

Una migración es un archivo SQL que cambia la estructura de la base de datos (crea tablas, agrega columnas, cambia permisos). La `001` está vacía porque el esquema original se ejecutó a mano; la `002` se ejecuta del mismo modo.

## Cómo ejecutarla

1. Abrir el proyecto en Supabase → **SQL Editor**.
2. Pegar el contenido de `002_grupos_resenas_guardados.sql` y presionar **Run**.
3. Ejecutar el agrupado: `cd scraper && deno task group` (o `deno task scrape`, que lo corre al final).
4. Recién entonces abrir el frontend: hasta que corra el agrupado, la página no tiene productos que mostrar.

Orden: **migración → agrupado → página**.

Se puede ejecutar más de una vez sin problemas (usa `if not exists`, `create or replace`, etc.).

## Qué hace

1. **Crea `product_groups`**: un producto "único" (por ejemplo, "AMD Ryzen 5 7600"), con nombre, categoría, `slug` para la URL `/producto/amd-ryzen-5-7600` e `image_url`, vacía por ahora. Cualquiera la lee; solo el script de agrupado (con la clave secreta) escribe en ella.
2. **Agrega dos columnas a `products`**:
   - `group_id`: a qué producto único pertenece cada fila de tienda. Las filas de Winpy y de PC Express del mismo producto apuntan al mismo grupo.
   - `group_locked` (empieza en `false`): si se corrige un grupo a mano, se pone en `true` y el agrupado automático ya no toca esa fila.
3. **Modifica `product_reviews`** (estaba vacía, así que no se pierde nada):
   - `product_id` se reemplaza por `group_id`, para que la reseña pertenezca al producto único y no a una tienda;
   - se agrega `author_name`, que llena un **trigger** desde el nombre de la cuenta de Google (`auth.identities`), no el navegador, para que nadie firme con un nombre falso;
   - el mismo trigger pone las fechas: `created_at` al crear (se ignora la que mande el navegador) y `updated_at` en cada cambio. Al editar, `created_at` no cambia y el usuario no puede mover su reseña a otro producto (`group_id` queda igual); desde el SQL Editor, sin sesión, sí se puede, para corregir grupos;
   - la nota debe estar entre 1 y 5 estrellas y el comentario tiene como máximo 1000 caracteres;
   - cada persona puede dejar una sola reseña por producto.
4. **Crea `saved_products`** con `user_id`, `group_id` y fecha. No se puede guardar dos veces el mismo producto.
5. **Permisos (RLS)**:

   | Tabla | Leer | Crear, editar o borrar |
   |---|---|---|
   | `product_groups` | Cualquiera | Solo el script de agrupado |
   | `product_reviews` | Cualquiera | Solo el autor, y solo las suyas |
   | `saved_products` | Solo el dueño | Solo el dueño |

   Como no se conocen los nombres de los permisos actuales de `product_reviews` (el `database.sql` original no está en el repositorio), la migración **borra todos los que existan en esa tabla** y crea los nuevos, para que no quede ninguno viejo abierto.

## Lo que no toca

- `stores`, `price_history`, `profiles` y su trigger quedan igual.
- No borra ni modifica productos ni precios: solo agrega las dos columnas a `products`.
- Los scrapers siguen funcionando igual.

## Corregir un grupo a mano

```sql
-- Mover la fila 228 al grupo 15 y evitar que el agrupado automático la cambie
update products set group_id = 15, group_locked = true where id = 228;
```

Si la corrección deja un grupo **sin filas** (por ejemplo, el 42), sus reseñas y guardados siguen apuntando a él: hay que moverlos al grupo correcto. Como cada usuario tiene una sola reseña y un solo guardado por producto, primero se borran los que chocarían con uno que el usuario ya tiene en el destino y después se mueven los demás:

```sql
-- Pasar reseñas y guardados del grupo 42 (vacío) al 15
begin;
delete from product_reviews r
 where r.group_id = 42
   and exists (select 1 from product_reviews d where d.group_id = 15 and d.user_id = r.user_id);
update product_reviews set group_id = 15 where group_id = 42;

delete from saved_products s
 where s.group_id = 42
   and exists (select 1 from saved_products d where d.group_id = 15 and d.user_id = s.user_id);
update saved_products set group_id = 15 where group_id = 42;
commit;
```

El agrupado (`scraper/group.ts`) nunca borra grupos, a propósito: borrar un grupo borra en cascada sus reseñas y guardados. Un grupo vacío no aparece en el catálogo; si ya no tiene reseñas ni guardados, se puede borrar a mano (`delete from product_groups where id = 42;`).
