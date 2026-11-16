# Diseño: distancia a las tiendas, orden por distancia y horarios

Fecha: 2026-11-12 · Estado: borrador para aprobación

## Intención

Quien mira un producto en la subpágina `/producto/:slug` quiere **ir hoy mismo a retirarlo o a pagarlo en persona**. Para decidir a qué tienda ir necesita saber, para cada tienda que vende el producto:

- a qué distancia le queda;
- si está abierta ahora y hasta qué hora (o cuándo abre);
- su horario de la semana.

Y poder **ordenar las tiendas por precio o por distancia**.

Es un proyecto universitario (3er año, Informática). El autor registra cada prompt en `docs/autoria.md` y prefiere soluciones simples y explicables.

## Hechos del dominio (dichos por el autor)

- Cada una de las 3 tiendas (Winpy, PC Express, SP Digital) tiene **una única sucursal física, que es a la vez su casa matriz**. No hay que manejar varias sucursales por tienda.
- El stock por sucursal **no importa**: da lo mismo si el stock es online o presencial; la distancia y el horario se muestran igual para toda tienda que vende el producto.

## Objetivos

1. **Datos de las tiendas**: dirección, comuna, coordenadas (latitud y longitud) y horario semanal de cada una de las 3 tiendas, guardados en Supabase mediante una migración nueva (`supabase/migrations/004_ubicacion_tiendas.sql`) **escrita a mano**, sin scrapers.
2. **Ubicación del usuario**:
   - La app pide la ubicación al navegador (`navigator.geolocation`).
   - Si el usuario no da permiso (o falla), elige **región y comuna** desde dos listas desplegables (la comuna se filtra por la región elegida). La distancia se calcula desde el **centro de esa comuna**.
   - La barra de ubicación tiene un enlace **"Cambiar"** para pasar de una forma a la otra (por ejemplo, elegir otra comuna aunque haya dado permiso, o volver a intentar con la ubicación del navegador).
3. **Archivo de comunas**: un archivo fijo dentro del frontend con las 16 regiones y las 346 comunas de Chile, cada comuna con latitud y longitud. Se genera **una sola vez** con un script que consulta OpenStreetMap (Nominatim) y el resultado se guarda en el repositorio. La app nunca llama a una API externa para esto mientras alguien navega.
   - "Centro de la comuna" = el punto que OpenStreetMap marca como centro de la comuna (normalmente el centro urbano o la municipalidad), **no** el centro geométrico del polígono, que en comunas grandes y rurales puede caer lejos de donde vive la gente.
4. **Sección "Tiendas" de la subpágina de producto** rediseñada como **una tarjeta por tienda** (opción B del boceto, elegida por el autor). Cada tarjeta muestra:
   - nombre de la tienda y precio;
   - dirección (calle y comuna) y **distancia** ("3,1 km");
   - estado **"Abierta · cierra 19:00"** o **"Cerrada · abre mañana 10:00"** (o el día que corresponda);
   - estado del stock (como hoy: con stock / agotado / sin datos recientes) y el enlace **"Ir a la tienda ↗"**;
   - un desplegable **"Ver horario"** con el horario de toda la semana.
   Arriba de las tarjetas: la barra de ubicación ("📍 Usando tu ubicación · Cambiar", o "Comuna: Ñuñoa · Cambiar", o las listas de región y comuna si aún no hay ubicación) y el selector **"Ordenar por: Precio | Distancia"**.
5. **Orden**:
   - Por defecto, **por precio** (como hoy).
   - "Distancia" está **desactivado** mientras no haya ubicación (ni permiso ni comuna elegida).
6. **Documentación**: actualizar `README.md` (estado, estructura, pasos manuales), crear `docs/migracion-004.md` (qué hace y cómo ejecutarla), agregar el prompt de esta etapa a `docs/autoria.md` con el formato de siempre (Prompt, Resultado obtenido, Decisiones propias, Supuestos por confirmar, Pendiente de verificar) y actualizar la sección "Por hacer", y regenerar el grafo (`graphify update .`).

## No objetivos

- Stock por sucursal (`branch_stock`) y guardar `quantityInStore` / `quantityOnline` de SP Digital.
- Scrapers de sucursales u horarios.
- Distancia por calles o tiempo de viaje, mapas embebidos o enlaces a rutas.
- Mostrar distancia u horario fuera de la subpágina de producto (catálogo, guardados).
- Feriados y horarios especiales.
- Usar la función `nearby_branches` (con 3 tiendas, la distancia se calcula en el navegador).

## Anti-objetivos (sería un fracaso aunque funcione)

- Que la ubicación del usuario (coordenadas o comuna) salga del navegador: no se envía a Supabase ni a ningún servicio externo.
- Que la app dependa de una API externa en tiempo de uso para ubicar comunas.
- Que se publiquen direcciones u horarios inventados: los datos de las tiendas deben salir de sus páginas oficiales y el autor los revisa antes de ejecutar la migración.
- Que, sin ubicación, la sección "Tiendas" deje de funcionar: precio, stock, horario y enlace se ven igual; solo falta la distancia.
- Que el frontend pueda escribir en las tablas de tiendas (RLS: solo lectura pública).

## Restricciones

- Stack existente: React 19 + TypeScript + Vite en `frontend/` (archivos en minúscula, react-router, lógica pura en `frontend/src/lib/` con pruebas que corren con `deno test --no-config src/lib/`), Deno + TypeScript en `scraper/`, Supabase (PostgreSQL con RLS).
- La vista debe funcionar a **360 px** de ancho y en **modo oscuro**, como el resto de la app.
- **Esquema**: `001_init.sql` está vacío; el esquema base (`database.sql`) se ejecutó a mano en Supabase y **no está en el repositorio**. Según `docs/autoria.md` (Prompt 8), ya existen y están vacías las tablas `store_branches` (sucursales con coordenadas), `branch_hours` (un tramo horario por día) y `branch_stock`, y la función `nearby_branches(lat, lng, radio_km)`. Sus columnas exactas no están documentadas en el repo.
  - Se **reutilizan** `store_branches` (una fila por tienda) y `branch_hours`. El autor entregó su definición real (exportada desde Supabase):

    ```sql
    store_branches (
      id bigint generated always as identity primary key,
      store_id bigint not null references stores(id),
      name text not null,
      address text,
      city text,
      lat double precision check (lat between -90 and 90),
      lng double precision check (lng between -180 and 180),
      phone text
    )
    branch_hours (
      branch_id bigint not null references store_branches(id),
      weekday smallint not null check (weekday between 0 and 6),
      opens time not null,
      closes time not null,
      primary key (branch_id, weekday)
    )
    ```

  - Lo que se desprende:
    - Las coordenadas son números simples (`double precision`), sin PostGIS: `run_002.sh` sigue con su imagen de Postgres.
    - `branch_hours` admite **un solo tramo por día** (clave primaria `(branch_id, weekday)`), y un día cerrado es un día **sin fila**.
    - `store_branches` no tiene clave única por tienda: la 004 agrega `create unique index if not exists ... on store_branches(store_id)` para poder usar `on conflict (store_id)` y garantizar una sucursal por tienda.
    - `city` guarda la **comuna** de la tienda; `address` la calle y el número.
    - La convención de `weekday` no está documentada. Como las tablas están vacías, la 004 la fija y la deja comentada: **0 = domingo … 6 = sábado**, igual que `Date.getDay()` de JavaScript y `extract(dow ...)` de Postgres.
  - La exportación no muestra las políticas RLS ni la función `nearby_branches`. La función no se usa. Para las políticas, la 004 deja **lectura pública** (`select` para `anon` y `authenticated`) en `store_branches` y `branch_hours` de forma idempotente (`drop policy if exists` + `create policy`, y `enable row level security`), sin políticas de escritura.
  - Estas dos tablas se agregan a `supabase/tests/002_stub.sql` para probar la 004 en local.
- Las migraciones las **ejecuta el autor a mano** en el SQL Editor y deben poder ejecutarse más de una vez sin error ni duplicar filas (`if not exists`, `on conflict`, etc.). Se prueban con `bash supabase/tests/run_002.sh` (Postgres local con podman), ampliado para la 004.
- `navigator.geolocation` solo funciona en contextos seguros (`https://` o `localhost`); el despliegue en Vercel ya es https.
- Nominatim (OpenStreetMap): máximo 1 consulta por segundo y un `User-Agent` que identifique la aplicación. El `User-Agent` usa un nombre genérico del proyecto, **sin correo ni datos personales** del autor.

## Decisiones del autor

- Mostrar distancia y horario en la subpágina de producto, con orden por precio o distancia.
- Tarjeta por tienda (opción B), no columnas nuevas en la tabla.
- Sin permiso de ubicación: el usuario elige región y comuna de una lista y se usa el centro de la comuna.
- Coordenadas de las comunas en un archivo fijo, generado una vez desde OpenStreetMap.
- Ignorar el stock por sucursal.

## Decisiones del asistente (el autor puede cambiarlas)

- Datos de las tiendas escritos a mano en la migración 004, sin scrapers (son 3 direcciones y 3 horarios que casi nunca cambian).
- **Flujo de ubicación** (el autor dijo que lo ideal es que el usuario dé permiso):
  - En la primera visita a una subpágina de producto, la app pide la ubicación al navegador de inmediato. Mientras el navegador responde, la barra dice "Buscando tu ubicación…" y la sección "Tiendas" se ve completa, sin distancias.
  - Si el permiso se niega o falla, aparecen las listas de región y comuna.
  - Se guarda en `localStorage` **el modo elegido** ("navegador" o "comuna") y, si es comuna, cuál. En la siguiente visita se respeta lo último que eligió el usuario: si eligió una comuna (aunque antes haya dado permiso), se usa esa comuna y no se pide el GPS; si eligió "navegador", se vuelve a pedir la ubicación (el navegador recuerda el permiso).
  - Las coordenadas exactas del GPS **no** se guardan.
  - "Cambiar" abre las listas de región y comuna, más un botón "Usar mi ubicación" para volver al modo navegador.
- Distancia en **línea recta** (fórmula de Haversine), con una decimal y coma decimal: "3,1 km".
- "Abierta / Cerrada" se calcula con la **hora de Chile** (`America/Santiago`), no con la zona horaria del computador del usuario.
- Al ordenar, las ofertas vigentes van primero y las atenuadas (agotadas o sin datos recientes) después, igual que hoy; dentro de cada bloque se aplica el orden elegido. En "Distancia", el empate se resuelve por precio.
- Una tienda sin dirección o sin horario en la base muestra "Sin dirección registrada" / "Horario no disponible" y queda al final al ordenar por distancia.
- Las funciones de distancia, estado abierto/cerrado y orden van en `frontend/src/lib/` como lógica pura, con pruebas.
- El orden elegido (Precio / Distancia) no se recuerda entre visitas; siempre parte en Precio.
- **Horario con más de un tramo por día:** se usa el horario de atención presencial (retiro y pago en tienda), que es el que sirve para la intención de la página. Antes de escribir la 004 se revisan los horarios reales. Si alguna tienda tiene más de un tramo en un día (por ejemplo, pausa de almuerzo), la 004 amplía `branch_hours` para permitir varios tramos por día (cambia la clave primaria a `(branch_id, weekday, opens)`; se puede porque la tabla está vacía), y la lógica de abierta/cerrada y el "Ver horario" los muestran ("cierra 13:30", luego "abre 15:00"). No se simplifica a un solo tramo, porque eso sería publicar un horario que no es el real. Si todas tienen un solo tramo, se mantiene la tabla como está.
- **Coordenadas de las tiendas:** se obtienen geocodificando la dirección oficial (con Nominatim, o desde el mapa que la tienda tenga en su sitio). En `docs/migracion-004.md` se anota la fuente de la dirección, la del horario y la forma en que se sacaron las coordenadas. El autor revisa en un mapa que cada punto caiga en la dirección correcta antes de ejecutar la migración.

## Lo que queda a criterio del builder

- Nombre y ubicación exactos del archivo de comunas y del script que lo genera (por ejemplo, el script en `scraper/` o en una carpeta `scripts/`, y el JSON en `frontend/src/`).
- De dónde sale el listado oficial de regiones y comunas que el script recorre, siempre que el resultado tenga 16 regiones y 346 comunas. El script debe validar que cada punto obtenido cae dentro de su región (por ejemplo, con un rango de latitudes aproximado) para detectar comunas con nombre repetido o mal resueltas, y listar las dudosas para revisarlas a mano.
- Cómo se comparte el estado de ubicación entre componentes (contexto de React, hook, etc.).
- El texto exacto de los mensajes y el estilo visual, siguiendo el boceto B y los estilos actuales.
- Cómo se buscan y documentan las direcciones, coordenadas y horarios reales de las 3 tiendas (desde sus sitios oficiales), dejando la fuente anotada en `docs/migracion-004.md` para que el autor la revise.
