import { Router } from 'express';
import { db } from '../db.js';
import { adminOnly, requireAuth } from '../middleware/auth.js';
import { isValidDate, isValidMonth, today } from '../lib/date.js';

export const workRouter = Router();

const mapEntry = (row) => ({
  id: row.id,
  employeeId: row.employee_id,
  date: row.date,
  task: row.task,
  item: row.item,
  hours: row.hours,
  note: row.note,
});

workRouter.get('/', requireAuth, (req, res) => {
  const filters = [];
  const values = [];

  if (req.user.role === 'employee') {
    filters.push('employee_id = ?');
    values.push(req.user.employeeId);
  } else if (req.query.employeeId) {
    filters.push('employee_id = ?');
    values.push(Number(req.query.employeeId));
  }
  if (req.query.date) {
    if (!isValidDate(req.query.date)) return res.status(400).json({ error: 'Invalid date.' });
    filters.push('date = ?');
    values.push(req.query.date);
  }
  if (req.query.month) {
    if (!isValidMonth(req.query.month)) return res.status(400).json({ error: 'Invalid month.' });
    filters.push('date LIKE ?');
    values.push(`${req.query.month}-%`);
  }

  const rows = db
    .prepare(`SELECT * FROM work_entries ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY date DESC, id DESC`)
    .all(...values);
  res.json(rows.map(mapEntry));
});

workRouter.post('/', requireAuth, (req, res) => {
  const employeeId = req.user.role === 'employee' ? req.user.employeeId : Number(req.body?.employeeId);
  const date = String(req.body?.date || today());
  const task = String(req.body?.task || '').trim();
  const item = String(req.body?.item || '').trim();
  const note = String(req.body?.note || '').trim();
  const hours = Number(req.body?.hours);

  if (!db.prepare('SELECT 1 FROM employees WHERE id = ? AND active = 1').get(employeeId)) {
    return res.status(400).json({ error: 'Choose a valid employee.' });
  }
  if (!isValidDate(date) || date > today()) {
    return res.status(400).json({ error: 'Work can only be logged for today or a past date.' });
  }
  if (!task) return res.status(400).json({ error: 'Choose the kind of work.' });
  if (!Number.isFinite(hours) || hours < 0.25 || hours > 12) {
    return res.status(400).json({ error: 'Hours must be between 0.25 and 12.' });
  }
  if (!db.prepare('SELECT 1 FROM attendance WHERE employee_id = ? AND date = ?').get(employeeId, date)) {
    return res.status(400).json({ error: 'Check in first. Work can be added only on a day you are present.' });
  }

  const { lastInsertRowid } = db
    .prepare('INSERT INTO work_entries (employee_id, date, task, item, hours, note) VALUES (?, ?, ?, ?, ?, ?)')
    .run(employeeId, date, task, item, hours, note);

  res.status(201).json(mapEntry(db.prepare('SELECT * FROM work_entries WHERE id = ?').get(lastInsertRowid)));
});

workRouter.patch('/:id', requireAuth, (req, res) => {
  const entry = db.prepare('SELECT * FROM work_entries WHERE id = ?').get(Number(req.params.id));
  if (!entry) return res.status(404).json({ error: 'Work entry not found.' });
  if (req.user.role === 'employee' && entry.employee_id !== req.user.employeeId) {
    return res.status(403).json({ error: 'You can only edit your own work.' });
  }

  const hours = Number(req.body?.hours);
  if (!Number.isFinite(hours) || hours < 0.25 || hours > 12) {
    return res.status(400).json({ error: 'Hours must be between 0.25 and 12.' });
  }

  db.prepare('UPDATE work_entries SET hours = ? WHERE id = ?').run(hours, entry.id);
  res.json(mapEntry(db.prepare('SELECT * FROM work_entries WHERE id = ?').get(entry.id)));
});

workRouter.delete('/:id', requireAuth, (req, res) => {
  const entry = db.prepare('SELECT * FROM work_entries WHERE id = ?').get(Number(req.params.id));
  if (!entry) return res.status(404).json({ error: 'Work entry not found.' });
  if (req.user.role === 'employee' && entry.employee_id !== req.user.employeeId) {
    return res.status(403).json({ error: 'You can only remove your own work.' });
  }

  db.prepare('DELETE FROM work_entries WHERE id = ?').run(entry.id);
  res.json({ ok: true });
});
