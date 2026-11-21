// Contexto de autenticación: refleja la sesión de Supabase Auth (SSO con Google)
// como un usuario mínimo { id, name } para el resto de la app.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Lo único que la app necesita del usuario de Supabase.
type AppUser = { id: string; name: string };
type AuthValue = {
  user: AppUser | null;
  loading: boolean;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

// Nombre a mostrar: el de Google (full_name/name en user_metadata) o, si falta, el correo.
function toAppUser(u: User | null | undefined): AppUser | null {
  if (!u) return null;
  const m = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
  return { id: u.id, name: m.full_name ?? m.name ?? u.email ?? "" };
}

/**
 * Mantiene el usuario de la sesión de Supabase (iniciada con Google desde LoginButton).
 * Expone `user`, `loading` (true hasta conocer la sesión inicial) y `signOut`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // getSession da la sesión ya guardada; onAuthStateChange cubre los cambios
    // posteriores (inicio/cierre de sesión, renovación del token).
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(toAppUser(data.session?.user));
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toAppUser(session?.user));
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(error.message);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Acceso al contexto de sesión; lanza error si se usa fuera de AuthProvider. */
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
