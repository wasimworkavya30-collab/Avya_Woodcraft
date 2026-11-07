import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api, deviceId, deviceLabel } from '../api.js';
import { Icon } from '../ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState('employee');
  const [email, setEmail] = useState('admin@avyawoodcraft.in');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [device, setDevice] = useState(null);

  useEffect(() => {
    api
      .get(`/devices/whoami?deviceId=${encodeURIComponent(deviceId())}`)
      .then(setDevice)
      .catch(() => setDevice(null));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'admin') {
        await login({ mode: 'admin', email, password });
      } else {
        await login({ mode: 'employee', code, pin });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <aside className="lbrand">
        <div>
          <div className="cap" style={{ color: '#B9C3DD' }}>Avya Woodcraft LLP</div>
          <h1>Attendance, hours and payroll in one place.</h1>
          <p>
            Every punch is checked against the authorized company mobile, the workshop location and a fresh
            selfie. Approved hours become the monthly salary report.
          </p>
        </div>
        <ul className="feat">
          <li>
            <i><Icon name="phone" size={16} /></i>
            <span>One authorized company phone. Punches from any other device are blocked and logged.</span>
          </li>
          <li>
            <i><Icon name="pin" size={16} /></i>
            <span>The workshop gate fence stops check-ins from home.</span>
          </li>
          <li>
            <i><Icon name="rupee" size={16} /></i>
            <span>Approved hours × hourly rate, with half days, double shifts and advances.</span>
          </li>
          <li>
            <i><Icon name="shield" size={16} /></i>
            <span>Admin, manager and employees see the same live data, saved on the server.</span>
          </li>
        </ul>
      </aside>

      <main className="lform">
        <form className="card" onSubmit={submit}>
          <h2 style={{ marginBottom: 4 }}>Sign in</h2>
          <p className="small muted" style={{ marginBottom: 18 }}>
            {mode === 'admin' ? 'Main admin console' : 'Employee app'}
          </p>

          <div className="seg" style={{ marginBottom: 18, width: '100%' }} role="group" aria-label="Sign in as">
            <button
              type="button"
              className={mode === 'employee' ? 'on' : ''}
              style={{ flex: 1 }}
              onClick={() => setMode('employee')}
            >
              Employee
            </button>
            <button
              type="button"
              className={mode === 'admin' ? 'on' : ''}
              style={{ flex: 1 }}
              onClick={() => setMode('admin')}
            >
              Admin
            </button>
          </div>

          {mode === 'admin' ? (
            <>
              <label className="field">
                <span>Admin email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                <span>Employee code</span>
                <input
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="AW-104"
                  autoComplete="username"
                />
              </label>
              <label className="field">
                <span>PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  placeholder="1234"
                  autoComplete="current-password"
                />
              </label>
            </>
          )}

          {error ? <p className="small" style={{ color: 'var(--bad)', margin: '0 0 12px' }}>{error}</p> : null}

          <button className="btn primary big" type="submit" disabled={busy}>
            {busy ? 'Checking…' : mode === 'admin' ? 'Open admin console' : 'Sign in'}
          </button>

          <div className="devbox">
            <span>
              <b>This device</b>
              <br />
              <span className="muted mono small">{device?.deviceId || deviceId()}</span> · {deviceLabel()}
            </span>
            {device?.authorized ? (
              <span className="chip good">Authorized mobile</span>
            ) : (
              <span className="chip warn">Not the company mobile</span>
            )}
          </div>

          <p className="small muted" style={{ margin: '14px 0 0' }}>
            {mode === 'admin'
              ? 'First run: admin@avyawoodcraft.in / Avya@2026 (change it in .env).'
              : 'Sample employees use PIN 1234. Codes run from AW-101 upwards.'}
          </p>
        </form>
      </main>
    </div>
  );
}
