# Política de privacidad y cookies con consentimiento — diseño

## Intención

Rigly guarda datos en el navegador sin avisar: el idioma (`localStorage`, clave `idioma`), la sesión de Supabase (`localStorage`, clave `sb-<proyecto>-auth-token`) y, al cargar el botón de Google, las cookies que pone `accounts.google.com`. No hay política de privacidad ni aviso.

El autor quiere una política de privacidad y cookies bien definida y un aviso que pregunte si se acepta guardar datos en el navegador. No es un requisito del enunciado, pero el proyecto se evalúa por su diseño: la política tiene que ser clara, honesta y coincidir exactamente con lo que la app hace. Si el usuario rechaza, la web funciona en español y sin sesión iniciada.

Público: Chile (`es-CL`, `America/Santiago`). El marco legal de referencia es la Ley 19.628 de protección de la vida privada, reformada por la Ley 21.719 (no el RGPD europeo).

## Objetivos

- Página `/privacidad` con la política de privacidad y cookies, en español e inglés.
- Aviso de consentimiento con dos opciones de igual peso: **Aceptar** y **Rechazar**.
- Con **rechazo**: no se escribe nada en el navegador salvo la propia decisión, no se carga el script de Google, no hay inicio de sesión y la web arranca en español.
- Poder releer la política y cambiar la decisión en cualquier momento.

## No objetivos

- Elegir por categorías (idioma sí, sesión no). Descartado por el autor (opción B).
- Analítica, publicidad o cualquier seguimiento: no existen y no se añaden.
- Borrar las cookies que Google ya puso en su propio dominio (el navegador no lo permite desde Rigly). La política lo explica.
- Función de borrar la cuenta dentro de la app: los derechos se ejercen escribiendo al correo de contacto (sección 1 de la política).

## Anti-objetivos (sería un fracaso aunque funcione)

- Que con rechazo quede algo de Rigly en `localStorage` aparte de la decisión, o que se cargue el script de Google.
- Un aviso que empuje a aceptar: botón de rechazar más pequeño, escondido o en gris, o casillas ya marcadas.
- Una política que diga algo distinto de lo que hace el código (por ejemplo, prometer que no hay cookies de terceros).
- Botones de «Inicia sesión» que no hacen nada cuando no hay consentimiento.

## Enfoques considerados

Qué ofrece el aviso:

- **A. Aceptar / Rechazar con el mismo peso (elegido por el autor).** Dos estados, fácil de probar y de entender.
- B. Aceptar / Rechazar / Configurar con interruptores por uso. Más granular, pero crea combinaciones incómodas (sesión sí e idioma no: el perfil intenta escribir el idioma en `localStorage`) y duplica el trabajo para solo dos usos. Descartado.

Cómo se construye:

- **1. Módulo de consentimiento y comprobarlo en cada sitio que guarda algo (elegido por el autor).** Cada punto que toca el navegador consulta el consentimiento de forma explícita; se lee y revisa fácil.
- 2. Interceptar `localStorage` de forma global. Invisible para quien lee el código y no evita las cookies del script de Google. Descartado.
- 3. Librería externa de banners (Klaro, CookieConsent). Añade una dependencia para dos usos, igual hay que conectarla a Supabase, idioma y Google, y no encaja con el diseño de Rigly. Descartado.

## Comportamiento (aprobado por el autor)

Tres estados de consentimiento: **sin decidir**, **aceptado** y **rechazado**.

- **Sin decidir** (primera visita): se muestra el aviso. La web usa el idioma del navegador (`navigator.language`) sin guardarlo. El script de Google no se carga y no hay botón de inicio de sesión (decisión del asistente). Se puede navegar con el aviso abierto: no bloquea la página.
- **Aceptar:** se guarda la decisión, se guarda el idioma activo en `localStorage`, se carga el script de Google y aparece el botón de inicio de sesión. A partir de ahí, todo funciona como hoy.
- **Rechazar:** se guarda solo la decisión. El idioma pasa a español. Se puede cambiar a inglés con el selector durante la visita, pero no se guarda (propuesta del asistente, aceptada). No se carga Google y no hay inicio de sesión.
- **La decisión se recuerda** en el navegador para que el aviso no vuelva a salir en cada visita (propuesta del asistente, aceptada). Guardar la decisión es necesario para cumplirla, así que se guarda también con rechazo.
- **Cambiar de aceptado a rechazado** con sesión iniciada: se cierra la sesión, se borran la clave `idioma` y la sesión de Supabase de `localStorage` y se recarga la página para que el script de Google deje de estar cargado (propuesta del asistente, aceptada; la recarga es decisión del asistente). El idioma guardado en `profiles.language` no se toca: es un dato de la cuenta, no del navegador.
- **Cambiar de rechazado a aceptado:** como «Aceptar».
- **Datos guardados antes de decidir** (usuarios de hoy sin la clave `consentimiento`, o una versión antigua de la decisión) (decisión del asistente): mientras se está **sin decidir** se ignoran, sin leerlos ni borrarlos. La web arranca con el idioma del navegador y sin sesión, y Supabase usa su almacenamiento en memoria, así que no refresca ni reescribe el token. **Al rechazar**, venga del estado que venga, se borran `idioma` y cualquier clave `sb-*` de `localStorage`. **Al aceptar** no se recarga la página: se escribe el idioma activo, y el usuario inicia sesión de nuevo si quiere. La sesión antigua, si quedaba, se recupera en la siguiente carga o se sobrescribe al iniciar sesión.
- **Pie de página** en todas las páginas con el enlace «Privacidad y cookies» a `/privacidad` (propuesta del asistente, aceptada). En la política hay un bloque «Tu elección» con el estado actual y los botones para cambiarlo.

### Sin consentimiento, dónde se pedía iniciar sesión

`LoginButton` se usa en la barra de navegación, `save-button.tsx`, `reviews.tsx` y `saved-page.tsx`. Sin consentimiento aceptado (decisión del asistente):

- En la barra de navegación no se muestra nada en lugar del botón.
- En los otros tres sitios, el texto actual («Inicia sesión para…») sigue, y en vez del botón de Google aparece una línea: «Para iniciar sesión, acepta guardar datos en este navegador» con un botón **Revisar preferencias** que vuelve a abrir el aviso.

## Qué se guarda en el navegador

| Clave | Dónde | Para qué | Cuándo |
|-------|-------|----------|--------|
| `consentimiento` | `localStorage` | Recordar Aceptar o Rechazar | Siempre que se decide |
| `idioma` | `localStorage` | Recordar el idioma | Solo con aceptado |
| `sb-<proyecto>-auth-token` | `localStorage` | Mantener la sesión iniciada | Solo con aceptado y sesión iniciada |
| Cookies de Google | Dominio de Google | Las pone el script de inicio de sesión de Google | Solo con aceptado (el script no se carga si no) |

Valor de `consentimiento` (decisión del asistente): un JSON `{ "version": 1, "decision": "aceptado" | "rechazado", "fecha": "<ISO>" }`. Si la versión guardada es distinta de la actual, o el valor no se puede leer, se trata como **sin decidir** y se vuelve a preguntar. Así, si la política cambia de forma importante, basta con subir la versión.

Si `localStorage` falla (modo privado, datos bloqueados), la decisión vive solo en memoria y el aviso volverá a salir en la siguiente visita. Se sigue el patrón `try/catch` que ya usan `language.tsx` e `i18n/index.ts`.

## Arquitectura

- **`src/lib/consent.ts`** (nuevo, puro, sin dependencias del navegador): tipos, versión actual, `parseConsent(raw)` que devuelve `"aceptado" | "rechazado" | null` y `serializeConsent(decision, fecha)`. Pruebas en `consent.test.ts` (deno).
- **`src/consent.tsx`** (nuevo): `ConsentProvider` con `useConsent()` → `{ decision, accept(), reject(), reopen(), bannerOpen }`. Lee la decisión al cargar y la persiste. También exporta una función síncrona `storageAllowed()` (lee el valor guardado) para el código que corre fuera de React: el cliente de Supabase y la inicialización de i18n.
- **`src/supabase.ts`:** `createClient(url, key, { auth: { storage } })` con un almacenamiento propio que escribe y lee de `localStorage` solo si `storageAllowed()`, y si no, de un `Map` en memoria. Aunque con rechazo no hay forma de iniciar sesión, esto garantiza que no se escriba nada.
- **`src/i18n/index.ts`:** idioma inicial = guardado si hay consentimiento aceptado; `"es"` si rechazado; idioma del navegador si sin decidir. La función pura que lo decide va en `lib/locale.ts` o `lib/consent.ts` con pruebas.
- **`src/language.tsx`:** `apply()` escribe `idioma` solo con consentimiento aceptado. Al pasar a aceptado, escribe el idioma activo. Al rechazar, cambia a `"es"`.
- **`src/google.ts` / `login-button.tsx`:** `googleIdentity()` solo se llama con consentimiento aceptado; `LoginButton` muestra el mensaje y «Revisar preferencias» si no.
- **`src/components/consent-banner.tsx`** (nuevo): aviso fijo abajo, estilo `glass` como la barra de navegación. Texto breve, enlace a la política y los dos botones con el mismo estilo y tamaño. Accesible: `role="dialog"`, `aria-labelledby`, foco en el primer botón al abrirse, sin atrapar el foco (la página sigue usable).
- **`src/components/site-footer.tsx`** (nuevo): enlace «Privacidad y cookies».
- **`src/pages/privacy.tsx`** (nuevo) en la ruta `/privacidad`, textos en `i18n/es.ts` y `i18n/en.ts` (sección `privacy`). La prueba `messages.test.ts` ya comprueba que ambos idiomas tienen las mismas claves.
- **`app.tsx`:** `ConsentProvider` por fuera de `AuthProvider` (Auth y Language lo necesitan), más el aviso, el pie y la ruta nueva.

## Contenido de la política

Escrita en lenguaje claro, con fecha de «Última actualización» y la versión. Secciones:

1. **Quién es responsable.** «Rigly, proyecto de la asignatura de Diseño de Software de la Universidad Adolfo Ibáñez». Contacto: `pedmoya@alumnos.uai.cl` (indicado por el autor). Es el único canal para ejercer los derechos de la sección 7, incluido borrar la cuenta.
2. **Qué datos tratamos y para qué:**
   - Cuenta de Google al iniciar sesión (nombre, correo, identificador), a través de Supabase: para identificarte, mostrar tu nombre en tus reseñas y guardar tus productos.
   - Perfil: idioma preferido (`profiles.language`).
   - Reseñas: nota, comentario y nombre del autor, **visibles públicamente**.
   - Productos guardados: privados, solo los ves tú.
   - Ubicación GPS: se pide con el permiso del navegador, se usa **solo en tu dispositivo** para calcular distancias a las tiendas y no se envía ni se guarda.
3. **Almacenamiento en el navegador y cookies:** la tabla de arriba, explicada.
4. **Servicios de terceros:** Supabase (base de datos y autenticación), Google Identity Services (inicio de sesión), Vercel (alojamiento de la web, registros técnicos del servidor) y las tiendas, cuyas imágenes de productos se cargan desde sus servidores y que reciben tu visita si sigues un enlace a ellas. Un apartado **Transferencias internacionales** dice que estos proveedores pueden tratar los datos en servidores fuera de Chile, sin nombrar regiones que no se han comprobado (decisión del asistente; si el autor indica la región del proyecto de Supabase, se nombra).
5. **Base legal:** consentimiento para el almacenamiento en el navegador y el inicio de sesión; los datos de la cuenta, para prestar las funciones que pides (reseñas, guardados).
6. **Cuánto tiempo:** mientras la cuenta exista; `localStorage` hasta que cambies tu decisión o borres los datos del navegador.
7. **Tus derechos** (Ley 19.628 / 21.719): acceso, rectificación, supresión, oposición y portabilidad; se ejercen escribiendo a `pedmoya@alumnos.uai.cl`.
8. **Tu elección:** estado actual y botones Aceptar / Rechazar.
9. **Cambios en esta política:** se avisa volviendo a preguntar (subiendo la versión).

## Pruebas

- `lib/consent.test.ts` (deno): parseo de valores válidos, inválidos, versión distinta, JSON roto; idioma inicial según la decisión.
- `i18n/messages.test.ts`: ya cubre que `privacy.*` exista en ambos idiomas.
- Comprobación manual en el navegador (Firefox con Playwright, ver nota de memoria): con rechazo, `localStorage` solo tiene `consentimiento` y no hay peticiones a `accounts.google.com`; con aceptado, todo funciona como antes; pasar de aceptado a rechazado con sesión deja la web sin sesión y en español.

## Lo que queda al implementador

- Textos exactos del aviso y de la política (siguiendo las secciones de arriba), y su traducción al inglés.
- Estilos concretos del aviso y del pie, dentro del lenguaje visual existente (`app.css`, clases `glass`).
- Dónde vive exactamente `storageAllowed()` y la función de idioma inicial, mientras la lógica pura quede en `lib/` con pruebas.
