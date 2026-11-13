# Comparador de precios de hardware

Plataforma web que compara precios de **procesadores (CPU), tarjetas de video (GPU) y memorias RAM** entre tiendas chilenas reales. Unos scrapers recopilan nombre, precio y stock de cada producto, lo guardan en Supabase (PostgreSQL) y un frontend en React lo muestra.

> Proyecto de diseño, 3er año de Informática. El registro de los prompts de IA usados está en [`docs/autoria.md`](docs/autoria.md).

## Estado actual

- [x] Scrapers de 3 tiendas × 3 categorías (9 scrapers) con precio y stock
- [x] Base de datos en Supabase con historial automático de precios
- [x] Frontend: tienda, buscador, filtros (categoría, stock, presupuesto) y paginación
- [x] Agrupación de productos iguales entre tiendas (`product_groups`) y subpágina por producto con gráfico de precio histórico
- [x] Inicio de sesión con Google (SSO), reseñas con estrellas y productos guardados con comparación lado a lado (hecho en código; falta probarlo con Google y Supabase reales)
- [ ] Multilenguaje propio
- [x] Geolocalización de tiendas: cada tienda se muestra en una tarjeta con dirección, distancia al usuario, estado abierta/cerrada (hora de Chile) y horario semanal, y las ofertas se ordenan por precio o distancia (hecho en código; falta generar `frontend/src/data/comunas.ts`, ejecutar la migración 004 y probarlo en el navegador)
- [x] Imagen del producto: SP Digital y Winpy la guardan (`products.image_url`) y el agrupado elige una foto por grupo (`product_groups.image_url`, SP Digital > Winpy). PC Express no: su servidor responde 403 a las imágenes pedidas desde otro sitio, así que se respeta el bloqueo y se muestra el placeholder (`/placeholder.png`).
- [x] Scraping y agrupado diarios automáticos (GitHub Actions, `.github/workflows/scrape.yml`)

> **Quedó fuera de la geolocalización:** el stock por sucursal (`branch_stock`, y guardar `quantityInStore` y `quantityOnline` de SP Digital) y la función `nearby_branches`, que siguen sin usarse. Cada tienda tiene una sola sucursal (su casa matriz), cargada a mano en la migración 004 desde los sitios oficiales.

Varios pasos son **manuales**:

- Configurar Google OAuth (ver [Configurar inicio de sesión con Google](#configurar-inicio-de-sesión-con-google)).
- Ejecutar las migraciones 002, 003 y 004 en Supabase (ver [`docs/migracion-002.md`](docs/migracion-002.md), [`docs/migracion-003.md`](docs/migracion-003.md) y [`docs/migracion-004.md`](docs/migracion-004.md)).
- Generar la lista de regiones y comunas: `cd scraper && deno task comunas` (escribe `frontend/src/data/comunas.ts`; sin ese archivo el frontend no compila). La consulta a Overpass (OpenStreetMap) aún no se ha probado en vivo; si el conteo no da 16 regiones y 346 comunas, el script falla sin escribir nada.
- Probar la geolocalización en el navegador: aceptar la ubicación y ordenar por distancia, negarla y ver las listas, elegir una comuna y recargar (se recuerda), "Cambiar" y "Usar mi ubicación", "Ver horario", 360 px y modo oscuro.
- Confirmar con Winpy si su horario es "Lunes a Martes" o "Lunes a Jueves" (la 004 carga lo que dice su sitio: "Lunes a Martes").

El detalle completo está en la sección "Por hacer" de [`docs/autoria.md`](docs/autoria.md).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite, react-router (rutas), recharts (gráfico), lint con Oxlint |
| Autenticación | Supabase Auth con el botón oficial de Google (Google Identity Services) |
| Scrapers | Deno + TypeScript |
| Base de datos | Supabase (PostgreSQL, con RLS) |

## Estructura

```
.
├── frontend/
│   ├── public/          placeholder.png (imagen de producto sin foto)
│   └── src/
│       ├── app.tsx, main.tsx    Rutas de la aplicación
│       ├── supabase.ts          Cliente de Supabase (clave pública)
│       ├── auth.tsx             Sesión con Google
│       ├── saved.tsx            Contexto de productos guardados
│       ├── location.tsx         Ubicación del usuario (GPS o región y comuna)
│       ├── data.ts              Consultas a la base de datos
│       ├── data/comunas.ts      Regiones y comunas con coordenadas (generado, ver `deno task comunas`)
│       ├── pages/               catalog.tsx, product.tsx, saved-page.tsx
│       ├── components/          tarjeta, estrellas, reseñas, gráfico, botones
│       └── lib/                 Lógica pura con pruebas: search, offers, history, distancia y horarios
├── scraper/             Un scraper por tienda (winpy.ts, pcexpress.ts, spdigital.ts),
│                        el agrupador (group_key.ts, group.ts), comunas.ts (genera la lista
│                        de comunas), sus pruebas (*_test.ts) y deno.json con las tareas
├── supabase/
│   ├── migrations/      Migraciones SQL (001 vacía, 002 grupos, reseñas y guardados, 003 imagen del producto, 004 ubicación y horario de las tiendas)
│   └── tests/           Pruebas de las migraciones 002 a 004 (run_002.sh, usa podman)
├── api/                 Reservado (vacío por ahora)
├── docs/
│   ├── autoria.md       Registro de prompts y estado del proyecto
│   ├── configurar-google.md  Paso a paso del inicio de sesión con Google
│   ├── migracion-002.md Qué hace la migración 002 y cómo ejecutarla
│   ├── migracion-003.md Qué hace la migración 003 (imagen del producto) y cómo ejecutarla
│   ├── migracion-004.md Migración 004 (dirección, coordenadas y horario de las tiendas) y sus fuentes
│   └── superpowers/     Diseño (specs/) y plan (plans/) de SSO, reseñas y guardados, imagen de producto y geolocalización
└── .env.example         Variables de entorno de los scrapers (se copia a scraper/.env)
```

## Tiendas

Se eligieron tras revisar el `robots.txt` de cada una, y los scrapers respetan su `crawl-delay`:

| Tienda | Método | Espera entre requests |
|---|---|---|
| [Winpy](https://www.winpy.cl) | HTML | 10 s |
| [PC Express](https://tienda.pc-express.cl) | HTML | 5 s |
| [SP Digital](https://www.spdigital.cl) | JSON público de Gatsby (`/page-data/`) | 5 s |

Se descartaron PC Factory (conflicto con su `robots.txt`) e Infor-Ingen (bloquea bots).

## Base de datos

Tablas: `stores`, `products` (precio, stock, fecha de precio), `price_history`, `store_branches`, `branch_hours`, `branch_stock`, `profiles` y `product_reviews`. Detalles destacados:

- Un **trigger** agrega una fila a `price_history` cuando un producto nuevo entra o cambia de precio o stock (sin duplicar si nada cambió).
- La función `nearby_branches(lat, lng, radio_km)` busca sucursales cercanas.
- **Migración 002** (`supabase/migrations/002_grupos_resenas_guardados.sql`, explicada en [`docs/migracion-002.md`](docs/migracion-002.md)) agrega:
  - `product_groups`: un producto "único" que junta las filas de varias tiendas (`products.group_id`; `group_locked` protege las correcciones manuales).
  - Reseñas por grupo en `product_reviews`: 1 a 5 estrellas, una por usuario y producto; el nombre del autor lo pone la base desde la cuenta de Google.
  - `saved_products`: los productos que guarda cada usuario para compararlos.
- **Migración 003** (`supabase/migrations/003_imagen_producto.sql`, explicada en [`docs/migracion-003.md`](docs/migracion-003.md)) agrega `products.image_url`. Los scrapers de SP Digital y Winpy la llenan y `group.ts` copia una foto por grupo a `product_groups.image_url`.
- **Migración 004** (`supabase/migrations/004_ubicacion_tiendas.sql`, explicada en [`docs/migracion-004.md`](docs/migracion-004.md)) carga una sucursal por tienda (dirección, coordenadas y horario de atención presencial, con la fuente anotada), deja un índice único para que cada tienda tenga una sola, cambia la clave de `branch_hours` a `(branch_id, weekday, opens)` (PC Express cierra a almorzar y tiene dos tramos al día) y activa RLS de solo lectura.
- **RLS:** con la clave pública, cualquiera lee productos, precios, grupos y reseñas; un usuario con sesión iniciada solo escribe sus propias reseñas y sus propios guardados. Productos, precios y grupos solo los escriben los scrapers y el script de agrupado (clave de servicio).

> Nota: `supabase/migrations/001_init.sql` está vacío en el repositorio; el esquema se ejecutó manualmente en Supabase (ver Prompt 8 en `docs/autoria.md`). La `002`, la `003` y la `004` son migraciones nuevas y también se ejecutan a mano (se puede correr más de una vez sin error).

## Puesta en marcha

### Requisitos

- [Deno](https://deno.com) (scrapers y dependencias del frontend) y Node.js (herramientas del frontend: Vite, tsc, Oxlint)
- Un proyecto de [Supabase](https://supabase.com) con el esquema creado

### 1. Variables de entorno

Copia `.env.example` (en la raíz) a `scraper/.env`, que es el que leen los scrapers y el agrupado:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Y crea `frontend/.env` con la clave **pública**:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_CLIENT_ID=
```

`VITE_GOOGLE_CLIENT_ID` es el ID de cliente OAuth de Google (público; ver [Configurar inicio de sesión con Google](#configurar-inicio-de-sesión-con-google)). Sin él, el botón de iniciar sesión no aparece.

> Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` en el frontend. Los archivos `.env` están en `.gitignore`.

### 2. Migraciones 002, 003 y 004

En Supabase → **SQL Editor**, pega el contenido de `supabase/migrations/002_grupos_resenas_guardados.sql` y presiona **Run**; luego haz lo mismo con `supabase/migrations/003_imagen_producto.sql` y `supabase/migrations/004_ubicacion_tiendas.sql`. Más detalles en [`docs/migracion-002.md`](docs/migracion-002.md), [`docs/migracion-003.md`](docs/migracion-003.md) y [`docs/migracion-004.md`](docs/migracion-004.md). La 003 debe estar ejecutada antes de que corran los scrapers con este código (incluido el cron diario), porque guardan `image_url`.

### 3. Scrapers y agrupado

Desde `scraper/` (donde está el `deno.json` con las tareas):

```bash
deno task scrape              # los 9 scrapers y, al final, el agrupado
deno task group               # solo el agrupado (junta productos iguales entre tiendas)
deno task comunas             # genera frontend/src/data/comunas.ts (regiones y comunas, desde OpenStreetMap)
deno task scrape:winpy        # una sola tienda
deno run --allow-net --allow-env --env-file=.env spdigital.ts cpu   # una tienda y categoría
```

Sin variables de Supabase, los scrapers corren en **modo prueba**: muestran los productos sin guardarlos. La corrida completa es lenta a propósito por los `crawl-delay`. El agrupado es automático y puede equivocarse; los errores se corrigen a mano con `group_locked` (ver `docs/migracion-002.md`).

### 4. Frontend

```bash
cd frontend
deno install      # instala las dependencias (el frontend usa deno.lock)
deno task dev     # servidor de desarrollo (http://localhost:5173); también npm run dev
deno task build   # compilación de producción
deno task lint    # Oxlint
```

Antes de compilar el frontend hay que generar `frontend/src/data/comunas.ts` con `deno task comunas`.

El orden recomendado es: migraciones (002 a 004), `deno task comunas`, scrapers/agrupado y recién después el frontend, porque sin grupos la página no tiene productos que mostrar.

### 5. Pruebas

Desde la raíz del repositorio:

```bash
(cd scraper && deno task test)                   # pruebas del agrupador y de los scrapers (SP Digital y Winpy)
(cd frontend && deno test --no-config src/lib/)  # lógica pura del frontend (sin --no-config falla)
(cd frontend && npx tsc -b && npx oxlint && npx vite build)
bash supabase/tests/run_002.sh                   # migraciones 002 a 004 en un Postgres local (necesita podman)
```

## Configurar inicio de sesión con Google

El botón de inicio de sesión lo dibuja el script oficial de Google Identity Services; la app recibe el token de Google y se lo pasa a Supabase Auth (`signInWithIdToken`). Es un paso manual:

1. En Google Cloud Console, crea un cliente OAuth de tipo "Aplicación web" y agrega como orígenes de JavaScript autorizados `http://localhost:5173` y `http://localhost`.
2. En Supabase → Authentication → Sign In / Providers → Google: activa el proveedor, pega el Client ID y el Client Secret, y deja el ID en la lista **Client IDs** (sin activar *Skip nonce check*).
3. Pon el mismo ID de cliente en `frontend/.env` como `VITE_GOOGLE_CLIENT_ID` y reinicia `deno task dev`.
4. Al desplegar: agrega el dominio final como origen autorizado en Google, define `VITE_GOOGLE_CLIENT_ID` en las variables del hosting (Vite incrusta las `VITE_*` al compilar, así que hay que volver a desplegar después de definirla) y configura el hosting para que todas las rutas sirvan `index.html` (la app usa rutas como `/producto/amd-ryzen-5-7600`).

La guía paso a paso (pantalla de consentimiento, usuarios de prueba, cómo probarlo y errores comunes) está en [`docs/configurar-google.md`](docs/configurar-google.md).

## Arquitectura (resumen del grafo de conocimiento)

El grafo generado con graphify (`graphify-out/`, ignorado por git) muestra tres bloques principales:

- **Scrapers** (`winpy.ts`, `pcexpress.ts`, `spdigital.ts`): comparten la misma forma (`CATEGORIES`, `parseListing`, `parsePrice`, `scrapeCategory`, `ScrapedProduct`) y escriben a Supabase vía su API REST.
- **Supabase**: núcleo del sistema; el esquema, el trigger de historial y las políticas RLS se conectan a scrapers y frontend.
- **Frontend**: rutas con react-router (catálogo, `/producto/:slug`, guardados); consulta `product_groups`, `products` y las sucursales con el cliente de `supabase.ts`, calcula la distancia en línea recta a la ubicación del usuario (GPS o comuna elegida) y si cada tienda está abierta con la hora de Chile, formatea precios en CLP y solo cuenta como oferta vigente la vista en los últimos 3 días y con stock.

No se detectaron ciclos de importación.
