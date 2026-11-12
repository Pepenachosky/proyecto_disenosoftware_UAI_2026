// Nonce para el inicio de sesión con Google Identity Services.
// El hash SHA-256 (hashed) se envía a Google; el valor crudo (raw) se envía a Supabase.

// Convierte bytes a hex en minúsculas.
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// SHA-256 del texto, codificado en hex en minúsculas.
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", data)));
}

// Genera 32 bytes aleatorios (64 caracteres hex) y su hash.
export async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const hashed = await sha256Hex(raw);
  return { raw, hashed };
}
