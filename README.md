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
- [ ] Geolocalización de tiendas: mostrar la distancia de cada tienda a la ubicación del usuario y sus horarios de funcionamiento (por hacer, ver nota abajo)
- [ ] Mostrar la imagen del producto si está disponible (por hacer). Hoy se usa una imagen genérica (`/placeholder.png`). `product_groups.image_url` ya existe y el frontend la usa si tiene valor, pero ningún scraper guarda imágenes ni `group.ts` las copia al grupo; falta extraer la URL de la imagen en cada tienda y completar el grupo.
- [x] Scraping y agrupado diarios automáticos (GitHub Actions, `.github/workflows/scrape.yml`)

> **Por hacer: geolocalización y horarios de las tiendas.** Falta implementar en la app (1) pedir la ubicación del usuario y mostrar a qué distancia queda cada tienda y sucursal, y (2) mostrar los horarios de funcionamiento de cada una. La base ya tiene las tablas `store_branches` (sucursales y ubicación), `branch_hours` (horarios) y `branch_stock` (unidades por sucursal) y la función `nearby_branches(lat, lng, radio_km)`, pero están vacías: ningún scraper las llena y el frontend no las usa. Hay que escribir los scrapers de sucursales y horarios (y, de paso, guardar `quantityInStore` y `quantityOnline` de SP Digital) y luego la vista en el frontend.

Dos pasos son **manuales**: configurar Google OAuth (ver [Configurar inicio de sesión con Google](#configurar-inicio-de-sesión-con-google)) y ejecutar la migración 002 en Supabase (ver [`docs/migracion-002.md`](docs/migracion-002.md)).

El detalle completo está en la sección "Por hacer" de [`docs/autoria.md`](docs/autoria.md).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite, react-router (rutas), recharts (gráfico), lint con Oxlint |
| Autenticación | Supabase Auth con Google (SSO) |
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
│       ├── data.ts              Consultas a la base de datos
│       ├── pages/               catalog.tsx, product.tsx, saved-page.tsx
│       ├── components/          tarjeta, estrellas, reseñas, gráfico, botones
│       └── lib/                 Lógica pura con pruebas: search, offers, history
├── scraper/             Un scraper por tienda (winpy.ts, pcexpress.ts, spdigital.ts),
│                        el agrupador (group_key.ts, group.ts) y deno.json con las tareas
├── supabase/
│   ├── migrations/      Migraciones SQL (001 vacía, 002 grupos, reseñas y guardados)
│   └── tests/           Pruebas de la migración 002 (run_002.sh, usa podman)
├── api/                 Reservado (vacío por ahora)
├── docs/
│   ├── autoria.md       Registro de prompts y estado del proyecto
│   ├── configurar-google.md  Paso a paso del inicio de sesión con Google
│   ├── migracion-002.md Qué hace la migración 002 y cómo ejecutarla
│   └── superpowers/     Diseño (specs/) y plan (plans/) de SSO, reseñas y guardados
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
- **RLS:** con la clave pública, cualquiera lee productos, precios, grupos y reseñas; un usuario con sesión iniciada solo escribe sus propias reseñas y sus propios guardados. Productos, precios y grupos solo los escriben los scrapers y el script de agrupado (clave de servicio).

> Nota: `supabase/migrations/001_init.sql` está vacío en el repositorio; el esquema se ejecutó manualmente en Supabase (ver Prompt 8 en `docs/autoria.md`). La `002` es la migración nueva y también se ejecuta a mano (se puede correr más de una vez sin error).

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
```

> Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` en el frontend. Los archivos `.env` están en `.gitignore`.

### 2. Migración 002

En Supabase → **SQL Editor**, pega el contenido de `supabase/migrations/002_grupos_resenas_guardados.sql` y presiona **Run**. Más detalles en [`docs/migracion-002.md`](docs/migracion-002.md).

### 3. Scrapers y agrupado

Desde `scraper/` (donde está el `deno.json` con las tareas):

```bash
deno task scrape              # los 9 scrapers y, al final, el agrupado
deno task group               # solo el agrupado (junta productos iguales entre tiendas)
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

El orden recomendado es: migración, scrapers/agrupado y recién después el frontend, porque sin grupos la página no tiene productos que mostrar.

### 5. Pruebas

Desde la raíz del repositorio:

```bash
(cd scraper && deno task test)                   # pruebas del agrupador
(cd frontend && deno test --no-config src/lib/)  # lógica pura del frontend (sin --no-config falla)
(cd frontend && npx tsc -b && npx oxlint && npx vite build)
bash supabase/tests/run_002.sh                   # migración 002 en un Postgres local (necesita podman)
```

## Configurar inicio de sesión con Google

El inicio de sesión usa Google a través de Supabase Auth. Es un paso manual:

1. En Google Cloud Console, crea un cliente OAuth de tipo "Aplicación web" con la URI de redirección `https://<proyecto>.supabase.co/auth/v1/callback` (cambia `<proyecto>` por el de tu proyecto de Supabase).
2. En Supabase → Authentication → Sign In / Providers → Google: activa el proveedor y pega el Client ID y el Client Secret.
3. En Supabase → Authentication → URL Configuration: pon Site URL `http://localhost:5173` y Redirect URLs `http://localhost:5173/**`.
4. Al desplegar: agrega el dominio final en esas mismas URLs y configura el hosting para que todas las rutas sirvan `index.html` (la app usa rutas como `/producto/amd-ryzen-5-7600`).

La guía paso a paso (pantalla de consentimiento, usuarios de prueba, cómo probarlo y errores comunes) está en [`docs/configurar-google.md`](docs/configurar-google.md).

## Arquitectura (resumen del grafo de conocimiento)

El grafo generado con graphify (`graphify-out/`, ignorado por git) muestra tres bloques principales:

- **Scrapers** (`winpy.ts`, `pcexpress.ts`, `spdigital.ts`): comparten la misma forma (`CATEGORIES`, `parseListing`, `parsePrice`, `scrapeCategory`, `ScrapedProduct`) y escriben a Supabase vía su API REST.
- **Supabase**: núcleo del sistema; el esquema, el trigger de historial y las políticas RLS se conectan a scrapers y frontend.
- **Frontend**: rutas con react-router (catálogo, `/producto/:slug`, guardados); consulta `product_groups` y `products` con el cliente de `supabase.ts`, formatea precios en CLP y solo cuenta como oferta vigente la vista en los últimos 3 días y con stock.

No se detectaron ciclos de importación.
