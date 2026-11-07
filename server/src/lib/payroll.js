/**
 * Payroll rules.
 *
 * A punch produces raw hours. The admin can then re-classify the day as
 * full / half / double / custom before approving it. Only approved hours are
 * payable, so `approvedHours * hourlyRate` is the salary for the month.
 */

export const DAY_TYPES = {
  full: { units: 1, label: 'Full day', short: 'P' },
  half: { units: 0.5, label: 'Half day', short: 'H' },
  double: { units: 2, label: 'Double shift', short: 'D' },
  custom: { units: null, label: 'Custom', short: 'C' },
};

export const isDayType = (value) =>
  Object.prototype.hasOwnProperty.call(DAY_TYPES, value);

export const unitsFor = (record) => {
  if (!record) return 0;
  if (record.day_type === 'custom') return Number(record.units ?? 1);
  return DAY_TYPES[record.day_type]?.units ?? 1;
};

/** Day type that matches the raw hours, used as the default after a punch-out. */
export const dayTypeForHours = (hours) => {
  if (hours >= 11) return 'double';
  if (hours <= 5) return 'half';
  return 'full';
};

/** Worked hours from a shift, with an unpaid lunch break on long shifts. */
export const workedHours = (elapsedMinutes) => {
  const breakMinutes = elapsedMinutes > 300 ? 60 : 0;
  const net = Math.max(0, elapsedMinutes - breakMinutes);
  return Math.round((net / 60) * 4) / 4;
};

/** Monthly totals for one employee. */
export const summarise = (records, { approvedOnly = false } = {}) => {
  const totals = { days: 0, units: 0, half: 0, double: 0, approvedHours: 0, pendingHours: 0 };
  for (const record of records) {
    if (record.out_min == null) continue;
    if (approvedOnly && !record.approved) continue;
    totals.days += 1;
    totals.units += unitsFor(record);
    if (record.day_type === 'half') totals.half += 1;
    if (record.day_type === 'double') totals.double += 1;
    if (record.approved) totals.approvedHours += record.hours;
    else totals.pendingHours += record.hours;
  }
  return totals;
};

/** The one-letter mark used by the monthly attendance matrix. */
export const dayMark = (record, { onLeave, sundayOff }) => {
  if (onLeave) return 'L';
  if (record && record.out_min != null) {
    return DAY_TYPES[record.day_type]?.short ?? 'P';
  }
  if (sundayOff) return 'S';
  return 'A';
};
