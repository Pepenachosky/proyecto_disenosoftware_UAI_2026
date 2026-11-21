// Contexto de idioma: une i18next, la preferencia guardada en el navegador (solo con
// consentimiento) y profiles.language del usuario en Supabase.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import i18n from "./i18n/index.ts";
import { useAuth } from "./auth.tsx";
import { useConsent } from "./consent.tsx";
import { storageAllowed } from "./consent-storage.ts";
import { fetchProfileLanguage, saveProfileLanguage } from "./data.ts";
import { intlLocale, onLogin, parseLang, STORAGE_KEY, type Lang } from "./lib/locale.ts";

type LanguageValue = {
  lang: Lang;
  locale: "es-CL" | "en-US";
  setLang(l: Lang): void;
};

const LanguageContext = createContext<LanguageValue | null>(null);

function writeStoredLang(l: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    // localStorage puede fallar (modo privado): el idioma sigue activo en memoria.
  }
}

/**
 * Idioma activo (es/en) y su locale Intl. Depende de Auth (sincroniza el idioma
 * con el perfil del usuario) y de Consent (solo lo guarda en localStorage con
 * consentimiento). Expone `lang`, `locale` y `setLang`.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  // i18n ya se inicializó con el idioma guardado o el del navegador.
  const [lang, setLangState] = useState<Lang>(() => parseLang(i18n.language) ?? "es");

  // El atributo lang de <html> sigue al idioma activo (lectores de pantalla, traductor del navegador).
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = i18n.t("common.appTitle");
  }, [lang]);

  const { user } = useAuth();
  const userId = user?.id ?? null;
  // setLang lee el usuario desde un ref para no recrearse (ni re-renderizar consumidores) al cambiar la sesión.
  const userIdRef = useRef<string | null>(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);
  // Idioma activo, siempre al día (el estado de React llega un render tarde).
  const langRef = useRef<Lang>(lang);
  // Se incrementa cada vez que el usuario elige idioma: sirve para detectar la carrera con la lectura del perfil.
  const choiceRef = useRef(0);

  // Aplica el idioma (i18n, localStorage y estado) sin tocar el perfil.
  const apply = useCallback((l: Lang) => {
    langRef.current = l;
    void i18n.changeLanguage(l);
    if (storageAllowed()) writeStoredLang(l);
    setLangState(l);
  }, []);

  // Aceptar guarda el idioma activo; rechazar vuelve a español (sin guardarlo).
  // Al cargar no hace falta: i18n ya arrancó con el idioma que toca (startLang).
  const { onDecision } = useConsent();
  useEffect(
    () =>
      onDecision((d) => {
        if (d === "aceptado") writeStoredLang(langRef.current);
        else apply("es");
      }),
    [onDecision, apply],
  );

  const setLang = useCallback(
    (l: Lang) => {
      choiceRef.current += 1;
      apply(l);
      const id = userIdRef.current;
      if (id) {
        saveProfileLanguage(id, l).catch((e) =>
          console.warn("No se pudo guardar el idioma en el perfil:", e),
        );
      }
    },
    [apply],
  );

  // Al iniciar sesión (o cambiar de cuenta) el perfil manda; si no tiene idioma, se guarda el actual.
  useEffect(() => {
    if (!userId) return;
    const ticket = choiceRef.current;
    let cancelled = false;
    (async () => {
      try {
        const profileValue = await fetchProfileLanguage(userId);
        if (cancelled) return; // cerró sesión o cambió de cuenta
        if (choiceRef.current !== ticket) {
          // El usuario eligió idioma mientras se leía el perfil: gana su elección.
          await saveProfileLanguage(userId, langRef.current);
          return;
        }
        const { lang: next, saveToProfile } = onLogin(profileValue, langRef.current);
        apply(next); // idempotente: también deja el idioma del perfil en localStorage
        if (saveToProfile) await saveProfileLanguage(userId, next);
      } catch (e) {
        console.warn("No se pudo sincronizar el idioma con el perfil:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, apply]);

  const value = useMemo(
    () => ({ lang, locale: intlLocale(lang), setLang }),
    [lang, setLang],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Acceso al contexto de idioma; lanza error si se usa fuera de LanguageProvider. */
export function useLanguage(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage debe usarse dentro de LanguageProvider");
  return ctx;
}
