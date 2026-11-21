// Inicio de sesión con Google: carga el script de Google Identity Services bajo
// demanda y entrega el token a Supabase (signInWithIdToken).
import { supabase } from "./supabase";
import i18n from "./i18n/index.ts";
import { createNonce } from "./lib/nonce";

// Tipos mínimos del script de Google Identity Services (solo lo que se usa).
type GoogleButtonOptions = {
  type: "standard" | "icon";
  theme: "outline" | "filled_black";
  size: "medium" | "large";
  text: "signin_with";
  shape: "rectangular" | "pill" | "circle";
  logo_alignment: "left";
  locale: "es" | "en";
};
/** API de google.accounts.id que usa el botón de inicio de sesión. */
export type GoogleId = {
  initialize(config: {
    client_id: string;
    nonce: string;
    auto_select: boolean;
    callback(response: { credential: string }): void;
  }): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const SCRIPT_URL = "https://accounts.google.com/gsi/client";

// Inserta el script; resuelve false (nunca rechaza) si no carga, p. ej. por un bloqueador.
function loadScript(): Promise<boolean> {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn("No se pudo cargar el script de Google (¿bloqueado o sin conexión?)");
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

// El token de Google lleva el hash del nonce; Supabase recibe el valor original
// y comprueba que coincidan, así un token robado no sirve para otra sesión.
// No hay respaldo por redirección ni One Tap (prompt): decisión del usuario.
// Si falta el ID de cliente o el script no carga, devuelve null y no se dibuja botón.
async function init(): Promise<GoogleId | null> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) {
    console.warn("Falta VITE_GOOGLE_CLIENT_ID en frontend/.env: no se muestra el botón de Google");
    return null;
  }
  try {
    if (!(await loadScript())) return null;
    const id = window.google?.accounts.id;
    if (!id) return null;
    const { raw, hashed } = await createNonce();
    id.initialize({
      client_id: clientId,
      nonce: hashed,
      // Sin inicio de sesión automático: el usuario siempre pulsa el botón.
      auto_select: false,
      callback: (response) => {
        supabase.auth
          .signInWithIdToken({ provider: "google", token: response.credential, nonce: raw })
          .then(({ error }) => {
            if (error) alert(i18n.t("reviews.loginFailed", { message: error.message }));
          })
          .catch((e: unknown) => {
            alert(i18n.t("reviews.loginFailed", { message: e instanceof Error ? e.message : String(e) }));
          });
      },
    });
    return id;
  } catch (e) {
    console.warn("No se pudo inicializar Google Identity Services", e);
    return null;
  }
}

// Se guarda la promesa (no el resultado) para que llamadas simultáneas compartan la carga.
let cached: Promise<GoogleId | null> | null = null;

// Carga e inicializa una sola vez por página. Un null también queda guardado:
// no se reintenta hasta recargar.
export function googleIdentity(): Promise<GoogleId | null> {
  return (cached ??= init());
}
