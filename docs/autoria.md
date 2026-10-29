# Autoría: registro de prompts

Registro de los prompts usados con Claude (asistente de IA) durante el proyecto. Las más de 30 interacciones de la conversación están condensadas en 3 prompts, redactados a partir de lo que se pidió realmente. Se irán agregando prompts nuevos al final.

- **Proyecto:** plataforma de comparación de precios de RAM, GPU y procesadores
- **Stack:** React + TypeScript + Deno, Supabase (PostgreSQL)
- **Fecha de inicio:** 2026-10-21

---

## Prompt 1: Planificación y alcance

**Prompt (condensado):**
> Voy a hacer un proyecto que compara precios de RAM, GPU y procesadores, con presupuesto y reseñas como filtros. Debe permitir (1) buscar y comparar precios en al menos 3 fuentes, con historial de precios para ver tendencias, y (2) ver disponibilidad por horario, stock y geolocalización, usando scrapers para los horarios de atención y el stock. Además debe ser totalmente responsive, tener login con SSO y multilenguaje propio (sin APIs externas como Google Translate). Con React + TypeScript sobre Deno, dame el roadmap completo y explícalo de forma simple, porque no tengo experiencia previa. El profesor no responde preguntas, así que asume las condiciones que falten.

**Resultado obtenido:**
- Roadmap por etapas y arquitectura propuesta: monorepo en Deno, scrapers programados, i18n propio, SSO por OIDC.
- Se acotó el alcance a 3 categorías: RAM, GPU y procesador.

**Decisiones propias:**
- Elegir solo RAM, GPU y procesador.
- Asumir las condiciones que el enunciado no aclara.

---

## Prompt 2: Selección de tiendas reales

**Prompt (condensado):**
> Necesito al menos 3 tiendas reales para scrapear (no simuladas; no tienen que ser chilenas, pero prefiero tiendas locales). Revisa el `robots.txt` de cada una antes de usarla. Te pego el HTML y el `robots.txt` de las candidatas (PC Factory, Infor-Ingen, SP Digital, Winpy y PC Express) para que veas qué datos se pueden extraer: precio, stock, sucursales y horarios.

**Resultado obtenido:**
- Tiendas elegidas: **SP Digital, Winpy y PC Express**.
- Descartadas: PC Factory, por conflicto con su `robots.txt` y problemas para acceder, e Infor-Ingen, porque su `robots.txt` bloquea bots.
- Reglas de scraping que se respetan: `crawl-delay` de cada sitio (Winpy 10 s, SP Digital 5 s, PC Express 5 s por cortesía) y no usar URLs prohibidas (por ejemplo `?filtro=` en Winpy).
- Se detectó que SP Digital requiere navegador (Playwright) por su stock cargado con JavaScript, y que bloquea consultas automatizadas simples.

**Decisiones propias y correcciones al asistente:**
- Las tiendas deben ser reales, no simuladas.
- Solotodo no es una tienda, es un comparador.
- Elegí la combinación final de tiendas.

---

## Prompt 3: Base de datos y primer scraper

**Prompt (condensado):**
> Voy a hacer la base de datos en Supabase. Primero diséñala completa, pero luego simplifícala al máximo: que solo guarde las tiendas y los nombres de los productos que se extraen. Después haz el scraper de Winpy usando `fetch` (sin Scrapy ni Playwright) y organízalo dentro de la estructura de mi proyecto, que ya tiene una carpeta `frontend`.

**Resultado obtenido:**
- `schema.sql`, `seed.sql` y `sample_data.sql`: diseño completo (precios, stock, sucursales, horarios, usuarios). Se guardan como referencia para etapas futuras.
- `simple.sql`: versión mínima con 2 tablas, `stores` y `products`. Esta es la que se ejecutó en Supabase.
- `scraper/winpy.ts` y `scraper/deno.json`: scraper de Winpy hecho con `fetch` y un parser HTML. Sigue la paginación y espera 10 s entre peticiones. Se probó el parser con el HTML real de la categoría de procesadores (40 de 40 productos extraídos).
- Estructura: carpeta `scraper/` al lado de `frontend/`, para que la clave `service_role` nunca quede dentro del frontend.

**Decisiones propias:**
- Usar Supabase.
- Simplificar a lo mínimo y avanzar por partes.
- Usar `fetch` en vez de Scrapy o Playwright.

**Pendiente de verificar:**
- Ejecutar el scraper contra Winpy y revisar que los datos lleguen a Supabase.
- Las categorías GPU y RAM de Winpy no se han probado contra su HTML real.

---

## Prompt 4: Scrapers de Winpy y PC Express para procesadores, RAM y GPU

**Prompt (condensado):**
> Ejecuté el scraper de Winpy y funcionó. Ahora haz el segundo scraper (PC Express) y extiende ambos para memorias RAM y tarjetas de video. Te pego el código fuente de cada página de categoría. PC Express organiza sus productos en subpáginas (una por socket de CPU, por tipo de memoria o por marca de GPU) y su página general mezcla accesorios, así que el scraper debe entrar por los botones de esa página general. Prefiero extender los scrapers existentes antes que crear un archivo por categoría.

**Resultado obtenido:**
- **Decisión de diseño:** un archivo por tienda (`winpy.ts`, `pcexpress.ts`), con la categoría como argumento (`cpu`, `ram`, `gpu`). Las categorías comparten el mismo formato HTML dentro de cada tienda.
- **`winpy.ts`:** recorre la paginación (`/paged/N/`) con 10 s de espera, como pide su `robots.txt`. Para RAM usa las subpáginas de PC y notebook (deja fuera la RAM de servidores). Filtros de respaldo por categoría: RAM solo con DDR2 a DDR5, GPU solo nombres que empiezan con "Tarjeta gráfica" (descarta 4 kits GPU + procesador).
- **`pcexpress.ts`:** lee la página general de cada categoría, descubre sus botones de subcategoría y recorre solo los correctos (sockets "CPU ...", "Memorias para PC/Notebook", "T / Video PCIe ..."), con 5 s de espera. Descarta accesorios, pendrives, memorias SD y tarjetas AGP.
- Los parsers se probaron contra el HTML real que se pegó en cada paso (40 de 40 productos de Winpy en cada página probada; 7 de 7 en la subpágina AM4 de PC Express).
- Ninguno de los dos respeta URLs prohibidas en su `robots.txt` (`?filtro=` en Winpy; `sort`, `order`, `limit` y `filter_` en PC Express).

**Decisiones propias y correcciones al asistente:**
- Aclaré que el link que había pasado de PC Express era solo de AM4, y que existía una página general con botones a todos los sockets.
- Indiqué qué botones y subpáginas existían en cada categoría, y que `/tarjetas-de-video/` de Winpy es lo mismo que `/tarjetas-graficas/`.
- Elegí dejar el guardado en Supabase para después y probar primero solo la extracción.
- Ejecuté el scraper de Winpy: extrajo 73 procesadores en 2 páginas.

**Pendiente de verificar:**
- Ejecutar los scrapers de PC Express y de RAM y GPU de Winpy contra los sitios reales.
- Subpáginas de PC Express distintas de AM4, y su paginación (`&page=N`).
- Incluí las GPU "Profesionales" de PC Express por consistencia con Winpy.
- Conectar Supabase para guardar los datos.
- Scraper de SP Digital (requiere navegador).

---

## Cómo seguir anotando

Para cada nuevo prompt, agrega una sección con este formato:

```
## Prompt N: título corto
**Prompt:** lo que se pidió, en pocas líneas
**Resultado obtenido:** qué entregó el asistente
**Decisiones propias:** qué decidí o corregí yo
```