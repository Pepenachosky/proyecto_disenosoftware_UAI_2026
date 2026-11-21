// Clave de agrupación: nombres distintos del mismo producto (en distintas tiendas)
// dan la misma `key`. Devuelve null si no reconoce el patrón.
// Lo usa group.ts; la `key` se guarda como product_groups.slug.

export type Category = "cpu" | "gpu" | "ram";
/** Resultado de groupKey: slug estable entre corridas y título para mostrar. */
export interface GroupKey {
  key: string; // slug [a-z0-9-]
  title: string; // nombre visible
}

/** Minúsculas, sin tildes, sin lo que va después de "p/n", y @ , ( ) como espacios. */
function normalize(name: string): string {
  // NFD separa cada tilde de su letra y el rango U+0300–U+036F la borra. Lo que sigue
  // a "p/n" es el número de parte, que cambia entre tiendas y confunde a las reglas.
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bp\/n\b.*$/, "")
    .replace(/[@,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Une las piezas presentes con guiones (las ausentes no dejan guiones dobles). */
const join = (parts: (string | undefined)[], sep: string) => parts.filter(Boolean).join(sep);

/**
 * Ryzen 3/5/7/9, Core Ultra 5/7/9 y Core i3/5/7/9 (con o sin guion). Variantes que
 * meten una palabra entre serie y modelo (p. ej. "Ryzen 5 PRO 4650G") no se reconocen.
 */
function cpuKey(t: string): GroupKey | null {
  let m = t.match(/ryzen (3|5|7|9) (\d{4}[a-z0-9]*)/);
  if (m) return { key: `amd-ryzen-${m[1]}-${m[2]}`, title: `AMD Ryzen ${m[1]} ${m[2].toUpperCase()}` };
  m = t.match(/ultra (5|7|9) (\d{3}[a-z]*)/);
  if (m) return { key: `intel-core-ultra-${m[1]}-${m[2]}`, title: `Intel Core Ultra ${m[1]} ${m[2].toUpperCase()}` };
  m = t.match(/\bi([3579])[- ]?(\d{4,5}[a-z]*)/);
  if (m) return { key: `intel-core-i${m[1]}-${m[2]}`, title: `Intel Core i${m[1]}-${m[2].toUpperCase()}` };
  return null;
}

// Ensambladores y también fabricantes de chip (AMD/NVIDIA/Intel, para tarjetas de
// referencia). Clave del mapa = como aparece normalizado; valor = como se muestra.
const GPU_MAKERS: Record<string, string> = {
  asus: "ASUS", msi: "MSI", gigabyte: "Gigabyte", zotac: "Zotac", asrock: "ASRock",
  sapphire: "Sapphire", xfx: "XFX", powercolor: "PowerColor", palit: "Palit", pny: "PNY",
  inno3d: "Inno3D", galax: "Galax", gainward: "Gainward", evga: "EVGA", amd: "AMD",
  nvidia: "NVIDIA", intel: "Intel",
};

/**
 * Clave fabricante-chip-vram (p. ej. "asus-rtx-4060-ti-8gb"). Si falta cualquiera de
 * los tres devuelve null: es preferible un grupo propio a mezclar modelos distintos.
 */
function gpuKey(t: string): GroupKey | null {
  // Fabricante: el primero que aparece en el texto.
  const maker = t.match(new RegExp(`\\b(${Object.keys(GPU_MAKERS).join("|")})\\b`))?.[1];

  let chip: string | undefined; // para la clave
  let chipTitle: string | undefined;
  let m = t.match(/\brtx ?(\d{4})( ?ti\b)?( super\b)?/);
  if (m) {
    chip = join(["rtx", m[1], m[2] && "ti", m[3] && "super"], "-");
    chipTitle = join(["GeForce RTX", m[1], m[2] && "Ti", m[3] && "Super"], " ");
  } else if ((m = t.match(/\brx ?(\d{4})( ?xt\b)?( ?gre\b)?/))) {
    chip = join(["rx", m[1], m[2] && "xt", m[3] && "gre"], "-");
    chipTitle = join(["Radeon RX", m[1], m[2] && "XT", m[3] && "GRE"], " ");
  } else if ((m = t.match(/\barc ?([ab]\d{3})/))) {
    chip = `arc-${m[1]}`;
    chipTitle = `Arc ${m[1].toUpperCase()}`;
  }

  // VRAM: "8gb" o "8g" como token aparte (no "gddr6" ni "o12g").
  const vram = t.match(/(?<![a-z0-9.])(\d{1,2}) ?g(?:b)?(?![a-z0-9])/)?.[1];

  if (!maker || !chip || !vram) return null;
  return {
    key: `${maker}-${chip}-${vram}gb`,
    title: `${GPU_MAKERS[maker]} ${chipTitle} ${vram}GB`,
  };
}

const RAM_BRANDS: Record<string, string> = {
  kingston: "Kingston", xpg: "XPG", adata: "ADATA", corsair: "Corsair", gskill: "G.Skill",
  crucial: "Crucial", teamgroup: "TeamGroup", patriot: "Patriot", lexar: "Lexar",
  samsung: "Samsung", hikvision: "Hikvision",
};
// El orden importa: se toma la primera línea contenida en el nombre, así que las
// más específicas van antes ("fury beast" antes que "fury").
const RAM_LINES = [
  "fury beast", "fury renegade", "fury impact", "fury", "lancer blade", "lancer",
  "spectrix", "vengeance", "trident", "ripjaws",
];

/**
 * Clave marca[-línea]-tipo-capacidad-velocidad-formato[-ecc]. Marca, tipo (DDRx),
 * capacidad y velocidad son obligatorios; sin ellos devuelve null.
 */
function ramKey(t: string): GroupKey | null {
  const found = t.match(/\b(kingston|xpg|adata|corsair|g\.?skill|crucial|teamgroup|patriot|lexar|samsung|hikvision)\b/g);
  if (!found) return null;
  // XPG gana sobre ADATA (XPG es la línea gamer de ADATA).
  let brand = found.includes("xpg") ? "xpg" : found[0];
  brand = brand.replace(".", "").replace(/^g\.?skill$/, "gskill");

  const line = RAM_LINES.find((l) => t.includes(l));
  const type = t.match(/\bddr[2-5]\b/)?.[0];
  // Un kit ("2x16gb") se distingue de un módulo suelto de la misma capacidad total.
  const kit = t.match(/\b(\d) ?x ?(\d+) ?gb/);
  const cap = kit ? `${kit[1]}x${kit[2]}gb` : t.match(/(?<![\d.])(\d+(?:\.\d+)?) ?gb/)?.[1];
  const capacity = kit ? cap : cap && `${cap}gb`;
  // Exige la unidad: "ddr5-6000" sin "mhz"/"mt/s" queda sin velocidad (y sin clave).
  const speed = t.match(/(\d{4}) ?(?:mhz|mt\/s)/)?.[1];
  // sodimm > rdimm/registered > dimm
  const format = /so-?dimm|notebook/.test(t) ? "sodimm" : /rdimm|registered/.test(t) ? "rdimm" : "dimm";
  // ECC solo si no dice "non-ecc" / "no ecc". El "On-Die ECC" de toda DDR5 de
  // escritorio no es memoria ECC.
  const noOnDie = t.replace(/\bon[- ]?die[- ]?ecc\b/g, " ");
  const ecc = /\becc\b/.test(noOnDie) && !/\b(non|no)[- ]?ecc\b/.test(noOnDie);

  if (!type || !capacity || !speed) return null;
  return {
    key: join([brand, line?.replace(/ /g, "-"), type, capacity, speed, format, ecc ? "ecc" : undefined], "-"),
    title: join([
      RAM_BRANDS[brand], line?.replace(/\b\w/g, (c) => c.toUpperCase()), type.toUpperCase(),
      capacity.toUpperCase().replace("X", " x "), `${speed}MHz`, format.toUpperCase(), ecc ? "ECC" : undefined,
    ], " "),
  };
}

/**
 * Clave de grupo de un nombre de producto según su categoría. null = sin patrón
 * reconocido (group.ts deja ese producto en un grupo propio "p-<id>").
 */
export function groupKey(name: string, category: Category): GroupKey | null {
  const t = normalize(name);
  if (category === "cpu") return cpuKey(t);
  if (category === "gpu") return gpuKey(t);
  return ramKey(t);
}
