import { assertEquals } from "jsr:@std/assert@1";
import { groupKey } from "./group_key.ts";

const key = (n: string, c: "cpu" | "gpu" | "ram") => groupKey(n, c)?.key;

Deno.test("CPU: misma clave entre tiendas, distinta para 7600 / 7600X / 7600X3D", () => {
  assertEquals(key("Procesador AMD Ryzen 5 7600 (AM5, 6 Cores, 12 Hilos, 3.8/5.1GHz, 32MB Caché)", "cpu"), "amd-ryzen-5-7600");
  assertEquals(key("procesador amd ryzen 5 7600 3.8ghz@5.1ghz 6 nucleos 12 hilos sam5 p/n 100-100001015box", "cpu"), "amd-ryzen-5-7600");
  assertEquals(key("procesador amd ryzen 5 7600x 4.7ghz@5.3ghz 6 nucleos 12 hilos sam5 p/n 100-100000593wof", "cpu"), "amd-ryzen-5-7600x");
  assertEquals(key("Procesador AMD Ryzen 5 7600X3D (AM5, 6 Núcleos, 12 Hilos, 4.1/4.7GHz, 96MB de Caché L3)", "cpu"), "amd-ryzen-5-7600x3d");
  assertEquals(groupKey("Procesador AMD Ryzen 5 7600X3D (AM5, ...)", "cpu")?.title, "AMD Ryzen 5 7600X3D");
  assertEquals(key("procesador intel i7-12700kf 3.6ghz s1700 p/n bx8071512700kf", "cpu"), "intel-core-i7-12700kf");
  assertEquals(key("procesador intel i5 12600k 3.7ghz s1700 p/n bx8071512600k", "cpu"), "intel-core-i5-12600k");
  assertEquals(key("Procesador Intel Core i7-12700, Socket LGA 1700, 12 Core/20 Thread, 3.6/5.0 GHz, 25MB Caché", "cpu"), "intel-core-i7-12700");
  assertEquals(key("procesador intel core ultra 5 245k 5.2ghz 24mb cache s1851 p/n bx80768245k", "cpu"), "intel-core-ultra-5-245k");
  assertEquals(key("Procesador Intel Core Ultra 9 285 (LGA1851, 2.5/5.6 GHz 8 P-Cores, 16 E-cores, 36MB Cache)", "cpu"), "intel-core-ultra-9-285");
});

Deno.test("GPU: fabricante + chip + VRAM", () => {
  assertEquals(key("tarjeta gráfica gigabyte radeon rx 9050 gaming oc 8gb gddr6 pcie 5.0 hdmi 2.1 displayport 2.1a", "gpu"), "gigabyte-rx-9050-8gb");
  assertEquals(key("Tarjeta de Video Gigabyte Radeon RX 9050 Gaming OC, 8GB GDDR6, 128-bits, PCI-e 5.0, 2x DP, 1x HDMI", "gpu"), "gigabyte-rx-9050-8gb");
  assertEquals(key("Tarjeta gráfica MSI GeForce RTX 5070 Ti SHADOW 3X OC de 16GB GDDR7", "gpu"), "msi-rtx-5070-ti-16gb");
  assertEquals(key("tarjeta de video asus prime radeon rx 9070 gre oc 12gb - prime-rx9070gre-o12g", "gpu"), "asus-rx-9070-gre-12gb");
  assertEquals(key("tarjeta de video asrock intel arc b580 challenger gaming 12gb gddr6 192 bit p/n 90-ga5lzz-00uanf", "gpu"), "asrock-arc-b580-12gb");
  assertEquals(key("tarjeta de video asrock radeon rx7600 challenger 8gb oc p/n 90-ga41zz-00uanz", "gpu"), "asrock-rx-7600-8gb");
  assertEquals(groupKey("tarjeta de video zotac gaming geforce rtx 3050 twin edge", "gpu"), null); // sin VRAM
});

Deno.test("RAM: marca + línea + tipo + capacidad + velocidad + formato", () => {
  assertEquals(key("Memoria RAM Kingston Fury Beast de 64GB (DDR5, 5600MHz, CL36, DIMM)", "ram"), "kingston-fury-beast-ddr5-64gb-5600-dimm");
  assertEquals(key("Kit Memorias RAM Kingston Fury Beast de 32GB (2 x 16GB, DDR5, 5600MHz, CL36, EXPO, DIMM)", "ram"), "kingston-fury-beast-ddr5-2x16gb-5600-dimm");
  assertEquals(key("memoria sodimm kingston 16gb ddr4 3200mhz - unbuffered p/n kvr32s22s8/16", "ram"), "kingston-ddr4-16gb-3200-sodimm");
  assertEquals(key("Memoria RAM DDR4 Kingston 32GB, DDR4 3200MT/S, NON-ECC, UNBUFFERED, CL22, DIMM", "ram"), "kingston-ddr4-32gb-3200-dimm");
  assertEquals(key("Memoria RAM Kingston de 32GB (DDR4, 3200Mhz, Non-ECC, Unbuffered, DIMM)", "ram"), "kingston-ddr4-32gb-3200-dimm");
  assertEquals(key("memoria ddr5 xpg lancer udimm adata 8gb 5600mhz black rgb p/n ax5u5600c468g-slabrbk", "ram"), "xpg-lancer-ddr5-8gb-5600-dimm");
  assertEquals(key("Memoria RAM para Notebook ADATA 16GB DDR5, 4800Mhz, SODIMM, Negro", "ram"), "adata-ddr5-16gb-4800-sodimm");
});
