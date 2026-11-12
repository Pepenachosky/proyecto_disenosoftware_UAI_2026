# Migración 003: imagen de producto

Archivo: `supabase/migrations/003_imagen_producto.sql`

## Cómo ejecutarla

1. Abrir el proyecto en Supabase → **SQL Editor**.
2. Pegar el contenido de `003_imagen_producto.sql` y presionar **Run**.

Orden: **migración 003 → scrapers → agrupado → página**. Los scrapers actualizados guardan `image_url`, así que fallan al guardar si la 003 todavía no se ejecutó; el agrupado (`deno task group`) también falla, porque ahora lee `image_url`.

Se puede ejecutar más de una vez sin problemas (usa `if not exists`).

## Qué hace

Agrega la columna `image_url` (texto, puede quedar vacía) a `products`: la URL de la imagen del producto en cada tienda. Los permisos no cambian, así que cualquiera la lee igual que el resto de la tabla.

## De dónde salen las imágenes

- **SP Digital y Winpy**: sus scrapers guardan la imagen que publica cada tienda.
- **PC Express**: no aporta imágenes. Su servidor de imágenes responde 403 cuando la imagen se pide desde otro sitio (protección contra hotlinking), y el proyecto respeta ese bloqueo. Sus filas quedan con `image_url` vacía.

## Foto de los grupos

`group.ts` decide la foto del grupo (`product_groups.image_url`) en cada corrida: una foto puesta a mano en un grupo armado automáticamente se sobrescribe en la siguiente corrida, incluso con vacío. Los grupos formados solo por productos con `group_locked = true` no los procesa `group.ts`, así que muestran el placeholder salvo que su `image_url` se ponga a mano en Supabase (`group.ts` no la sobrescribe).
