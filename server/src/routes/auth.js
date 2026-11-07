import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { asyncRoute, requireAuth, signToken } from '../middleware/auth.js';

export const authRouter = Router();

const employeeProfile = (row) => ({
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

authRouter.post(
  '/login',
  asyncRoute(async (req, res) => {
    const mode = req.body?.mode === 'admin' ? 'admin' : 'employee';

    if (mode === 'admin') {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!email || !password) {
        return res.status(400).json({ error: 'Enter your email and password.' });
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Wrong email or password.' });
      }

      return res.json({
        token: signToken({ role: 'admin', userId: user.id, name: user.name, email: user.email }),
        admin: { id: user.id, name: user.name, email: user.email },
      });
    }

    const code = String(req.body?.code || '').trim().toUpperCase();
    const pin = String(req.body?.pin || '');
    if (!code || !pin) {
      return res.status(400).json({ error: 'Enter your employee code and PIN.' });
    }

    const employee = db.prepare('SELECT * FROM employees WHERE UPPER(code) = ?').get(code);
    if (!employee || !employee.active) {
      return res.status(401).json({ error: 'No active employee with this code.' });
    }
    if (!employee.pin_hash || !(await bcrypt.compare(pin, employee.pin_hash))) {
      return res.status(401).json({ error: 'Wrong PIN. Ask the admin to reset it.' });
    }

    return res.json({
      token: signToken({
        role: 'employee',
        employeeId: employee.id,
        name: employee.name,
        code: employee.code,
      }),
      employee: employeeProfile(employee),
    });
  }),
);

authRouter.get('/me', requireAuth, (req, res) => {
  if (req.user.role === 'admin') {
    return res.json({ role: 'admin', admin: { id: req.user.userId, name: req.user.name, email: req.user.email } });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.user.employeeId);
  if (!employee || !employee.active) {
    return res.status(401).json({ error: 'This employee account is no longer active.' });
  }
  return res.json({ role: 'employee', employee: employeeProfile(employee) });
});
