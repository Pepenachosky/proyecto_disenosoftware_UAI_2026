// Genera frontend/src/data/comunas.ts: las 16 regiones de Chile y sus 346 comunas, cada una con
// el punto que OpenStreetMap marca como su centro (nodo admin_centre; si no, label; si no, el
// center de la relación). Overpass se usa solo al correr este script, no en producción.
//   deno task comunas

export type Comuna = { name: string; lat: number; lng: number };
export type Region = { name: string; comunas: Comuna[] };

interface OverpassElement {
  type: "node" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  center?: { lat: number; lon: number };
  members?: { type: string; ref: number; role: string }[];
}
export interface OverpassResponse {
  elements: OverpassElement[];
}

/** Regiones en orden oficial norte → sur, con su código ISO 3166-2. */
export const REGIONES_OFICIALES: { iso: string; name: string }[] = [
  { iso: "CL-AP", name: "Arica y Parinacota" },
  { iso: "CL-TA", name: "Tarapacá" },
  { iso: "CL-AN", name: "Antofagasta" },
  { iso: "CL-AT", name: "Atacama" },
  { iso: "CL-CO", name: "Coquimbo" },
  { iso: "CL-VS", name: "Valparaíso" },
  { iso: "CL-RM", name: "Metropolitana de Santiago" },
  { iso: "CL-LI", name: "Libertador General Bernardo O'Higgins" },
  { iso: "CL-ML", name: "Maule" },
  { iso: "CL-NB", name: "Ñuble" },
  { iso: "CL-BI", name: "Biobío" },
  { iso: "CL-AR", name: "La Araucanía" },
  { iso: "CL-LR", name: "Los Ríos" },
  { iso: "CL-LL", name: "Los Lagos" },
  { iso: "CL-AI", name: "Aysén del General Carlos Ibáñez del Campo" },
  { iso: "CL-MA", name: "Magallanes y de la Antártica Chilena" },
];

const TOTAL_REGIONES = 16;
const TOTAL_COMUNAS = 346;
// Instancias públicas de Overpass; si una está sobrecargada (502/504) se prueba la siguiente.
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const USER_AGENT = "comparador-hardware-chile/1.0 (proyecto universitario)";

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Convierte la respuesta de Overpass de una región en `Region` + nombres de comunas dudosas. */
export function parseRegion(json: OverpassResponse, regionName: string): { region: Region; dudosas: string[] } {
  const nodos = new Map<number, { lat: number; lon: number }>();
  for (const e of json.elements) {
    if (e.type === "node" && e.lat !== undefined && e.lon !== undefined) nodos.set(e.id, { lat: e.lat, lon: e.lon });
  }
  const bounds = json.elements.find((e) => e.type === "relation" && e.bounds)?.bounds;
  if (!bounds) throw new Error(`Sin bounds para la región ${regionName}`);

  const comunas: Comuna[] = [];
  const dudosas: string[] = [];
  for (const e of json.elements) {
    if (e.type !== "relation" || e.tags?.admin_level !== "8") continue;
    const name = e.tags.name;
    if (!name) throw new Error(`Relación ${e.id} (admin_level 8) sin nombre en la región ${regionName}`);
    const miembro = (rol: string) => {
      for (const m of e.members ?? []) {
        if (m.type === "node" && m.role === rol && nodos.has(m.ref)) return nodos.get(m.ref);
      }
    };
    const punto = miembro("admin_centre") ?? miembro("label") ?? (e.center && { lat: e.center.lat, lon: e.center.lon });
    if (!punto) throw new Error(`Comuna ${name} sin punto de centro`);
    comunas.push({ name, lat: round5(punto.lat), lng: round5(punto.lon) });
    if (punto.lat < bounds.minlat || punto.lat > bounds.maxlat || punto.lon < bounds.minlon || punto.lon > bounds.maxlon) {
      dudosas.push(name);
    }
  }
  comunas.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { region: { name: regionName, comunas }, dudosas };
}

/** Código fuente de frontend/src/data/comunas.ts (una comuna por línea, datos como JSON). */
export function toModule(regiones: Region[], fecha: string): string {
  const cuerpo = regiones
    .map((r) => {
      const filas = r.comunas.map((c) => `    ${JSON.stringify(c)}`).join(",\n");
      return `  {"name": ${JSON.stringify(r.name)}, "comunas": [\n${filas}\n  ]}`;
    })
    .join(",\n");
  return `// Generado por scraper/comunas.ts el ${fecha}; no editar a mano.
// Regiones de Chile (norte a sur) y sus comunas con el centro según OpenStreetMap.

export type Comuna = { name: string; lat: number; lng: number };
export type Region = { name: string; comunas: Comuna[] };

export const REGIONES: Region[] = JSON.parse(\`[
${cuerpo}
]\`);
`;
}

// Solo comunas que son miembros de la región (región → provincias → comunas, o comunas directas
// con rol "subarea"). No se usa `rel(area.a)`: arrastraría comunas de regiones vecinas que cruzan
// el límite regional y de comunas de Perú, Bolivia y Argentina.
function consulta(iso: string): string {
  return `[out:json][timeout:180];
rel["ISO3166-2"="${iso}"]->.r;
.r out bb tags;
rel(r.r:"subarea")->.p;
rel(r.p:"subarea")->.pp;
(.p; .pp;)->.q;
rel.q["boundary"="administrative"]["admin_level"="8"]->.c;
.c out body center;
node(r.c:"admin_centre");
out;
node(r.c:"label");
out;`;
}

/** Una respuesta sirve si trae `elements` y Overpass no avisó de un error en tiempo de ejecución (resultado truncado). */
export function esRespuestaValida(json: unknown): json is OverpassResponse {
  const j = json as { elements?: unknown; remark?: unknown } | null;
  if (!j || !Array.isArray(j.elements)) return false;
  return !(typeof j.remark === "string" && j.remark.includes("runtime error"));
}

/** Una comuna solo puede estar en una región; si aparece en dos, el filtro de la consulta falló. */
export function verificarSinDuplicados(regiones: Region[]): void {
  const vistas = new Map<string, string>();
  for (const r of regiones) {
    for (const c of r.comunas) {
      const otra = vistas.get(c.name);
      if (otra) throw new Error(`La comuna ${c.name} aparece en dos regiones: ${otra} y ${r.name}`);
      vistas.set(c.name, r.name);
    }
  }
}

/** Consulta una región y la interpreta; reintenta ante cualquier fallo (red, timeout, cuerpo inválido, truncado, sin bounds). */
async function pedir(iso: string, nombre: string): Promise<{ region: Region; dudosas: string[] }> {
  for (let intento = 1; intento <= 8; intento++) {
    try {
      const res = await fetch(ENDPOINTS[(intento - 1) % ENDPOINTS.length], {
        method: "POST",
        headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: consulta(iso) }),
        signal: AbortSignal.timeout(200_000), // el servidor corta a los 180 s
      });
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`HTTP ${res.status}`);
      }
      const json: unknown = await res.json();
      if (!esRespuestaValida(json)) throw new Error("respuesta truncada o sin elements");
      return parseRegion(json, nombre);
    } catch (e) {
      console.error(`Overpass falló para ${iso} (intento ${intento}): ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 5000 * Math.min(intento, 4)));
  }
  throw new Error(`Overpass no respondió para ${iso}`);
}

async function main() {
  const regiones: Region[] = [];
  const todasDudosas: string[] = [];
  for (const { iso, name } of REGIONES_OFICIALES) {
    const { region, dudosas } = await pedir(iso, name);
    regiones.push(region);
    todasDudosas.push(...dudosas.map((d) => `${d} (${name})`));
    console.log(`${name}: ${region.comunas.length} comunas`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  verificarSinDuplicados(regiones);
  if (todasDudosas.length) console.log(`Comunas dudosas (fuera de los bounds de su región):\n  ${todasDudosas.join("\n  ")}`);
  const total = regiones.reduce((n, r) => n + r.comunas.length, 0);
  if (regiones.length !== TOTAL_REGIONES || total !== TOTAL_COMUNAS) {
    console.error(`Se esperaban ${TOTAL_REGIONES} regiones y ${TOTAL_COMUNAS} comunas; hay ${regiones.length} y ${total}.`);
    Deno.exit(1);
  }
  await Deno.mkdir("../frontend/src/data", { recursive: true });
  await Deno.writeTextFile("../frontend/src/data/comunas.ts", toModule(regiones, new Date().toISOString().slice(0, 10)));
  console.log(`${regiones.length} regiones, ${total} comunas`);
}

if (import.meta.main) await main();
