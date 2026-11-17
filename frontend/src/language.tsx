import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import i18n from "./i18n/index.ts";
import { intlLocale, parseLang, STORAGE_KEY, type Lang } from "./lib/locale.ts";

type LanguageValue = {
  lang: Lang;
  locale: "es-CL" | "en-US";
  setLang(l: Lang): void;
};

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // i18n ya se inicializó con el idioma guardado o el del navegador.
  const [lang, setLangState] = useState<Lang>(() => parseLang(i18n.language) ?? "es");

  // El atributo lang de <html> sigue al idioma activo (lectores de pantalla, traductor del navegador).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    void i18n.changeLanguage(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // localStorage puede fallar (modo privado): el idioma sigue activo en memoria.
    }
    setLangState(l);
  }, []);

  const value = useMemo(
    () => ({ lang, locale: intlLocale(lang), setLang }),
    [lang, setLang],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage debe usarse dentro de LanguageProvider");
  return ctx;
}
