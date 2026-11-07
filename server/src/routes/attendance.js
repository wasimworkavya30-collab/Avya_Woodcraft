import { Router } from 'express';
import { db, getSetting, transaction } from '../db.js';
import { config } from '../config.js';
import { adminOnly, requireAuth, requireEmployee } from '../middleware/auth.js';
import { distanceToWorkshop, isAuthorizedDevice, logBlocked, touchDevice } from '../lib/device.js';
import { dayTypeForHours, isDayType, unitsFor, workedHours } from '../lib/payroll.js';
import { isValidDate, isValidMonth, minutesNow, today } from '../lib/date.js';

export const attendanceRouter = Router();

const mapRecord = (row) => ({
  id: row.id,
  employeeId: row.employee_id,
  date: row.date,
  inMin: row.in_min,
  outMin: row.out_min,
  hours: row.hours,
  dayType: row.day_type,
  units: row.units,
  approved: !!row.approved,
  distanceM: row.distance_m,
  selfie: row.selfie,
  inTs: row.in_ts,
  outTs: row.out_ts,
});

const geofenceLimit = () => Number(getSetting('geofence_metres', config.workshop.radiusMetres));

/**
 * The punch gate: authorized phone, inside the workshop fence, fresh selfie.
 * Returns null when the punch may go ahead, or the error response to send.
 */
function checkPunchGate(req, employee) {
  const deviceId = req.get('x-device-id');
  if (!isAuthorizedDevice(deviceId)) {
    logBlocked({
      employeeId: employee.id,
      who: employee.name,
      device: req.get('x-device-model') || 'Unregistered phone',
      reason: 'Device not registered',
    });
    return {
      status: 403,
      body: { error: 'Attendance is blocked: this phone is not the authorized company mobile.' },
    };
  }

  const { latitude, longitude, distanceM, selfie } = req.body || {};
  let distance = null;
  if (typeof distanceM === 'number') distance = Math.round(distanceM);
  else if (typeof latitude === 'number' && typeof longitude === 'number') {
    distance = distanceToWorkshop(latitude, longitude);
  }

  if (distance == null) {
    return { status: 400, body: { error: 'Location is required. Turn on location and try again.' } };
  }
  if (distance > geofenceLimit()) {
    return {
      status: 400,
      body: {
        error: `You are ${distance} m from the workshop. Move within ${geofenceLimit()} m.`,
        distanceM: distance,
      },
    };
  }
  if (!selfie) {
    return { status: 400, body: { error: 'Take a selfie before punching.' } };
  }

  touchDevice(deviceId);
  return { distance };
}

const employeeById = (id) => db.prepare('SELECT * FROM employees WHERE id = ?').get(id);

attendanceRouter.get('/', adminOnly, (req, res) => {
  const { month, date, employeeId } = req.query;
  const filters = [];
  const values = [];

  if (month) {
    if (!isValidMonth(month)) return res.status(400).json({ error: 'Month must look like 2026-11.' });
    filters.push('date LIKE ?');
    values.push(`${month}-%`);
  }
  if (date) {
    if (!isValidDate(date)) return res.status(400).json({ error: 'Invalid date.' });
    filters.push('date = ?');
    values.push(date);
  }
  if (employeeId) {
    filters.push('employee_id = ?');
    values.push(Number(employeeId));
  }

  const rows = db
    .prepare(`SELECT * FROM attendance ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY date DESC, employee_id`)
    .all(...values);
  res.json(rows.map(mapRecord));
});

attendanceRouter.get('/pending', adminOnly, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM attendance WHERE out_min IS NOT NULL AND approved = 0 ORDER BY date DESC, employee_id')
    .all();
  res.json(rows.map(mapRecord));
});

attendanceRouter.get('/me', requireAuth, requireEmployee, (req, res) => {
  const month = String(req.query.month || today().slice(0, 7));
  if (!isValidMonth(month)) return res.status(400).json({ error: 'Month must look like 2026-11.' });

  const rows = db
    .prepare('SELECT * FROM attendance WHERE employee_id = ? AND date LIKE ? ORDER BY date DESC')
    .all(req.user.employeeId, `${month}-%`);
  res.json({ month, records: rows.map(mapRecord), today: mapRecord(db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(req.user.employeeId, today()) || {}) });
});

attendanceRouter.post('/punch-in', requireAuth, requireEmployee, (req, res) => {
  const employee = employeeById(req.user.employeeId);
  if (!employee || !employee.active) {
    return res.status(403).json({ error: 'This employee account is inactive.' });
  }

  const date = today();
  if (db.prepare('SELECT 1 FROM attendance WHERE employee_id = ? AND date = ?').get(employee.id, date)) {
    return res.status(409).json({ error: 'You already checked in today.' });
  }

  const gate = checkPunchGate(req, employee);
  if (gate.status) return res.status(gate.status).json(gate.body);

  const now = new Date();
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO attendance (employee_id, date, in_min, hours, day_type, approved, distance_m, selfie, in_ts)
       VALUES (?, ?, ?, 0, 'full', 0, ?, ?, ?)`,
    )
    .run(employee.id, date, minutesNow(), gate.distance, req.body.selfie, now.toISOString());

  res.status(201).json(mapRecord(db.prepare('SELECT * FROM attendance WHERE id = ?').get(lastInsertRowid)));
});

attendanceRouter.post('/punch-out', requireAuth, requireEmployee, (req, res) => {
  const employee = employeeById(req.user.employeeId);
  if (!employee) return res.status(404).json({ error: 'Employee not found.' });

  const open = db
    .prepare('SELECT * FROM attendance WHERE employee_id = ? AND out_min IS NULL ORDER BY date DESC')
    .get(employee.id);
  if (!open) return res.status(400).json({ error: 'You are not checked in.' });

  const gate = checkPunchGate(req, employee);
  if (gate.status) return res.status(gate.status).json(gate.body);

  const now = new Date();
  const elapsed = open.in_ts
    ? Math.max(0, Math.round((now.getTime() - new Date(open.in_ts).getTime()) / 60000))
    : Math.max(0, minutesNow() - open.in_min);
  const hours = workedHours(elapsed);
  const dayType = dayTypeForHours(hours);

  db.prepare(
    `UPDATE attendance
     SET out_min = ?, out_ts = ?, hours = ?, day_type = ?, approved = 0, selfie = COALESCE(?, selfie)
     WHERE id = ?`,
  ).run(open.in_min + elapsed, now.toISOString(), hours, dayType, req.body.selfie || null, open.id);

  const updated = db.prepare('SELECT * FROM attendance WHERE id = ?').get(open.id);
  res.json({ ...mapRecord(updated), message: `Checked out. ${hours.toFixed(2)} h sent for approval.` });
});

attendanceRouter.patch('/:id', adminOnly, (req, res) => {
  const record = db.prepare('SELECT * FROM attendance WHERE id = ?').get(Number(req.params.id));
  if (!record) return res.status(404).json({ error: 'Attendance record not found.' });

  const updates = [];
  const values = [];

  if (req.body.dayType !== undefined) {
    if (!isDayType(req.body.dayType)) return res.status(400).json({ error: 'Unknown day type.' });
    updates.push('day_type = ?');
    values.push(req.body.dayType);
  }
  if (req.body.hours !== undefined) {
    const hours = Number(req.body.hours);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      return res.status(400).json({ error: 'Hours must be between 0 and 24.' });
    }
    updates.push('hours = ?');
    values.push(hours);
  }
  if (req.body.units !== undefined) {
    const units = Number(req.body.units);
    if (!Number.isFinite(units) || units < 0 || units > 3) {
      return res.status(400).json({ error: 'Days must be between 0 and 3.' });
    }
    updates.push('units = ?');
    values.push(units);
  }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });

  values.push(record.id);
  db.prepare(`UPDATE attendance SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(mapRecord(db.prepare('SELECT * FROM attendance WHERE id = ?').get(record.id)));
});

attendanceRouter.post('/:id/approve', adminOnly, (req, res) => {
  const record = db.prepare('SELECT * FROM attendance WHERE id = ?').get(Number(req.params.id));
  if (!record) return res.status(404).json({ error: 'Attendance record not found.' });
  if (record.out_min == null) {
    return res.status(400).json({ error: 'This shift is still open. Approve it after check-out.' });
  }

  const dayType = req.body?.dayType && isDayType(req.body.dayType) ? req.body.dayType : record.day_type;
  const hours =
    req.body?.hours !== undefined && Number.isFinite(Number(req.body.hours))
      ? Number(req.body.hours)
      : record.hours;

  db.prepare(
    "UPDATE attendance SET approved = 1, day_type = ?, hours = ?, approved_at = datetime('now') WHERE id = ?",
  ).run(dayType, hours, record.id);

  res.json(mapRecord(db.prepare('SELECT * FROM attendance WHERE id = ?').get(record.id)));
});

attendanceRouter.post('/approve-all', adminOnly, (req, res) => {
  const pending = db.prepare('SELECT id FROM attendance WHERE out_min IS NOT NULL AND approved = 0').all();
  const approve = db.prepare(
    "UPDATE attendance SET approved = 1, approved_at = datetime('now') WHERE id = ?",
  );
  const run = () => transaction(() => pending.forEach((row) => approve.run(row.id)));
  run();
  res.json({ approved: pending.length });
});

/**
 * Monthly report editing: the admin sets the days worked on any date.
 * 0 days removes the record and marks the day absent.
 */
attendanceRouter.put('/cell', adminOnly, (req, res) => {
  const employeeId = Number(req.body.employeeId);
  const date = String(req.body.date || '');
  const units = req.body.units === null || req.body.units === '' ? 0 : Number(req.body.units);
  const hoursOverride = req.body.hours === undefined || req.body.hours === '' ? null : Number(req.body.hours);

  if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(employeeId)) {
    return res.status(404).json({ error: 'Employee not found.' });
  }
  if (!isValidDate(date)) return res.status(400).json({ error: 'Invalid date.' });
  if (date > today()) return res.status(400).json({ error: 'Attendance cannot be set for a future date.' });
  if (!Number.isFinite(units) || units < 0 || units > 3) {
    return res.status(400).json({ error: 'Days must be between 0 and 3.' });
  }

  if (units === 0 && hoursOverride == null) {
    db.prepare('DELETE FROM attendance WHERE employee_id = ? AND date = ?').run(employeeId, date);
    return res.json({ removed: true });
  }

  const dayType = units === 0.5 ? 'half' : units === 1 ? 'full' : units === 2 ? 'double' : 'custom';
  const hours = hoursOverride ?? (dayType === 'half' ? 4 : dayType === 'double' ? 14 : units * 8);
  const inMin = 9 * 60;
  const outMin = inMin + Math.round(hours * 60) + (hours > 5 ? 60 : 0);

  db.prepare(
    `INSERT INTO attendance (employee_id, date, in_min, out_min, hours, day_type, units, approved, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
     ON CONFLICT(employee_id, date) DO UPDATE SET
       out_min = excluded.out_min, hours = excluded.hours, day_type = excluded.day_type,
       units = excluded.units, approved = 1, approved_at = datetime('now')`,
  ).run(employeeId, date, inMin, outMin, hours, dayType, dayType === 'custom' ? units : null);

  res.json(mapRecord(db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(employeeId, date)));
});

attendanceRouter.get('/summary/:employeeId', adminOnly, (req, res) => {
  const month = String(req.query.month || today().slice(0, 7));
  const records = db
    .prepare('SELECT * FROM attendance WHERE employee_id = ? AND date LIKE ?')
    .all(Number(req.params.employeeId), `${month}-%`)
    .map(mapRecord);

  const days = records.filter((record) => record.outMin != null);
  res.json({
    month,
    days: days.length,
    units: days.reduce((sum, record) => sum + unitsFor(record), 0),
    approvedHours: days.filter((r) => r.approved).reduce((sum, r) => sum + r.hours, 0),
    pendingHours: days.filter((r) => !r.approved).reduce((sum, r) => sum + r.hours, 0),
  });
});
