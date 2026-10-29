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
- SP Digital sigue sin precio ni stock: falta el HTML de una tarjeta completa y de un producto agotado.

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
- Aplicar a `spdigital.ts` el ajuste de la clave nueva.

---

## Por hacer (estado actual)

- [x] Precio y stock en los scrapers de Winpy y PC Express.
- [ ] Precio y stock en el scraper de SP Digital (falta el HTML de una tarjeta completa y de un producto agotado).
- [x] Diseñar la base de datos completa (`database.sql`).
- [x] Ejecutar `database.sql` en Supabase y probar `winpy.ts cpu` contra ella (productos con precio y stock guardados).
- [ ] Revisar `price_history` y repetir la corrida para ver que no duplica filas.
- [ ] Probar PC Express, y RAM y GPU de Winpy y PC Express, contra los sitios reales y Supabase.
- [ ] Scrapers de sucursales, horarios y stock por sucursal.
- [ ] Empezar a hacer el frontend (hoy solo hay una página de placeholder).

---

## Cómo seguir anotando

Para cada nuevo prompt, agrega una sección con este formato:

```
## Prompt N: título corto
**Prompt:** lo que se pidió, en pocas líneas
**Resultado obtenido:** qué entregó el asistente
**Decisiones propias:** qué decidí o corregí yo
```