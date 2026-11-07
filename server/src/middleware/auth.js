import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const signToken = (payload) =>
  jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiry });

export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export const requireAuth = (req, res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only an admin can do this.' });
  }
  return next();
};

export const requireEmployee = (req, res, next) => {
  if (req.user?.role !== 'employee') {
    return res.status(403).json({ error: 'Only an employee account can do this.' });
  }
  return next();
};

/** Wraps a handler so only admins reach it. */
export const adminOnly = [requireAuth, requireAdmin];
