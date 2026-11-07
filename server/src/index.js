import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { ensureSeed } from './seed.js';
import { authRouter } from './routes/auth.js';
import { employeesRouter } from './routes/employees.js';
import { teamsRouter } from './routes/teams.js';
import { attendanceRouter } from './routes/attendance.js';
import { workRouter } from './routes/work.js';
import { leaveRouter } from './routes/leave.js';
import { payrollRouter } from './routes/payroll.js';
import { devicesRouter } from './routes/devices.js';
import { settingsRouter } from './routes/settings.js';
import { dashboardRouter } from './routes/dashboard.js';
import { opsRouter } from './routes/ops.js';
import { backupRouter } from './routes/backup.js';

const seeded = ensureSeed();

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    app: 'Avya Woodcraft attendance',
    tier: { presentation: 'React', logic: 'Express', data: 'SQLite' },
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/work', workRouter);
app.use('/api/leave', leaveRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ops', opsRouter);
app.use('/api/backup', backupRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route.' }));

// Serve the built single page app when it exists (production mode).
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`API ready on http://localhost:${config.port}`);
  console.log(`Database: ${config.databaseFile}`);
  if (seeded) console.log('Sample data loaded. Admin login: ' + config.admin.email);
});
