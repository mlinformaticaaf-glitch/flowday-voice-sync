import { addDays, addMonths, addWeeks, format, parseISO } from 'date-fns';
import type { Recurrence } from '@/lib/appTypes';

export function isRecurring(recurrence: Recurrence): boolean {
  return recurrence !== 'none';
}

export function defaultDueDateForRecurrence(recurrence: Recurrence, baseDate = new Date()): string | null {
  if (!isRecurring(recurrence)) {
    return null;
  }

  return format(baseDate, 'yyyy-MM-dd');
}

export function getNextDueDate(currentDueDate: string | null, recurrence: Recurrence, baseDate = new Date()): string | null {
  if (!isRecurring(recurrence)) {
    return currentDueDate;
  }

  const anchorDate = currentDueDate ? parseISO(currentDueDate) : baseDate;

  switch (recurrence) {
    case 'daily':
      return format(addDays(anchorDate, 1), 'yyyy-MM-dd');
    case 'weekly':
      return format(addWeeks(anchorDate, 1), 'yyyy-MM-dd');
    case 'monthly':
      return format(addMonths(anchorDate, 1), 'yyyy-MM-dd');
    default:
      return currentDueDate;
  }
}