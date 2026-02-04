import { differenceInDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz'; // 

const TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Obtiene la fecha actual en zona horaria de Argentina
 */
export function getArgentinaDate(date: Date = new Date()): Date {
  return toZonedTime(date, TIMEZONE); // ✅ Usar toZonedTime
}

/**
 * Calcula días hasta una fecha futura (en zona horaria Argentina)
 */
export function getDaysUntil(futureDate: Date): number {
  const now = getArgentinaDate();
  const future = getArgentinaDate(futureDate);
  return differenceInDays(future, now);
}