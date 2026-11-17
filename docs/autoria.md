# Autoría: registro de prompts

Registro de los prompts usados con Claude (asistente de IA) durante el proyecto. Las primeras interacciones de la conversación (más de 30) están condensadas en los primeros 3 prompts, redactados a partir de lo que se pidió realmente. Los prompts siguientes se agregan uno por etapa, al final.

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

---

## Prompt 7: Precio y stock en los scrapers

**Prompt (condensado):**
> En base a estos 3 scrapers, además del nombre de cada producto, obtén el precio y si hay stock. Te pego el código fuente de Winpy (procesadores) y el de PC Express (RAM de PC).

**Resultado obtenido:**
- El asistente pidió ver primero el HTML real de cada tienda antes de escribir los selectores, para no dejar precios vacíos sin aviso.
- **`winpy.ts`:** precio desde `p.valor`, guardado como entero en pesos chilenos. Stock: `true` si la tarjeta tiene el botón "Retiro Inmediato" o "Despacho Express", y `null` (no se sabe) si no trae ninguno, porque el listado nunca dice "agotado". Con el HTML real de procesadores: 40 de 40 con precio, 30 con stock y 10 sin señal de stock. Prueba: `test_winpy_price.ts`.
- **`pcexpress.ts`:** precio vigente "Transferencia" (`.product-list__price`; en las ofertas se ignora el precio tachado). Stock: `true` si la tarjeta tiene el botón "Agregar al carro". Con el HTML real de RAM de PC: 20 de 20 con precio y stock (solo la página 1 de 4).
- Ambos scrapers ahora mandan `price`, `in_stock` y `price_updated_at` al guardar en Supabase.

**Decisiones propias:**
- Pedir el precio y el stock en los tres scrapers.
- Pegar el HTML real de Winpy y de PC Express (RAM de PC) para que el asistente probara con datos reales.
- Ejecuté el scraper de PC Express y funcionó bien.
- Ejecuté `winpy.ts cpu` con Supabase conectado: funcionó y los productos se guardaron con su precio y su stock.

**Pendiente de verificar:**
- Winpy: qué significa un producto sin botones de entrega (10 de 40, por ejemplo el Intel Core i3-12100): sin stock o entrega normal. Revisar su página de producto.
- PC Express: 3 productos en oferta muestran un precio anterior más bajo que el vigente (por ejemplo, Kingston `kf432c16bb/8`: tachado $85.000, vigente $93.900). Hoy se guarda el vigente; falta confirmar en la página cuál es el real.
- PC Express: cómo se ve un producto agotado (no apareció ninguno en el HTML).
- PC Express: el formato de precios de CPU y GPU no se verificó (solo RAM de PC).
- SP Digital quedó resuelto después (ver Prompt 10).

---

## Prompt 8: Base de datos completa

**Prompt (condensado):**
> Hagamos ahora la base de datos en Supabase.

**Resultado obtenido:**
- `database.sql`, que reemplaza a `simple.sql`. Tablas: `stores` y `products` (con precio, stock y fecha de precio), `price_history`, `store_branches`, `branch_hours`, `branch_stock`, `profiles` y `product_reviews`. Deja cargadas las 3 tiendas.
- **Historial de precios automático:** un trigger agrega una fila a `price_history` cuando un producto nuevo entra o cambia de precio o de stock. Los scrapers no cambian. No duplica filas si nada cambió, y no registra productos sin precio.
- **Sucursales:** coordenadas, un tramo horario por día y stock por sucursal. Incluye la función `nearby_branches(lat, lng, radio_km)` para buscar sucursales cercanas.
- **Seguridad (RLS):** el frontend, con la clave pública, solo puede leer datos públicos. Escriben solo los scrapers con la clave secreta. Cada usuario solo puede crear, editar o borrar sus propias reseñas y ver su propio perfil.
- Probado en un Postgres local que imita a Supabase: 14 pruebas (script re-ejecutable, historial, restricciones, cercanía de sucursales, perfil automático y permisos).

**Decisiones propias:**
- Hacer ahora la base de datos completa, en vez de seguir con la versión mínima.
- Ejecutar `database.sql` en Supabase (los productos llegaron con precio y stock al correr el scraper de Winpy).

**Supuestos del asistente por confirmar:**
- Las "reseñas" son opiniones de los usuarios de la plataforma (si son las calificaciones de las tiendas, la tabla cambia).
- Cada sucursal tiene un solo tramo horario por día, sin pausa de almuerzo.

**Pendiente de verificar:**
- Revisar que `price_history` se llene (y que una segunda corrida sin cambios no agregue filas); por ahora solo se confirmó `products`.
- Las tablas de sucursales, horarios y stock por sucursal quedan vacías hasta tener esos scrapers.
- Los perfiles son privados, así que el frontend no podría mostrar el nombre de quien escribió una reseña sin agregar una vista pública.

---

## Prompt 9: Conectar Supabase al proyecto

**Prompt (condensado):**
> Ayúdame a instalar Supabase en el proyecto. (Después aclaré que uso Vite, que instalé la librería con `deno install` en la carpeta raíz, que ya copié las claves, y pedí que me explicara la tabla `profiles`.)

**Resultado obtenido:**
- Supabase es un servicio en la nube, no se instala: se crea el proyecto, se ejecuta `database.sql` en el SQL Editor y se copian las claves de Settings → API Keys.
- **Claves:** la clave pública (`sb_publishable_...`) va en el frontend; la secreta (`sb_secret_...`) solo en los scrapers y nunca en git. Según la documentación de Supabase, las claves antiguas `anon` y `service_role` se dan de baja a fines de 2026.
- **Scrapers:** `winpy.ts` y `pcexpress.ts` se ajustaron para que la clave secreta nueva se mande solo en el encabezado `apikey` (las nuevas no son JWT). `spdigital.ts` falta.
- Variables: `scraper/.env` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; `frontend/.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Los `.env` van en `.gitignore`.
- Se comprobó que `deno install npm:@supabase/supabase-js` hace lo mismo que `deno add` (agrega la entrada a `deno.json`). Vite necesita `"nodeModulesDir": "auto"` para encontrar el paquete.
- Pasos para probar: correr `winpy.ts cpu`, revisar `products` y `price_history`, y volver a correrlo para ver que el historial no crece si los precios no cambiaron.
- Explicación de `profiles`: tabla propia, ligada a `auth.users`, que guarda el nombre y el idioma (`es` o `en`) de cada usuario. Se crea sola al registrarse y cada usuario solo ve la suya.

**Decisiones propias:**
- Usar Vite en el frontend.
- Instalar `@supabase/supabase-js` con Deno puro.
- El frontend sigue siendo solo una página de placeholder, por eso el cliente de Supabase se crea más adelante.
- Instalé la librería en la carpeta raíz; el asistente recomendó moverla a `frontend/` si este tiene su propio `deno.json`.
- Creé `scraper/.env` con la URL y la clave secreta, y corrí `winpy.ts cpu`: funcionó y los datos llegaron a Supabase.
- Comprobé que mi `.gitignore` de la raíz (línea `.env`) ignora `scraper/.env` con `git check-ignore -v`. `frontend/` tiene además su propio `.gitignore`.

**Pendiente de verificar:**
- Correr `pcexpress.ts` y las categorías RAM y GPU contra Supabase.
- Ubicar `@supabase/supabase-js` en el `deno.json` correcto y agregar `nodeModulesDir`.
- El ajuste de la clave nueva en `spdigital.ts` quedó hecho en el Prompt 10.

---

## Prompt 10: Precio y stock de SP Digital

**Prompt (condensado):**
> Como los precios de SP Digital se obtienen por JavaScript, ¿se puede completar el scraper con `fetch` o debo usar Playwright? (Después pregunté qué buscar en la pestaña Network y pasé el JSON que encontré: primero el de Procesador Intel y luego el de todos los procesadores.)

**Resultado obtenido:**
- **Corrección de la premisa:** los precios ya venían en el HTML; lo que se cargaba con JavaScript era el stock. Se explicó cómo buscar en DevTools → Network (filtro Fetch/XHR) la petición que trae los datos.
- **Hallazgo:** SP Digital está hecho con Gatsby y cada categoría tiene un JSON público, `/page-data/categories/<categoría>/page-data.json`, que la propia página pide. Trae para cada producto el nombre, el `slug`, los precios (`metadata.pricing`: `cash` = transferencia, `other` = otros medios) y el stock (`quantityAvailable`, `quantityInStore`, `quantityOnline`). También trae el horario de atención (`openingHours`) y dos bodegas. No hace falta Playwright.
- **`scraper/spdigital.ts` reescrito** para leer ese JSON en vez de parsear HTML (ya no usa `linkedom`). Guarda el precio de transferencia (`cash`) y `in_stock = quantityAvailable > 0`. La URL del producto es `https://www.spdigital.cl/<slug>/`. Mantiene la espera de 5 s, se detiene ante 403, 429 o 503 sin intentar esquivar el bloqueo, y avisa si una categoría tiene más de una página. Envía la clave secreta nueva de Supabase solo en `apikey`.
- **Pruebas** (`test_spdigital_price.ts`): con el JSON real, 8 de 8 procesadores con precio y stock; los 3 de Procesador Intel coinciden con los de la categoría completa; 10 casos límite (agotado, sin precio, precio mal formado, sin slug, varias páginas, etc.).
- Ejecuté `spdigital.ts cpu` y funcionó.

**Decisiones propias:**
- Buscar yo mismo en la pestaña Network en vez de pasar a Playwright.
- Pasar los dos JSON (Procesador Intel y todos los procesadores) para que el asistente viera el formato real.

**Supuestos del asistente por confirmar:**
- El campo `cash` es el precio de transferencia que muestra la web (por ejemplo, $229.990 para el i3-13100F). No se usa `pricing.priceRange`, porque no coincide con ese valor.

**Pendiente de verificar:**
- Los JSON de RAM y GPU (`componentes-memorias-ram` y `componentes-tarjeta-de-video`) se suponen con el mismo formato, pero no se han visto.
- (Revisado después: el `robots.txt` de SP Digital sí permite `/page-data/`.)
- El JSON trae solo la primera página (hasta 48 productos); hoy las categorías caben.
- El listado oculta los productos agotados, por eso casi todo queda con `in_stock = true`.
- Guardar `quantityInStore` y `quantityOnline` en `branch_stock` y usar `openingHours` cuando se hagan los datos por sucursal (hoy no se guardan).

---

## Prompt 11: Primera página del frontend (lista de productos)

**Prompt (condensado):**
> Tengo una base de datos y sus credenciales públicas están en un archivo `.env`. Quiero hacer una página de frontend para leer los datos. (Después pedí que, para partir, solo se muestre el nombre del producto y un precio de referencia. Pegué una captura de la estructura del proyecto y los errores que fueron apareciendo.)

**Resultado obtenido:**
- Tres archivos en `frontend/src/`: `supabase.ts` (cliente de Supabase con la clave pública), `App.tsx` y `App.css`.
- Primera versión con buscador, filtro por tienda, orden y "solo con stock". La simplifiqué a lo que pedí: una tabla con **nombre** y **precio de referencia** (formato CLP), ordenada por nombre, con un máximo de 1000 filas por consulta. Los productos sin precio muestran "—".
- Se corrigieron tres problemas al probarla:
  - **Mayúsculas en los nombres de archivo:** mis archivos se llaman `app.tsx` y `app.css` (minúscula), y el asistente asumió `App`. Se corrigió el import dentro de `app.tsx` a `./app.css`, sin renombrar nada.
  - **Pantalla en negro:** `supabase.ts` lanzaba un error porque en mi `.env` la clave se llama `VITE_SUPABASE_ANON_KEY`, no `VITE_SUPABASE_PUBLISHABLE_KEY`. Ahora `supabase.ts` acepta `VITE_SUPABASE_ANON_KEY`.
  - **Reinicio de Vite:** hay que detener y volver a levantar Vite cada vez que cambia el `.env`.
- Verificado: la página carga y muestra los productos de la base de datos.

**Decisiones propias y correcciones al asistente:**
- Partir con solo nombre y precio, y agregar el resto después.
- Dejar los archivos en minúscula (`app.tsx`, `app.css`) en vez de renombrarlos.
- Corregí al asistente: mi `main.tsx` importaba `./app.css` y `./app.tsx` en minúscula, no con mayúscula.
- Usar al principio la clave `anon` que ya tenía en el `.env`. Después la cambié por la clave `sb_publishable_...`.

**Supuestos del asistente por confirmar:**
- La tabla `products` tiene las columnas `id`, `name` y `price` (la página funcionó, así que coinciden).

**Pendiente de verificar:**
- Paginar cuando haya más de 1000 productos.
- `app.css` se importa dos veces (en `main.tsx` y en `app.tsx`); quitar uno.
- Agregar tienda, buscador, filtro de stock, categorías y presupuesto.

---

## Prompt 12: Ejecutar todos los scrapers con un solo comando

**Prompt (condensado):**
> Ya cambié la clave `anon` por la `publishable` en el `.env`, y revisé que el `robots.txt` de SP Digital permite `/page-data/`. Necesito un `deno task` que ejecute los scrapers de forma automatizada, para que después, al hacer el deploy, corran una vez al día con un cronjob (eso lo veo después).

**Resultado obtenido:**
- Primero se hizo un script (`run_all.ts`) con resumen final y código de salida; después se descartó a favor de tareas en `scraper/deno.json`, que es más simple.
- Tareas: `scrape:winpy`, `scrape:pcexpress` y `scrape:spdigital`, cada una con sus 3 categorías (cpu, ram y gpu) unidas con `;`, y la tarea `scrape`, que lanza las 3 tiendas en paralelo con `dependencies`.
- Se usa `;` en vez de `&&`, para que si una categoría falla, las demás se ejecuten igual: siempre corren los 9 scrapers.
- Las tiendas corren en paralelo (son sitios distintos) y las categorías de una misma tienda en serie, para respetar el `crawl-delay` de cada sitio.
- No se puede elegir tienda ni categoría desde `deno task scrape`.
- Limitación aceptada: con `;` el código de salida de cada tienda es el del último comando, así que un cronjob no detecta fallos de CPU o RAM, y no hay resumen final. Las tareas con `dependencies` requieren Deno 2.1 o más nuevo.

**Decisiones propias:**
- Dejar el cronjob del deploy para después.
- Pedir que siempre se ejecuten todos los scrapers (CPU, RAM y GPU de las 3 tiendas), sin opción de elegir solo algunos. Los argumentos de tienda y categoría que tenía la primera versión se quitaron.
- Ejecuté `deno task scrape` y funcionó muy bien.
- Mantener mis permisos (`--allow-net --allow-env`) en vez de `-A` y agregar `--env-file=.env`. Las nuevas tareas reemplazan a mis tareas anteriores `winpy`, `pcexpress` y `spdigital` en `scraper/deno.json`.
- Preferir tareas de `deno.json` en vez de un script completo, y usar `;` en lugar de `&&` para que no se detengan los demás scrapers si uno falla. El asistente recomendaba el script (por el resumen y el código de salida), pero elegí lo simple.
- Cambiar la clave `anon` por la `publishable` en el `.env`.
- Revisar yo mismo que el `robots.txt` de SP Digital permite `/page-data/`.

**Pendiente de verificar:**
- Revisar en Supabase que los datos de RAM y GPU de las 3 tiendas hayan llegado bien (la corrida de `deno task scrape` funcionó, pero solo se revisó la ejecución).
- Con 3 tiendas en paralelo, la corrida dura lo que tarde la más lenta (Winpy, con 10 s entre peticiones).

---

## Prompt 13: Buscador y filtros en el frontend

**Prompt (condensado):**
> En base a lo que está en graphify, necesito que me generes un frontend para esta aplicación donde pueda filtrar y buscar por tipo de producto y categoría los productos deseados. También añade un buscador de texto para buscar los productos.

**Resultado obtenido:**
- `frontend/src/app.tsx` reescrito con:
  - pestañas de categoría (CPU, GPU y RAM) con contador;
  - buscador sin tildes ni mayúsculas que exige todas las palabras escritas;
  - filtro por tienda, precio máximo y "solo con stock";
  - orden por nombre o precio y botón "Limpiar filtros";
  - tabla con producto (enlace a la tienda), categoría, tienda, stock y precio;
  - paginación de 50 filas.
- La carga ahora trae todos los productos en páginas de 1000 (antes el máximo era 1000).
- Verificado: `tsc`, `oxlint` y `vite build` sin errores. No se probó en el navegador en ese momento.

**Decisiones propias:**
- Pedir el frontend apoyándome en el grafo de graphify.
- "Tipo de producto" se interpretó como categoría + tienda, porque la base no tiene otro nivel.

**Supuestos del asistente por confirmar:**
- Que "tipo de producto" significa categoría y tienda.

**Pendiente de verificar:**
- Probar la página en el navegador con los datos reales.

---

## Prompt 14: SSO con Google, subpágina de producto, reseñas, guardados y comparación

**Prompt (condensado):**
> Quiero integrar SSO para comentar reseñas en los productos, poder guardar productos para comparar precios entre ellos, y un gráfico de precio histórico por producto. Cada producto debe tener su propia subpágina que muestre todas las tiendas que lo venden. Usa superpowers y apóyate en graphify. (Describí el flujo: lista con filtros, clic en un producto, subpágina con las tiendas ordenadas de menor a mayor precio, comentarios con SSO abajo, botón de guardar y un gráfico que junte las tiendas SP Digital, Winpy y PC Express.)

**Resultado obtenido:**
- Con el brainstorming (y bocetos en el navegador) salió un diseño y un plan (`docs/superpowers/`). El asistente notó que cada fila de `products` es de una sola tienda y los nombres cambian entre tiendas (por ejemplo, el Ryzen 5 7600 en Winpy y en PC Express), así que hacía falta **agrupar**.
- **Migración 002** (`supabase/migrations/002_grupos_resenas_guardados.sql`, explicada en `docs/migracion-002.md`): tabla `product_groups`, columnas `group_id` y `group_locked` en `products`, reseñas por grupo y tabla `saved_products`, con RLS. Se probó en un Postgres local con podman (13 casos: permisos, nombre no falsificable y ejecutable dos veces).
- **Agrupador** (`scraper/group_key.ts` y `group.ts`, tarea `deno task group`): sobre los 417 productos salieron 252 grupos; 59 productos sin patrón quedan solos.
- **Frontend:**
  - lógica pura con 11 pruebas (`src/lib/`: búsqueda, ofertas vigentes e historial);
  - rutas, sesión con Google y contexto de guardados;
  - lista en cuadrícula;
  - subpágina de producto con tiendas, gráfico de precio histórico (recharts) y reseñas con estrellas;
  - página Guardados con comparación lado a lado.
- Commits en `dev`: 9c6ac24, 396e851, a023a1b, 76c2572, 87f0abb, c97aab1, d5146f0 y 1b35c24.

**Decisiones propias:**
- Agrupar automáticamente aceptando errores por ahora, y corregir a mano después.
- Lista en cuadrícula con imagen placeholder (`PlaceholderLC.png`), también en la subpágina.
- Comparación con la opción A (tabla lado a lado), en una página "Guardados" del menú superior ligada al inicio de sesión.
- Reseñas con estrellas y el nombre de la cuenta de Google.
- Regla de ofertas vigentes: vista en los últimos 3 días y no agotada.
- Pedí que se me explicara la migración 002 antes de seguir, y que se anotara en `docs/migracion-002.md`.
- Elegí la ejecución con subagentes y pedí actualizar graphify, el README y esta autoría.

**Supuestos del asistente por confirmar:**
- El nombre de la reseña se toma de `auth.identities` (Google) y no de `raw_user_meta_data`, porque el usuario puede editar este último.
- La migración borra todas las políticas viejas de `product_reviews`, porque el `database.sql` original no está en el repositorio.
- Solo funciona en local (`localhost:5173`) por ahora.
- Se usan react-router y recharts; `deno task group` es una tarea aparte y corre al final de `deno task scrape`.
- Una oferta sin precio no es vigente.
- RAM distingue ECC/RDIMM y la línea Fury; GPU agrupa por fabricante + chip + VRAM, así que variantes de una misma marca (por ejemplo, ASUS TUF y ROG Astral 5080) quedan juntas hasta corregirlas a mano.

**Pendiente de verificar:**
- Configurar Google OAuth en Google Cloud y en Supabase.
- Ejecutar la migración 002 en Supabase y luego `deno task group` contra la base real.
- Probar en el navegador: iniciar sesión, guardar y quitar, publicar, editar y borrar una reseña, el gráfico, `/producto/no-existe`, 360 px de ancho y modo oscuro.
- Revisar grupos mal agrupados (GPU de una misma marca con distinto modelo de placa; RAM de distintos colores o variantes) y corregirlos con `group_locked`.
- El bundle pesa unos 870 kB por recharts; se puede cargar el gráfico de forma diferida.

---

## Prompt 15: Correcciones, guía de Google y ejecución diaria automática

**Prompt (condensado):**
> Revisión y correcciones tras la entrega anterior. Pregunté si los scripts de auth, Supabase y guardados no deberían ir en una carpeta `backend` o `api` (usando graphify para visualizar el proyecto), y pedí que el scraper y el agrupador se ejecuten solos una vez al día. Pregunté si Vercel podía correr ese cron. Después pedí commitear a `origin dev` y actualizar esta autoría.

**Resultado obtenido:**
- **Correcciones** (commits en `dev`):
  - `31bdbf7`: el trigger de reseñas fija `created_at` y `group_id`, y el comentario tiene largo máximo (con pruebas nuevas en `supabase/tests/002_test.sql`).
  - `4fafcae`: el "On-Die ECC" de la DDR5 ya no marca el grupo como ECC (`group_key.ts`, con prueba).
  - `e7f4e66`: Guardados muestra también grupos sin ofertas; el catálogo guarda búsqueda, filtros, orden y página en la URL; el gráfico llega hasta hoy con eje de tiempo; guardar/quitar ignora clics repetidos.
  - `3424069`: README al día (`scraper/.env`, `deno install`, RLS, pruebas desde la raíz y cómo vaciar un grupo a mano).
- **Documentación:** guía `docs/configurar-google.md` (paso a paso del inicio de sesión con Google) y `frontend/vercel.json`, con un rewrite a `index.html` para que funcionen las rutas como `/producto/...` al desplegar (commit `3e94cda`).
- **Ejecución diaria:** `.github/workflows/scrape.yml` (GitHub Actions) corre todos los días a las 07:00 UTC, o a mano con *Run workflow*. Ejecuta las pruebas del agrupador y luego `deno task scrape` (los 9 scrapers y el agrupado). Usa los secrets `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (commit `d7cd4ec`).
- **Sobre la carpeta `backend`/`api`:** según el grafo, auth, guardados y Supabase son código de cliente (React sobre Supabase con RLS), así que no corresponde moverlos a un backend. La parte de servidor real ya está en `scraper/` y `supabase/`. La carpeta `api/` sigue vacía y reservada.

**Decisiones propias:**
- Usar GitHub Actions y no el cron de Vercel: las funciones serverless tienen un tope de tiempo, los scrapers son de Deno y la corrida es lenta por los `crawl-delay`.
- Dejar Vercel solo para el frontend.
- No mover los scripts de auth y guardados a un backend.

**Supuestos del asistente por confirmar:**
- La hora del cron (07:00 UTC, de madrugada en Chile) y el límite de 180 minutos por corrida.
- El workflow no se ha probado: los `schedule` de GitHub solo corren desde la rama por defecto (`main`).

**Pendiente de verificar:**
- Hacer merge de `dev` a `main`, crear los dos secrets en el repo y lanzar el workflow a mano para comprobar que termina bien.
- Decidir qué hacer con la carpeta `api/` vacía (borrarla o usarla).

---

## Prompt 16: Imagen de los productos

**Prompt (condensado):**
> Pedí implementar la extracción de la imagen de los productos para mostrarla en el frontend, trabajando de forma estructurada con superpowers (brainstorming, plan y ejecución con subagentes y revisión por tarea), anotar el prompt resumido en esta autoría y actualizar graphify. Noté que el frontend ya mostraba `image_url` con un placeholder. Ante el bloqueo de PC Express (responde 403 a las imágenes pedidas desde otro sitio) elegí respetarlo y dejar el placeholder. Pedí una sola foto por producto y dije que no había que preocuparse por el cron diario (07:00 UTC) respecto al orden de la migración.

**Resultado obtenido:**
- **Commits en `dev`:**
  - `18d5af5`: migración 003, columna `products.image_url` (`supabase/migrations/003_imagen_producto.sql`, prueba en `supabase/tests/003_test.sql`, `run_002.sh` ahora corre también la 003, explicada en `docs/migracion-003.md`).
  - `bb82cc6`: SP Digital guarda la imagen del producto (`media[0].limitedUrl` de 512 px de la primera entrada IMAGE, o `thumbnail.url` si no hay; solo https; prueba en `scraper/spdigital_test.ts`).
  - `126b4d1`: Winpy guarda la imagen en tamaño completo (el `<img>` de cada artículo sin el prefijo `tumb_`; solo https; prueba en `scraper/winpy_test.ts`).
  - `8866b14`: el agrupado elige la imagen del grupo (`pickGroupImage` en `group.ts`, SP Digital > Winpy) y la escribe en `product_groups.image_url`; las filas con `group_locked` no se consideran (prueba en `scraper/group_test.ts`).
  - `d95ff75`: placeholder cuando la imagen no carga (`frontend/src/components/product-image.tsx`, usado en la tarjeta, la página del producto y Guardados).
- **PC Express:** no se extrae imagen; usa el placeholder.
- **Plan:** `docs/superpowers/plans/2026-11-12-imagen-producto.md`.
- **Grafo:** se actualizó el grafo de conocimiento con `graphify update .`.

**Decisiones propias:**
- Respetar el bloqueo de PC Express y mostrar el placeholder.
- Una sola foto por producto.

**Supuestos del asistente por confirmar:**
- La prioridad SP Digital > Winpy para elegir la foto del grupo.
- Los tamaños: SP Digital 512 px y Winpy tamaño completo.
- Las imágenes se enlazan directo desde la tienda (no se copian a Supabase Storage).
- Las filas con `group_locked` no aportan foto al grupo.

**Verificado por el autor:**
- Migración 003 ejecutada en Supabase, scrapers y agrupado corridos contra la base real.
- En el navegador la imagen del producto se ve nítida, y cuando no hay imagen aparece el placeholder.

---

## Prompt 17: Botón oficial de Google

**Prompt (condensado):**
> Pedí reemplazar los botones caseros de inicio de sesión (arriba en cada página y en las reseñas de la página de producto) por el botón con el diseño oficial de Google. Ante dos opciones (un botón propio siguiendo la guía de marca o el botón que dibuja el script oficial de Google Identity Services), pregunté el esfuerzo de la segunda y la elegí porque me pareció más segura; el asistente aclaró que ambas son seguras y que la diferencia es de experiencia (el script puede mostrar "Continuar como…"). Pedí obligar a usar el script oficial: sin respaldo si no carga y sin el aviso flotante (One Tap). Pedí también los pasos para Supabase y Google Cloud Console.

**Resultado obtenido:**
- **Commits en `dev`:**
  - `7aa4bae`: nonce para el inicio de sesión (`frontend/src/lib/nonce.ts`, con pruebas).
  - `4724a07`: botón oficial de Google con `signInWithIdToken` (`frontend/src/google.ts`). `LoginButton` ahora es el espacio donde Google dibuja su botón, en los 4 lugares (barra superior, reseñas, guardar y Guardados). Se quitó el flujo con redirección.
  - `767d8d6`: `docs/configurar-google.md`, README y esta autoría.
  - `3a6a1e3`: ajustes de la revisión final: la causa correcta del error de nonce (no activar "Skip nonce check"), el error "Unacceptable audience", volver a desplegar en Vercel después de definir la variable, la demora de Google en aplicar orígenes nuevos, y un `.catch` para que un error al dibujar el botón quede como aviso en la consola.
- **Proceso:** brainstorming → plan (`docs/superpowers/plans/2026-11-12-boton-google-oficial.md`) → una tarea por subagente con revisión de cada una → revisión final de la rama completa, sin problemas que bloquearan. Pruebas: 17 del frontend pasan, build y lint sin errores nuevos.
- **Cómo funciona:**
  - El script de Google se carga una sola vez.
  - Google recibe el nonce con hash y, al iniciar sesión, entrega un token.
  - La app pasa ese token a Supabase junto con el nonce original.
  - La sesión que queda es la misma de antes, así que reseñas, guardados y "Salir" no cambian.
  - Si falta `VITE_GOOGLE_CLIENT_ID` o el script no carga, no se muestra el botón (solo un aviso en la consola).
- **Documentación:** `docs/configurar-google.md` y el README con los pasos nuevos (orígenes `http://localhost:5173` y `http://localhost` en Google Cloud, `VITE_GOOGLE_CLIENT_ID` en `frontend/.env`, Client IDs en Supabase) y una tabla de errores comunes.
- **Grafo:** se actualizó el grafo de conocimiento con graphify (código y documentos).

**Decisiones propias:**
- Usar el script oficial de Google.
- Sin respaldo si el script no carga.
- Sin One Tap.

**Supuestos del asistente por confirmar:**
- Tema claro u oscuro según el sistema.
- Tamaño mediano en la barra y grande en el resto.
- Frases de contexto fuera del botón, porque Google no permite cambiar su texto.
- Los errores de inicio de sesión se muestran con `alert`.
- El nonce se crea una vez por carga de página.

**Pendiente de verificar:**
- Agregar los orígenes en Google Cloud, poner `VITE_GOOGLE_CLIENT_ID` en `frontend/.env` (y en Vercel al publicar) y revisar la lista Client IDs en Supabase.
- Probar iniciar y cerrar sesión, reseñas y guardados.

---

## Prompt 18: Geolocalización y horarios de las tiendas

**Prompt (condensado):**
> Pedí mostrar en la página de cada producto la dirección de cada tienda, la distancia desde el usuario, si está abierta o cerrada y su horario, y poder ordenar las ofertas por precio o distancia, trabajando con superpowers (brainstorming con bocetos, diseño, plan y ejecución con subagentes). Elegí las tarjetas (opción B). Dije que lo ideal es que el usuario dé permiso de ubicación y que, sin permiso, elija región y comuna de una lista, con la distancia medida desde el centro de la comuna. Pedí un archivo fijo de comunas generado una sola vez desde OpenStreetMap, ignorar el stock por sucursal y suponer que cada tienda tiene una sola sucursal (la casa matriz). Aprobé las direcciones y horarios tal como están en los sitios oficiales, incluido el "Lunes a Martes" de Winpy. Pedí no commitear en `dev` (todo en `feat/geolocalizacion`). Cuando los servidores de Overpass respondían 502/504 pedí detener la generación de comunas y correrla a mano más adelante.

**Resultado obtenido:**
- **Commits en `feat/geolocalizacion`:**
  - `c4e1dc9`: diseño y plan (`docs/superpowers/specs/2026-11-12-geolocalizacion-horarios-design.md` y su plan).
  - `747c5e0`: dirección, coordenadas y horario de las 3 tiendas, con sus fuentes (`docs/migracion-004.md`).
  - `51c2da7` y `3e6c695`: script que genera el archivo de regiones y comunas (`scraper/comunas.ts`, `deno task comunas`), con reintentos, timeout y solo comunas miembros de la región.
  - `9cc763c`: migración 004 (`supabase/migrations/004_ubicacion_tiendas.sql`): dirección, coordenadas y horario de las tiendas, sucursal única por tienda, RLS de lectura.
  - `5b7deb8`: distancia y estado abierta/cerrada con hora de Chile (lógica pura en `frontend/src/lib/`, con pruebas).
  - `82fc8b9`: ordenar ofertas por distancia.
  - `81df122` y `35462e9`: ubicación del usuario con GPS o comuna (`frontend/src/location.tsx`), y la lib de ubicación sin depender del archivo de comunas generado.
  - `5711656`: tarjetas de tienda con distancia, horario y orden.
- **Proceso:** brainstorming con bocetos, diseño (revisado por un subagente), plan, y un subagente por tarea con revisión de cada una.
- **Comunas:** la lista de regiones y comunas se obtiene con Overpass (OpenStreetMap), siguiendo región, provincias y comunas por pertenencia (`subarea`). Nominatim se usó solo para geocodificar las 3 direcciones de las tiendas.
- **Horarios:** PC Express cierra a almorzar, así que la clave primaria de `branch_hours` pasó a `(branch_id, weekday, opens)` para guardar dos tramos el mismo día.
- **Quedó fuera:** stock por sucursal (`branch_stock`) y `nearby_branches`, sin usar.
- **Plan:** `docs/superpowers/plans/2026-11-12-geolocalizacion-horarios.md`.
- **Grafo:** se actualizó el grafo de conocimiento con `graphify update .`.

**Decisiones propias:**
- Mostrar las tiendas como tarjetas (opción B).
- Sin permiso de ubicación, elegir región y comuna de una lista, midiendo la distancia desde el centro de la comuna.
- Archivo fijo de comunas generado una vez desde OpenStreetMap.
- Ignorar el stock por sucursal.
- Una sola sucursal por tienda (la casa matriz).
- Aprobar las direcciones y horarios como están en los sitios oficiales, incluido el "Lunes a Martes" de Winpy.
- Ejecutar con subagentes y no commitear en `dev`.
- Detener la generación de comunas por los errores 502/504 de Overpass y correrla a mano más adelante.

**Supuestos del asistente por confirmar:**
- Datos de las tiendas escritos a mano en la migración 004, sin scrapers.
- La app pide la ubicación al navegador en la primera visita a un producto; si se niega o falla, aparecen las listas de región y comuna.
- Se guarda en `localStorage` el modo elegido (navegador o comuna) y la comuna; las coordenadas exactas del GPS no se guardan.
- "Cambiar" abre las listas, con un botón "Usar mi ubicación" para volver al modo navegador.
- Distancia en línea recta (Haversine), con una decimal y coma decimal.
- Abierta o cerrada según la hora de Chile (`America/Santiago`), no la del computador.
- Al ordenar, las ofertas vigentes van antes que las atenuadas; en "Distancia", el empate se resuelve por precio.
- Una tienda sin dirección u horario muestra un aviso y queda al final al ordenar por distancia.
- El orden elegido no se recuerda entre visitas (parte en Precio).
- Se usa el horario de atención presencial (retiro y pago en tienda).
- Coordenadas de las tiendas obtenidas con Nominatim a partir de la dirección oficial.

**Pendiente de verificar:**
- ~~Generar `frontend/src/data/comunas.ts` con `deno task comunas`~~: reemplazado en el Prompt 19 (sin comunas; distancias solo con permiso de ubicación).
- Ejecutar la migración 004 en Supabase (SQL Editor) antes de desplegar; si no, todas las tarjetas muestran "Sin dirección registrada".
- ~~Probar en el navegador con listas de región y comuna~~: reemplazado por la prueba del Prompt 19 (sin comunas), más "Ver horario", 360 px y modo oscuro.
- Confirmar con Winpy si su horario es "Lunes a Martes" o "Lunes a Jueves".

---

## Prompt 19: Distancias solo con permiso de ubicación

**Prompt (condensado):**
> Pedí revisar con graphify cómo quedó la geolocalización y, con superpowers, reemplazar el script de Overpass (saturado) por un JSON fijo de regiones y comunas que entregué, para medir la distancia desde el centro de la comuna cuando el usuario no da permiso. Elegí obtener las coordenadas una vez con Nominatim (opción A). Mientras se consultaba, cambié el plan: si no se acepta la ubicación, simplemente no se activa el cálculo de distancias, y se elimina todo lo de comunas.

**Resultado obtenido:**
- **Commits en `feat/geolocalizacion`** (fusionada en `dev` sin commit de merge, rama borrada):
  - `05a1eeb` y `fca441f`: diseño y plan de comunas fijas (quedaron reemplazados).
  - `7a30848`: diseño y plan de ubicación solo con GPS (`docs/superpowers/specs/2026-11-16-ubicacion-solo-gps-design.md` y su plan).
  - `54774c2`: el frontend solo usa la ubicación del navegador. Estados `inicial`, `buscando`, `gps` y `sin-ubicacion`; sin `localStorage`; sin permiso la barra dice "Activa tu ubicación para ver la distancia a cada tienda" con el botón "Usar mi ubicación" y una nota, y el botón "Distancia" se oculta.
  - `c9a3add`: se eliminaron `scraper/comunas.ts`, su prueba, la tarea `deno task comunas` y `scraper/.cache/` del `.gitignore`; README y esta autoría actualizados.
  - `172b5da`: corrección de la revisión final (prueba con comunas del Prompt 18 marcada como reemplazada).
- **Revisión final** (revisor independiente): sin problemas críticos ni importantes. Quedaron como menores: el botón "Distancia" aparece si alguna sucursal tiene coordenadas aunque no venda ese producto; sin `navigator.geolocation` (sitio sin HTTPS) el botón "Usar mi ubicación" no sirve; una línea en blanco de más en `app.css`.
- **Nominatim:** la consulta de comunas llegó a 293 de 294 comunas (sin la Región Metropolitana) antes de detenerla; no se usó.

**Cambio de decisión sobre la geolocalización:**
- **Antes (Prompt 18):** con permiso se usaba el GPS; sin permiso, el usuario elegía región y comuna de una lista y la distancia se medía desde el centro de la comuna. La lista se iba a generar con un script contra Overpass (OpenStreetMap), que nunca terminó por errores 502/504, y sin ese archivo el frontend no compilaba.
- **Intento intermedio:** usar un JSON fijo de regiones y comunas entregado por mí, con las coordenadas de cada comuna consultadas una vez en Nominatim.
- **Decisión final:** quitar las comunas. Si el usuario no da permiso de ubicación, no se calculan distancias ni se ofrece ordenar por distancia. Motivo: simplificar y no depender de una lista de comunas ni de servicios externos saturados.

**Decisiones propias:**
- Usar el JSON de comunas entregado y la opción A para las coordenadas (luego descartado).
- Sin permiso de ubicación no hay distancias ni orden por distancia; eliminar todo lo de comunas.
- Ejecución directa (sin subagentes por tarea).
- Fusionar en `dev` (local, sin push) aunque la geolocalización no se haya podido confirmar en mi equipo, dejándolo como pendiente.

**Supuestos del asistente por confirmar:**
- No se guarda nada en `localStorage`: el navegador ya recuerda el permiso.
- El botón "Distancia" se oculta (no se deshabilita) sin ubicación.
- Con la ubicación activa no hay botón "Cambiar" (no hay otro modo).

**Pendiente de verificar:**
- Probar en el navegador: ubicación aceptada (distancias y orden), negada (barra con "Usar mi ubicación" y nota, sin distancias ni "Distancia") y aceptada después de 10 s.
- En mi equipo (Firefox 156, Fedora, Hyprland) Firefox pide el permiso pero no entrega la ubicación: `getCurrentPosition` termina con `ERROR 3` (tiempo agotado), con `geo.provider.use_geoclue` en `true` y en `false`. La app reacciona bien a ese error (muestra "Activa tu ubicación"), pero falta confirmar que muestra las distancias cuando sí hay ubicación: probar desde el celular, otro navegador o simulando la ubicación en Chrome (DevTools → Sensors → Location).

---

## Prompt 20: Multilenguaje propio

**Prompt (condensado):**
> Pedí empezar el multilenguaje sin API externa (como Google Translate), usando una herramienta tipo i18n; elegí guardar el idioma también en el perfil (opción B) y usar i18next (opción A); pasé el resultado de una consulta sobre `profiles` en Supabase; aprobé el diseño y pedí implementarlo con subagentes.

**Resultado obtenido:**
- **Commits en `feat/multilenguaje`** (diseño: `docs/superpowers/specs/2026-11-16-multilenguaje-design.md`; plan: `docs/superpowers/plans/2026-11-16-multilenguaje.md`):
  - `1687165`: migración 005 (`supabase/migrations/005_idioma_perfil.sql`): quita el default `'es'` de `profiles.language` (solo la primera vez, deja `null` en las filas existentes), restringe a `es`/`en`/`null`, quita a `anon` y `authenticated` todos los permisos sobre `profiles` y deja `select` + `update (language)` a `authenticated`, y reemplaza la política `perfil propio: editar` por `profiles_update_own_language`. Pruebas `005_prep.sql`, `005_test.sql` y `005_rerun_test.sql` en `run_002.sh`; guía `docs/migracion-005.md`.
  - `270c89a`: base de i18n con i18next 27.1.3 y react-i18next 18.0.2; traducciones escritas a mano en `frontend/src/i18n/es.ts` y `en.ts` (tipo `Messages`: una clave faltante es error de compilación); `messages.test.ts` (mismas claves, sin textos vacíos, mismas variables); `frontend/src/lib/locale.ts`.
  - `42d9fd6`: `LanguageProvider`/`useLanguage` (`frontend/src/language.tsx`), botón "ES / EN" en la barra, textos de catálogo y guardados, `formatClp(valor, locale)`.
  - `41a9ebf`: subpágina de producto, horarios, gráfico y reseñas traducidos; `hours.ts` devuelve datos (no texto), `formatKm(km, locale)`, gráfico y fechas según el idioma, botón de Google con el idioma activo.
  - `bfcc8b5`: el idioma se guarda en el perfil y lo sigue al iniciar sesión.

**Decisiones propias:**
- Multilenguaje propio sin APIs externas (requisito del enunciado); español e inglés.
- Idioma guardado en el navegador y en `profiles.language` (opción B).
- i18next + react-i18next (opción A).
- Consulté en Supabase el estado real de `profiles` para ajustar la migración 005.
- Pedí ejecutar con subagentes.

**Supuestos del asistente por confirmar:**
- Formatos `es-CL` y `en-US`; los precios siempre en CLP (`$89.990` / `CLP 89,990`).
- Selector ES/EN en la barra; detección inicial por `navigator.language`.
- Al iniciar sesión manda el perfil; si está vacío, se guarda el idioma actual.
- La 005 quita el default `'es'` y deja `null` en el perfil existente, y restringe permisos: ya no se puede editar `display_name`, insertar ni borrar perfiles.
- El autor "Usuario" de las reseñas se traduce en el frontend; los nombres de sucursal no se traducen porque no se muestran.

**Pendiente de verificar:**
- Ejecutar la migración 005 en Supabase (`docs/migracion-005.md`).
- Probar en el navegador ES/EN en catálogo, producto, guardados, horarios, gráfico, reseñas y botón de Google, recarga, 360 px y modo oscuro.
- Con sesión: (a) en EN sin sesión, iniciar sesión con perfil `null` sigue en EN y la fila queda `en`; (b) cambiar a ES con sesión deja la fila `es`; (c) borrar localStorage, navegador en inglés e iniciar sesión cambia a ES; (d) sin red, cambiar idioma cambia igual y aparece un `console.warn`.
- Revisar la redacción en inglés.

---

## Por hacer (estado actual)

- [x] Precio y stock en los scrapers de Winpy, PC Express y SP Digital (SP Digital probado con procesadores).
- [x] Diseñar la base de datos completa (`database.sql`).
- [x] Ejecutar `database.sql` en Supabase y probar `winpy.ts cpu` contra ella (productos con precio y stock guardados).
- [x] Primera página del frontend: lista de productos con nombre y precio, leída desde Supabase.
- [x] Revisar `price_history` y repetir la corrida para ver que no duplica filas.
- [x] Revisar en Supabase los datos de PC Express, y de RAM y GPU de las 3 tiendas.
- [x] Revisar que el `robots.txt` de SP Digital permita `/page-data/` (lo permite).
- [x] Probar `deno task scrape` (ejecuta los 9 scrapers): funcionó bien.
- [x] Programar `deno task scrape` una vez al día (GitHub Actions, `.github/workflows/scrape.yml`).
- [x] Probar el workflow diario: merge a `main`, crear los secrets y lanzarlo a mano.
- [x] Imagen del producto: SP Digital y Winpy la guardan y el agrupado elige una por grupo; PC Express usa el placeholder (su servidor bloquea imágenes pedidas desde otro sitio).
- [x] Geolocalización de tiendas: tarjetas con dirección, distancia, abierta/cerrada y horario, y orden por precio o distancia (fusionado en `dev`). La distancia solo aparece con permiso de ubicación; no hay selección de comuna (Prompt 19). Quedó fuera el stock por sucursal (`branch_stock`, y `quantityInStore`/`quantityOnline` de SP Digital) y `nearby_branches`.
- [x] Quitar las comunas: la distancia solo se calcula con permiso de ubicación y se eliminó el script de Overpass (Prompt 19).
- [x] Ejecutar la migración 004 en Supabase antes de hacer push de `dev` (si no, las tarjetas dicen "Sin dirección registrada").
- [x] Confirmar que aparecen las distancias con la ubicación activa: en Firefox con Hyprland la ubicación se agota (`ERROR 3`); probar en el celular, otro navegador o simulando la ubicación en Chrome.
- [x] Probar distancias y horarios en el navegador (ubicación aceptada, negada y aceptada después de 10 s, "Usar mi ubicación", "Ver horario", 360 px y modo oscuro).
- [x] Confirmar con Winpy si su horario es "Lunes a Martes" o "Lunes a Jueves".
- [x] Frontend: mostrar tienda, buscador, filtros (categoría, stock, presupuesto) y paginación.
- [x] SSO con Google, subpágina de producto con gráfico, reseñas, guardados y comparación (probado con Google y Supabase reales).
- [x] Configurar el botón oficial de Google (ver `docs/configurar-google.md`): orígenes en Google Cloud, el ID de cliente en la lista Client IDs de Supabase y `VITE_GOOGLE_CLIENT_ID` en `frontend/.env`. Probar iniciar sesión, cerrar sesión y volver a iniciar sin recargar, reseñas, guardados y el cambio de modo claro/oscuro.
- [x] Ejecutar la migración 002 en Supabase y correr `deno task group` contra la base real.
- [x] Ejecutar la migración 003 en Supabase y revisar las fotos en el navegador (imagen nítida y placeholder cuando no hay foto).
- [x] Probar en el navegador: sesión, guardados, reseñas, gráfico, `/producto/no-existe`, 360 px y modo oscuro.
- [ ] Foto de los grupos corregidos a mano: hoy `group.ts` no lee las filas con `group_locked = true`, así que un grupo formado solo por ellas queda con el placeholder. Hacer que esas filas también aporten foto antes de corregir los grupos de GPU y RAM.
- [x] Revisar los grupos mal agrupados (GPU y RAM) y corregirlos con `group_locked`.
- [ ] Cargar el gráfico de forma diferida (el bundle pesa unos 870 kB por recharts).
- [x] Multilenguaje propio (español e inglés con i18next, idioma en el perfil; Prompt 20).
- [ ] Ejecutar la migración 005 en Supabase (`docs/migracion-005.md`) y hacer la prueba manual del multilenguaje.
- [x] Cambiar la clave `anon` por la clave `publishable` en `frontend/.env`.

---

## Cómo seguir anotando

Para cada nuevo prompt, agrega una sección con este formato:

```
## Prompt N: título corto
**Prompt:** lo que se pidió, en pocas líneas
**Resultado obtenido:** qué entregó el asistente
**Decisiones propias:** qué decidí o corregí yo
```