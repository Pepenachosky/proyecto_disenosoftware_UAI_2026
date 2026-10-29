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
- Scraper de SP Digital (requiere navegador), probablemente use playwright para estoq.

---

## Prompt 5: Análisis de SP Digital (tercera tienda)

**Prompt (condensado):**
> ¿Cómo que SP Digital bloquea las consultas automáticas? Te dejo el resultado de una prueba de `fetch` desde mi computador y el código fuente de su categoría de procesadores. Dime cómo extraer sus productos.

**Resultado obtenido:**
- Se aclaró que el bloqueo ocurrió con la herramienta web del asistente, desde un servidor, y no necesariamente afecta a un `fetch` desde el computador del proyecto. Se acordó no intentar saltarse ninguna verificación si apareciera.
- Se entregó una prueba mínima (`test_spdigital.ts`) para comprobar desde el computador del proyecto. Resultado: estado 200 y HTML completo de la portada, sin bloqueo.
- Del código fuente de la categoría de procesadores se concluyó que el sitio está hecho con Gatsby (React) y que cada producto trae nombre, URL relativa y precios (transferencia y otros medios de pago) dentro del HTML. Los nombres empiezan con "Procesador", así que se puede reutilizar el filtro de respaldo.
- Se detectó un problema: el HTML inicial trae solo 8 productos y la paginación muestra una sola página. Lo más probable es que el resto se cargue con JavaScript. Se entregó una segunda prueba (`test_spdigital2.ts`) para confirmarlo.

**Decisiones propias:**
- Probar primero desde mi computador antes de asumir que se necesita un navegador automatizado (Playwright).
- Pasar el código fuente de la categoría de procesadores como muestra del formato.

**Pendiente de verificar:**
- Ejecutar `test_spdigital2.ts` y contar cuántos productos ve un `fetch` simple frente a los que se ven en el navegador.
- Si el resto se carga con JavaScript, decidir entre Playwright (con espera de 5 s y respetando `robots.txt`) y otra tienda como tercera fuente.
- Escribir `spdigital.ts` con la misma estructura de los otros scrapers.

---

## Prompt 6: Scraper de SP Digital (CPU, RAM y GPU)

**Prompt (condensado):**
> Ya hice el test de `fetch` y funcionó. Empecemos con los procesadores de SP Digital. Te adjunto los scrapers de Winpy y PC Express para que sigas el mismo estilo. Después te paso el código fuente de RAM y GPU para extender el scraper.

**Resultado obtenido:**
- `scraper/spdigital.ts`, con la misma estructura que `winpy.ts` y `pcexpress.ts` (`parseListing`, `fetchHtml`, `scrapeCategory`, `save`, lotes de 100, categoría como argumento).
- Usa solo `fetch` y `linkedom`: las tarjetas de producto vienen en el HTML inicial. Lo que se carga con JavaScript es el stock, que por ahora no se extrae. Por eso no hace falta Playwright.
- Espera de 5 s entre peticiones (`robots.txt`), sin filtros ni carrito. Si el sitio responde 403, 429 o 503 el scraper se detiene, sin intentar esquivar el bloqueo.
- Filtros de respaldo: CPU empieza con "Procesador", GPU con "Tarjeta de video", RAM contiene DDR2 a DDR5 (incluye RAM de notebook).
- Parser probado con el HTML real: 8 de 8 procesadores, 14 de 14 memorias RAM y 5 de 5 tarjetas de video.

**Decisiones propias:**
- Mostrar los scrapers que ya tenía para mantener el mismo estilo.
- Ir categoría por categoría, pasando el código fuente de cada una.

**Pendiente de verificar:**
- Ejecutar `spdigital.ts` contra el sitio real y contra Supabase (solo se probó el parser).
- El listado por defecto oculta los productos agotados, por eso salen pocos productos.
- Paginación de SP Digital: las tres categorías probadas tenían una sola página.

**Por hacer:**
- [ ] Agregar a los scrapers (Winpy, PC Express y SP Digital) el precio y el stock de cada producto.
- [ ] Empezar a hacer el frontend.
- [ ] Hacer la base de datos (la versión completa con precios, stock, sucursales y horarios; hoy solo existe `simple.sql`).

---

## Cómo seguir anotando

Para cada nuevo prompt, agrega una sección con este formato:

```
## Prompt N: título corto
**Prompt:** lo que se pidió, en pocas líneas
**Resultado obtenido:** qué entregó el asistente
**Decisiones propias:** qué decidí o corregí yo
```