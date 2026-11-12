# Migración 003: imagen de producto

Archivo: `supabase/migrations/003_imagen_producto.sql`

## Cómo ejecutarla

1. Abrir el proyecto en Supabase → **SQL Editor**.
2. Pegar el contenido de `003_imagen_producto.sql` y presionar **Run**.

Orden: **migración 003 → scrapers → agrupado → página**. Los scrapers actualizados guardan `image_url`, así que fallan al guardar si la 003 todavía no se ejecutó.

Se puede ejecutar más de una vez sin problemas (usa `if not exists`).

## Qué hace

Agrega la columna `image_url` (texto, puede quedar vacía) a `products`: la URL de la imagen del producto en cada tienda. Los permisos no cambian, así que cualquiera la lee igual que el resto de la tabla.

## De dónde salen las imágenes

- **SP Digital y Winpy**: sus scrapers guardan la imagen que publica cada tienda.
- **PC Express**: no aporta imágenes. Su servidor de imágenes responde 403 cuando la imagen se pide desde otro sitio (protección contra hotlinking), y el proyecto respeta ese bloqueo. Sus filas quedan con `image_url` vacía.
