import { describe, expect, it } from 'vitest';
import { defaultDueDateForRecurrence, getNextDueDate, isRecurring } from '@/lib/recurrence';

describe('recurrence helpers', () => {
  it('detects recurring patterns', () => {
    expect(isRecurring('daily')).toBe(true);
    expect(isRecurring('none')).toBe(false);
  });

  it('creates a default due date for recurring items', () => {
    expect(defaultDueDateForRecurrence('weekly', new Date('2026-04-09T09:00:00Z'))).toBe('2026-04-09');
    expect(defaultDueDateForRecurrence('none', new Date('2026-04-09T09:00:00Z'))).toBeNull();
  });

  it('advances the next due date according to the pattern', () => {
    expect(getNextDueDate('2026-04-09', 'daily')).toBe('2026-04-10');
    expect(getNextDueDate('2026-04-09', 'weekly')).toBe('2026-04-16');
    expect(getNextDueDate('2026-04-09', 'monthly')).toBe('2026-05-09');
  });
});