// Utilidades puras de idioma (sin dependencias, para poder probarlas con deno).
export type Lang = "es" | "en";
export const LANGS: readonly Lang[] = ["es", "en"];
/** Clave de localStorage del idioma; solo se escribe con consentimiento aceptado. */
export const STORAGE_KEY = "idioma";

/** Solo acepta "es" o "en" exactos. */
export function parseLang(v: unknown): Lang | null {
  return v === "es" || v === "en" ? v : null;
}

/** Idioma según el navegador: inglés si empieza con "en", si no español. */
export function detectLang(navLang: string | undefined): Lang {
  return navLang?.toLowerCase().startsWith("en") ? "en" : "es";
}

/** Lo guardado en localStorage manda; si no, el idioma del navegador. */
export function initialLang(stored: string | null, navLang: string | undefined): Lang {
  return parseLang(stored) ?? detectLang(navLang);
}

/** Locale para Intl (precios, fechas, números): español de Chile o inglés de EE. UU. */
export function intlLocale(lang: Lang): "es-CL" | "en-US" {
  return lang === "en" ? "en-US" : "es-CL";
}

/** Al iniciar sesión: el perfil válido manda; si no, se guarda el idioma actual en el perfil. */
export function onLogin(
  profileLang: unknown,
  current: Lang,
): { lang: Lang; saveToProfile: boolean } {
  const p = parseLang(profileLang);
  return p ? { lang: p, saveToProfile: false } : { lang: current, saveToProfile: true };
}
