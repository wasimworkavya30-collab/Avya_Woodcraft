import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, getSettings, setSetting, transaction } from './db.js';
import { config } from './config.js';
import { addDays, currentMonth, today } from './lib/date.js';

export const TEAMS = [
  { id: 'mgmt', name: 'Management', color: 'var(--t-mgmt)' },
  { id: 'design', name: 'Design studio', color: 'var(--t-design)' },
  { id: 'carp', name: 'Carpentry', color: 'var(--t-carp)' },
  { id: 'polish', name: 'Polish & finishing', color: 'var(--t-polish)' },
  { id: 'house', name: 'Housekeeping', color: 'var(--t-house)' },
];

const STAFF = [
  ['Anand', 'Sr Carpenter · Team Leader', 'carp', 1, 140],
  ['Surya', 'Manager & Sr Designer', 'design', 1, 180],
  ['Rajesh Swamy', 'Manager', 'mgmt', 1, 170],
  ['Wasim', 'Designer', 'design', 0, 120],
  ['Santosh', 'Sr Carpenter', 'carp', 0, 125],
  ['Ghanshyam', 'Sr Carpenter', 'carp', 0, 125],
  ['Srinivas K', 'Carpenter', 'carp', 0, 100],
  ['Srinivas Ch', 'Carpenter', 'carp', 0, 100],
  ['Avdesh', 'Carpenter', 'carp', 0, 95],
  ['Devendra Pal', 'Carpenter', 'carp', 0, 95],
  ['Sahabuddin', 'Carpenter', 'carp', 0, 95],
  ['Amarjeet', 'Polish', 'polish', 0, 105],
  ['Sarvajeet', 'Polish', 'polish', 0, 100],
  ['Brijesh', 'Polish', 'polish', 0, 100],
  ['Bhavani', 'Cleaning', 'house', 0, 70],
  ['Satyapal', 'Carpenter', 'carp', 0, 95],
];

const TASKS_BY_TEAM = {
  carp: ['Cutting', 'Planing', 'Joinery', 'Carving', 'Assembly', 'Sanding'],
  polish: ['Sanding', 'Polishing', 'Finishing'],
  design: ['Design work', 'Supervision'],
  mgmt: ['Supervision', 'Loading'],
  house: ['Cleaning', 'Packing'],
};

const ORDER_ITEMS = [
  'Teak dining table (Order #214)',
  'Teak chair set of 6 (Order #215)',
  'Teak bed frame (Order #210)',
  'Wardrobe door panels (Order #212)',
  'Sofa frame (Order #217)',
];

const INVENTORY = [
  ['Teak wood planks', 'Wood', 'cft', 180, 100, 4200],
  ['Teak veneer sheet', 'Wood', 'sheet', 24, 10, 1800],
  ['PU polish (clear gloss)', 'Polish & paint', 'litre', 8, 15, 640],
  ['Melamine polish', 'Polish & paint', 'litre', 22, 10, 520],
  ['Wood stain (teak shade)', 'Polish & paint', 'litre', 5, 6, 480],
  ['Sandpaper 120 grit', 'Consumables', 'sheet', 90, 50, 14],
  ['Wood glue', 'Consumables', 'kg', 12, 8, 210],
  ['Screws 2 inch', 'Hardware', 'box', 14, 10, 160],
  ['Hinges', 'Hardware', 'pcs', 60, 40, 35],
  ['Chair cushion foam', 'Fabric & foam', 'pcs', 6, 12, 380],
  ['Upholstery fabric', 'Fabric & foam', 'metre', 0, 20, 320],
  ['Bubble wrap', 'Packing', 'roll', 4, 3, 900],
];

const round = (value, step = 0.25) => Math.round(value / step) * step;

/** Small deterministic PRNG so the demo data looks the same on every install. */
function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isDbEmpty = () => db.prepare('SELECT COUNT(*) AS count FROM employees').get().count === 0;

function seedTeams() {
  const insert = db.prepare('INSERT INTO teams (id, name, color, sort_order) VALUES (?, ?, ?, ?)');
  TEAMS.forEach((team, index) => insert.run(team.id, team.name, team.color, index));
}

function seedAdmin() {
  const hash = bcrypt.hashSync(config.admin.password, 10);
  db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').run(
    config.admin.email,
    config.admin.name,
    hash,
  );
}

function seedEmployees() {
  const insert = db.prepare(
    `INSERT INTO employees (code, name, role, team_id, hourly_rate, is_lead, is_manager, joined_on, pin_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const pin = bcrypt.hashSync('1234', 10);
  STAFF.forEach(([name, role, team, lead, rate], index) => {
    insert.run(`AW-${101 + index}`, name, role, team, rate, lead, /Manager/.test(role) ? 1 : 0, addDays(today(), -180), pin);
  });
}

function seedSettings() {
  const defaults = {
    sunday_weeks: '2,4',
    petty_opening: '25000',
    petty_low: '10000',
    business_name: 'Avya Woodcraft LLP',
    workshop_lat: String(config.workshop.lat),
    workshop_lng: String(config.workshop.lng),
    geofence_metres: String(config.workshop.radiusMetres),
  };
  Object.entries(defaults).forEach(([key, value]) => setSetting(key, value));
  setSetting('petty_open_date', addDays(today(), -3));
}

function seedAttendanceAndWork() {
  const random = makeRandom(2026);
  const employees = db.prepare('SELECT id, team_id FROM employees WHERE active = 1').all();
  const insertAttendance = db.prepare(
    `INSERT INTO attendance (employee_id, date, in_min, out_min, hours, day_type, units, approved, distance_m, in_ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertWork = db.prepare(
    'INSERT INTO work_entries (employee_id, date, task, item, hours) VALUES (?, ?, ?, ?, ?)',
  );

  const start = `${currentMonth()}-01`;
  let day = start;
  const yesterday = addDays(today(), -1);

  while (day <= yesterday) {
    const dow = new Date(`${day}T00:00:00`).getDay();
    const week = Math.ceil(Number(day.slice(8, 10)) / 7);
    const sundayOff = dow === 0 && [2, 4].includes(week);

    for (const employee of employees) {
      if (sundayOff) continue;
      const roll = random();
      if (dow === 0 && roll < 0.22) continue;
      if (roll < 0.05) continue;

      const dayType = roll < 0.12 ? 'half' : roll < 0.18 ? 'double' : 'full';
      const inMin = 530 + Math.floor(random() * 40);
      const outMin =
        dayType === 'half' ? inMin + 250 : dayType === 'double' ? inMin + 960 : 1070 + Math.floor(random() * 50);
      const hours = dayType === 'half' ? 4 : dayType === 'double' ? 14 : round((outMin - inMin - 60) / 60);
      insertAttendance.run(
        employee.id,
        day,
        inMin,
        outMin,
        hours,
        dayType,
        null,
        day <= addDays(today(), -3) ? 1 : 0,
        20 + Math.floor(random() * 90),
        null,
      );

      if (day >= addDays(today(), -6)) {
        const tasks = TASKS_BY_TEAM[employee.team_id] || TASKS_BY_TEAM.carp;
        const key = employee.id * 31 + Number(day.slice(8, 10));
        const first = round(hours * 0.6);
        insertWork.run(employee.id, day, tasks[key % tasks.length], ORDER_ITEMS[key % ORDER_ITEMS.length], first);
        const second = round(hours - first);
        if (second > 0) {
          insertWork.run(
            employee.id,
            day,
            tasks[(key + 1) % tasks.length],
            ORDER_ITEMS[(key + 1) % ORDER_ITEMS.length],
            second,
          );
        }
      }
    }
    day = addDays(day, 1);
  }

  // A few people are still on shift right now.
  const open = [
    [1, 543],
    [5, 560],
    [2, 538],
    [12, 545],
    [9, 552],
  ];
  for (const [employeeId, inMin] of open) {
    insertAttendance.run(employeeId, today(), inMin, null, 0, 'full', null, 0, 25 + employeeId * 5, null);
  }
}

function seedLeave() {
  const insert = db.prepare(
    'INSERT INTO leave_requests (employee_id, type, from_date, to_date, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
  );
  insert.run(15, 'Casual', today(), today(), 'Family function', 'approved');
  insert.run(14, 'Sick', addDays(today(), 2), addDays(today(), 3), 'Fever and cold', 'pending');
  insert.run(7, 'Casual', addDays(today(), 8), addDays(today(), 8), 'Bank work', 'pending');
}

function seedDevices() {
  db.prepare(
    "INSERT INTO devices (device_id, label, model, status, paired_on, last_seen) VALUES (?, ?, ?, 'authorized', ?, ?)",
  ).run('AVYA-MOB-01', 'Company mobile', 'Samsung Galaxy A15', addDays(today(), -26), today());
  const blocked = db.prepare(
    'INSERT INTO blocked_attempts (employee_id, who, device, reason, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  blocked.run(14, 'Brijesh', 'Redmi Note 12 (personal)', 'Device not registered', `${addDays(today(), -1)} 09:14:00`);
  blocked.run(16, 'Satyapal', 'Vivo Y22 (personal)', 'Device not registered', `${addDays(today(), -2)} 08:52:00`);
}

function seedBusiness() {
  const insertItem = db.prepare(
    'INSERT INTO inventory_items (name, category, unit, qty, min_qty, rate) VALUES (?, ?, ?, ?, ?, ?)',
  );
  INVENTORY.forEach((row) => insertItem.run(...row));

  const insertProduct = db.prepare('INSERT INTO products (name, price) VALUES (?, ?)');
  const insertLine = db.prepare(
    'INSERT INTO product_lines (product_id, kind, name, qty, unit, rate) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const products = [
    {
      name: 'Teak dining table, 6 seater',
      price: 98000,
      lines: [
        ['material', 'Teak wood planks', 12, 'cft', 4200],
        ['material', 'Teak veneer sheet', 1, 'sheet', 1800],
        ['material', 'Wood glue', 1, 'kg', 210],
        ['material', 'Screws 2 inch', 1, 'box', 160],
        ['material', 'PU polish (clear gloss)', 2, 'litre', 640],
        ['material', 'Wood stain (teak shade)', 0.5, 'litre', 480],
        ['material', 'Sandpaper 120 grit', 10, 'sheet', 14],
        ['labour', 'Cutting and planing', 6, 'h', 130],
        ['labour', 'Joinery', 22, 'h', 120],
        ['labour', 'Carving', 8, 'h', 120],
        ['labour', 'Sanding', 10, 'h', 85],
        ['labour', 'Polishing', 12, 'h', 110],
        ['labour', 'Assembly', 6, 'h', 100],
        ['overhead', 'Packing', 1, 'lot', 600],
        ['overhead', 'Transport and loading', 1, 'lot', 800],
        ['overhead', 'Power and machine wear', 1, 'lot', 1200],
        ['overhead', 'Workshop rent share', 1, 'lot', 2000],
      ],
    },
    {
      name: 'Teak dining chair',
      price: 14500,
      lines: [
        ['material', 'Teak wood planks', 1.6, 'cft', 4200],
        ['material', 'Chair cushion foam', 1, 'pcs', 380],
        ['material', 'Upholstery fabric', 1.2, 'metre', 320],
        ['material', 'Wood glue', 0.15, 'kg', 210],
        ['material', 'Screws 2 inch', 0.1, 'box', 160],
        ['material', 'PU polish (clear gloss)', 0.3, 'litre', 640],
        ['material', 'Sandpaper 120 grit', 4, 'sheet', 14],
        ['labour', 'Cutting and planing', 0.8, 'h', 130],
        ['labour', 'Joinery', 3, 'h', 120],
        ['labour', 'Sanding', 1.2, 'h', 85],
        ['labour', 'Polishing', 1.5, 'h', 110],
        ['labour', 'Upholstery', 1, 'h', 95],
        ['overhead', 'Packing', 1, 'lot', 80],
        ['overhead', 'Transport and loading', 1, 'lot', 100],
        ['overhead', 'Power and rent share', 1, 'lot', 250],
      ],
    },
    {
      name: 'Teak bed frame, queen',
      price: 135000,
      lines: [
        ['material', 'Teak wood planks', 16, 'cft', 4200],
        ['material', 'Teak veneer sheet', 2, 'sheet', 1800],
        ['material', 'Wood glue', 1.5, 'kg', 210],
        ['material', 'Screws 2 inch', 2, 'box', 160],
        ['material', 'PU polish (clear gloss)', 3, 'litre', 640],
        ['material', 'Wood stain (teak shade)', 1, 'litre', 480],
        ['material', 'Sandpaper 120 grit', 15, 'sheet', 14],
        ['labour', 'Cutting and planing', 8, 'h', 130],
        ['labour', 'Joinery', 28, 'h', 120],
        ['labour', 'Carving', 14, 'h', 120],
        ['labour', 'Sanding', 12, 'h', 85],
        ['labour', 'Polishing', 14, 'h', 110],
        ['labour', 'Assembly', 8, 'h', 100],
        ['overhead', 'Packing', 1, 'lot', 900],
        ['overhead', 'Transport and loading', 1, 'lot', 1200],
        ['overhead', 'Power and machine wear', 1, 'lot', 1500],
        ['overhead', 'Workshop rent share', 1, 'lot', 2500],
      ],
    },
  ];
  for (const product of products) {
    const { lastInsertRowid } = insertProduct.run(product.name, product.price);
    for (const line of product.lines) insertLine.run(lastInsertRowid, ...line);
  }

  const insertRequest = db.prepare(
    'INSERT INTO material_requests (employee_id, item_name, qty, unit, urgency, note, status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  insertRequest.run(12, 'PU polish (clear gloss)', 10, 'litre', 'Urgent', 'Polish is almost finished. Need it before Thursday.', 'pending', today());
  insertRequest.run(1, 'Sandpaper 120 grit', 50, 'sheet', 'Normal', '', 'approved', addDays(today(), -1));
  insertRequest.run(5, 'Hinges', 12, 'pcs', 'Urgent', 'Machine blade is worn out.', 'ordered', addDays(today(), -2));

  const insertPetty = db.prepare(
    'INSERT INTO petty_entries (date, direction, category, description, amount, paid_to) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const petty = [
    [-3, 'in', 'Cash added', 'Cash from owner', 20000, 'Owner'],
    [-3, 'out', 'Tea & food', 'Tea and snacks', 180, 'Canteen'],
    [-3, 'out', 'Fuel', 'Diesel for tempo', 650, 'Fuel pump'],
    [-2, 'out', 'Transport', 'Tempo hire for teak delivery', 1200, 'Ravi Transport'],
    [-2, 'out', 'Hardware & tools', 'Screws and hinges', 940, 'Sharma Hardware'],
    [-2, 'out', 'Tea & food', 'Tea and snacks', 160, 'Canteen'],
    [-1, 'out', 'Hardware & tools', 'Polish brush set', 560, 'Sharma Hardware'],
    [-1, 'out', 'Repair & maintenance', 'Planer blade sharpening', 450, 'Local mechanic'],
    [-1, 'out', 'Courier', 'Sample sent to client', 220, 'Courier'],
    [-1, 'out', 'Tea & food', 'Tea and snacks', 150, 'Canteen'],
    [0, 'out', 'Tea & food', 'Tea and snacks', 170, 'Canteen'],
    [0, 'out', 'Stationery', 'Register and pens', 120, 'Stationery shop'],
    [0, 'out', 'Labour advance', 'Advance to Mohan Lal', 1000, 'Mohan Lal'],
  ];
  petty.forEach(([offset, direction, category, description, amount, paidTo]) =>
    insertPetty.run(addDays(today(), offset), direction, category, description, amount, paidTo),
  );

  const advance = db
    .prepare('INSERT INTO advances (employee_id, date, amount, note) VALUES (?, ?, ?, ?)')
    .run(9, addDays(today(), -12), 5000, 'Home repair');

  db.prepare('INSERT INTO advance_deductions (advance_id, month, amount) VALUES (?, ?, ?)').run(
    advance.lastInsertRowid,
    currentMonth(),
    2000,
  );

  const insertOrder = db.prepare(
    'INSERT INTO orders (label, customer, qty, start_date) VALUES (?, ?, ?, ?)',
  );
  const insertStage = db.prepare(
    'INSERT INTO order_stages (order_id, name, planned_days, start_date, sort_order) VALUES (?, ?, ?, ?, ?)',
  );
  const order = insertOrder.run('Teak dining table (Order #214)', 'Mr. Rao', 1, addDays(today(), -6));
  [
    ['Cutting', 2, addDays(today(), -6)],
    ['Joinery', 3, addDays(today(), -4)],
    ['Sanding', 1, addDays(today(), -1)],
    ['Polishing', 2, null],
    ['Assembly and packing', 1, null],
  ].forEach(([name, days, start], index) => insertStage.run(order.lastInsertRowid, name, days, start, index));
}

export function seedDatabase() {
  db.exec(`
    DELETE FROM stage_assignees; DELETE FROM order_stages; DELETE FROM orders;
    DELETE FROM advance_deductions; DELETE FROM advances;
    DELETE FROM petty_entries; DELETE FROM material_requests; DELETE FROM inventory_items;
    DELETE FROM product_lines; DELETE FROM products;
    DELETE FROM blocked_attempts; DELETE FROM pairing_codes; DELETE FROM devices;
    DELETE FROM leave_requests; DELETE FROM work_entries; DELETE FROM attendance;
    DELETE FROM employees; DELETE FROM users; DELETE FROM teams;
    DELETE FROM sunday_overrides; DELETE FROM settings;
  `);

  const run = () => transaction(() => {
    seedTeams();
    seedAdmin();
    seedEmployees();
    seedSettings();
    seedAttendanceAndWork();
    seedLeave();
    seedDevices();
    seedBusiness();
  });
  run();
}

/** Creates the admin account and (optionally) demo data the first time the app runs. */
export function ensureSeed() {
  if (isDbEmpty() && config.seedDemo) {
    seedDatabase();
    return true;
  }
  if (db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0) {
    seedAdmin();
  }
  if (db.prepare('SELECT COUNT(*) AS count FROM settings').get().count === 0) {
    setSetting('sunday_weeks', '2,4');
    setSetting('petty_opening', '25000');
    setSetting('petty_low', '10000');
    setSetting('petty_open_date', addDays(today(), -30));
  }
  return false;
}

export const newId = () => crypto.randomUUID();

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase();
  const settings = getSettings();
  console.log('Database seeded.');
  console.log(`  teams: ${TEAMS.length}, employees: ${STAFF.length}`);
  console.log(`  admin: ${config.admin.email} / ${config.admin.password}`);
  console.log(`  sunday policy: ${settings.sunday_weeks}`);
}
