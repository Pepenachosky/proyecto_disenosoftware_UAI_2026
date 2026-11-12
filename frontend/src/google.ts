import { supabase } from "./supabase";
import { createNonce } from "./lib/nonce";

// Tipos mínimos del script de Google Identity Services (solo lo que se usa).
type GoogleButtonOptions = {
  type: "standard";
  theme: "outline" | "filled_black";
  size: "medium" | "large";
  text: "signin_with";
  shape: "rectangular";
  logo_alignment: "left";
  locale: "es";
};
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
      auto_select: false,
      callback: (response) => {
        supabase.auth
          .signInWithIdToken({ provider: "google", token: response.credential, nonce: raw })
          .then(({ error }) => {
            if (error) alert("No se pudo iniciar sesión: " + error.message);
          })
          .catch((e: unknown) => {
            alert("No se pudo iniciar sesión: " + (e instanceof Error ? e.message : String(e)));
          });
      },
    });
    return id;
  } catch (e) {
    console.warn("No se pudo inicializar Google Identity Services", e);
    return null;
  }
}

let cached: Promise<GoogleId | null> | null = null;

// Carga e inicializa una sola vez por página.
export function googleIdentity(): Promise<GoogleId | null> {
  return (cached ??= init());
}
