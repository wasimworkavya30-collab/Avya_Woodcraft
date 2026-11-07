import { Router } from 'express';
import { db } from '../db.js';
import { adminOnly } from '../middleware/auth.js';

export const teamsRouter = Router();

const mapTeam = (row) => ({ id: row.id, name: row.name, color: row.color, sortOrder: row.sort_order });

teamsRouter.get('/', adminOnly, (req, res) => {
  const teams = db.prepare('SELECT * FROM teams ORDER BY sort_order').all().map(mapTeam);
  const employees = db
    .prepare('SELECT * FROM employees WHERE active = 1 ORDER BY is_lead DESC, id')
    .all();

  res.json(
    teams.map((team) => ({
      ...team,
      members: employees
        .filter((employee) => employee.team_id === team.id)
        .map((employee) => ({
          id: employee.id,
          name: employee.name,
          role: employee.role,
          code: employee.code,
          isLead: !!employee.is_lead,
          isManager: !!employee.is_manager,
          photo: employee.photo,
        })),
    })),
  );
});

teamsRouter.get('/org', adminOnly, (req, res) => {
  const employees = db.prepare('SELECT * FROM employees WHERE active = 1').all();
  const ceo = db.prepare('SELECT name FROM users ORDER BY id LIMIT 1').get();

  res.json({
    ceo: ceo?.name || 'Main Admin',
    managers: employees
      .filter((employee) => employee.is_manager)
      .map((employee) => ({
        id: employee.id,
        name: employee.name,
        role: employee.role,
        teamId: employee.team_id,
        photo: employee.photo,
      })),
    leaders: employees
      .filter((employee) => employee.is_lead)
      .map((employee) => ({
        id: employee.id,
        name: employee.name,
        role: employee.role,
        teamId: employee.team_id,
        photo: employee.photo,
      })),
  });
});
