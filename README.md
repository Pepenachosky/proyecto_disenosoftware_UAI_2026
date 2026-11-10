# Comparador de precios de hardware

Plataforma web que compara precios de **procesadores (CPU), tarjetas de video (GPU) y memorias RAM** entre tiendas chilenas reales. Unos scrapers recopilan nombre, precio y stock de cada producto, lo guardan en Supabase (PostgreSQL) y un frontend en React lo muestra.

> Proyecto de diseño, 3er año de Informática. El registro de los prompts de IA usados está en [`docs/autoria.md`](docs/autoria.md).

## Estado actual

- [x] Scrapers de 3 tiendas × 3 categorías (9 scrapers) con precio y stock
- [x] Base de datos en Supabase con historial automático de precios
- [x] Frontend inicial: lista de productos con nombre y precio
- [ ] Frontend: tienda, buscador, filtros (categoría, stock, presupuesto) y paginación
- [ ] Scrapers de sucursales, horarios y stock por sucursal
- [ ] Reseñas, login con SSO y multilenguaje propio
- [ ] Cronjob diario de scraping al hacer el deploy

El detalle completo está en la sección "Por hacer" de [`docs/autoria.md`](docs/autoria.md).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite, lint con Oxlint |
| Scrapers | Deno + TypeScript |
| Base de datos | Supabase (PostgreSQL, con RLS) |

## Estructura

```
.
├── frontend/            App React + Vite (src/app.tsx, src/supabase.ts)
├── scraper/             Un scraper por tienda: winpy.ts, pcexpress.ts, spdigital.ts
├── supabase/migrations/ Migraciones SQL
├── api/                 Reservado (vacío por ahora)
├── docs/autoria.md      Registro de prompts y estado del proyecto
├── deno.json            Tareas de scraping
└── .env.example         Variables de entorno
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
- **RLS:** el frontend, con la clave pública, solo lee datos públicos; solo los scrapers (clave de servicio) escriben.

> Nota: `supabase/migrations/001_init.sql` está vacío en el repositorio; el esquema se ejecutó manualmente en Supabase (ver Prompt 8 en `docs/autoria.md`).

## Puesta en marcha

### Requisitos

- [Deno](https://deno.com) y Node.js (para el frontend)
- Un proyecto de [Supabase](https://supabase.com) con el esquema creado

### 1. Variables de entorno

Copia `.env.example` a `.env` (en la raíz, usado por los scrapers):

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

### 2. Scrapers

Desde `scraper/` (donde están los `deno.json` con las tareas):

```bash
deno task scrape              # los 9 scrapers (3 tiendas × cpu, ram, gpu)
deno task scrape:winpy        # una sola tienda
deno run --allow-net --allow-env --env-file=.env spdigital.ts cpu   # una tienda y categoría
```

Sin variables de Supabase, los scrapers corren en **modo prueba**: muestran los productos sin guardarlos. La corrida completa es lenta a propósito por los `crawl-delay`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev       # servidor de desarrollo
npm run build     # compilación de producción
npm run lint      # Oxlint
```

## Arquitectura (resumen del grafo de conocimiento)

El grafo generado con graphify (`graphify-out/`, ignorado por git) muestra tres bloques principales:

- **Scrapers** (`winpy.ts`, `pcexpress.ts`, `spdigital.ts`): comparten la misma forma (`CATEGORIES`, `parseListing`, `parsePrice`, `scrapeCategory`, `ScrapedProduct`) y escriben a Supabase vía su API REST.
- **Supabase**: núcleo del sistema; el esquema, el trigger de historial y las políticas RLS se conectan a scrapers y frontend.
- **Frontend**: `App()` consulta `products` con el cliente de `supabase.ts` y formatea precios en CLP.

No se detectaron ciclos de importación.
