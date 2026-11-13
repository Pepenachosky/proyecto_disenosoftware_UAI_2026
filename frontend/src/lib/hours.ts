// Horario de tienda y estado abierta/cerrada, siempre con la hora de Chile
// (nunca la zona horaria del computador).
export type HoursRow = { weekday: number; opens: string; closes: string };

export type OpenStatus =
  | { open: true; closes: string }
  | { open: false; opens: string; when: "hoy" | "mañana" | string }
  | null;

const ZONA = "America/Santiago";
const DIAS_CORTO = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DIAS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

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
      const when = delta === 0 ? "hoy" : delta === 1 ? "mañana" : `el ${DIAS_ES[dia]}`;
      return { open: false, opens: hhmm(siguiente.opens), when };
    }
  }
  return null;
}

export function statusText(s: OpenStatus): string {
  if (s === null) return "Horario no disponible";
  if (s.open) return `Abierta · cierra ${s.closes}`;
  return `Cerrada · abre ${s.when} ${s.opens}`;
}

const SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// 7 filas de lunes a domingo; varios tramos se unen con ", ".
export function weekSchedule(hours: HoursRow[]): { day: string; text: string }[] {
  return SEMANA.map((day, i) => {
    const tramos = tramosDelDia(hours, (i + 1) % 7);
    return {
      day,
      text: tramos.length
        ? tramos.map((r) => `${hhmm(r.opens)} – ${hhmm(r.closes)}`).join(", ")
        : "Cerrado",
    };
  });
}
