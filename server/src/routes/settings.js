import { Router } from 'express';
import { getSettings, setSetting, sundayWeeks } from '../db.js';
import { adminOnly, requireAuth } from '../middleware/auth.js';

export const settingsRouter = Router();

settingsRouter.get('/', requireAuth, (req, res) => {
  const settings = getSettings();
  res.json({
    ...settings,
    sundayWeeks: sundayWeeks(),
  });
});

settingsRouter.patch('/', adminOnly, (req, res) => {
  const body = req.body || {};

  if (body.sundayWeeks !== undefined) {
    if (!Array.isArray(body.sundayWeeks)) {
      return res.status(400).json({ error: 'Sunday weeks must be a list.' });
    }
    const weeks = [...new Set(body.sundayWeeks.map(Number))].filter((n) => n >= 1 && n <= 5).sort();
    setSetting('sunday_weeks', weeks.join(','));
  }

  const numeric = {
    pettyOpening: 'petty_opening',
    pettyLow: 'petty_low',
    geofenceMetres: 'geofence_metres',
  };
  for (const [field, key] of Object.entries(numeric)) {
    if (body[field] !== undefined) {
      const value = Number(body[field]);
      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({ error: `${field} must be 0 or more.` });
      }
      setSetting(key, value);
    }
  }

  if (body.businessName !== undefined) {
    setSetting('business_name', String(body.businessName).slice(0, 80));
  }

  res.json({ ...getSettings(), sundayWeeks: sundayWeeks() });
});
