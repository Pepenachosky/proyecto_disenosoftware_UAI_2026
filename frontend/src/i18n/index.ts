import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { initialLang, STORAGE_KEY } from "../lib/locale.ts";
import { es } from "./es.ts";
import { en } from "./en.ts";

// localStorage puede fallar (modo privado, datos bloqueados).
function leerStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// Inicialización síncrona: el primer render ya tiene los textos.
void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: initialLang(leerStorage(), navigator.language),
  fallbackLng: "es",
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18n;
