# Multilenguaje propio (español e inglés) — diseño

## Intención

El enunciado del proyecto pide "multilenguaje propio (sin APIs externas como Google Translate)" (Prompt 1 en `docs/autoria.md`). La página debe poder usarse en español y en inglés con traducciones escritas a mano dentro del proyecto, mostradas con una librería de i18n. El idioma elegido sigue al usuario entre equipos cuando inició sesión, usando la columna `profiles.language` que ya existe para eso.

## Objetivos

- Toda la interfaz en español o inglés, con cambio de idioma sin recargar la página.
- Formatos (fechas, distancias, precios) según el idioma activo.
- El idioma se recuerda en el navegador y, con sesión iniciada, en `profiles.language`.

## No objetivos

- Más idiomas que español e inglés (la estructura debe permitir agregar otro después sin rediseñar).
- Traducir contenido que viene de las tiendas o de los usuarios: nombres de productos, direcciones de tiendas, comentarios de reseñas, nombre del usuario.
- Rutas por idioma (`/en/...`) o SEO multilenguaje.

## Anti-objetivos (sería un fracaso aunque funcione)

- Cualquier llamada a un servicio de traducción externo, o texto traducido automáticamente.
- Textos de la interfaz que quedan en español al cambiar a inglés (claves faltantes que nadie nota).
- Que un usuario pueda cambiar el idioma (u otra columna) del perfil de otro usuario.

## Enfoques considerados

- **i18next + react-i18next (elegido por el autor).** La herramienta i18n más usada con React: archivos de traducción por idioma, variables en el texto, plurales, cambio de idioma en caliente y claves tipadas con TypeScript. Unos 20 kB comprimidos.
- **react-intl (FormatJS).** Formato ICU, más formal y más pesado (~40 kB), mensajes más verbosos; no aporta nada que este proyecto necesite.
- **Sistema propio sin librería.** Descartado: el autor pidió usar una herramienta tipo i18n.

Dónde se guarda el idioma:

- **Navegador + `profiles.language` (elegido por el autor).** Sigue al usuario entre equipos. Requiere la migración 005.
- Solo en el navegador. Más simple y sin migración; descartado por el autor.

## Comportamiento (aprobado por el autor)

- Idiomas: **español** (`es`, por defecto) e **inglés** (`en`).
- **Visitante sin sesión:** la primera vez se usa el idioma del navegador (`navigator.language`): inglés si empieza con `en`, español en cualquier otro caso. Si cambia el idioma con el selector, se recuerda en ese navegador (`localStorage`).
- **Al iniciar sesión** (propuesta del asistente, aceptada): si el perfil ya tiene idioma (`es` o `en`), ese manda y la página cambia a él (también se actualiza `localStorage`). Si el perfil no tiene idioma (`null`), se guarda en el perfil el idioma que se está usando.
- **Con sesión, al cambiar el idioma:** se guarda en el perfil y en `localStorage`.
- **Selector** (propuesta del asistente, aceptada): botón "ES / EN" en la barra de navegación, junto al usuario. Visible con y sin sesión.

## Qué se traduce

- Todo el texto de la interfaz: barra de navegación, catálogo (buscador, filtros, orden, paginación, mensajes vacíos), tarjetas de producto, subpágina de producto (tiendas, gráfico, reseñas, guardar), página de guardados y tabla comparativa, barra y mensajes de ubicación, estado abierta/cerrada y horario semanal (`lib/hours.ts`), distancias (`lib/geo.ts`), errores y "Página no encontrada".
- Botón oficial de Google: su opción `locale` sigue el idioma activo (`login-button.tsx`, `google.ts`).
- `<html lang>` se actualiza al idioma activo.
- **Textos fijos del proyecto guardados en la base** (decisión del asistente): los nombres de sucursal que carga la 004 ("Tienda física", "Casa matriz", "Tienda y punto de retiro") y el autor `'Usuario'` que pone el trigger de la 002 cuando la reseña no tiene nombre. Se traducen en el frontend con una lista de valores conocidos; un valor que no está en la lista se muestra tal cual. No se cambia la base.

## Formatos (propuesta del asistente, aceptada)

- Se sigue usando `Intl` del navegador, con el locale del idioma activo: `es-CL` para español y `en-US` para inglés.
- **Precios:** siempre en pesos chilenos (CLP); cambia solo el formato: `$89.990` en español, `CLP 89,990` en inglés. Aplica a `clp` (`lib/offers.ts`) y `compactClp` (`price-chart.tsx`).
- **Fechas:** "16 de noviembre de 2026" / "November 16, 2026" (`price-chart.tsx`, `reviews.tsx`).
- **Distancias y promedio de estrellas:** separador decimal según el idioma (`lib/geo.ts`, `reviews.tsx`).
- **Orden alfabético** (`localeCompare` en `catalog.tsx` y `saved-page.tsx`): usa el locale activo.
- La zona horaria para abierta/cerrada sigue siendo la de Chile (`America/Santiago`); solo cambian los textos.

## Base de datos: migración 005

### Estado real de `profiles` (consultado por el autor en Supabase, 2026-11-16)

- Columnas `id`, `display_name`, `language`; `language` tiene **default `'es'`** y es **`NOT NULL`** (no aparecía en la consulta; se descubrió al fallar la primera ejecución de la 005 el 2026-11-17, y la 005 ahora lo quita).
- Valores actuales: una fila, `es` (puesto por el default; la interfaz nunca escribió el idioma).
- Permisos de tabla: `anon` y `authenticated` tienen todos (`INSERT`, `SELECT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`), los que Supabase da por defecto.
- Políticas: `perfil propio: leer` (`SELECT`) y `perfil propio: editar` (`UPDATE`), ambas para el rol `public`.
- Trigger `on_auth_user_created` → `public.handle_new_user()` (`security definer`): inserta `(id, display_name)` sin `language`, así que el idioma lo pone el default.

### Qué hace la 005

`supabase/migrations/005_idioma_perfil.sql`, idempotente como las anteriores (se puede ejecutar dos veces):

- **Quita el default `'es'` de `language`** y pone `null` en las filas existentes. Sin esto, todo usuario nuevo tendría `es` y la regla "si el perfil no tiene idioma, se guarda el actual" nunca se cumpliría. Poner `null` no borra ninguna elección: nadie pudo elegir idioma hasta ahora (decisión del asistente).
- Restricción: `profiles.language` solo admite `es`, `en` o `null`.
- **Permisos:** quita a `anon` y `authenticated` todos los permisos de tabla sobre `profiles`; devuelve `select` a `authenticated` y da `update (language)` (solo esa columna) a `authenticated`. El trigger de registro sigue funcionando porque es `security definer`. Con esto un usuario ya no puede cambiar su `display_name`, insertar ni borrar perfiles; hoy sí puede (decisión del asistente: lo pide el tercer anti-objetivo y la interfaz no usa esas operaciones).
- **Políticas:** reemplaza `perfil propio: editar` por una política `for update to authenticated` con `id = auth.uid()` en `using` y `with check`. `perfil propio: leer` se mantiene.

### Pruebas

- `supabase/tests/005_prep.sql` reproduce en el Postgres local el estado real de arriba (default `'es'`, permisos completos para `anon` y `authenticated`, las dos políticas con sus nombres y el trigger que no pone idioma). Así las pruebas miden lo mismo que pasará en Supabase; el stub de la 002 solo da `select` y no serviría.
- `supabase/tests/005_test.sql`, agregado a `run_002.sh` después de la 004 (prep → 005 dos veces → pruebas): el default ya no existe y un perfil nuevo queda con `null`; un usuario cambia su idioma; no puede cambiar el de otro (0 filas); no puede cambiar `display_name`; un valor como `fr` se rechaza; `anon` no puede actualizar; un usuario no puede insertar ni borrar perfiles.
- Guía `docs/migracion-005.md` (como las de la 002 y la 004): qué hace y cómo ejecutarla en Supabase.

## Lo que decidió el autor

- Español e inglés, sin servicio externo de traducción.
- i18next + react-i18next.
- Idioma guardado en el navegador y en `profiles.language`.
- El comportamiento, lo que se traduce y los formatos descritos arriba.

## Lo que queda al implementador

- Organización de las traducciones (un archivo por idioma, por ejemplo `frontend/src/i18n/es.json` y `en.json`, o un objeto TypeScript), nombres de las claves y cómo se agrupan.
- Claves tipadas para que una clave inexistente sea error de compilación, y una prueba con `deno test` que verifique que `es` y `en` tienen exactamente las mismas claves.
- Cómo pasar el idioma a la lógica pura de `frontend/src/lib/` (`hours.ts`, `geo.ts`, `offers.ts`) sin perder sus pruebas: por ejemplo, que reciban el locale o devuelvan datos y el componente arme el texto.
- Dónde vive la sincronización con el perfil (por ejemplo, un `LanguageProvider` dentro de `AuthProvider`, o dentro de `AuthProvider`), y qué pasa si la lectura o escritura del perfil falla (la página sigue funcionando con el idioma local).
- Textos en inglés: los redacta el implementador; el autor los revisa.
- Actualizar README (estado actual: multilenguaje hecho; paso manual de la migración 005) y `docs/autoria.md` (nuevo Prompt y "Por hacer").
