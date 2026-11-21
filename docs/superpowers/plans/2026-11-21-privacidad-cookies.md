# Política de privacidad y cookies con consentimiento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `/privacidad` y aviso Aceptar/Rechazar. Con rechazo no se guarda nada en el navegador salvo la decisión, no se carga Google, no hay sesión y la web arranca en español.

**Architecture:** La lógica pura (parsear la decisión, idioma inicial, claves a borrar) vive en `src/lib/consent.ts`, con pruebas en deno. Un módulo sin React (`src/consent-storage.ts`) lee y escribe la decisión y da a Supabase un almacenamiento que solo usa `localStorage` con consentimiento aceptado. `ConsentProvider` (por fuera de `AuthProvider`) expone la decisión a React; `LanguageProvider`, `LoginButton`, el aviso, el pie y la página de la política la consultan.

**Tech Stack:** React 19 + Vite + TypeScript, react-router 7, i18next + react-i18next, `@supabase/supabase-js` 2, lucide-react, `deno test` para la lógica pura.

**Spec:** `docs/superpowers/specs/2026-11-21-privacidad-cookies-design.md`

## Global Constraints

- Clave de la decisión: `consentimiento` en `localStorage`. Valor: JSON `{ "version": 1, "decision": "aceptado" | "rechazado", "fecha": "<ISO>" }`. Una versión distinta de `1` o un valor ilegible equivale a **sin decidir**.
- Con decisión distinta de `"aceptado"`: nada de `idioma` ni `sb-*` en `localStorage`, no se llama a `googleIdentity()` (no se pide `https://accounts.google.com/gsi/client`).
- Con rechazo, idioma inicial `es`. Sin decidir, idioma del navegador (`detectLang`), sin leer lo guardado.
- Botones Aceptar y Rechazar con **la misma clase, tamaño y peso visual**. Sin casillas premarcadas.
- Responsable: «Rigly, proyecto de la asignatura de Diseño de Software de la Universidad Adolfo Ibáñez». Contacto: `pedmoya@alumnos.uai.cl`. Marco legal: Ley 19.628, reformada por la Ley 21.719 (Chile).
- Todo acceso a `localStorage` dentro de `try/catch` (puede fallar en modo privado).
- Textos de la interfaz en `i18n/es.ts` y `i18n/en.ts` (mismas claves y placeholders, lo comprueba `messages.test.ts`). `console.warn` y errores internos en español.
- Colores, radios y espacios solo con variables de `styles/tokens.css` (lo comprueba `tokens.test.ts`). Los CSS nuevos van en `src/styles/` y se importan en `app.css`.
- Pruebas: `(cd frontend && deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/)`. Verificación completa: además `(cd frontend && npx tsc -b && npx oxlint && npx vite build)`.
- Rama `feat/privacidad-cookies` desde `dev`. Commits con `git add` de archivos concretos, nunca `git add -A`. Los mensajes de commit terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **`localStorage` bloqueado (modo privado):** Aceptar y Rechazar funcionan en memoria durante la visita, sin errores; el aviso vuelve en la siguiente visita. → `consent-storage.ts` guarda la decisión también en una variable de módulo (Task 2) y paso manual en Task 6.
2. **Valor de `consentimiento` roto o de otra versión** (`"si"`, `{}`, `{"version":0,...}`, JSON truncado): se vuelve a preguntar, sin romper la carga. → pruebas de `parseConsent` (Task 1).
3. **Datos antiguos sin decisión** (`idioma = "en"`, `sb-xxx-auth-token`) en la primera visita tras el cambio: no se leen ni se borran; la web abre con el idioma del navegador y sin sesión. → prueba de `startLang(null, "en", "es-CL") === "es"` (Task 1) y paso manual (Task 6).
4. **Rechazar con sesión abierta y sin red:** el cierre de sesión local no debe bloquear; igual se borran las claves y se recarga. → `reject()` atrapa el error de `signOut` (Task 3) y paso manual (Task 6).
5. **Cambiar a inglés con rechazo:** el texto cambia, pero `idioma` no aparece en `localStorage`; `clearStoredData` no borra `consentimiento` ni claves ajenas. → prueba de `keysToClear` (Task 1) y paso manual (Task 6).

---

### Task 0: Rama de trabajo

- [ ] **Step 1:** `git switch dev && git switch -c feat/privacidad-cookies`. Expected: `git branch --show-current` → `feat/privacidad-cookies`.

---

### Task 1: Lógica pura del consentimiento

**Files:**
- Create: `frontend/src/lib/consent.ts`
- Test: `frontend/src/lib/consent.test.ts`

**Interfaces:**
- Consumes: `Lang`, `STORAGE_KEY`, `initialLang`, `detectLang` de `src/lib/locale.ts`.
- Produces:
  - `CONSENT_KEY = "consentimiento"`, `CONSENT_VERSION = 1`
  - `type Decision = "aceptado" | "rechazado"`
  - `parseConsent(raw: string | null): Decision | null`
  - `serializeConsent(decision: Decision, fecha: Date): string`
  - `startLang(decision: Decision | null, stored: string | null, navLang: string | undefined): Lang`
  - `keysToClear(keys: readonly string[]): string[]`

- [ ] **Step 1: Escribir las pruebas que fallan** en `consent.test.ts` (estilo de `locale.test.ts`, `jsr:@std/assert@1`):

```ts
Deno.test("serializeConsent y parseConsent hacen ida y vuelta", () => {
  const raw = serializeConsent("aceptado", new Date("2026-11-21T12:00:00Z"));
  assertEquals(JSON.parse(raw), { version: 1, decision: "aceptado", fecha: "2026-11-21T12:00:00.000Z" });
  assertEquals(parseConsent(raw), "aceptado");
  assertEquals(parseConsent(serializeConsent("rechazado", new Date())), "rechazado");
});

Deno.test("parseConsent trata lo ilegible o de otra versión como sin decidir", () => {
  for (const raw of [null, "", "si", "{}", "{\"version\":1", "null", "[]",
    JSON.stringify({ version: 0, decision: "aceptado" }),
    JSON.stringify({ version: "1", decision: "aceptado" }),
    JSON.stringify({ version: 1, decision: "ACEPTADO" })]) {
    assertEquals(parseConsent(raw), null, String(raw));
  }
});

Deno.test("startLang según la decisión", () => {
  assertEquals(startLang("aceptado", "en", "es-CL"), "en");
  assertEquals(startLang("aceptado", null, "en-US"), "en");
  assertEquals(startLang("rechazado", "en", "en-US"), "es");
  assertEquals(startLang(null, "en", "es-CL"), "es"); // lo guardado se ignora sin decidir
  assertEquals(startLang(null, null, "en-GB"), "en");
});

Deno.test("keysToClear elige idioma y sb-*, nada más", () => {
  assertEquals(
    keysToClear(["idioma", "sb-abc-auth-token", "consentimiento", "otra", "sbx", "sb-"]).sort(),
    ["idioma", "sb-", "sb-abc-auth-token"],
  );
  assertEquals(keysToClear([]), []);
});
```

- [ ] **Step 2: Ejecutar y ver que fallan**
Run: `cd frontend && deno test --no-config src/lib/consent.test.ts`
Expected: FAIL (no existe `./consent.ts`).

- [ ] **Step 3: Implementar `consent.ts`** con las firmas de arriba. `parseConsent` exige objeto con `version === CONSENT_VERSION` (número) y `decision` exactamente `"aceptado"` o `"rechazado"`; cualquier excepción de `JSON.parse` → `null`. `startLang`: aceptado → `initialLang(stored, navLang)`; rechazado → `"es"`; `null` → `detectLang(navLang)`. `keysToClear`: `k === STORAGE_KEY || k.startsWith("sb-")`.

- [ ] **Step 4: Ejecutar y ver que pasan**
Run: `cd frontend && deno test --no-config src/lib/`
Expected: PASS (incluidas las pruebas que ya existían).

- [ ] **Step 5: Commit**
`git add frontend/src/lib/consent.ts frontend/src/lib/consent.test.ts && git commit -m "feat(frontend): lógica pura del consentimiento"`

---

### Task 2: Almacenamiento condicionado (Supabase e i18n)

**Files:**
- Create: `frontend/src/consent-storage.ts`
- Modify: `frontend/src/supabase.ts`, `frontend/src/i18n/index.ts`

**Interfaces:**
- Consumes: todo lo de Task 1.
- Produces (en `consent-storage.ts`):
  - `readDecision(): Decision | null`: la decisión en memoria si ya se fijó en esta visita; si no, `parseConsent` de `localStorage`.
  - `writeDecision(d: Decision): void`: fija la variable de módulo y, dentro de `try/catch`, escribe `serializeConsent(d, new Date())`.
  - `storageAllowed(): boolean`: `readDecision() === "aceptado"`.
  - `clearStoredData(): void`: recorre `localStorage.key(i)`, aplica `keysToClear` y hace `removeItem` (todo en `try/catch`).
  - `gatedStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }`: con `storageAllowed()` usa `localStorage` (en `try/catch`); si no, un `Map<string, string>` en memoria.

- [ ] **Step 1: Crear `consent-storage.ts`** con lo de arriba. Sin React. Comentario corto: por qué existe (Supabase e i18n se inicializan antes que React).

- [ ] **Step 2: `supabase.ts`:** `createClient(url, key, { auth: { storage: gatedStorage } })`. Actualizar el comentario: la sesión solo se guarda en el navegador con consentimiento.

- [ ] **Step 3: `i18n/index.ts`:** `lng: startLang(readDecision(), leerStorage(), navigator.language)` (en lugar de `initialLang`).

- [ ] **Step 4: Verificar compilación y pruebas**
Run: `cd frontend && npx tsc -b && deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/`
Expected: sin errores; PASS.

- [ ] **Step 5: Commit**
`git add frontend/src/consent-storage.ts frontend/src/supabase.ts frontend/src/i18n/index.ts && git commit -m "feat(frontend): sesión e idioma solo se guardan con consentimiento"`

---

### Task 3: `ConsentProvider` e idioma según la decisión

**Files:**
- Create: `frontend/src/consent.tsx`
- Modify: `frontend/src/language.tsx`, `frontend/src/app.tsx`

**Interfaces:**
- Consumes: `readDecision`, `writeDecision`, `clearStoredData`, `storageAllowed` (Task 2); `supabase` de `src/supabase.ts`.
- Produces:
  - `ConsentProvider({ children })`
  - `useConsent(): { decision: Decision | null; bannerOpen: boolean; accept(): void; reject(): Promise<void>; reopen(): void; close(): void }`

- [ ] **Step 1: Crear `consent.tsx`.** Estado inicial `readDecision()`. `bannerOpen = decision === null || reabierto`. `close()` solo baja `reabierto` (con `decision === null` el aviso sigue visible).
  - `accept()`: `writeDecision("aceptado")`, actualiza el estado y cierra el aviso.
  - `reject()`, **en este orden**: si la decisión previa era `"aceptado"`, `await supabase.auth.signOut({ scope: "local" })` dentro de `try/catch` (`console.warn` si falla); después `clearStoredData()` y `writeDecision("rechazado")`; si la previa era `"aceptado"`, `location.reload()` (descarga el script de Google); si no, actualiza el estado y cierra el aviso.
  - `useConsent` lanza `Error("useConsent debe usarse dentro de ConsentProvider")` fuera del proveedor (como `useAuth`).

- [ ] **Step 2: `language.tsx`:**
  - En `apply()`, escribir `localStorage` solo si `storageAllowed()`.
  - Nuevo efecto sobre `decision` (de `useConsent()`): `"aceptado"` → escribir `langRef.current` en `localStorage` (`try/catch`); `"rechazado"` → `apply("es")`. No se toca `profiles.language`.

- [ ] **Step 3: `app.tsx`:** `<ConsentProvider>` envuelve a `<AuthProvider>` (dentro de `<BrowserRouter>`).

- [ ] **Step 4: Verificar**
Run: `cd frontend && npx tsc -b && npx oxlint`
Expected: sin errores.

- [ ] **Step 5: Commit**
`git add frontend/src/consent.tsx frontend/src/language.tsx frontend/src/app.tsx && git commit -m "feat(frontend): proveedor de consentimiento e idioma según la decisión"`

---

### Task 4: Aviso, pie de página e inicio de sesión condicionado

**Files:**
- Create: `frontend/src/components/consent-banner.tsx`, `frontend/src/components/site-footer.tsx`, `frontend/src/styles/consent.css`
- Modify: `frontend/src/components/login-button.tsx`, `frontend/src/components/nav-bar.tsx`, `frontend/src/app.tsx`, `frontend/src/app.css`, `frontend/src/i18n/es.ts`, `frontend/src/i18n/en.ts`

**Interfaces:**
- Consumes: `useConsent()` (Task 3).
- Produces: `ConsentBanner()`, `SiteFooter()`, `LoginButton({ size?, type?, hideWithoutConsent?: boolean })`. Claves i18n `consent.*` y `footer.privacy`, que usa la Task 5.

- [ ] **Step 1: Textos.** Añadir en `es.ts` y en `en.ts`:
  - `consent.title`: «Datos en tu navegador»
  - `consent.text`: «Rigly puede guardar en este navegador tu idioma y tu sesión de Google. Si lo rechazas, la web funciona en español y sin iniciar sesión.»
  - `consent.policyLink`: «Política de privacidad y cookies»
  - `consent.accept`: «Aceptar»
  - `consent.reject`: «Rechazar»
  - `consent.loginNeedsConsent`: «Para iniciar sesión, acepta guardar datos en este navegador.»
  - `consent.review`: «Revisar preferencias»
  - `footer.privacy`: «Privacidad y cookies»

- [ ] **Step 2: Ejecutar `messages.test.ts`**
Run: `cd frontend && deno test --no-config src/i18n/`
Expected: PASS (mismas claves en ambos idiomas).

- [ ] **Step 3: `login-button.tsx`.** Separar el dibujo actual del botón de Google en un componente interno `GoogleButton` (contiene el `useEffect`). `LoginButton` llama a `useConsent()`:
  - con `"aceptado"` → `<GoogleButton …/>`;
  - si no, y `hideWithoutConsent` → `null`;
  - si no → `<div className="login-consent"><p>{t("consent.loginNeedsConsent")}</p><button type="button" onClick={reopen}>{t("consent.review")}</button></div>`.

  Así, `googleIdentity()` nunca se llama sin consentimiento. En `nav-bar.tsx`, pasar `hideWithoutConsent` al `LoginButton` de la barra.

- [ ] **Step 4: `consent-banner.tsx`.** Se muestra si `bannerOpen`. Es `<section role="dialog" aria-labelledby="consent-title" className="consent-banner glass">` con:
  - el título (`id="consent-title"`) y el texto;
  - el enlace `<Link to="/privacidad">` a la política;
  - dos `<button className="consent-choice">`, primero Rechazar y luego Aceptar, con la misma clase.

  Comportamiento:
  - Al abrirse, el foco va al primer botón (`useRef` + `useEffect`). El foco no queda atrapado y no hay fondo oscurecido.
  - Si `decision !== null` (aviso reabierto), un botón «Cerrar» (`common.close`, icono `X` de lucide) llama a `close()`.

- [ ] **Step 5: `site-footer.tsx`.** `<footer className="site-footer">` con `<Link to="/privacidad">{t("footer.privacy")}</Link>`.

- [ ] **Step 6: `styles/consent.css`** (importado en `app.css` después de `states.css`). Contiene:
  - `.consent-banner`: fijo abajo, centrado, ancho máximo ~720px; a 375px ocupa el ancho menos `var(--space-4)` por lado.
  - `.consent-choice`: idénticos entre sí.
  - `.login-consent` y `.site-footer`.

  Solo con variables de `tokens.css`. El pie deja hueco abajo (`padding-bottom`) para que el aviso no tape el enlace.

- [ ] **Step 7: `app.tsx`.** Después de `<Routes>`, añadir `<SiteFooter />` y `<ConsentBanner />`.

- [ ] **Step 8: Verificar**
Run: `cd frontend && deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/ && npx tsc -b && npx oxlint`
Expected: PASS y sin errores (incluido `ningún color fuera de tokens.css`).

- [ ] **Step 9: Commit**
`git add` de los archivos listados y `git commit -m "feat(frontend): aviso de consentimiento, pie de página y login condicionado"`.

---

### Task 5: Página `/privacidad`

**Files:**
- Create: `frontend/src/pages/privacy.tsx`, `frontend/src/lib/privacy-policy.ts`
- Modify: `frontend/src/app.tsx`, `frontend/src/i18n/es.ts`, `frontend/src/i18n/en.ts`, `frontend/src/styles/consent.css`

**Interfaces:**
- Consumes: `useConsent()` (Task 3); `CONSENT_VERSION`, `CONSENT_KEY` (Task 1).
- Produces: `PrivacyPage()` en la ruta `/privacidad`. `privacy-policy.ts` exporta `CONTACT_EMAIL = "pedmoya@alumnos.uai.cl"` y `POLICY_UPDATED = "2026-11-21"` (la fecha se muestra con `Intl` según el idioma).

- [ ] **Step 1: Textos `privacy.*` en `es.ts` y `en.ts`.** Una clave de título por sección y los párrafos o ítems necesarios. El correo va como `{{email}}` y la versión como `{{version}}`. Contenido obligatorio por sección (spec, «Contenido de la política»):
  1. **Responsable:** «Rigly, proyecto de la asignatura de Diseño de Software de la Universidad Adolfo Ibáñez», contacto `{{email}}`.
  2. **Qué datos y para qué:**
     - cuenta de Google (nombre, correo, identificador) vía Supabase;
     - idioma del perfil;
     - reseñas **públicas** (nota, comentario, nombre);
     - guardados **privados**;
     - ubicación GPS **solo en tu dispositivo**: no se envía ni se guarda.
  3. **Almacenamiento en el navegador y cookies:** tabla con `consentimiento`, `idioma`, `sb-<proyecto>-auth-token` y las cookies de Google. Para cada una, qué es, para qué sirve y cuándo se guarda (como la tabla del spec). Añadir que las cookies que Google ya puso en su dominio se borran desde el navegador.
  4. **Terceros:** Supabase, Google Identity Services, Vercel y las tiendas (imágenes y enlaces). Subapartado **Transferencias internacionales**: estos proveedores pueden tratar datos en servidores fuera de Chile; sin nombrar regiones.
  5. **Base legal:** consentimiento para el navegador y el inicio de sesión; las funciones pedidas para reseñas y guardados.
  6. **Plazos:** mientras exista la cuenta; `localStorage` hasta cambiar la decisión o borrar los datos del navegador.
  7. **Derechos** (Ley 19.628 / Ley 21.719): acceso, rectificación, supresión (incluido borrar la cuenta), oposición y portabilidad, escribiendo a `{{email}}`.
  8. **Tu elección:** estado actual (`privacy.choice.accepted` / `rejected` / `undecided`) y botones.
  9. **Cambios:** si la política cambia de forma importante, se vuelve a preguntar. Mostrar «Versión {{version}} · Última actualización {{date}}».

  La traducción inglesa es fiel, sin añadir ni quitar compromisos.

- [ ] **Step 2: Ejecutar `messages.test.ts`**
Run: `cd frontend && deno test --no-config src/i18n/`
Expected: PASS.

- [ ] **Step 3: `pages/privacy.tsx`.** `<main className="wrap privacy">` con `h1` y un `h2` por sección. El correo va como `<a href="mailto:…">`. En «Tu elección» van los mismos dos botones `consent-choice` (Rechazar, Aceptar), que llaman a `reject()` / `accept()`, y el botón del estado ya elegido lleva `aria-pressed="true"`. La tabla de almacenamiento es una `<table>` con `<th scope="col">` y, a 375px, se desplaza dentro de su contenedor (sin scroll horizontal de la página).

- [ ] **Step 4: `app.tsx`.** `<Route path="/privacidad" element={<PrivacyPage />} />` antes de `*`. Estilos `.privacy` mínimos en `consent.css` (ancho de lectura ~70ch, tabla).

- [ ] **Step 5: Verificar**
Run: `cd frontend && deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/ && npx tsc -b && npx oxlint && npx vite build`
Expected: PASS y build correcto.

- [ ] **Step 6: Commit**
`git add` de los archivos listados y `git commit -m "feat(frontend): página de política de privacidad y cookies"`.

---

### Task 6: Verificación en el navegador y documentación

**Files:**
- Modify: `README.md` (sección nueva «Privacidad y cookies» antes de «Puesta en marcha», y en «Estructura» los archivos nuevos), `docs/autoria.md` (sección «Prompt 26: Política de privacidad y cookies» con el formato del archivo, y en la lista de pendientes la entrada `[x]` y `[ ] Revisar el texto de la política con alguien de la asignatura`).

- [ ] **Step 1: Arrancar** `cd frontend && npx vite` y probar con Firefox (Playwright; ver memoria: sin Chrome). Comprobar cada punto en la consola del navegador o en la lista de peticiones:
  1. Primera visita (sin datos): sale el aviso y no hay peticiones a `accounts.google.com`. `Object.keys(localStorage)` → `[]`.
  2. Rechazar: el aviso se cierra, la web está en español y `localStorage` solo tiene `consentimiento`. Cambiar a EN: el texto cambia y `idioma` sigue sin aparecer. Al recargar, todo vuelve a español y el aviso no sale. En Guardar, Reseñas y `/guardados` aparece «Revisar preferencias», que abre el aviso.
  3. Aceptar desde «Revisar preferencias»: aparece el botón de Google, se pide `gsi/client` y aparece `idioma`.
  4. Con sesión iniciada, ir a `/privacidad` → Rechazar: la página se recarga sin sesión y en español; `localStorage` solo tiene `consentimiento`.
  5. Datos antiguos: borrar `consentimiento`, poner `localStorage.idioma = "en"` y recargar. Se usa el idioma del navegador, sale el aviso y `idioma` no se borra hasta decidir.
  6. `consentimiento` con valor `"basura"`: sale el aviso, sin errores en la consola.
  7. A 375px y a 1280px, en claro y en oscuro: el aviso no tapa el pie, los botones son iguales y no hay scroll horizontal.

  Anotar en el informe cualquier punto que falle y corregirlo antes de seguir.

- [ ] **Step 2: Documentación.** README y `autoria.md` como arriba. En README, «Privacidad y cookies» resume en 4 o 5 líneas qué se guarda y con qué decisión, y enlaza al spec.

- [ ] **Step 3: Verificación completa**
Run: `(cd frontend && deno test --no-config --allow-read src/lib/ src/i18n/ src/styles/ && npx tsc -b && npx oxlint && npx vite build)`
Expected: todo PASS.

- [ ] **Step 4: Commit**
`git add README.md docs/autoria.md && git commit -m "docs: privacidad y cookies en README y autoría"`
