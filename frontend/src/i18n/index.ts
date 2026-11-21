// Configuración de i18next: idioma inicial según consentimiento, lo guardado y el navegador.
// Importar este módulo inicializa i18n como efecto secundario.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { STORAGE_KEY } from "../lib/locale.ts";
import { startLang } from "../lib/consent.ts";
import { readDecision } from "../consent-storage.ts";
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
  lng: startLang(readDecision(), leerStorage(), navigator.language),
  fallbackLng: "es",
  // React ya escapa el texto al renderizar; escapar aquí lo haría dos veces.
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18n;
