# Configurar el inicio de sesión con Google

El botón de inicio de sesión lo dibuja el script oficial de Google Identity Services y la app le pasa el token que entrega Google a Supabase Auth. Hay que configurarlo en tres lados: en **Google** se crean las credenciales, en **Supabase** se pegan y en **`frontend/.env`** se deja el ID de cliente. No hay que tocar el código. El secreto de Google queda guardado solo en Supabase.

## 0. Callback URL de Supabase (ya no es necesaria)

El botón oficial de Google no usa la Callback URL de Supabase, las URIs de redireccionamiento de Google ni las Redirect URLs de Supabase. Si ya estaban configuradas, se pueden dejar como están sin problema. Se pueden omitir en una configuración nueva.

## 1. Google Cloud Console

Entrar a https://console.cloud.google.com.

1. **Crear un proyecto**: selector de arriba → "Proyecto nuevo" (por ejemplo, "Comparador hardware").
2. **Configurar la pantalla de consentimiento** en **APIs y servicios → Pantalla de consentimiento de OAuth** (en la versión nueva se llama "Google Auth Platform"):
   - Tipo de usuario: **Externo**.
   - Nombre de la app, correo de asistencia y correo del desarrollador: los propios.
   - Permisos: los básicos (`email`, `profile`, `openid`), que suelen venir por defecto.
   - **Usuarios de prueba**: agregar el correo de Google propio y el de quien vaya a probar. Mientras la app esté en modo "Prueba", solo esas cuentas pueden iniciar sesión.
3. **Crear las credenciales** en **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - **Orígenes de JavaScript autorizados**: `http://localhost:5173` **y** `http://localhost`. Google pide los dos para las pruebas locales con este botón.
   - **URIs de redireccionamiento autorizados**: no se necesitan para este botón. Si ya estaba configurada, se puede dejar.
   - Al crear, Google muestra un **ID de cliente** y un **Secreto de cliente**. Copiar ambos.

## 2. Supabase

1. En **Authentication → Sign In / Providers → Google**:
   - activar **Enable Sign in with Google**;
   - pegar el **Client ID** y el **Client Secret**;
   - comprobar que el ID de cliente esté en la lista **Client IDs** (en versiones anteriores del panel: *Authorized Client IDs*). Si Google ya se configuró antes, ya está;
   - dejar **Skip nonce check** desactivado;
   - guardar.
2. **Authentication → URL Configuration** (Site URL y Redirect URLs) ya no hace falta para este botón: la sesión se crea en la misma página, sin redirección. Se puede dejar como está.

## 3. `frontend/.env`

En `frontend/.env` agregar el mismo ID de cliente que se pegó en Supabase:

```
VITE_GOOGLE_CLIENT_ID=<ID de cliente>
```

Es un dato público; el secreto de cliente no va aquí, solo en Supabase. Después de editar el `.env`, reiniciar `deno task dev`.
## 4. Probar

```
(cd frontend && npm run dev)
```

Abrir http://localhost:5173 y apretar el botón oficial de Google (**"Iniciar sesión con Google"**, o "Continuar como…" si el navegador ya tiene una cuenta de Google). Sin recargar la página, el menú debería mostrar el nombre de la cuenta y el botón "Salir".

El inicio de sesión funciona aunque no se haya ejecutado la migración 002. Pero para **guardar productos y escribir reseñas** hay que ejecutar la migración (ver [`migracion-002.md`](migracion-002.md)) y después `(cd scraper && deno task group)`.

## Errores comunes

| Error | Causa |
|---|---|
| `Unsupported provider: provider is not enabled` | Google no quedó activado o guardado en Supabase. |
| "Acceso bloqueado" o "app no verificada" | El correo no está en **Usuarios de prueba**. |
| `The given origin is not allowed for the given client ID` | Falta el origen (`http://localhost:5173` o `http://localhost`, o el dominio real) en los orígenes de JavaScript autorizados en Google. |
| `Nonces mismatch` o `Passed nonce and nonce in id_token should either both exist or not` | Se activó algo distinto en Supabase (por ejemplo, **Skip nonce check**). Debe quedar desactivado. |
| El botón no aparece | Falta `VITE_GOOGLE_CLIENT_ID` en `frontend/.env`, no se reinició `deno task dev` o el navegador bloquea el script de Google. |

## Al hacer el deploy

Con este botón basta con dos cosas:

- en Google, agregar el dominio real como **origen autorizado**;
- en las variables de entorno de Vercel, definir `VITE_GOOGLE_CLIENT_ID`.

La Site URL y las Redirect URLs de Supabase no se usan para este botón. Además, el hosting debe servir `index.html` para todas las rutas (por ejemplo, `/producto/...`), porque la app usa rutas del navegador.
