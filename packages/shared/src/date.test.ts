import { describe, it, expect } from 'vitest';
import { getBusinessDate } from './date';

describe('getBusinessDate', () => {
  it('assigns early morning hours before 5 AM to the previous calendar day', () => {
    // 2:00 AM on Sept 29 IST should belong to the Sept 28 business day
    const lateNight = new Date('2026-09-29T02:00:00+05:30');
    expect(getBusinessDate(lateNight, 'Asia/Kolkata', 5)).toBe('2026-09-28');

    // 4:59 AM on Sept 29 IST is still the Sept 28 business day
    const endOfShift = new Date('2026-09-29T04:59:00+05:30');
    expect(getBusinessDate(endOfShift, 'Asia/Kolkata', 5)).toBe('2026-09-28');
  });

  it('assigns 5:00 AM onwards to the new calendar day', () => {
    // 5:00 AM on Sept 29 IST begins the Sept 29 business day
    const morningStart = new Date('2026-09-29T05:00:00+05:30');
    expect(getBusinessDate(morningStart, 'Asia/Kolkata', 5)).toBe('2026-09-29');

    // 2:30 PM on Sept 29 IST is the Sept 29 business day
    const afternoon = new Date('2026-09-29T14:30:00+05:30');
    expect(getBusinessDate(afternoon, 'Asia/Kolkata', 5)).toBe('2026-09-29');

    // 11:30 PM on Sept 29 IST is the Sept 29 business day
    const lateEvening = new Date('2026-09-29T23:30:00+05:30');
    expect(getBusinessDate(lateEvening, 'Asia/Kolkata', 5)).toBe('2026-09-29');
  });

  it('supports custom dayStartHour', () => {
    // If venue opens at 6:00 AM:
    const custom = new Date('2026-09-29T05:30:00+05:30');
    expect(getBusinessDate(custom, 'Asia/Kolkata', 6)).toBe('2026-09-28');
  });
});
