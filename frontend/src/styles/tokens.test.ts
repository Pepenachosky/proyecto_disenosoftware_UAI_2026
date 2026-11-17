import { assert, assertEquals } from "jsr:@std/assert@1";

function parseVars(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

/** Devuelve el contenido del bloque que abre en `open` (con llaves balanceadas). */
function blockAt(css: string, open: number): string {
  let depth = 0;
  for (let i = css.indexOf("{", open); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) {
      return css.slice(css.indexOf("{", open) + 1, i);
    }
  }
  throw new Error("bloque sin cerrar");
}

const css = await Deno.readTextFile(new URL("./tokens.css", import.meta.url));
const darkAt = css.indexOf("@media (prefers-color-scheme: dark)");
assert(darkAt >= 0, "falta el bloque oscuro");
const darkBlock = blockAt(css, darkAt);
const lightCss = css.slice(0, darkAt) + css.slice(darkAt + darkBlock.length);
const rootAt = lightCss.indexOf(":root");
const light = parseVars(blockAt(lightCss, rootAt));
const dark = parseVars(blockAt(darkBlock, darkBlock.indexOf(":root")));

function lum(hex: string): number {
  assert(/^#[0-9a-fA-F]{6}$/.test(hex), `no es #rrggbb: ${hex}`);
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const pairs: [string, string][] = [
  ["--text", "--bg"],
  ["--text", "--surface"],
  ["--text", "--glass-solid"],
  ["--text-muted", "--bg"],
  ["--text-muted", "--surface"],
  ["--text-muted", "--surface-2"],
  ["--accent", "--bg"],
  ["--accent", "--surface"],
  ["--on-accent", "--accent"],
  ["--accent-2", "--surface"],
  ["--ok", "--surface"],
  ["--err", "--surface"],
];

for (const [mode, vars] of [["claro", light], ["oscuro", dark]] as const) {
  for (const [fg, bg] of pairs) {
    Deno.test(`contraste ${mode}: ${fg} sobre ${bg} >= 4.5`, () => {
      assert(vars[fg] && vars[bg], `faltan ${fg} o ${bg}`);
      const ratio = contrast(vars[fg], vars[bg]);
      assert(ratio >= 4.5, `${ratio.toFixed(2)} < 4.5`);
    });
  }
}

Deno.test("--focus es el acento", () => {
  assertEquals(light["--focus"], "var(--accent)");
});

Deno.test("ningún color fuera de tokens.css", async () => {
  const files = [new URL("../app.css", import.meta.url)];
  for await (const e of Deno.readDir(new URL("./", import.meta.url))) {
    if (e.name.endsWith(".css") && e.name !== "tokens.css") {
      files.push(new URL(`./${e.name}`, import.meta.url));
    }
  }
  for (const f of files) {
    const text = await Deno.readTextFile(f);
    assert(
      !/#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(|hsl\(/.test(text),
      `color fijo en ${f.pathname}`,
    );
  }
});
