import { db } from '../db.js';
import { config } from '../config.js';

export const isAuthorizedDevice = (deviceId) => {
  if (!deviceId) return false;
  const device = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(deviceId);
  return !!device && device.status === 'authorized';
};

export const logBlocked = ({ employeeId = null, who, device, reason }) => {
  db.prepare(
    'INSERT INTO blocked_attempts (employee_id, who, device, reason) VALUES (?, ?, ?, ?)',
  ).run(employeeId, who, device || 'Unknown device', reason);
};

/** Great-circle distance in metres between the workshop and a phone. */
export const distanceToWorkshop = (lat, lng) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(lat - config.workshop.lat);
  const dLng = toRad(lng - config.workshop.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(config.workshop.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const touchDevice = (deviceId) => {
  db.prepare("UPDATE devices SET last_seen = date('now') WHERE device_id = ?").run(deviceId);
};
