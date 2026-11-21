import { createClient } from "@supabase/supabase-js";
import { gatedStorage } from "./consent-storage";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en frontend/.env",
  );
}

// Solo clave pública: las políticas RLS dejan únicamente leer datos públicos.
// La sesión solo se guarda en el navegador con consentimiento aceptado (consent-storage.ts).
export const supabase = createClient(url, key, { auth: { storage: gatedStorage } });