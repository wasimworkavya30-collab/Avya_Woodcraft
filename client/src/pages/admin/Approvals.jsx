import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';
import {
  Avatar,
  Chip,
  ErrorNote,
  Loading,
  hours as fmtHours,
  clock12,
  prettyDate,
  useToast,
  Toast,
} from '../../ui.jsx';

const DAY_TYPES = [
  ['full', 'Full day'],
  ['half', 'Half day'],
  ['double', 'Double shift'],
  ['custom', 'Custom'],
];

export default function Approvals() {
  const [records, setRecords] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [work, setWork] = useState([]);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({});
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      const [pending, staff, entries] = await Promise.all([
        api.get('/attendance/pending'),
        api.get('/employees'),
        api.get('/work'),
      ]);
      setRecords(pending);
      setEmployees(staff);
      setWork(entries);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const staffById = useMemo(
    () => Object.fromEntries(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const workHours = (employeeId, date) =>
    work.filter((entry) => entry.employeeId === employeeId && entry.date === date).reduce((sum, entry) => sum + entry.hours, 0);

  const rowState = (record) =>
    edits[record.id] || { dayType: record.dayType, hours: record.hours };

  const updateRow = (record, patch) =>
    setEdits((current) => ({ ...current, [record.id]: { ...rowState(record), ...patch } }));

  const approve = async (record) => {
    const state = rowState(record);
    try {
      await api.post(`/attendance/${record.id}/approve`, { dayType: state.dayType, hours: Number(state.hours) });
      setRecords((current) => current.filter((item) => item.id !== record.id));
      notify(`${staffById[record.employeeId]?.name || 'Shift'} approved.`);
    } catch (err) {
      fail(err);
    }
  };

  const approveAll = async () => {
    try {
      const result = await api.post('/attendance/approve-all');
      notify(`${result.approved} shifts approved.`);
      await load();
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!records) return <Loading />;

  return (
    <div className="card">
      <Toast message={toast.message} error={toast.error} />
      <div className="head-row">
        <div>
          <h3>Waiting for approval</h3>
          <span className="small muted">
            Set the day type (full, half, double shift) and hours, then approve. Only approved hours count
            towards salary.
          </span>
        </div>
        {records.length ? (
          <button type="button" className="btn primary sm" onClick={approveAll}>
            Approve all ({records.length})
          </button>
        ) : null}
      </div>

      {records.length === 0 ? (
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Everything is approved.
        </p>
      ) : (
        records.map((record) => {
          const employee = staffById[record.employeeId] || { name: 'Employee', id: record.employeeId };
          const state = rowState(record);
          const logged = workHours(record.employeeId, record.date);
          return (
            <div className="pend" key={record.id}>
              <Avatar person={employee} src={record.selfie} size={40} ring />
              <div className="grow">
                <b>{employee.name}</b>
                <br />
                <span className="small muted">
                  {prettyDate(record.date)} ·{' '}
                  <span className="mono">
                    {clock12(record.inMin)} → {clock12(record.outMin)}
                  </span>{' '}
                  · {record.distanceM ?? '–'} m
                  <br />
                  Work logged: <b className="mono">{fmtHours(logged)}</b>
                  {Math.abs(logged - record.hours) > 1 ? (
                    <Chip tone="warn"> {fmtHours(logged)} of {fmtHours(record.hours)} </Chip>
                  ) : null}
                </span>
              </div>

              <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Day
                <select
                  value={state.dayType}
                  onChange={(event) => updateRow(record, { dayType: event.target.value })}
                  aria-label={`Day type for ${employee.name}`}
                >
                  {DAY_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Hours
                <input
                  type="number"
                  min="0"
                  max="16"
                  step="0.25"
                  value={state.hours}
                  onChange={(event) => updateRow(record, { hours: event.target.value })}
                  aria-label={`Approved hours for ${employee.name}`}
                />
              </label>

              <button type="button" className="btn sm ok" onClick={() => approve(record)}>
                Approve
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
