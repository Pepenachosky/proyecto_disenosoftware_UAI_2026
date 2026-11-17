import type { Messages } from "./es.ts";

// Tipa las claves de t(): una clave inexistente no compila.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: Messages };
  }
}
