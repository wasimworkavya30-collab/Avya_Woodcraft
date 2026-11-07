import crypto from 'node:crypto';
import { Router } from 'express';
import { db } from '../db.js';
import { adminOnly, requireAuth, requireEmployee } from '../middleware/auth.js';

export const devicesRouter = Router();

const mapBlocked = (row) => ({
  id: row.id,
  who: row.who,
  device: row.device,
  reason: row.reason,
  at: row.created_at,
});

const activePairing = () =>
  db
    .prepare("SELECT * FROM pairing_codes WHERE used_at IS NULL AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1")
    .get();

devicesRouter.get('/', adminOnly, (req, res) => {
  const devices = db.prepare('SELECT * FROM devices ORDER BY id').all();
  const blocked = db.prepare('SELECT * FROM blocked_attempts ORDER BY id DESC LIMIT 20').all();
  const pairing = activePairing();

  res.json({
    devices: devices.map((device) => ({
      id: device.id,
      deviceId: device.device_id,
      label: device.label,
      model: device.model,
      status: device.status,
      pairedOn: device.paired_on,
      lastSeen: device.last_seen,
    })),
    blocked: blocked.map(mapBlocked),
    pairing: pairing ? { code: pairing.code, expiresAt: pairing.expires_at } : null,
  });
});

devicesRouter.post('/pairing-code', adminOnly, (req, res) => {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.prepare("UPDATE pairing_codes SET used_at = datetime('now') WHERE used_at IS NULL").run();
  db.prepare("INSERT INTO pairing_codes (code, expires_at) VALUES (?, datetime('now', '+10 minutes'))").run(code);
  res.status(201).json({ code, expiresInMinutes: 10 });
});

/** An employee registers the phone they are holding as the company mobile. */
devicesRouter.post('/pair', requireAuth, requireEmployee, (req, res) => {
  const code = String(req.body?.code || '').trim();
  const deviceId = String(req.body?.deviceId || '').trim();
  const model = String(req.body?.model || 'Company mobile').trim();

  if (!deviceId) return res.status(400).json({ error: 'This device could not be identified.' });

  const pairing = db
    .prepare("SELECT * FROM pairing_codes WHERE code = ? AND used_at IS NULL AND expires_at > datetime('now')")
    .get(code);

  if (!pairing) {
    return res.status(400).json({ error: 'That pairing code is wrong or has expired.' });
  }

  const existing = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(deviceId);

  db.prepare("UPDATE devices SET status = 'revoked' WHERE device_id <> ? AND status = 'authorized'").run(deviceId);

  if (existing) {
    db.prepare(
      "UPDATE devices SET status = 'authorized', model = ?, last_seen = date('now'), paired_on = date('now') WHERE device_id = ?",
    ).run(model, deviceId);
  } else {
    db.prepare(
      "INSERT INTO devices (device_id, label, model, status, paired_on, last_seen) VALUES (?, 'Company mobile', ?, 'authorized', date('now'), date('now'))",
    ).run(deviceId, model);
  }

  db.prepare("UPDATE pairing_codes SET used_at = datetime('now') WHERE id = ?").run(pairing.id);

  res.json({ ok: true, message: 'This phone is now the authorized company mobile.' });
});

devicesRouter.delete('/:id', adminOnly, (req, res) => {
  const result = db.prepare("UPDATE devices SET status = 'revoked' WHERE id = ?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Device not found.' });
  res.json({ ok: true });
});

devicesRouter.delete('/blocked/all', adminOnly, (req, res) => {
  db.prepare('DELETE FROM blocked_attempts').run();
  res.json({ ok: true });
});

/** Used by the login screen to label the device row without auth. */
devicesRouter.get('/whoami', (req, res) => {
  const deviceId = String(req.query.deviceId || '');
  const device = deviceId ? db.prepare('SELECT * FROM devices WHERE device_id = ?').get(deviceId) : null;
  res.json({
    deviceId,
    authorized: !!device && device.status === 'authorized',
    model: device?.model || null,
    fingerprint: crypto.createHash('sha1').update(deviceId || 'unknown').digest('hex').slice(0, 8),
  });
});
