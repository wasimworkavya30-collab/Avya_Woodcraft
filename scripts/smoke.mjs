/**
 * API smoke test. Start the server first (npm start), then run: npm run smoke
 * Exercises the full three-tier flow against a running API.
 */
const base = process.env.API_URL || 'http://localhost:4000/api';
const results = [];

async function call(path, { method = 'GET', body, token, device = 'SMOKE-DEVICE' } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-device-id': device,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

function check(name, condition, detail = '') {
  results.push({ name, ok: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const run = async () => {
  const health = await call('/health');
  check('health', health.status === 200 && health.data.ok, `status ${health.status}`);

  const adminLogin = await call('/auth/login', {
    method: 'POST',
    body: { mode: 'admin', email: 'admin@avyawoodcraft.in', password: 'Avya@2026' },
  });
  check('admin login', adminLogin.status === 200 && !!adminLogin.data.token, `status ${adminLogin.status}`);
  const admin = adminLogin.data.token;

  const badLogin = await call('/auth/login', {
    method: 'POST',
    body: { mode: 'admin', email: 'admin@avyawoodcraft.in', password: 'wrong' },
  });
  check('wrong password rejected', badLogin.status === 401, `status ${badLogin.status}`);

  const dashboard = await call('/dashboard', { token: admin });
  check(
    'dashboard',
    dashboard.status === 200 && Array.isArray(dashboard.data.people) && dashboard.data.people.length >= 16,
    `${dashboard.data.people?.length} people`,
  );

  const employees = await call('/employees?includeInactive=1', { token: admin });
  check('employees list', employees.status === 200 && employees.data.length >= 16);

  const pending = await call('/attendance/pending', { token: admin });
  check('pending approvals', pending.status === 200 && pending.data.length > 0, `${pending.data.length} pending`);

  const salary = await call('/payroll/salary', { token: admin });
  check(
    'salary report',
    salary.status === 200 && salary.data.rows.length > 0 && Number.isFinite(salary.data.totals.payable),
    `payable ${salary.data.totals?.payable}`,
  );

  const report = await call('/payroll/report', { token: admin });
  check('monthly matrix', report.status === 200 && report.data.dates.length >= 28);

  const teams = await call('/teams', { token: admin });
  check('teams', teams.status === 200 && teams.data.length === 5);
  const org = await call('/teams/org', { token: admin });
  check('org chart', org.status === 200 && Array.isArray(org.data.managers));

  const devices = await call('/devices', { token: admin });
  check('devices', devices.status === 200 && Array.isArray(devices.data.devices));

  const products = await call('/ops/products', { token: admin });
  check('product costing', products.status === 200 && products.data.length > 0);
  const petty = await call('/ops/petty', { token: admin });
  check('petty cash', petty.status === 200 && Number.isFinite(petty.data.balance), `balance ${petty.data.balance}`);
  const inventory = await call('/ops/inventory', { token: admin });
  check('inventory', inventory.status === 200 && inventory.data.items.length > 0);
  const orders = await call('/ops/orders', { token: admin });
  check('production orders', orders.status === 200 && Array.isArray(orders.data));

  const employeeLogin = await call('/auth/login', {
    method: 'POST',
    body: { mode: 'employee', code: 'AW-104', pin: '1234' },
  });
  check('employee login', employeeLogin.status === 200 && !!employeeLogin.data.token, `status ${employeeLogin.status}`);
  const employee = employeeLogin.data.token;

  const blocked = await call('/attendance/punch-in', {
    method: 'POST',
    token: employee,
    device: 'NOT-AUTHORIZED-PHONE',
    body: { selfie: 'data:image/jpeg;base64,AAAA', distanceM: 42 },
  });
  check('punch from unknown phone blocked', blocked.status === 403, `status ${blocked.status}`);

  const blockedList = await call('/devices', { token: admin });
  check('blocked attempt logged', blockedList.data.blocked.length > 0);

  const code = await call('/devices/pairing-code', { method: 'POST', token: admin });
  check('pairing code', code.status === 201 && /^\d{6}$/.test(code.data.code));

  const pair = await call('/devices/pair', {
    method: 'POST',
    token: employee,
    device: 'SMOKE-DEVICE',
    body: { code: code.data.code, deviceId: 'SMOKE-DEVICE', model: 'Smoke test phone' },
  });
  check('device paired', pair.status === 200, `status ${pair.status}`);

  const punchIn = await call('/attendance/punch-in', {
    method: 'POST',
    token: employee,
    body: { selfie: 'data:image/jpeg;base64,AAAA', distanceM: 42 },
  });
  check('check in', punchIn.status === 201, `status ${punchIn.status} ${punchIn.data.error || ''}`);

  const farAway = await call('/attendance/punch-in', {
    method: 'POST',
    token: employee,
    body: { selfie: 'data:image/jpeg;base64,AAAA', distanceM: 900 },
  });
  check('geofence rejects a far punch', farAway.status === 400 || farAway.status === 409, `status ${farAway.status}`);

  const work = await call('/work', {
    method: 'POST',
    token: employee,
    body: { task: 'Joinery', item: 'Smoke test item', hours: 2, note: 'smoke' },
  });
  check('work entry', work.status === 201, `status ${work.status} ${work.data.error || ''}`);

  const punchOut = await call('/attendance/punch-out', {
    method: 'POST',
    token: employee,
    body: { selfie: 'data:image/jpeg;base64,AAAA', distanceM: 42 },
  });
  check('check out', punchOut.status === 200, `status ${punchOut.status} ${punchOut.data.error || ''}`);

  if (punchOut.data.id) {
    const approve = await call(`/attendance/${punchOut.data.id}/approve`, {
      method: 'POST',
      token: admin,
      body: { dayType: 'full', hours: 8 },
    });
    check('approve shift', approve.status === 200 && approve.data.approved === true);
  }

  const leave = await call('/leave', {
    method: 'POST',
    token: employee,
    body: { type: 'Casual', from: new Date(Date.now() + 86400000).toISOString().slice(0, 10), to: new Date(Date.now() + 86400000).toISOString().slice(0, 10), reason: 'Smoke test' },
  });
  check('leave request', leave.status === 201, `status ${leave.status} ${leave.data.error || ''}`);
  if (leave.data.id) {
    const decide = await call(`/leave/${leave.data.id}`, { method: 'PATCH', token: admin, body: { status: 'approved' } });
    check('leave approved', decide.status === 200 && decide.data.status === 'approved');
    await call(`/leave/${leave.data.id}`, { method: 'DELETE', token: admin });
  }

  const material = await call('/ops/material-requests', {
    method: 'POST',
    token: employee,
    body: { itemName: 'Smoke test sandpaper', qty: 3, unit: 'sheet', urgency: 'Normal', note: 'smoke' },
  });
  check('material request', material.status === 201, `status ${material.status}`);
  if (material.data.id) await call(`/ops/material-requests/${material.data.id}`, { method: 'DELETE', token: admin });

  const forbidden = await call('/employees', { token: employee });
  check('employee cannot list employees', forbidden.status === 403, `status ${forbidden.status}`);

  const missing = await call('/not-a-route', { token: admin });
  check('unknown route returns 404', missing.status === 404);

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error('Failed:', failed.map((result) => result.name).join(', '));
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error('Smoke test crashed:', error.message);
  process.exitCode = 1;
});
