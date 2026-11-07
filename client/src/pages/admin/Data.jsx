import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { Chip, ErrorNote, Icon, Loading, useToast, Toast } from '../../ui.jsx';

const RESETS = [
  ['records', 'Clear attendance, work log, leave and advances'],
  ['business', 'Clear products, inventory, requests and production'],
  ['petty', 'Clear petty cash'],
  ['all', 'Reset everything to the sample data'],
];

export default function Data() {
  const [meta, setMeta] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState(null);
  const fileInput = useRef(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      setMeta(await api.get('/backup/meta'));
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const exportBackup = async () => {
    try {
      const response = await api.raw('/backup/export');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `avya-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify('Backup file created.');
    } catch (err) {
      fail(err);
    }
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await api.post('/backup/import', payload);
      await load();
      notify('Backup imported.');
    } catch (err) {
      fail(err instanceof SyntaxError ? new Error('That file is not a valid Avya backup.') : err);
    }
  };

  const reset = async (scope) => {
    try {
      await api.post('/backup/reset', { scope });
      setConfirm(null);
      await load();
      notify(scope === 'all' ? 'Database reset to sample data.' : 'Cleared.');
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!meta) return <Loading />;

  return (
    <div className="stack">
      <Toast message={toast.message} error={toast.error} />

      <div className="card">
        <h3 style={{ marginBottom: 6 }}>How the data is stored</h3>
        <p style={{ margin: 0 }}>
          Attendance, payroll, devices and the workshop records live in a SQLite database on the server.
          Every phone, laptop and manager reads the same data, and nothing is kept only in the browser.
        </p>
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          Export a backup before clearing anything.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Backup</h3>
        <div className="inl">
          <button type="button" className="btn primary" onClick={exportBackup}>
            <Icon name="download" size={15} /> Export backup (.json)
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={15} /> Import backup
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importBackup} />
        </div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          Import replaces everything currently in the database, including employees.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Records in the database</h3>
        <div className="inl" style={{ gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(meta.counts).map(([key, value]) => (
            <Chip key={key}>
              {key} · {value}
            </Chip>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Start with your real data</h3>
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          Clear the sample records, then fill in the real ones. Employees, teams, rates and settings are kept
          unless you reset everything.
        </p>
        <div className="inl">
          {RESETS.map(([scope, label]) => (
            <button
              key={scope}
              type="button"
              className={`btn ${confirm === scope ? 'no' : ''}`}
              onClick={() => (confirm === scope ? reset(scope) : setConfirm(scope))}
            >
              {confirm === scope ? 'Click again to confirm' : label}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ margin: '12px 0 0' }}>
          After clearing attendance, open an employee's File or the Monthly report to fill past months day by day.
        </p>
      </div>
    </div>
  );
}
