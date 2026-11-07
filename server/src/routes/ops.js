import { Router } from 'express';
import { db, getSetting } from '../db.js';
import { adminOnly, requireAuth } from '../middleware/auth.js';
import { isValidDate, today } from '../lib/date.js';

export const opsRouter = Router();

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/* ------------------------------- products -------------------------------- */

const productTotals = (lines) => {
  const totals = { material: 0, labour: 0, overhead: 0 };
  lines.forEach((line) => {
    totals[line.kind] = (totals[line.kind] || 0) + line.qty * line.rate;
  });
  const total = totals.material + totals.labour + totals.overhead;
  return { ...totals, total };
};

const productRows = () => {
  const products = db.prepare('SELECT * FROM products ORDER BY id').all();
  const lines = db.prepare('SELECT * FROM product_lines ORDER BY id').all();

  return products.map((product) => {
    const rows = lines
      .filter((line) => line.product_id === product.id)
      .map((line) => ({
        id: line.id,
        kind: line.kind,
        name: line.name,
        qty: line.qty,
        unit: line.unit,
        rate: line.rate,
      }));
    const totals = productTotals(rows);
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      lines: rows,
      totals,
      profit: product.price - totals.total,
      margin: product.price ? ((product.price - totals.total) / product.price) * 100 : 0,
    };
  });
};

opsRouter.get('/products', adminOnly, (req, res) => res.json(productRows()));

opsRouter.post('/products', adminOnly, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Product name is required.' });
  const { lastInsertRowid } = db
    .prepare('INSERT INTO products (name, price) VALUES (?, ?)')
    .run(name, num(req.body?.price));
  res.status(201).json({ id: lastInsertRowid });
});

opsRouter.patch('/products/lines/:lineId', adminOnly, (req, res) => {
  const line = db.prepare('SELECT * FROM product_lines WHERE id = ?').get(Number(req.params.lineId));
  if (!line) return res.status(404).json({ error: 'Cost line not found.' });

  const qty = req.body?.qty === undefined ? line.qty : num(req.body.qty);
  const rate = req.body?.rate === undefined ? line.rate : num(req.body.rate);
  if (qty < 0 || rate < 0) return res.status(400).json({ error: 'Quantity and rate must be 0 or more.' });

  db.prepare('UPDATE product_lines SET qty = ?, rate = ? WHERE id = ?').run(qty, rate, line.id);
  res.json({ ok: true });
});

opsRouter.delete('/products/lines/:lineId', adminOnly, (req, res) => {
  const result = db.prepare('DELETE FROM product_lines WHERE id = ?').run(Number(req.params.lineId));
  if (!result.changes) return res.status(404).json({ error: 'Cost line not found.' });
  res.json({ ok: true });
});

opsRouter.post('/products/:id/lines', adminOnly, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const kind = String(req.body?.kind || 'material');
  const name = String(req.body?.name || '').trim();
  const qty = num(req.body?.qty);
  const rate = num(req.body?.rate);
  const unit = String(req.body?.unit || 'pcs');

  if (!['material', 'labour', 'overhead'].includes(kind)) {
    return res.status(400).json({ error: 'Kind must be material, labour or overhead.' });
  }
  if (!name) return res.status(400).json({ error: 'Give the cost line a name.' });
  if (qty <= 0 || rate < 0) return res.status(400).json({ error: 'Enter a quantity above 0.' });

  const { lastInsertRowid } = db
    .prepare('INSERT INTO product_lines (product_id, kind, name, qty, unit, rate) VALUES (?, ?, ?, ?, ?, ?)')
    .run(product.id, kind, name, qty, unit, rate);
  res.status(201).json({ id: lastInsertRowid });
});

opsRouter.patch('/products/:id', adminOnly, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const name = req.body?.name === undefined ? product.name : String(req.body.name).trim();
  const price = req.body?.price === undefined ? product.price : num(req.body.price);
  if (!name) return res.status(400).json({ error: 'Product name cannot be empty.' });
  if (price < 0) return res.status(400).json({ error: 'Price must be 0 or more.' });

  db.prepare('UPDATE products SET name = ?, price = ? WHERE id = ?').run(name, price, product.id);
  res.json({ ok: true });
});

opsRouter.delete('/products/:id', adminOnly, (req, res) => {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Product not found.' });
  res.json({ ok: true });
});

/* ------------------------------- inventory ------------------------------- */

const mapItem = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  unit: row.unit,
  qty: row.qty,
  minQty: row.min_qty,
  rate: row.rate,
  low: row.qty <= row.min_qty,
  value: row.qty * row.rate,
});

opsRouter.get('/inventory', adminOnly, (req, res) => {
  const items = db.prepare('SELECT * FROM inventory_items ORDER BY category, name').all().map(mapItem);
  const requests = db
    .prepare(
      `SELECT r.*, e.name FROM material_requests r JOIN employees e ON e.id = r.employee_id
       ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, r.id DESC`,
    )
    .all()
    .map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.name,
      itemName: row.item_name,
      qty: row.qty,
      unit: row.unit,
      urgency: row.urgency,
      note: row.note,
      status: row.status,
      date: row.date,
    }));

  res.json({
    items,
    requests,
    lowStock: items.filter((item) => item.low).length,
    stockValue: items.reduce((sum, item) => sum + item.value, 0),
  });
});

opsRouter.post('/inventory', adminOnly, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const category = String(req.body?.category || 'Wood');
  const unit = String(req.body?.unit || 'pcs');
  if (!name) return res.status(400).json({ error: 'Item name is required.' });

  const { lastInsertRowid } = db
    .prepare('INSERT INTO inventory_items (name, category, unit, qty, min_qty, rate) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, category, unit, num(req.body?.qty), num(req.body?.minQty), num(req.body?.rate));
  res.status(201).json(mapItem(db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(lastInsertRowid)));
});

opsRouter.patch('/inventory/:id', adminOnly, (req, res) => {
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  const updates = [];
  const values = [];
  for (const [field, column] of [
    ['name', 'name'],
    ['category', 'category'],
    ['unit', 'unit'],
    ['qty', 'qty'],
    ['minQty', 'min_qty'],
    ['rate', 'rate'],
  ]) {
    if (req.body?.[field] === undefined) continue;
    updates.push(`${column} = ?`);
    values.push(['qty', 'min_qty', 'rate'].includes(column) ? num(req.body[field]) : String(req.body[field]));
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });

  values.push(item.id);
  db.prepare(`UPDATE inventory_items SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(mapItem(db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(item.id)));
});

opsRouter.delete('/inventory/:id', adminOnly, (req, res) => {
  const result = db.prepare('DELETE FROM inventory_items WHERE id = ?').run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Item not found.' });
  res.json({ ok: true });
});

/* ---------------------------- material requests --------------------------- */

const mapRequest = (row) => ({
  id: row.id,
  employeeId: row.employee_id,
  employeeName: row.employee_name ?? row.name,
  itemName: row.item_name,
  qty: row.qty,
  unit: row.unit,
  urgency: row.urgency,
  note: row.note,
  status: row.status,
  date: row.date,
});

opsRouter.get('/material-requests', requireAuth, (req, res) => {
  const rows =
    req.user.role === 'employee'
      ? db
          .prepare(
            `SELECT r.*, e.name AS employee_name FROM material_requests r JOIN employees e ON e.id = r.employee_id
             WHERE r.employee_id = ? ORDER BY r.id DESC`,
          )
          .all(req.user.employeeId)
      : db
          .prepare(
            `SELECT r.*, e.name AS employee_name FROM material_requests r JOIN employees e ON e.id = r.employee_id
             ORDER BY r.id DESC`,
          )
          .all();
  res.json(rows.map(mapRequest));
});

opsRouter.post('/material-requests', requireAuth, (req, res) => {
  const employeeId = req.user.role === 'employee' ? req.user.employeeId : Number(req.body?.employeeId);
  const itemName = String(req.body?.itemName || '').trim();
  const qty = num(req.body?.qty);
  const unit = String(req.body?.unit || 'pcs');
  const urgency = req.body?.urgency === 'Urgent' ? 'Urgent' : 'Normal';
  const note = String(req.body?.note || '').trim();

  if (!itemName) return res.status(400).json({ error: 'Write the item you need.' });
  if (qty <= 0) return res.status(400).json({ error: 'Quantity must be 1 or more.' });

  const { lastInsertRowid } = db
    .prepare(
      'INSERT INTO material_requests (employee_id, item_name, qty, unit, urgency, note, status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(employeeId, itemName, qty, unit, urgency, note, 'pending', today());

  const created = db
    .prepare(
      `SELECT r.*, e.name AS employee_name FROM material_requests r JOIN employees e ON e.id = r.employee_id WHERE r.id = ?`,
    )
    .get(lastInsertRowid);
  res.status(201).json(mapRequest(created));
});

opsRouter.patch('/material-requests/:id', adminOnly, (req, res) => {
  const request = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(Number(req.params.id));
  if (!request) return res.status(404).json({ error: 'Request not found.' });

  const status = String(req.body?.status || '');
  if (!['pending', 'approved', 'ordered', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Unknown status.' });
  }

  db.prepare("UPDATE material_requests SET status = ?, decided_at = datetime('now') WHERE id = ?").run(
    status,
    request.id,
  );
  res.json({ ok: true });
});

opsRouter.delete('/material-requests/:id', adminOnly, (req, res) => {
  const result = db.prepare('DELETE FROM material_requests WHERE id = ?').run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Request not found.' });
  res.json({ ok: true });
});

/* ------------------------------- petty cash ------------------------------- */

const pettyEntries = () => {
  const opening = Number(getSetting('petty_opening', '0'));
  const entries = db.prepare('SELECT * FROM petty_entries ORDER BY date DESC, id DESC').all();
  const added = entries.filter((row) => row.direction === 'in').reduce((sum, row) => sum + row.amount, 0);
  const spent = entries.filter((row) => row.direction === 'out').reduce((sum, row) => sum + row.amount, 0);

  return {
    opening,
    openDate: getSetting('petty_open_date', ''),
    low: Number(getSetting('petty_low', '10000')),
    balance: Math.round((opening + added - spent) * 100) / 100,
    spentToday: entries.filter((row) => row.date === today()).reduce((sum, row) => sum + row.amount, 0),
    entries: entries.map((row) => ({
      id: row.id,
      date: row.date,
      direction: row.direction,
      category: row.category,
      description: row.description,
      amount: row.amount,
      paidTo: row.paid_to,
    })),
  };
};

opsRouter.get('/petty', adminOnly, (req, res) => res.json(pettyEntries()));

opsRouter.post('/petty', adminOnly, (req, res) => {
  const direction = req.body?.direction === 'in' ? 'in' : 'out';
  const amount = num(req.body?.amount);
  const category = String(req.body?.category || 'Other');
  const description = String(req.body?.description || '').trim();
  const paidTo = String(req.body?.paidTo || '').trim();
  const date = String(req.body?.date || today());

  if (amount <= 0) return res.status(400).json({ error: 'Enter an amount above 0.' });
  if (!isValidDate(date) || date > today()) {
    return res.status(400).json({ error: 'Choose a date up to today.' });
  }

  db.prepare(
    'INSERT INTO petty_entries (date, direction, category, description, amount, paid_to) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(date, direction, category, description, amount, paidTo);
  res.status(201).json(pettyEntries());
});

opsRouter.delete('/petty/:id', adminOnly, (req, res) => {
  const result = db.prepare('DELETE FROM petty_entries WHERE id = ?').run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Entry not found.' });
  res.json(pettyEntries());
});

/* ------------------------------- production ------------------------------- */

const orderRows = () => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY start_date DESC, id DESC').all();
  const stages = db.prepare('SELECT * FROM order_stages ORDER BY order_id, sort_order, id').all();
  const assignees = db
    .prepare(
      `SELECT sa.stage_id AS stageId, e.id, e.name FROM stage_assignees sa
       JOIN employees e ON e.id = sa.employee_id`,
    )
    .all();

  return orders.map((order) => ({
    id: order.id,
    label: order.label,
    customer: order.customer,
    qty: order.qty,
    startDate: order.start_date,
    stages: stages
      .filter((stage) => stage.order_id === order.id)
      .map((stage) => ({
        id: stage.id,
        name: stage.name,
        plannedDays: stage.planned_days,
        startDate: stage.start_date,
        doneDate: stage.done_date,
        assignees: assignees.filter((person) => person.stageId === stage.id).map(({ id, name }) => ({ id, name })),
      })),
  }));
};

opsRouter.get('/orders', adminOnly, (req, res) => res.json(orderRows()));

opsRouter.post('/orders', adminOnly, (req, res) => {
  const label = String(req.body?.label || '').trim();
  const qty = Math.floor(num(req.body?.qty, 1));
  const startDate = String(req.body?.startDate || today());
  if (!label) return res.status(400).json({ error: 'Write the item name.' });
  if (qty <= 0) return res.status(400).json({ error: 'Quantity must be 1 or more.' });
  if (orderRows().some((order) => order.label.toLowerCase() === label.toLowerCase())) {
    return res.status(409).json({ error: 'An item with this name already exists.' });
  }

  const { lastInsertRowid } = db
    .prepare('INSERT INTO orders (label, customer, qty, start_date) VALUES (?, ?, ?, ?)')
    .run(label, String(req.body?.customer || '').trim(), qty, startDate);

  const stageNames = Array.isArray(req.body?.stages) ? req.body.stages : [];
  const insert = db.prepare(
    'INSERT INTO order_stages (order_id, name, planned_days, sort_order) VALUES (?, ?, ?, ?)',
  );
  (stageNames.length ? stageNames : ['Cutting', 'Joinery', 'Sanding', 'Polishing', 'Assembly and packing']).forEach(
    (stage, index) => insert.run(lastInsertRowid, typeof stage === 'string' ? stage : stage.name, 1, index),
  );

  res.status(201).json({ id: lastInsertRowid });
});

opsRouter.patch('/orders/stages/:stageId', adminOnly, (req, res) => {
  const stage = db.prepare('SELECT * FROM order_stages WHERE id = ?').get(Number(req.params.stageId));
  if (!stage) return res.status(404).json({ error: 'Stage not found.' });

  const updates = [];
  const values = [];
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: 'Stage name cannot be empty.' });
    updates.push('name = ?');
    values.push(name);
  }
  if (req.body?.plannedDays !== undefined) {
    const days = num(req.body.plannedDays);
    if (days < 0.5 || days > 60) return res.status(400).json({ error: 'Planned days must be 0.5 to 60.' });
    updates.push('planned_days = ?');
    values.push(days);
  }
  if (req.body?.startDate !== undefined) {
    updates.push('start_date = ?');
    values.push(req.body.startDate || null);
  }
  if (req.body?.doneDate !== undefined) {
    updates.push('done_date = ?');
    values.push(req.body.doneDate || null);
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });

  values.push(stage.id);
  db.prepare(`UPDATE order_stages SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

opsRouter.delete('/orders/stages/:stageId', adminOnly, (req, res) => {
  const result = db.prepare('DELETE FROM order_stages WHERE id = ?').run(Number(req.params.stageId));
  if (!result.changes) return res.status(404).json({ error: 'Stage not found.' });
  res.json({ ok: true });
});

opsRouter.post('/orders/stages/:stageId/assignees', adminOnly, (req, res) => {
  const stage = db.prepare('SELECT * FROM order_stages WHERE id = ?').get(Number(req.params.stageId));
  if (!stage) return res.status(404).json({ error: 'Stage not found.' });
  const employeeId = Number(req.body?.employeeId);
  if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(employeeId)) {
    return res.status(400).json({ error: 'Choose an employee.' });
  }
  db.prepare('INSERT OR IGNORE INTO stage_assignees (stage_id, employee_id) VALUES (?, ?)').run(stage.id, employeeId);
  res.json({ ok: true });
});

opsRouter.delete('/orders/stages/:stageId/assignees/:employeeId', adminOnly, (req, res) => {
  db.prepare('DELETE FROM stage_assignees WHERE stage_id = ? AND employee_id = ?').run(
    Number(req.params.stageId),
    Number(req.params.employeeId),
  );
  res.json({ ok: true });
});

opsRouter.delete('/orders/:id', adminOnly, (req, res) => {
  const result = db.prepare('DELETE FROM orders WHERE id = ?').run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Order not found.' });
  res.json({ ok: true });
});
