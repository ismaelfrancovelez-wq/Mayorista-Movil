// lib/business-hours.ts

import { addBusinessDays, isWeekend, differenceInHours, differenceInMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Horario de un día
 */
export type DaySchedule = {
  open: string;   // "09:00"
  close: string;  // "18:00"
  closed: boolean;
};

/**
 * Horarios semanales del fabricante
 */
export type WeekSchedule = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

/**
 * Horario por defecto (Lun-Vie 9-18)
 */
export const DEFAULT_SCHEDULE: WeekSchedule = {
  monday: { open: '09:00', close: '18:00', closed: false },
  tuesday: { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday: { open: '09:00', close: '18:00', closed: false },
  friday: { open: '09:00', close: '18:00', closed: false },
  saturday: { open: '00:00', close: '00:00', closed: true },
  sunday: { open: '00:00', close: '00:00', closed: true },
};

/**
 * Calcula la fecha límite de retiro (48hs hábiles)
 */
export function calculatePickupDeadline(
  startDate: Date,
  schedule: WeekSchedule = DEFAULT_SCHEDULE
): Date {
  const argDate = toZonedTime(startDate, TIMEZONE);
  
  // Agregar 48 horas hábiles (2 días hábiles completos)
  let deadline = addBusinessDays(argDate, 2);
  
  // Ajustar a horario de cierre del día
  const dayKey = getDayKey(deadline);
  const daySchedule = schedule[dayKey];
  
  if (!daySchedule.closed) {
    const [closeHour, closeMin] = daySchedule.close.split(':').map(Number);
    deadline.setHours(closeHour, closeMin, 0, 0);
  }
  
  return fromZonedTime(deadline, TIMEZONE);
}

/**
 * Obtiene el tiempo restante hasta el deadline
 */
export function getTimeRemaining(deadline: Date): {
  hours: number;
  minutes: number;
  expired: boolean;
  formatted: string;
} {
  const now = toZonedTime(new Date(), TIMEZONE);
  const end = toZonedTime(deadline, TIMEZONE);
  
  const expired = now > end;
  
  if (expired) {
    return {
      hours: 0,
      minutes: 0,
      expired: true,
      formatted: 'VENCIDO',
    };
  }
  
  const totalMinutes = differenceInMinutes(end, now);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  const formatted = hours > 24
    ? `${Math.floor(hours / 24)} días ${hours % 24}hs`
    : `${hours}hs ${minutes}min`;
  
  return {
    hours,
    minutes,
    expired: false,
    formatted,
  };
}

/**
 * Formatea horarios para mostrar
 */
export function formatSchedule(schedule: WeekSchedule): string {
  const days = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ];

  const lines: string[] = [];

  for (const day of days) {
    const daySchedule = schedule[day.key as keyof WeekSchedule];
    
    if (daySchedule.closed) {
      lines.push(`${day.label}: Cerrado`);
    } else {
      lines.push(`${day.label}: ${daySchedule.open} - ${daySchedule.close}`);
    }
  }

  return lines.join('\n');
}

/**
 * Verifica si una fecha está en horario hábil
 */
export function isBusinessHour(
  date: Date,
  schedule: WeekSchedule
): boolean {
  const argDate = toZonedTime(date, TIMEZONE);
  
  if (isWeekend(argDate)) return false;
  
  const dayKey = getDayKey(argDate);
  const daySchedule = schedule[dayKey];
  
  if (daySchedule.closed) return false;
  
  const hours = argDate.getHours();
  const minutes = argDate.getMinutes();
  const currentTime = hours * 60 + minutes;
  
  const [openHour, openMin] = daySchedule.open.split(':').map(Number);
  const [closeHour, closeMin] = daySchedule.close.split(':').map(Number);
  
  const openTime = openHour * 60 + openMin;
  const closeTime = closeHour * 60 + closeMin;
  
  return currentTime >= openTime && currentTime <= closeTime;
}

/**
 * Obtiene la clave del día de la semana
 */
function getDayKey(date: Date): keyof WeekSchedule {
  const dayNames: (keyof WeekSchedule)[] = [
    'sunday', 'monday', 'tuesday', 'wednesday',
    'thursday', 'friday', 'saturday'
  ];
  
  return dayNames[date.getDay()];
}

/**
 * Formatea fecha para Argentina
 */
export function formatArgentinaDate(date: Date): string {
  const argDate = toZonedTime(date, TIMEZONE);
  
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  }).format(argDate);
}