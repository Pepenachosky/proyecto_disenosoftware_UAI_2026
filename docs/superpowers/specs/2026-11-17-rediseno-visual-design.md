# Rediseño visual del frontend — diseño

## Intención

El autor siente que el sitio "se ve muy básico" y quiere que **parezca un cotizador profesional y moderno**. Hoy todo el estilo está en un solo `frontend/src/app.css` (669 líneas, CSS plano, sin variables), con la fuente del sistema, un único acento morado (`#6d4aff`) repetido a mano y el modo claro/oscuro resuelto solo por `color-scheme: light dark`.

El rediseño cambia **cómo se ve y cómo se ordena** el sitio (catálogo, subpágina de producto, guardados y barra de navegación). **No cambia lo que hace**: mismos datos, mismas consultas a Supabase, filtros en la URL, sesión con Google, guardados, reseñas, ubicación e idiomas.

Las direcciones, paletas y distribuciones se eligieron sobre bocetos en el navegador (sesión de brainstorming del 2026-11-17).

## Objetivos

- Identidad visual propia y coherente en todas las páginas: paleta, tipografía, espacios, radios, sombras y vidrio definidos una sola vez como variables de diseño.
- El usuario ve primero el **mejor precio y la comparación de tiendas**.
- Catálogo con filtros en barra lateral (escritorio) y en panel (celular).
- Totalmente responsive (exigencia del proyecto) y legible en modo claro y oscuro.

## No objetivos

- Cambiar datos, consultas, migraciones, scraper o lógica de negocio. Lo único nuevo que se calcula son datos derivados de lo que ya se carga (rango de precios y ahorro, límite de la barra de precio).
- Selector manual de tema claro/oscuro (se sigue la preferencia del sistema).
- Descuentos o "−X %" basados en el historial (se vio como ilustración en un boceto; queda fuera).
- Restilizar el botón de Google por dentro (lo dibuja el script oficial; solo se ubica y se eligen sus opciones).

## Anti-objetivos (sería un fracaso aunque se vea bien)

- Texto con contraste insuficiente (menos de 4.5:1 en texto normal), sobre todo encima del vidrio o de la luz ambiental.
- Que algo deje de funcionar: filtros que ya no se guardan en la URL, atajos de teclado o foco perdidos, el botón de Google que no aparece, ubicación u ordenar por distancia rotos.
- Textos que se cortan o desbordan en inglés (más largos) o en pantallas de 360 px; scroll horizontal de la página (salvo dentro de la tabla de guardados).
- Que el aviso de "sin stock" o los errores se confundan con el color de acento.
- Que el sitio se ponga lento en celulares de gama media por el desenfoque.

## Enfoques considerados

- **A · CSS propio con variables de diseño (elegido por el autor).** Se mantiene CSS plano y `className`. `app.css` se divide en archivos por área, con un archivo de variables (tokens) para claro y oscuro. Fuentes instaladas como dependencia (`@fontsource`) e íconos `lucide-react`. Construye sobre lo existente, pocas dependencias, fácil de revisar.
- **B · Tailwind CSS 4.** Descartado: obliga a reescribir el marcado de todos los componentes y cambia la forma de trabajar del proyecto; para este tamaño no compensa.
- **C · CSS Modules.** Descartado: hay que renombrar todas las clases y cambiar cómo se importan; el sitio es lo bastante chico para que los choques de nombres no sean un problema real.

## Identidad visual (decidida por el autor sobre bocetos)

### Dirección: "tech oscuro" (B) con liquid glass en los controles

- **Modo oscuro como diseño principal**: fondo casi negro, superficies sólidas un poco más claras con borde fino.
- **Paleta naranja + amarillo**: el naranja es el acento principal (precios, elemento activo, hover, botón principal); el amarillo es secundario (etiqueta de categoría, detalles, degradado del logo).
- **Liquid glass solo en los controles** (opción G1): barra de navegación flotante en forma de píldora, panel de filtros, buscador, controles segmentados y el panel de cotización de la subpágina de producto. **Las tarjetas y el contenido son sólidos**, para que precios y textos se lean perfecto. Detrás del vidrio hay una luz ambiental suave (degradados radiales naranja/ámbar fijos en el fondo de la página), porque el vidrio solo se nota si tiene algo que desenfocar.

### Valores de referencia (los de los bocetos)

| Rol | Oscuro | Claro |
|---|---|---|
| Fondo | `#07090b` | `#eef1f5` |
| Texto | `#eef1f4` | `#0f1418` |
| Texto secundario | `#9aa3ae` | `#55606c` |
| Superficie (tarjetas) | `#111519` | `#ffffff` |
| Superficie 2 (imágenes, encabezados de tabla) | `#161b20` | (a definir) |
| Borde | `#1d2228` | `#e2e6eb` |
| Acento principal | `#fb923c` (texto sobre él: `#0e0c0a`) | `#c2410c` (texto sobre él: `#fff`) |
| Acento secundario | `#facc15` | `#a16207` |
| En stock / éxito | `#4ade80` | `#15803d` |
| Sin stock / error | `#f87171` | `#b91c1c` |
| Vidrio | `rgba(255,255,255,.06)`, borde `rgba(255,255,255,.12)`, brillo superior `rgba(255,255,255,.22)` | `rgba(255,255,255,.55)`, borde `rgba(255,255,255,.8)` |
| Desenfoque del vidrio | `blur(18px) saturate(170%)` | igual |
| Luz ambiental | naranja `rgba(251,146,60,.28)` + ámbar `rgba(250,204,21,.18)` | más intensa: `.45` / `.38` |

Son el punto de partida; el implementador puede ajustarlos para cumplir el contraste (ver anti-objetivos), sin cambiar la dirección.

### Decisiones del asistente (propuestas, no objetadas por el autor)

- **Tipografía:** Space Grotesk para la interfaz y **JetBrains Mono para precios y números** (cifras de ancho fijo, `font-variant-numeric: tabular-nums`). Instaladas como dependencia con `@fontsource` (sin pedir a Google Fonts).
- **Tema:** se sigue la preferencia del sistema (`prefers-color-scheme`), como hoy. El oscuro es el diseño principal; el claro aplica los mismos roles con los valores de la tabla.
- **Estados:** verde para "en stock", rojo para "sin stock"/errores; nunca el naranja. "Sin datos recientes" en gris.
- **Accesibilidad del vidrio:** con `prefers-reduced-transparency: reduce`, o si el navegador no soporta `backdrop-filter`, el vidrio pasa a un fondo opaco equivalente. Con `prefers-reduced-motion: reduce` se apagan transiciones y la animación de los esqueletos.
- **Íconos:** `lucide-react` en vez de los símbolos de texto actuales (☆ ★ ✕ ↗ y similares), incluidos los que están dentro de las traducciones (`saved.save` = "☆ Guardar para comparar", `saved.savedState` = "★ Guardado"): el ícono va en el componente y el texto queda sin símbolo, en `es` y `en`.
- **Carga:** "Cargando…" se reemplaza por esqueletos con la forma del contenido (tarjetas del catálogo, ficha de producto, tabla de guardados), con `aria-busy` y un texto accesible.
- **Estados vacíos y 404** con el mismo estilo y un botón para volver a Productos.
- **Movimiento:** transiciones cortas (150–250 ms) en hover, foco y al abrir el panel de filtros.
- **Foco visible** en todo lo interactivo (anillo naranja), objetivos táctiles de al menos 44 × 44 px en celular.
- **Botón de Google:** sigue con el tema que ya elige según el modo (`filled_black` en oscuro, `outline` en claro); se ubica dentro de la barra de vidrio. Puede usar `shape: "pill"` para calzar con la barra si se ve mejor (opción del script oficial).

## Páginas y componentes

### Barra de navegación (todas las páginas)

Píldora de vidrio flotante y fija arriba (`position: sticky`), con un pequeño margen respecto de los bordes. Contiene: logo (cuadro con degradado naranja→amarillo y el nombre del sitio), enlaces **Productos** y **Guardados (n)** con el activo resaltado como "pastilla" de vidrio más opaca, selector **ES / EN** y, a la derecha, el botón de Google o el nombre del usuario con "Salir". Nada debe desbordarse con los textos en inglés.

**En celular (< 640 px)** (decisión del asistente, tras la revisión del diseño: en 360 px no cabe todo en una línea): solo el logo sin nombre, **Productos** y **Guardados** como íconos con su texto accesible (Guardados conserva el contador como globo), ES / EN, y:
- **Sin sesión:** el botón de Google en su variante de **solo ícono** (`type: "icon"` del script oficial; se amplía `GoogleButtonOptions` en `google.ts`). Sigue visible y es el botón oficial.
- **Con sesión:** se oculta el nombre del usuario y "Salir" pasa a ser un botón de ícono con `aria-label` "Salir".
- La barra no se parte en dos líneas ni usa menú desplegable.

### Catálogo (`/`) — opción F2, barra lateral

- **Escritorio (aprox. ≥ 900 px):** dos columnas.
  - **Izquierda:** panel de vidrio fijo al bajar (`sticky`) con:
    - **Categoría:** lista vertical Todos / CPU / GPU / RAM con su conteo; la activa en naranja.
    - **Tienda:** selector (Todas / Winpy / PC Express / SP Digital).
    - **Precio máximo:** barra deslizante (`input type="range"`) con el valor mostrado en CLP.
    - **Disponibilidad:** interruptor "Solo con stock".
    - **Limpiar filtros** (solo si hay filtros activos, como hoy).
  - **Derecha:** buscador (vidrio) arriba; debajo, una línea con el conteo ("418 de 1.240 productos") y el selector de orden; luego la cuadrícula de tarjetas (3 por fila en escritorio normal; puede llegar a 4 en pantallas muy anchas) y la paginación.
- **Celular:** buscador arriba; debajo, un botón **"Filtros (n)"** (n = filtros activos, sin contar búsqueda ni orden) y el selector de orden lado a lado; 2 tarjetas por fila. "Filtros" abre un panel (hoja inferior o lateral) con los mismos controles de la barra lateral, cerrable con botón, con Escape y tocando fuera; el foco queda dentro mientras está abierto y vuelve al botón al cerrar.
- **Sin cambios de comportamiento:** los filtros, la búsqueda, el orden y la página siguen viviendo en la URL (`?q=&cat=&store=&max=&stock=&sort=&page=`) con los mismos nombres y valores; cambiar un filtro vuelve a la página 1.
- **Barra de precio máximo** (decisión del asistente): va de $0 al mayor "mejor precio" del catálogo cargado, redondeado hacia arriba a un múltiplo de $10.000, con paso de $10.000. El extremo derecho significa "sin límite" (no escribe `max` en la URL). Un `max` de la URL fuera del rango se respeta igual y se muestra en el extremo.
- **Tarjeta de producto:** superficie sólida, imagen arriba (marco de superficie 2, con el placeholder actual si no carga), categoría en amarillo y mayúsculas pequeñas, nombre (máximo 2 líneas), precio "Desde" en JetBrains Mono naranja, y una línea inferior con "en N tiendas" y el estado de stock (punto verde/rojo con texto). Hover: borde naranja y un leve resplandor; la tarjeta entera sigue siendo un enlace.

### Subpágina de producto (`/producto/:slug`) — opción P2 con tarjetas

- **Escritorio:** dos columnas.
  - **Izquierda (contenido):** ruta de migas ("Productos › GPU"), imagen grande, categoría, nombre (`h1`), **gráfico de historial de precios** y **reseñas**.
  - **Derecha (panel de cotización):** panel de vidrio **fijo al bajar** (`position: sticky`) con:
    1. **Bloque de mejor precio:** etiqueta "Mejor precio hoy", precio grande en naranja (JetBrains Mono), "en [tienda]" y, si hay 2 o más ofertas vigentes con precio, **"Ahorras hasta $X"** (diferencia entre la oferta vigente más cara y la más barata) en verde. Botones: **"Ir a la tienda"** (principal, enlace a `offer.url` de la oferta más barata, en pestaña nueva) y **"Guardar"** (el `SaveButton` actual, con el mismo comportamiento con y sin sesión).
    2. **Comparar tiendas:** título con el número de tiendas, el control segmentado **Precio / Distancia** (Distancia solo aparece cuando aparece hoy), la barra de ubicación actual y las **tarjetas de tienda** (se mantiene la decisión del autor de una tarjeta por tienda, ahora con el nuevo estilo).
  - Si el panel es más alto que la pantalla, la lista de tarjetas se desplaza **dentro** del panel; el bloque de mejor precio queda siempre visible.
- **Celular:** una columna en este orden: migas, imagen y nombre (compactos), panel de cotización (sin `sticky`), gráfico, reseñas.
- **Una tarjeta por oferta, como hoy** (decisión del asistente, tras la revisión del diseño): `product.tsx` hoy dibuja una `StoreCard` por oferta y la base no impide que un producto agrupado tenga dos ofertas de la misma tienda. No se fusionan ni se descartan ofertas. "N tiendas" cuenta tiendas distintas (`storeCount` de `summarize`), la etiqueta "Mejor" va solo en la tarjeta de la oferta vigente más barata (la de `summarize`), y "Ahorras hasta" compara las ofertas vigentes con precio aunque dos sean de la misma tienda. En la práctica casi siempre hay una oferta por tienda.
- **Tarjeta de tienda** (compacta, decisión del asistente): visible siempre: nombre de la tienda (y etiqueta **"Mejor"** en naranja en la más barata), precio, estado de stock, distancia y abierta/cerrada (con el texto actual de `hours`), y el enlace a la tienda. **Al tocarla se despliega** la dirección completa y el horario semanal (como el `<details>` de hoy). Se conservan todos los datos y textos que muestra hoy `store-card.tsx`, incluido el estilo atenuado de las ofertas no vigentes.
- **Sin precio vigente:** el bloque muestra "Sin stock" (texto actual) en lugar del precio y no muestra "Ir a la tienda" ni el ahorro.
- **Gráfico:** mismo componente (recharts) con el nuevo estilo (ejes, rejilla y tooltip con los colores del tema). **Los colores por tienda cambian**: hoy PC Express usa `#ea580c`, que choca con el acento naranja. Elegir tres colores distinguibles entre sí y del acento, legibles en claro y oscuro, y mantener la línea punteada de una tienda para no depender solo del color.
- **Reseñas:** mismo comportamiento; estrellas en amarillo, formulario y lista con el nuevo estilo.

### Guardados (`/guardados`)

- Misma tabla comparativa de hoy (un producto por columna; filas Categoría, Mejor precio, Tienda más barata y una por tienda), con el nuevo estilo: contenedor de superficie sólida con bordes redondeados, encabezados de fila en mayúsculas pequeñas y gris, precios en JetBrains Mono.
- **Nuevo:** el producto con el menor "Mejor precio" lleva la etiqueta **"Más barato"** (hoy solo va en negrita); en cada columna se resalta en naranja la celda de la tienda donde ese producto está más barato.
- Botón para quitar como ícono (✕ de `lucide-react`) con su `aria-label` actual.
- En celular la tabla se desliza de lado **con la columna de nombres de fila fija** (`position: sticky; left: 0`).
- Título "Guardados" con un subtítulo "N productos para comparar".

## Textos nuevos

Todos en `es` y `en` (la prueba `messages.test.ts` exige las mismas claves): "Mejor precio hoy", "Ahorras hasta {{price}}", "Ir a la tienda", "Comparar tiendas" / "N tiendas", "Mejor" (etiqueta), "Más barato", "Filtros", "Filtros ({{count}})", "Cerrar", "Disponibilidad", "N productos para comparar", textos accesibles de los esqueletos ("Cargando productos…") y de la migas, y "Volver a Productos" en 404 y estados vacíos. Redacción final al implementador; el autor revisa el inglés.

## Organización del CSS (enfoque A)

- `frontend/src/styles/` (o similar) con, por ejemplo: `tokens.css` (variables de claro y oscuro, vidrio, radios, espacios, sombras, fuentes), `base.css` (reset, tipografía, foco, luz ambiental de fondo, utilidades como `.sr-only` y `.glass`), y un archivo por área (`nav.css`, `catalog.css`, `product.css`, `store-card.css`, `reviews.css`, `saved.css`, `states.css`).
- `app.css` queda como punto de entrada que importa los demás en orden (o se importan desde `main.tsx`). Hoy `app.css` ya se importa una sola vez (en `app.tsx`); el pendiente de `docs/autoria.md` que dice que se importa dos veces está desactualizado y se marca como hecho en la etapa 5.
- **Ningún color, radio o sombra escrito a mano en las reglas de componentes**: siempre `var(--…)`.
- Los nombres de archivo siguen en minúscula, como el resto del proyecto.

## Trabajo y entrega

- Rama propia (`feat/rediseno-visual`); no se trabaja en `dev`.
- Por etapas revisables por separado:
  1. Tokens, base, fuentes, íconos y barra de navegación.
  2. Catálogo (barra lateral, panel en celular, tarjetas, barra de precio).
  3. Subpágina de producto (dos columnas, panel de cotización, tarjetas de tienda, gráfico, reseñas).
  4. Guardados, esqueletos de carga, estados vacíos y 404.
  5. Documentación: README (estado actual), `docs/autoria.md` (nuevo Prompt, decisiones y "Por hacer"), y actualizar el grafo con graphify.
- **Revisión** (decisión del asistente, tras la revisión del diseño): un commit (o varios) por etapa en la misma rama, con revisión de código de cada etapa. Se **para después de la etapa 1** para que el autor vea la base visual (tokens, fuentes, fondo, barra de navegación) funcionando en el sitio real antes de construir las páginas; las etapas 2 a 5 siguen sin pausa salvo que el autor pida otra cosa. La rama se integra a `dev` al final, cuando el autor lo apruebe.
- La lógica pura nueva (rango y ahorro de precios, límite de la barra de precio, conteo de filtros activos) va en `frontend/src/lib/` con pruebas `deno test`, como el resto de `lib/`. Las pruebas existentes deben seguir pasando.
- Verificación visual de cada etapa en el navegador: 360 px, 768 px, 1024 px y 1440 px; claro y oscuro; español e inglés.

## Lo que decidió el autor

- Dirección "tech oscuro" (B), paleta naranja + amarillo, liquid glass solo en los controles (G1).
- Subpágina de producto P2 (panel de cotización fijo al costado) **con tarjetas** de tienda.
- Catálogo F2 (barra lateral de filtros).
- Guardados: misma tabla con el nuevo estilo, etiqueta "Más barato" y resaltado de la tienda más barata.
- Enfoque A (CSS propio con variables).
- Prioridad de la subpágina: el mejor precio y la comparación de tiendas primero.

## Lo que queda al implementador

- Valores finales de los tokens dentro de la dirección elegida (contraste, superficie 2 en claro), escala de espacios y tipografía, radios y sombras.
- Puntos de quiebre exactos (la referencia es: celular < 640 px, tablet 640–899 px, escritorio ≥ 900 px).
- Componentes nuevos y su nombre (por ejemplo `filters-panel.tsx`, `quote-panel.tsx`, `skeleton.tsx`) y cómo se reparte el marcado de `catalog.tsx` y `product.tsx`.
- Implementación del panel de filtros en celular (por ejemplo `<dialog>` nativo) y del despliegue de las tarjetas de tienda.
- Paleta del gráfico por tienda (con la restricción indicada).
- Qué pesos de fuente se instalan (solo los usados).
