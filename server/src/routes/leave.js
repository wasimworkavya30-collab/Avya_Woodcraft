import { Router } from 'express';
import { db } from '../db.js';
import { adminOnly, requireAuth } from '../middleware/auth.js';
import { isValidDate, today } from '../lib/date.js';

export const leaveRouter = Router();

const LEAVE_TYPES = ['Casual', 'Sick', 'Unpaid'];

const mapLeave = (row) => ({
  id: row.id,
  employeeId: row.employee_id,
  type: row.type,
  from: row.from_date,
  to: row.to_date,
  reason: row.reason,
  status: row.status,
  createdAt: row.created_at,
  employeeName: row.name,
});

leaveRouter.get('/', requireAuth, (req, res) => {
  const rows =
    req.user.role === 'employee'
      ? db
          .prepare(
            `SELECT l.*, e.name FROM leave_requests l JOIN employees e ON e.id = l.employee_id
             WHERE l.employee_id = ? ORDER BY l.from_date DESC`,
          )
          .all(req.user.employeeId)
      : db
          .prepare(
            `SELECT l.*, e.name FROM leave_requests l JOIN employees e ON e.id = l.employee_id
             ORDER BY CASE l.status WHEN 'pending' THEN 0 ELSE 1 END, l.from_date DESC`,
          )
          .all();

  res.json(rows.map(mapLeave));
});

leaveRouter.post('/', requireAuth, (req, res) => {
  const employeeId = req.user.role === 'employee' ? req.user.employeeId : Number(req.body?.employeeId);
  const type = String(req.body?.type || 'Casual');
  const from = String(req.body?.from || '');
  const to = String(req.body?.to || from);
  const reason = String(req.body?.reason || '').trim();

  if (!LEAVE_TYPES.includes(type)) return res.status(400).json({ error: 'Unknown leave type.' });
  if (!isValidDate(from) || !isValidDate(to)) return res.status(400).json({ error: 'Choose valid dates.' });
  if (from < today()) return res.status(400).json({ error: 'Leave cannot start in the past.' });
  if (to < from) return res.status(400).json({ error: 'The end date cannot be before the start date.' });
  if (!reason) return res.status(400).json({ error: 'Add a short reason.' });

  const { lastInsertRowid } = db
    .prepare('INSERT INTO leave_requests (employee_id, type, from_date, to_date, reason) VALUES (?, ?, ?, ?, ?)')
    .run(employeeId, type, from, to, reason);

  const created = db
    .prepare('SELECT l.*, e.name FROM leave_requests l JOIN employees e ON e.id = l.employee_id WHERE l.id = ?')
    .get(lastInsertRowid);
  res.status(201).json(mapLeave(created));
});

leaveRouter.patch('/:id', adminOnly, (req, res) => {
  const request = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(Number(req.params.id));
  if (!request) return res.status(404).json({ error: 'Leave request not found.' });

  const status = String(req.body?.status || '');
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected.' });
  }

  db.prepare("UPDATE leave_requests SET status = ?, decided_at = datetime('now') WHERE id = ?").run(status, request.id);
  const updated = db
    .prepare('SELECT l.*, e.name FROM leave_requests l JOIN employees e ON e.id = l.employee_id WHERE l.id = ?')
    .get(request.id);
  res.json(mapLeave(updated));
});

leaveRouter.delete('/:id', adminOnly, (req, res) => {
  const result = db.prepare('DELETE FROM leave_requests WHERE id = ?').run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Leave request not found.' });
  res.json({ ok: true });
});
