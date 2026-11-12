# Botón oficial de Google — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el botón casero de inicio de sesión por el botón oficial que dibuja el script de Google (Google Identity Services) y entrar a Supabase con el token que entrega Google.

**Architecture:** Un módulo carga el script de Google una sola vez, crea un nonce, llama a `google.accounts.id.initialize` y, cuando Google devuelve el token, llama a `supabase.auth.signInWithIdToken`. `LoginButton` pasa a ser un `<div>` donde Google dibuja su botón (`renderButton`). La sesión que queda en Supabase es la misma de antes, así que reseñas, guardados y "Salir" no cambian. Se elimina el inicio de sesión por redirección (`signInWithOAuth`).

**Tech Stack:** React 19 + TypeScript + Vite, `@supabase/supabase-js` 2.x (`signInWithIdToken`), Google Identity Services (`https://accounts.google.com/gsi/client`), Web Crypto (`crypto.subtle`), `deno test` para la lógica pura.

**Spec:** acordado en la conversación del 2026-11-12 (sin documento de diseño):
- Botón oficial del script de Google, en español, texto "Iniciar sesión con Google". Puede mostrar "Continuar como…" cuando Google lo decida.
- Va en los 4 lugares que hoy usan `LoginButton`: barra de navegación, reseñas, botón de guardar y página Guardados. La frase de contexto queda fuera del botón.
- Sin respaldo: si el script de Google no carga, no se muestra nada.
- Sin One Tap: no hay aviso flotante.
- Tema claro o oscuro según `prefers-color-scheme` (propuesta del asistente, aceptada).
- Pasos manuales para Google Cloud Console, Supabase y `frontend/.env`, documentados.
- Prompt 17 en `docs/autoria.md` y actualización del grafo.

## Global Constraints

- Sin dependencias nuevas de npm. Los tipos del script de Google se declaran a mano, en lo mínimo que se use.
- Nunca llamar a `google.accounts.id.prompt()`: eso es One Tap.
- Sin respaldo de redirección: se elimina `signIn()` / `signInWithOAuth`. Si el script no carga o falta el ID de cliente, el lugar del botón queda vacío y solo se escribe un `console.warn`, sin `throw`.
- Variable nueva: `VITE_GOOGLE_CLIENT_ID` en `frontend/.env`. Es pública y es el mismo ID de cliente web que ya usa Supabase.
- Opciones de `renderButton`: `type: "standard"`, `text: "signin_with"`, `shape: "rectangular"`, `logo_alignment: "left"`, `locale: "es"`, `theme: "outline"` en modo claro y `"filled_black"` en modo oscuro. Tamaño `"large"` por defecto y `"medium"` en la barra de navegación.
- Frases fuera del botón: reseñas → "Inicia sesión para dejar tu reseña"; guardar → "Inicia sesión para guardar"; Guardados mantiene su `<p>` actual.
- Comentarios y documentación en español, con el estilo de los archivos existentes.

## Review Focus

1. **Falta `VITE_GOOGLE_CLIENT_ID`:** la app abre normal, sin botón y con un `console.warn`, nunca con pantalla en blanco (a diferencia de `supabase.ts`, que sí hace `throw`). Lo cubre Task 2.
2. **Script bloqueado (bloqueador de anuncios, sin red):** no se muestra nada y no hay error sin capturar. Lo cubre Task 2.
3. **El usuario cambia el modo claro/oscuro con la página abierta:** el botón se vuelve a dibujar con el tema correcto. Lo cubre Task 2.
4. **Navegar antes de que el script termine de cargar:** no se dibuja en un elemento desmontado y no aparecen errores en consola. Lo cubre Task 2.
5. **Supabase rechaza el token** (ID de cliente no autorizado, nonce distinto): mensaje visible y el usuario sigue sin sesión. Lo cubre Task 2.

---

### Task 1: Nonce (lógica pura con pruebas)

**Files:**
- Create: `frontend/src/lib/nonce.ts`
- Test: `frontend/src/lib/nonce.test.ts`

**Interfaces:**
- Produces: `export async function sha256Hex(text: string): Promise<string>` (hex en minúsculas) y `export async function createNonce(): Promise<{ raw: string; hashed: string }>`, donde `hashed === await sha256Hex(raw)`.

- [ ] **Step 1: Escribir `nonce.test.ts`** con el estilo de los `*.test.ts` existentes en `src/lib/`:
  - `sha256Hex("abc")` es `"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"`.
  - `createNonce()`: `hashed === await sha256Hex(raw)`, `raw.length >= 32` y `/^[0-9a-f]{64}$/.test(hashed)`.
  - Dos llamadas a `createNonce()` dan `raw` distintos.
- [ ] **Step 2: Correr y verificar que falla.** Run: `cd frontend && deno test --no-config src/lib/nonce.test.ts`. Expected: FAIL (no existe el módulo).
- [ ] **Step 3: Implementar.** `raw` sale de `crypto.getRandomValues` (32 bytes en hex) y `sha256Hex` usa `crypto.subtle.digest("SHA-256", ...)`.
- [ ] **Step 4: Verificar.** Run: `cd frontend && deno test --no-config src/lib/`. Expected: todas PASS.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/nonce.ts frontend/src/lib/nonce.test.ts
git commit -m "feat(frontend): nonce para el inicio de sesión con Google"
```

### Task 2: Botón oficial y sesión con el token de Google

**Files:**
- Create: `frontend/src/google.ts`
- Modify: `frontend/src/components/login-button.tsx` (se reescribe), `frontend/src/auth.tsx` (sale `signIn`), `frontend/src/components/reviews.tsx:102-103`, `frontend/src/components/save-button.tsx:15`, `frontend/src/components/nav-bar.tsx:20`, `frontend/src/app.css` (sale `.product .login-button` del grupo de selectores en la línea ~305; se agregan estilos mínimos del contenedor)

**Interfaces:**
- Consumes: `createNonce()` (Task 1); `supabase` de `src/supabase.ts`.
- Produces:
  - `src/google.ts`: `export function googleIdentity(): Promise<GoogleId | null>`. Está memoizada (carga el script e inicializa una sola vez por página) y devuelve `null` si falta `VITE_GOOGLE_CLIENT_ID` o el script no carga. `GoogleId` es un tipo local mínimo con `initialize` y `renderButton`.
  - `LoginButton({ size }: { size?: "medium" | "large" })`.
  - `AuthValue` sin `signIn`.

- [ ] **Step 1: `src/google.ts`**
  - Carga del script: agregar `<script src="https://accounts.google.com/gsi/client" async>` a `document.head`. La promesa se resuelve en `onload` y da `null` en `onerror`, con `console.warn`.
  - Inicialización: `createNonce()` y luego `google.accounts.id.initialize({ client_id, nonce: hashed, auto_select: false, callback })`.
  - El `callback` llama a `supabase.auth.signInWithIdToken({ provider: "google", token: response.credential, nonce: raw })`. Si hay error, `alert("No se pudo iniciar sesión: " + error.message)`.
  - Sin `prompt()`.
  - Comentario breve: por qué hay nonce y por qué no hay respaldo, que fue decisión del usuario.
- [ ] **Step 2: Reescribir `LoginButton`**
  - Renderiza `<div className="google-button">` con un `ref`.
  - En un `useEffect`: `googleIdentity()` y luego `renderButton(el, opciones de Global Constraints)`. El tema sale de `matchMedia("(prefers-color-scheme: dark)")`.
  - Escucha el `change` de ese media query para vaciar el `div` y volver a dibujar.
  - Usa una bandera `cancelled` en el cleanup para no dibujar si el componente ya se desmontó.
- [ ] **Step 3: Quitar `signIn` de `auth.tsx`** (tipo y valor). La sesión nueva llega sola por `onAuthStateChange`, que no cambia.
- [ ] **Step 4: Lugares donde se usa**
  - `nav-bar.tsx`: `<LoginButton size="medium" />`.
  - `reviews.tsx`: `<p>Inicia sesión para dejar tu reseña</p>` + `<LoginButton />`.
  - `save-button.tsx`: "Inicia sesión para guardar" + `<LoginButton />`, envuelto en un elemento simple.
  - `saved-page.tsx`: sin cambios de texto, solo deja de existir la prop `label`.
- [ ] **Step 5: CSS.** Quitar `.product .login-button` del grupo de selectores, sin tocar `.save-button` ni `.review-actions button`. Agregar `.google-button { min-height: 40px; }`, y 32px en `.nav-user .google-button`, para que el contenido no salte mientras carga.
- [ ] **Step 6: Verificar.** Run: `cd frontend && deno task lint && deno task build && deno test --no-config src/lib/`. Expected: lint sin errores nuevos (solo los 2 avisos de antes, en `auth.tsx` y `saved.tsx`), build OK y pruebas PASS. Además, `grep -rn "signInWithOAuth\|prompt()" src` no devuelve nada.
- [ ] **Step 7: Commit**

```bash
git add frontend/src/google.ts frontend/src/components/login-button.tsx frontend/src/auth.tsx frontend/src/components/reviews.tsx frontend/src/components/save-button.tsx frontend/src/components/nav-bar.tsx frontend/src/pages/saved-page.tsx frontend/src/app.css
git commit -m "feat(frontend): botón oficial de Google con signInWithIdToken"
```

### Task 3: Documentación y autoría

**Files:**
- Modify: `docs/configurar-google.md`, `README.md`, `docs/autoria.md`

- [ ] **Step 1: `docs/configurar-google.md`** (minimal edits, mismo estilo)
  - Intro: ahora el botón lo dibuja Google y la app le pasa el token a Supabase. Sí hay que tocar `frontend/.env`.
  - Paso 1.3, orígenes de JavaScript autorizados: `http://localhost:5173` **y** `http://localhost`. Google pide los dos para pruebas locales.
  - Paso nuevo **"`frontend/.env`"**: `VITE_GOOGLE_CLIENT_ID=<ID de cliente>`, el mismo que se pegó en Supabase. Es público; el secreto sigue solo en Supabase.
  - Paso 2, Supabase: el ID de cliente debe estar en la lista **Client IDs** del proveedor Google. Si ya se configuró antes, ya está. Mantener **Skip nonce check desactivado**.
  - La Callback URL, las URIs de redireccionamiento y Redirect URLs ya no son necesarias para este botón. Se pueden dejar como están sin problema; decirlo en una línea.
  - Errores comunes, filas nuevas:
    - "The given origin is not allowed for the given client ID": falta el origen en Google.
    - "Nonces mismatch" / "Passed nonce and nonce in id_token should either both exist or not": se activó algo distinto en Supabase.
    - "El botón no aparece": falta `VITE_GOOGLE_CLIENT_ID`, hay que reiniciar `deno task dev`, o el script está bloqueado.
  - "Al hacer el deploy": el dominio real va como origen autorizado en Google y como `VITE_GOOGLE_CLIENT_ID` en las variables de Vercel.
- [ ] **Step 2: README.** En "Puesta en marcha → Variables de entorno", agregar `VITE_GOOGLE_CLIENT_ID=` al bloque de `frontend/.env`. Ajustar el Stack ("Supabase Auth con Google (SSO)" → "Supabase Auth con el botón oficial de Google (Google Identity Services)").
- [ ] **Step 3: `docs/autoria.md`.** Agregar `## Prompt 17: Botón oficial de Google` antes de "Por hacer", con el formato del 16. Agregar a "Por hacer": "[ ] Configurar el botón de Google: orígenes en Google Cloud, `VITE_GOOGLE_CLIENT_ID` y probar el inicio de sesión."
- [ ] **Step 4: Commit**

```bash
git add docs/configurar-google.md README.md docs/autoria.md docs/superpowers/plans/2026-11-12-boton-google-oficial.md
git commit -m "docs: botón oficial de Google, pasos de configuración y Prompt 17"
```

(El grafo lo actualiza el controlador al final con `graphify update .`.)
