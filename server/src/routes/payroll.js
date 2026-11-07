import { Router } from 'express';
import { db, sundayWeeks } from '../db.js';
import { adminOnly, requireAuth, requireEmployee } from '../middleware/auth.js';
import { isValidMonth, monthDates, today, weekOfMonth } from '../lib/date.js';
import { dayMark, summarise, unitsFor } from '../lib/payroll.js';

export const payrollRouter = Router();

const monthOrDefault = (value) => (isValidMonth(value) ? value : today().slice(0, 7));

const employeesInMonth = (month) =>
  db
    .prepare(
      `SELECT DISTINCT e.* FROM employees e
       LEFT JOIN attendance a ON a.employee_id = e.id AND a.date LIKE ?
       WHERE e.active = 1 OR a.id IS NOT NULL
       ORDER BY e.is_manager DESC, e.id`,
    )
    .all(`${month}-%`);

const recordsFor = (month, employeeId = null) =>
  employeeId
    ? db.prepare('SELECT * FROM attendance WHERE date LIKE ? AND employee_id = ?').all(`${month}-%`, employeeId)
    : db.prepare('SELECT * FROM attendance WHERE date LIKE ?').all(`${month}-%`);

const outstandingAdvance = (employeeId, month = null) => {
  const advance = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM advances WHERE employee_id = ?')
    .get(employeeId).total;
  const deducted = db
    .prepare(
      `SELECT COALESCE(SUM(d.amount), 0) AS total FROM advance_deductions d
       JOIN advances a ON a.id = d.advance_id WHERE a.employee_id = ? ${month ? 'AND d.month <> ?' : ''}`,
    )
    .get(...(month ? [employeeId, month] : [employeeId])).total;
  return Math.round((advance - deducted) * 100) / 100;
};

payrollRouter.get('/salary', adminOnly, (req, res) => {
  const month = monthOrDefault(req.query.month);
  const employees = employeesInMonth(month);

  const rows = employees.map((employee) => {
    const totals = summarise(recordsFor(month, employee.id));
    const deduction = db
      .prepare(
        `SELECT COALESCE(SUM(d.amount), 0) AS total FROM advance_deductions d
         JOIN advances a ON a.id = d.advance_id WHERE a.employee_id = ? AND d.month = ?`,
      )
      .get(employee.id, month).total;
    const gross = Math.round(totals.approvedHours * employee.hourly_rate * 100) / 100;
    return {
      employeeId: employee.id,
      name: employee.name,
      role: employee.role,
      teamId: employee.team_id,
      code: employee.code,
      active: !!employee.active,
      hourlyRate: employee.hourly_rate,
      ...totals,
      gross,
      deduction,
      payable: Math.round((gross - deduction) * 100) / 100,
    };
  });

  res.json({
    month,
    rows,
    totals: {
      units: rows.reduce((sum, row) => sum + row.units, 0),
      approvedHours: rows.reduce((sum, row) => sum + row.approvedHours, 0),
      pendingHours: rows.reduce((sum, row) => sum + row.pendingHours, 0),
      gross: rows.reduce((sum, row) => sum + row.gross, 0),
      deductions: rows.reduce((sum, row) => sum + row.deduction, 0),
      payable: rows.reduce((sum, row) => sum + row.payable, 0),
    },
  });
});

payrollRouter.get('/report', adminOnly, (req, res) => {
  const month = monthOrDefault(req.query.month);
  const dates = monthDates(month);
  const employees = employeesInMonth(month);
  const records = recordsFor(month);
  const overrides = Object.fromEntries(
    db.prepare('SELECT date, is_off FROM sunday_overrides').all().map((row) => [row.date, !!row.is_off]),
  );
  const leave = db.prepare("SELECT employee_id, from_date, to_date FROM leave_requests WHERE status = 'approved'").all();
  const weeks = sundayWeeks();

  const offDays = {};
  for (const date of dates) {
    if (new Date(`${date}T00:00:00`).getDay() !== 0) continue;
    offDays[date] = date in overrides ? overrides[date] : weeks.includes(weekOfMonth(date));
  }

  const rows = employees.map((employee) => {
    const mine = records.filter((record) => record.employee_id === employee.id && record.out_min != null);
    const onLeave = (date) =>
      leave.some((l) => l.employee_id === employee.id && l.from_date <= date && date <= l.to_date);

    const days = dates.map((date) => {
      const record = mine.find((item) => item.date === date);
      return {
        date,
        mark: dayMark(record, { onLeave: onLeave(date), sundayOff: offDays[date] }),
        units: unitsFor(record),
      };
    });

    return {
      employeeId: employee.id,
      name: employee.name,
      role: employee.role,
      teamId: employee.team_id,
      hourlyRate: employee.hourly_rate,
      days,
      totals: {
        present: days.filter((d) => ['P', 'H', 'D', 'C'].includes(d.mark)).length,
        half: days.filter((d) => d.mark === 'H').length,
        double: days.filter((d) => d.mark === 'D').length,
        leave: days.filter((d) => d.mark === 'L').length,
        absent: days.filter((d) => d.mark === 'A').length,
        units: days.reduce((sum, d) => sum + d.units, 0),
      },
    };
  });

  res.json({ month, dates, offDays, sundayWeeks: weeks, rows });
});

payrollRouter.put('/sunday', adminOnly, (req, res) => {
  const { date, isOff } = req.body || {};
  if (!date) return res.status(400).json({ error: 'Choose a Sunday.' });
  db.prepare(
    'INSERT INTO sunday_overrides (date, is_off) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET is_off = excluded.is_off',
  ).run(date, isOff ? 1 : 0);
  res.json({ ok: true });
});

payrollRouter.get('/me', requireAuth, requireEmployee, (req, res) => {
  const month = monthOrDefault(req.query.month);
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.user.employeeId);
  const totals = summarise(recordsFor(month, employee.id));
  const deduction = db
    .prepare(
      `SELECT COALESCE(SUM(d.amount), 0) AS total FROM advance_deductions d
       JOIN advances a ON a.id = d.advance_id WHERE a.employee_id = ? AND d.month = ?`,
    )
    .get(employee.id, month).total;

  res.json({
    month,
    ...totals,
    hourlyRate: employee.hourly_rate,
    gross: Math.round(totals.approvedHours * employee.hourly_rate * 100) / 100,
    deduction,
    payable: Math.round((totals.approvedHours * employee.hourly_rate - deduction) * 100) / 100,
  });
});

payrollRouter.get('/advances', adminOnly, (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, e.name FROM advances a JOIN employees e ON e.id = a.employee_id ORDER BY a.date DESC`,
    )
    .all();
  const deductions = db.prepare('SELECT * FROM advance_deductions').all();

  res.json(
    rows.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.name,
      date: row.date,
      amount: row.amount,
      note: row.note,
      deducted: deductions.filter((d) => d.advance_id === row.id).reduce((sum, d) => sum + d.amount, 0),
      outstanding: outstandingAdvance(row.employee_id),
    })),
  );
});

payrollRouter.post('/advances', adminOnly, (req, res) => {
  const employeeId = Number(req.body?.employeeId);
  const amount = Number(req.body?.amount);
  const date = String(req.body?.date || today());
  const note = String(req.body?.note || '').trim();

  if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(employeeId)) {
    return res.status(400).json({ error: 'Choose an employee.' });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Enter an amount above 0.' });
  }
  if (date > today()) return res.status(400).json({ error: 'Choose a date up to today.' });

  const { lastInsertRowid } = db
    .prepare('INSERT INTO advances (employee_id, date, amount, note) VALUES (?, ?, ?, ?)')
    .run(employeeId, date, amount, note);
  res.status(201).json({ id: lastInsertRowid, ok: true });
});

payrollRouter.delete('/advances/:id', adminOnly, (req, res) => {
  const result = db.prepare('DELETE FROM advances WHERE id = ?').run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Advance not found.' });
  res.json({ ok: true });
});

payrollRouter.put('/advances/:id/deduction', adminOnly, (req, res) => {
  const advance = db.prepare('SELECT * FROM advances WHERE id = ?').get(Number(req.params.id));
  if (!advance) return res.status(404).json({ error: 'Advance not found.' });

  const month = String(req.body?.month || today().slice(0, 7));
  const amount = Number(req.body?.amount);

  if (!isValidMonth(month)) return res.status(400).json({ error: 'Invalid month.' });
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'Enter an amount, 0 or more.' });
  }

  const available = outstandingAdvance(advance.employee_id, month) + amount;
  const applied = Math.min(amount, available);

  db.prepare(
    `INSERT INTO advance_deductions (advance_id, month, amount) VALUES (?, ?, ?)
     ON CONFLICT(advance_id, month) DO UPDATE SET amount = excluded.amount`,
  ).run(advance.id, month, applied);

  res.json({ ok: true, applied, limited: applied < amount });
});
