// Lectura y escritura de la decisión de consentimiento fuera de React: Supabase e i18n
// se inicializan al importar sus módulos, antes de que exista ningún componente.
import {
  CONSENT_KEY,
  keysToClear,
  parseConsent,
  resolveDecision,
  serializeConsent,
  type Decision,
} from "./lib/consent.ts";

// Decisión tomada en esta visita: respaldo si localStorage no la guardó (modo privado).
let current: Decision | null = null;

// Siempre se mira lo guardado primero: otra pestaña puede haber cambiado la decisión.
export function readDecision(): Decision | null {
  let stored: Decision | null = null;
  try {
    stored = parseConsent(localStorage.getItem(CONSENT_KEY));
  } catch {
    // Sin localStorage, vale la decisión en memoria.
  }
  return resolveDecision(stored, current);
}

/** Guarda la decisión en memoria y, si se puede, en localStorage. No borra datos: eso es clearStoredData. */
export function writeDecision(d: Decision): void {
  current = d;
  try {
    localStorage.setItem(CONSENT_KEY, serializeConsent(d, new Date()));
  } catch {
    // Sin localStorage la decisión vale solo para esta visita; el aviso volverá a salir.
  }
}

/** Solo con consentimiento aceptado se escribe en localStorage (idioma y sesión). */
export function storageAllowed(): boolean {
  return readDecision() === "aceptado";
}

/** Borra el idioma y la sesión de Supabase guardados en este navegador. */
export function clearStoredData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null) keys.push(k);
    }
    for (const k of keysToClear(keys)) localStorage.removeItem(k);
  } catch {
    // Nada que borrar si localStorage no está disponible.
  }
}

// Almacenamiento para Supabase: localStorage solo con consentimiento; si no, memoria.
const memory = new Map<string, string>();

// La decisión se consulta en cada llamada: aceptar o rechazar surte efecto sin recargar.
export const gatedStorage = {
  getItem(k: string): string | null {
    if (!storageAllowed()) return memory.get(k) ?? null;
    try {
      return localStorage.getItem(k);
    } catch {
      return memory.get(k) ?? null;
    }
  },
  setItem(k: string, v: string): void {
    if (storageAllowed()) {
      try {
        localStorage.setItem(k, v);
        return;
      } catch {
        // Cae a memoria.
      }
    }
    memory.set(k, v);
  },
  removeItem(k: string): void {
    // Se borra de ambos lados: la clave pudo guardarse en memoria antes de aceptar.
    memory.delete(k);
    if (!storageAllowed()) return;
    try {
      localStorage.removeItem(k);
    } catch {
      // Nada que borrar.
    }
  },
};
