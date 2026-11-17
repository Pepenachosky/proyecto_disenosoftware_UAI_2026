// Horario de tienda y estado abierta/cerrada, siempre con la hora de Chile
// (nunca la zona horaria del computador).
export type HoursRow = { weekday: number; opens: string; closes: string };

export type OpenStatus =
  | { open: true; closes: string }
  | { open: false; opens: string; inDays: number; weekday: number }
  | null;

const ZONA = "America/Santiago";
const DIAS_CORTO = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formato = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Día de la semana (0 = domingo) y minutos desde medianoche en Chile.
export function chileClock(now: Date): { weekday: number; minutes: number } {
  const partes = formato.formatToParts(now);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return {
    weekday: DIAS_CORTO.indexOf(valor("weekday")),
    minutes: Number(valor("hour")) * 60 + Number(valor("minute")),
  };
}

// "HH:MM" o "HH:MM:SS" -> minutos desde medianoche.
function aMinutos(hora: string): number {
  const [h, m] = hora.split(":");
  return Number(h) * 60 + Number(m);
}

// "HH:MM:SS" -> "HH:MM".
const hhmm = (hora: string) => hora.slice(0, 5);

// Tramos de un día, ordenados por hora de apertura.
function tramosDelDia(hours: HoursRow[], weekday: number): HoursRow[] {
  return hours
    .filter((r) => r.weekday === weekday)
    .sort((a, b) => aMinutos(a.opens) - aMinutos(b.opens));
}

export function openStatus(hours: HoursRow[], now: Date): OpenStatus {
  if (hours.length === 0) return null;
  const { weekday, minutes } = chileClock(now);

  const hoy = tramosDelDia(hours, weekday);
  const actual = hoy.find((r) => aMinutos(r.opens) <= minutes && minutes < aMinutos(r.closes));
  if (actual) return { open: true, closes: hhmm(actual.closes) };

  // Próximo tramo: lo que queda de hoy y luego hasta 7 días hacia adelante
  // (el 7.º es el mismo día de la semana, por si hoy ya pasó su horario).
  for (let delta = 0; delta <= 7; delta++) {
    const dia = (weekday + delta) % 7;
    const siguiente = tramosDelDia(hours, dia).find(
      (r) => delta > 0 || aMinutos(r.opens) > minutes,
    );
    if (siguiente) {
      return { open: false, opens: hhmm(siguiente.opens), inDays: delta, weekday: dia };
    }
  }
  return null;
}

// 7 filas de lunes (1) a domingo (0); sin texto en ningún idioma.
// Los tramos van ordenados; una lista vacía significa cerrado.
export function weekSchedule(hours: HoursRow[]): { weekday: number; ranges: string[] }[] {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    weekday,
    ranges: tramosDelDia(hours, weekday).map((r) => `${hhmm(r.opens)} – ${hhmm(r.closes)}`),
  }));
}
