# Migración 004: tiendas físicas

Archivo: `supabase/migrations/004_ubicacion_tiendas.sql`

## Cómo ejecutarla

1. Abrir el proyecto en Supabase → **SQL Editor**.
2. Pegar el contenido de `004_ubicacion_tiendas.sql` y presionar **Run**.

Se puede ejecutar más de una vez sin problemas ni filas duplicadas. Para corregir un horario o un dato de una tienda, se edita la migración y se vuelve a ejecutar.

## Qué hace

- Crea el índice único `store_branches_store_id_key`: una sola sucursal por tienda.
- Cambia la clave primaria de `branch_hours` a `(branch_id, weekday, opens)`, porque PC Express tiene dos tramos el mismo día.
- Carga una sucursal por tienda (dirección, comuna en `city`, coordenadas y teléfono) y su horario, con los datos de la sección siguiente. Los horarios se borran y se vuelven a insertar en cada ejecución.
- Activa RLS en ambas tablas: borra todas las políticas que hubiera (por ejemplo, una abierta de la base original) y deja solo dos de lectura pública (`anon` y `authenticated`); ninguna política de escritura.
- Winpy: el texto oficial dice "Lunes a Martes 09:00 a 19:00", y así se cargó (lunes y martes hasta las 19:00; miércoles a viernes hasta las 18:00).

## Datos de las tiendas

Datos recogidos el 2026-11-13 de los sitios oficiales de cada tienda. Convención de `weekday`: 0 = domingo … 6 = sábado; un día sin horario = cerrado. Los horarios son los de **atención presencial** (retiro / pago en tienda).

Cada tienda tiene **una sola** ubicación física, que además es su casa matriz (coincide con lo que indica el autor del proyecto).

**Ninguna tienda tiene más de un tramo en un mismo día, salvo PC Express**, que cierra a almorzar de 14:00 a 15:00 (dos tramos de lunes a viernes). Winpy y SP Digital tienen un solo tramo por día.

Coordenadas: se geocodificó la dirección oficial con Nominatim (`https://nominatim.openstreetmap.org/search?countrycodes=cl&q=<dirección, comuna>`). Las fuentes no oficiales (Nominatim/OpenStreetMap) solo se usan para las coordenadas.

### Winpy (`winpy`)

| Campo | Valor | Fuente |
|---|---|---|
| name | Tienda física | https://www.winpy.cl/retiros-y-despachos ("Tienda Física") |
| address | Av. Antonio Varas 2223 | https://www.winpy.cl/retiros-y-despachos y https://www.winpy.cl/que-es-winpy |
| city | Ñuñoa | idem ("Ñuñoa, Región Metropolitana") |
| lat | -33.44777 | Nominatim (resultado: -33.4477558). Coincide con el pin del enlace "¿Cómo llegar?" del sitio (https://maps.app.goo.gl/2SJEAV7oqKft1ZtF6, Google Maps: -33.447771, -70.6111459) |
| lng | -70.61115 | Nominatim (-70.6111480); Google: -70.6111459 |
| phone | +562 2227 9800 | Encabezado de https://www.winpy.cl (Centro de Ayuda) |

Horario (texto oficial en https://www.winpy.cl/retiros-y-despachos y https://www.winpy.cl/que-es-winpy): "De Lunes a Martes hábiles de 09:00 a 19:00 hrs. y de Miércoles a Viernes hábiles de 09:00 a 18:00 hrs."

| weekday | día | opens | closes |
|---|---|---|---|
| 0 | domingo | cerrado | cerrado |
| 1 | lunes | 09:00 | 19:00 |
| 2 | martes | 09:00 | 19:00 |
| 3 | miércoles | 09:00 | 18:00 |
| 4 | jueves | 09:00 | 18:00 |
| 5 | viernes | 09:00 | 18:00 |
| 6 | sábado | cerrado | cerrado |

Punto para revisar: https://www.openstreetmap.org/?mlat=-33.44777&mlon=-70.61115#map=18/-33.44777/-70.61115

Nota: Nominatim nombra ese punto como "Verisure" (un negocio vecino en el mismo número); la dirección y el pin de Google del sitio oficial coinciden con él.

### PC Express (`pcexpress`)

| Campo | Valor | Fuente |
|---|---|---|
| name | Casa matriz | https://tienda.pc-express.cl/sucursales-y-horarios ("Nuestra casa matriz en Providencia") |
| address | Almirante Zegers 784 | idem |
| city | Providencia | idem |
| lat | -33.43424 | Nominatim (-33.4342406; el resultado se llama "PC Express Casa Matriz") |
| lng | -70.62353 | Nominatim (-70.6235302) |
| phone | +562 2235 3028 | idem ("Mesa Central +562 22353028") |

Horario (texto oficial en https://tienda.pc-express.cl/sucursales-y-horarios): "Horario de Atención es de lunes a viernes entre de 09:30 a 14:00 y 15:00 a 18:30 horas." La página lista "Retiro en tienda" y "Venta presencial" en esa sede. También indica: "favor contactarnos a través de los canales digitales", lo que podría limitar la atención presencial (a confirmar con el autor).

| weekday | día | tramo 1 | tramo 2 |
|---|---|---|---|
| 0 | domingo | cerrado | |
| 1-5 | lunes a viernes | 09:30 a 14:00 | 15:00 a 18:30 |
| 6 | sábado | cerrado | |

**Dos tramos por día (lunes a viernes).**

Punto para revisar: https://www.openstreetmap.org/?mlat=-33.43424&mlon=-70.62353#map=18/-33.43424/-70.62353

### SP Digital (`spdigital`)

| Campo | Valor | Fuente |
|---|---|---|
| name | Tienda y punto de retiro | https://www.spdigital.cl (pie de página: "Horario Atención Tienda y Punto de Retiro") |
| address | Padre Mariano 356 | https://www.spdigital.cl, https://www.spdigital.cl/about/ ("Padre Mariano N° 356") |
| city | Providencia | idem |
| lat | -33.42410 | Nominatim (-33.4241035; el resultado se llama "SP Digital") |
| lng | -70.61849 | Nominatim (-70.6184854) |
| phone | +562 2656 7043 | https://www.spdigital.cl/help-center/ (teléfono de atención, no necesariamente de la tienda) |

Horario (pie de página de https://www.spdigital.cl y https://www.spdigital.cl/contact-form/): "Lunes a Jueves - 09:00 a 18:30; Viernes - 09:00 a 18:00".

| weekday | día | opens | closes |
|---|---|---|---|
| 0 | domingo | cerrado | cerrado |
| 1 | lunes | 09:00 | 18:30 |
| 2 | martes | 09:00 | 18:30 |
| 3 | miércoles | 09:00 | 18:30 |
| 4 | jueves | 09:00 | 18:30 |
| 5 | viernes | 09:00 | 18:00 |
| 6 | sábado | cerrado | cerrado |

Otro horario del sitio (no usado): el teléfono de atención/consultas atiende de 08:30 a 18:00 hrs (https://www.spdigital.cl/help-center/).

Punto para revisar: https://www.openstreetmap.org/?mlat=-33.42410&mlon=-70.61849#map=18/-33.42410/-70.61849
