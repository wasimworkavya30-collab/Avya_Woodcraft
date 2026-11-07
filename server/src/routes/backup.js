import { Router } from 'express';
import { db, transaction } from '../db.js';
import { adminOnly } from '../middleware/auth.js';
import { seedDatabase, TEAMS } from '../seed.js';

export const backupRouter = Router();

const TABLES = [
  ['teams', 'teams'],
  ['employees', 'employees'],
  ['attendance', 'attendance'],
  ['work_entries', 'workEntries'],
  ['leave_requests', 'leaveRequests'],
  ['devices', 'devices'],
  ['blocked_attempts', 'blockedAttempts'],
  ['pairing_codes', 'pairingCodes'],
  ['sunday_overrides', 'sundayOverrides'],
  ['settings', 'settings'],
  ['products', 'products'],
  ['product_lines', 'productLines'],
  ['inventory_items', 'inventoryItems'],
  ['material_requests', 'materialRequests'],
  ['petty_entries', 'pettyEntries'],
  ['advances', 'advances'],
  ['advance_deductions', 'advanceDeductions'],
  ['orders', 'orders'],
  ['order_stages', 'orderStages'],
  ['stage_assignees', 'stageAssignees'],
];

backupRouter.get('/export', adminOnly, (req, res) => {
  const snapshot = { exportedAt: new Date().toISOString(), version: 1, data: {} };
  for (const [table, key] of TABLES) {
    snapshot.data[key] = db.prepare(`SELECT * FROM ${table}`).all();
  }
  res.setHeader('Content-Disposition', `attachment; filename="avya-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(snapshot);
});

backupRouter.post('/import', adminOnly, (req, res) => {
  const payload = req.body?.data ? req.body.data : req.body;
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.employees)) {
    return res.status(400).json({ error: 'That file is not a valid Avya backup.' });
  }

  const restore = () => transaction(() => {
    [...TABLES].reverse().forEach(([table]) => db.prepare(`DELETE FROM ${table}`).run());
    for (const [table, key] of TABLES) {
      const rows = payload[key];
      if (!Array.isArray(rows) || !rows.length) continue;
      const columns = Object.keys(rows[0]).filter((column) => /^[a-z_]+$/.test(column));
      const statement = db.prepare(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      );
      for (const row of rows) statement.run(...columns.map((column) => row[column] ?? null));
    }
  });

  try {
    restore();
  } catch (error) {
    return res.status(400).json({ error: `Import failed: ${error.message}` });
  }

  res.json({ ok: true, message: 'Backup imported.' });
});

backupRouter.post('/reset', adminOnly, (req, res) => {
  const scope = String(req.body?.scope || 'records');

  if (scope === 'all') {
    seedDatabase();
    return res.json({ ok: true, message: 'Database reset to the sample data.' });
  }

  const wipe = () => transaction(() => {
    if (scope === 'records') {
      db.prepare('DELETE FROM attendance').run();
      db.prepare('DELETE FROM work_entries').run();
      db.prepare('DELETE FROM leave_requests').run();
      db.prepare('DELETE FROM blocked_attempts').run();
      db.prepare('DELETE FROM advance_deductions').run();
      db.prepare('DELETE FROM advances').run();
    }
    if (scope === 'business') {
      db.prepare('DELETE FROM product_lines').run();
      db.prepare('DELETE FROM products').run();
      db.prepare('DELETE FROM material_requests').run();
      db.prepare('DELETE FROM inventory_items').run();
      db.prepare('DELETE FROM stage_assignees').run();
      db.prepare('DELETE FROM order_stages').run();
      db.prepare('DELETE FROM orders').run();
    }
    if (scope === 'petty') {
      db.prepare('DELETE FROM petty_entries').run();
    }
  });
  wipe();

  res.json({ ok: true, message: 'Cleared.' });
});

backupRouter.get('/meta', adminOnly, (req, res) => {
  res.json({
    teams: TEAMS,
    counts: Object.fromEntries(
      TABLES.map(([table, key]) => [key, db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count]),
    ),
  });
});
