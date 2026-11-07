import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { adminOnly } from '../middleware/auth.js';

export const employeesRouter = Router();

const mapEmployee = (row) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  role: row.role,
  teamId: row.team_id,
  hourlyRate: row.hourly_rate,
  isLead: !!row.is_lead,
  isManager: !!row.is_manager,
  active: !!row.active,
  photo: row.photo,
});

const nextCode = () => {
  const rows = db.prepare("SELECT code FROM employees WHERE code LIKE 'AW-%'").all();
  const highest = rows.reduce((max, row) => Math.max(max, Number(row.code.slice(3)) || 100), 100);
  return `AW-${highest + 1}`;
};

employeesRouter.get('/', adminOnly, (req, res) => {
  const includeInactive = req.query.includeInactive === '1';
  const rows = db
    .prepare(
      `SELECT * FROM employees ${includeInactive ? '' : 'WHERE active = 1'}
       ORDER BY active DESC, is_manager DESC, id ASC`,
    )
    .all();
  res.json(rows.map(mapEmployee));
});

employeesRouter.post('/', adminOnly, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const role = String(req.body?.role || '').trim();
  const teamId = String(req.body?.teamId || '');
  const rate = Number(req.body?.hourlyRate);
  const pin = String(req.body?.pin || '1234');

  if (!name || !role) return res.status(400).json({ error: 'Name and role are required.' });
  if (!db.prepare('SELECT 1 FROM teams WHERE id = ?').get(teamId)) {
    return res.status(400).json({ error: 'Choose a valid team.' });
  }
  if (!Number.isFinite(rate) || rate < 0) {
    return res.status(400).json({ error: 'Hourly rate must be 0 or more.' });
  }
  if (!/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be 4 to 6 digits.' });
  }

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO employees (code, name, role, team_id, hourly_rate, is_lead, is_manager, pin_hash, joined_on)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, date('now'))`,
    )
    .run(nextCode(), name, role, teamId, rate, /manager/i.test(role) ? 1 : 0, bcrypt.hashSync(pin, 10));

  const created = db.prepare('SELECT * FROM employees WHERE id = ?').get(lastInsertRowid);
  res.status(201).json(mapEmployee(created));
});

employeesRouter.patch('/:id', adminOnly, async (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(Number(req.params.id));
  if (!employee) return res.status(404).json({ error: 'Employee not found.' });

  const updates = [];
  const values = [];
  const body = req.body || {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return res.status(400).json({ error: 'Name cannot be empty.' });
    updates.push('name = ?');
    values.push(name);
  }
  if (body.role !== undefined) {
    const role = String(body.role).trim();
    if (!role) return res.status(400).json({ error: 'Role cannot be empty.' });
    updates.push('role = ?');
    values.push(role);
    updates.push('is_manager = ?');
    values.push(/manager/i.test(role) ? 1 : 0);
  }
  if (body.teamId !== undefined) {
    if (!db.prepare('SELECT 1 FROM teams WHERE id = ?').get(body.teamId)) {
      return res.status(400).json({ error: 'Choose a valid team.' });
    }
    updates.push('team_id = ?');
    values.push(body.teamId);
  }
  if (body.hourlyRate !== undefined) {
    const rate = Number(body.hourlyRate);
    if (!Number.isFinite(rate) || rate < 0) {
      return res.status(400).json({ error: 'Hourly rate must be 0 or more.' });
    }
    updates.push('hourly_rate = ?');
    values.push(rate);
  }
  if (body.photo !== undefined) {
    updates.push('photo = ?');
    values.push(body.photo || null);
  }
  if (body.pin !== undefined) {
    const pin = String(body.pin);
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4 to 6 digits.' });
    }
    updates.push('pin_hash = ?');
    values.push(bcrypt.hashSync(pin, 10));
  }
  if (body.isLead !== undefined) {
    const isLead = body.isLead ? 1 : 0;
    updates.push('is_lead = ?');
    values.push(isLead);
    if (isLead) {
      db.prepare('UPDATE employees SET is_lead = 0 WHERE team_id = ? AND id <> ?').run(
        body.teamId ?? employee.team_id,
        employee.id,
      );
    }
  }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });

  values.push(employee.id);
  db.prepare(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(mapEmployee(db.prepare('SELECT * FROM employees WHERE id = ?').get(employee.id)));
});

employeesRouter.delete('/:id', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!employee) return res.status(404).json({ error: 'Employee not found.' });

  db.prepare('UPDATE employees SET active = 0 WHERE id = ?').run(id);
  res.json({ ok: true, message: `${employee.name} removed. Past records are kept.` });
});

employeesRouter.post('/:id/restore', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!employee) return res.status(404).json({ error: 'Employee not found.' });
  db.prepare('UPDATE employees SET active = 1 WHERE id = ?').run(id);
  res.json(mapEmployee(db.prepare('SELECT * FROM employees WHERE id = ?').get(id)));
});

employeesRouter.get('/:id/file', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!employee) return res.status(404).json({ error: 'Employee not found.' });

  const advances = db
    .prepare('SELECT * FROM advances WHERE employee_id = ? ORDER BY date DESC')
    .all(id);
  const deductions = db
    .prepare(
      `SELECT d.advance_id AS advanceId, d.month, d.amount FROM advance_deductions d
       JOIN advances a ON a.id = d.advance_id WHERE a.employee_id = ?`,
    )
    .all(id);

  res.json({
    employee: mapEmployee(employee),
    advances: advances.map((row) => ({
      id: row.id,
      date: row.date,
      amount: row.amount,
      note: row.note,
      deducted: deductions.filter((d) => d.advanceId === row.id).reduce((sum, d) => sum + d.amount, 0),
      deductions: deductions.filter((d) => d.advanceId === row.id),
    })),
  });
});
