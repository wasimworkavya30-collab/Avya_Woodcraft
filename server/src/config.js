import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(here, '../..');

dotenv.config({ path: path.join(rootDir, '.env') });

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: num(process.env.PORT, 4000),
  jwtSecret: process.env.JWT_SECRET || 'avya-dev-secret-change-me',
  jwtExpiry: '12h',
  databaseFile: path.resolve(rootDir, process.env.DATABASE_FILE || 'data/avya.db'),
  workshop: {
    lat: num(process.env.WORKSHOP_LAT, 17.385),
    lng: num(process.env.WORKSHOP_LNG, 78.4867),
    radiusMetres: num(process.env.GEOFENCE_METRES, 150),
  },
  admin: {
    email: (process.env.ADMIN_EMAIL || 'admin@avyawoodcraft.in').toLowerCase(),
    password: process.env.ADMIN_PASSWORD || 'Avya@2026',
    name: 'Main Admin',
  },
  seedDemo: (process.env.SEED_DEMO || 'true').toLowerCase() !== 'false',
  clientDist: path.join(rootDir, 'client', 'dist'),
};
