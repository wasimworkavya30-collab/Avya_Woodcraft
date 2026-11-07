import { Router } from 'express';
import { db } from '../db.js';
import { adminOnly } from '../middleware/auth.js';
import { today, isValidMonth } from '../lib/date.js';
import { summarise } from '../lib/payroll.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', adminOnly, (req, res) => {
  const month = isValidMonth(req.query.month) ? req.query.month : today().slice(0, 7);
  const date = today();

  const employees = db.prepare('SELECT * FROM employees WHERE active = 1 ORDER BY id').all();
  const todayRecords = db.prepare('SELECT * FROM attendance WHERE date = ?').all(date);
  const approvedLeaveToday = db
    .prepare("SELECT employee_id FROM leave_requests WHERE status = 'approved' AND from_date <= ? AND to_date >= ?")
    .all(date, date)
    .map((row) => row.employee_id);

  const recordsForMonth = db.prepare('SELECT * FROM attendance WHERE date LIKE ?').all(`${month}-%`);

  const people = employees.map((employee) => {
    const record = todayRecords.find((row) => row.employee_id === employee.id) || null;
    const onLeave = approvedLeaveToday.includes(employee.id);
    return {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      teamId: employee.team_id,
      hourlyRate: employee.hourly_rate,
      isLead: !!employee.is_lead,
      photo: employee.photo,
      onLeave,
      record: record
        ? {
            id: record.id,
            date: record.date,
            inMin: record.in_min,
            outMin: record.out_min,
            hours: record.hours,
            dayType: record.day_type,
            approved: !!record.approved,
            distanceM: record.distance_m,
          }
        : null,
    };
  });

  const present = people.filter((person) => person.record && !person.onLeave).length;
  const onLeave = people.filter((person) => person.onLeave).length;
  const notIn = people.length - present - onLeave;

  const payroll = employees.reduce((sum, employee) => {
    const totals = summarise(recordsForMonth.filter((row) => row.employee_id === employee.id));
    return sum + totals.approvedHours * employee.hourly_rate;
  }, 0);

  const pending = db
    .prepare('SELECT COUNT(*) AS count FROM attendance WHERE out_min IS NOT NULL AND approved = 0')
    .get().count;
  const pendingLeave = db.prepare("SELECT COUNT(*) AS count FROM leave_requests WHERE status = 'pending'").get().count;
  const pendingMaterial = db
    .prepare("SELECT COUNT(*) AS count FROM material_requests WHERE status = 'pending'")
    .get().count;
  const blocked = db.prepare('SELECT COUNT(*) AS count FROM blocked_attempts').get().count;

  const teams = db.prepare('SELECT * FROM teams ORDER BY sort_order').all();
  const teamPresence = teams.map((team) => {
    const members = people.filter((person) => person.teamId === team.id);
    return {
      id: team.id,
      name: team.name,
      color: team.color,
      total: members.length,
      present: members.filter((person) => person.record).length,
    };
  });

  res.json({
    date,
    month,
    people,
    counts: { present, onLeave, notIn, pendingHours: pending, pendingLeave, pendingMaterial, blocked },
    payrollApproved: Math.round(payroll),
    teamPresence,
  });
});
