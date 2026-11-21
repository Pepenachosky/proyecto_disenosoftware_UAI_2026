import { assertEquals } from "jsr:@std/assert@1";
import {
  type HoursRow,
  openStatus,
  weekSchedule,
} from "../../src/lib/hours.ts";

// Lunes a viernes 10:00–19:00, sábado 10:00–14:00, domingo cerrado.
const H: HoursRow[] = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens: "10:00", closes: "19:00" })),
  { weekday: 6, opens: "10:00", closes: "14:00" },
];

Deno.test("openStatus usa hora de Chile en verano", () => {
  assertEquals(openStatus(H, new Date("2026-11-12T21:30:00Z")), { open: true, closes: "19:00" });
});

Deno.test("openStatus usa hora de Chile en invierno", () => {
  assertEquals(openStatus(H, new Date("2026-07-16T22:30:00Z")), { open: true, closes: "19:00" });
});

Deno.test("justo a la hora de cierre está cerrada", () => {
  assertEquals(openStatus(H, new Date("2026-11-12T22:00:00Z")), {
    open: false, opens: "10:00", inDays: 1, weekday: 5,
  });
});

Deno.test("antes de abrir dice hoy", () => {
  assertEquals(openStatus(H, new Date("2026-11-12T11:00:00Z")), {
    open: false, opens: "10:00", inDays: 0, weekday: 4,
  });
});

Deno.test("cerrada el sábado tarde abre el lunes", () => {
  assertEquals(openStatus(H, new Date("2026-11-14T18:00:00Z")), {
    open: false, opens: "10:00", inDays: 2, weekday: 1,
  });
});

Deno.test("pausa de almuerzo", () => {
  const L: HoursRow[] = [
    { weekday: 4, opens: "10:00:00", closes: "13:30:00" },
    { weekday: 4, opens: "15:00:00", closes: "19:00:00" },
  ];
  // jueves 14:00 Chile = 17:00Z; 12:00 Chile = 15:00Z
  assertEquals(openStatus(L, new Date("2026-11-12T17:00:00Z")), {
    open: false, opens: "15:00", inDays: 0, weekday: 4,
  });
  assertEquals(openStatus(L, new Date("2026-11-12T15:00:00Z")), { open: true, closes: "13:30" });
});

Deno.test("sin horario", () => {
  assertEquals(openStatus([], new Date("2026-11-12T15:00:00Z")), null);
});

Deno.test("weekSchedule", () => {
  const w = weekSchedule(H);
  assertEquals(w.length, 7);
  assertEquals(w[0], { weekday: 1, ranges: ["10:00 – 19:00"] });
  assertEquals(w[5], { weekday: 6, ranges: ["10:00 – 14:00"] });
  assertEquals(w[6], { weekday: 0, ranges: [] });
  assertEquals(weekSchedule([{ weekday: 1, opens: "10:00:00", closes: "19:00:00" }])[0].ranges, ["10:00 – 19:00"]);
  assertEquals(
    weekSchedule([
      { weekday: 1, opens: "15:00", closes: "19:00" },
      { weekday: 1, opens: "10:00", closes: "13:30" },
    ])[0].ranges,
    ["10:00 – 13:30", "15:00 – 19:00"],
  );
});
