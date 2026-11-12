# Configurar el inicio de sesión con Google

El inicio de sesión usa Google a través de Supabase Auth. Hay que configurarlo en dos lados: en **Google** se crean las credenciales y en **Supabase** se pegan. No hay que tocar el código ni el `.env`: el secreto de Google queda guardado solo en Supabase.

## 0. Copiar la URL de callback de Supabase

En el proyecto de Supabase, ir a **Authentication → Sign In / Providers → Google**. Ahí aparece una **Callback URL** con esta forma:

```
https://<tu-proyecto>.supabase.co/auth/v1/callback
```

Copiarla, porque Google la pide en el paso 1. Dejar esa pestaña abierta.

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
   - **Orígenes de JavaScript autorizados**: `http://localhost:5173`
   - **URIs de redireccionamiento autorizados**: la Callback URL de Supabase del paso 0.
   - Al crear, Google muestra un **ID de cliente** y un **Secreto de cliente**. Copiar ambos.

## 2. Supabase

1. En **Authentication → Sign In / Providers → Google**:
   - activar **Enable Sign in with Google**;
   - pegar el **Client ID** y el **Client Secret**;
   - guardar.
2. En **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173`
   - **Redirect URLs**: agregar `http://localhost:5173/**`. Con los `**`, después de iniciar sesión se vuelve a la misma página donde se apretó el botón (por ejemplo, `/producto/...` o `/guardados`).

## 3. Probar

```
(cd frontend && npm run dev)
```

Abrir http://localhost:5173 y apretar **"Iniciar sesión con Google"**. Al volver, el menú debería mostrar el nombre de la cuenta y el botón "Salir".

El inicio de sesión funciona aunque no se haya ejecutado la migración 002. Pero para **guardar productos y escribir reseñas** hay que ejecutar la migración (ver [`migracion-002.md`](migracion-002.md)) y después `(cd scraper && deno task group)`.

## Errores comunes

| Error | Causa |
|---|---|
| `redirect_uri_mismatch` (en Google) | La URI de redireccionamiento en Google no es exactamente la Callback URL de Supabase. |
| `Unsupported provider: provider is not enabled` | Google no quedó activado o guardado en Supabase. |
| "Acceso bloqueado" o "app no verificada" | El correo no está en **Usuarios de prueba**. |
| Se vuelve a `localhost:3000` o a otra página | Falta `http://localhost:5173/**` en Redirect URLs, o la Site URL está mal. |

## Al hacer el deploy

Agregar el dominio real en tres lugares:

- en Google, como **origen autorizado**;
- en Supabase, como **Site URL**;
- en Supabase, en **Redirect URLs** (`https://tu-dominio/**`).

La Callback URL de Supabase no cambia. Además, el hosting debe servir `index.html` para todas las rutas (por ejemplo, `/producto/...`), porque la app usa rutas del navegador.
