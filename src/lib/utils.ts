import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_TZ = 'America/Sao_Paulo';

/** Datas sempre exibidas no fuso da igreja, em pt-BR. */
export function formatDateTime(iso: string, timeZone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
export function formatDate(iso: string, timeZone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));
}
export function formatRelative(iso: string, now = new Date()) {
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}
export function formatBRL(value: number | string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function greeting(date = new Date(), timeZone = DEFAULT_TZ) {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', hour12: false }).format(date));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

/** Converte "#B51227" em "181 18 39" para CSS variables com alpha. */
export function hexToRgbTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function tzOffsetMs(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(date).map((p) => [p.type, p.value]),
  );
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return wall - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Entrada `datetime-local` ("2030-05-01T19:30") → ISO UTC, interpretando o
 * horário no fuso da IGREJA (não no do aparelho de quem digita).
 */
export function churchLocalToIso(value: string, timeZone = DEFAULT_TZ) {
  const asUtc = new Date(`${value.length === 16 ? `${value}:00` : value}Z`);
  if (Number.isNaN(asUtc.getTime())) throw new Error('Data inválida');
  const firstPass = asUtc.getTime() - tzOffsetMs(asUtc, timeZone);
  // segunda passada corrige transições de horário de verão
  return new Date(asUtc.getTime() - tzOffsetMs(new Date(firstPass), timeZone)).toISOString();
}
