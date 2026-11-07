import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import {
  Avatar,
  Chip,
  ErrorNote,
  Icon,
  Loading,
  MonthNav,
  Tile,
  clock12,
  hours as fmtHours,
  money,
  prettyDate,
  todayISO,
  useToast,
  Toast,
} from '../../ui.jsx';

const DAY_OPTIONS = [0, 0.5, 1, 2];

export default function EmployeeFile() {
  const { id } = useParams();
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [records, setRecords] = useState([]);
  const [advance, setAdvance] = useState({ amount: '', date: todayISO(), note: '' });
  const [error, setError] = useState(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      const [fileData, attendance] = await Promise.all([
        api.get(`/employees/${id}/file`),
        api.get(`/attendance?employeeId=${id}&month=${month}`),
      ]);
      setFile(fileData);
      setRecords(attendance);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, month]);

  const setDays = async (date, units, currentHours) => {
    try {
      await api.put('/attendance/cell', {
        employeeId: Number(id),
        date,
        units: Number(units),
        hours: Number(units) === 0 ? null : currentHours,
      });
      const updated = await api.get(`/attendance?employeeId=${id}&month=${month}`);
      setRecords(updated);
      notify(Number(units) === 0 ? 'Marked absent.' : 'Days saved.');
    } catch (err) {
      fail(err);
    }
  };

  const addAdvance = async (event) => {
    event.preventDefault();
    try {
      await api.post('/payroll/advances', {
        employeeId: Number(id),
        amount: Number(advance.amount),
        date: advance.date,
        note: advance.note,
      });
      setAdvance({ amount: '', date: todayISO(), note: '' });
      await load();
      notify('Advance saved.');
    } catch (err) {
      fail(err);
    }
  };

  const deduct = async (advanceId, amount) => {
    try {
      const result = await api.put(`/payroll/advances/${advanceId}/deduction`, { month, amount: Number(amount) });
      await load();
      notify(result.limited ? `Only ${money(result.applied)} was outstanding.` : 'Deduction saved.');
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!file) return <Loading />;

  const employee = file.employee;
  const days = records.filter((record) => record.outMin != null);
  const approvedHours = days.filter((record) => record.approved).reduce((sum, record) => sum + record.hours, 0);
  const pendingHours = days.filter((record) => !record.approved).reduce((sum, record) => sum + record.hours, 0);
  const units = days.reduce((sum, record) => sum + (record.dayType === 'custom' ? record.units || 1 : { full: 1, half: 0.5, double: 2 }[record.dayType] || 1), 0);

  return (
    <div className="stack">
      <Toast message={toast.message} error={toast.error} />

      <div className="card">
        <div className="head-row">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Avatar person={employee} size={52} ring />
            <div>
              <h2 style={{ marginBottom: 2 }}>{employee.name}</h2>
              <span className="small muted">
                {employee.role} · <span className="mono">{employee.code}</span> · {money(employee.hourlyRate)}/hour
              </span>
            </div>
          </div>
          <Link className="btn sm" to="/admin/employees">
            Back to employees
          </Link>
        </div>
      </div>

      <div className="tiles">
        <Tile icon="check" label="Day units" value={units.toFixed(2)} tone="var(--accent)" />
        <Tile icon="clock" label="Approved hours" value={approvedHours.toFixed(2)} tone="var(--good)" />
        <Tile icon="cal" label="Pending hours" value={pendingHours.toFixed(2)} tone="var(--warn)" />
        <Tile icon="rupee" label="Payable so far" value={money(approvedHours * employee.hourlyRate)} tone="var(--primary)" />
      </div>

      <div className="card">
        <div className="head-row">
          <div>
            <h3>Attendance file</h3>
            <span className="small muted">Click a row to change the days worked. Entering 0 marks the day absent.</span>
          </div>
          <MonthNav month={month} onChange={setMonth} />
        </div>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>In → out</th>
                <th>Day type</th>
                <th className="r">Hours</th>
                <th className="r">Days</th>
                <th className="r">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length ? (
                records.map((record) => (
                  <tr key={record.id}>
                    <td>{prettyDate(record.date)}</td>
                    <td className="mono small">
                      {clock12(record.inMin)} → {record.outMin == null ? 'open' : clock12(record.outMin)}
                    </td>
                    <td>{record.dayType}</td>
                    <td className="r mono">{record.outMin == null ? '–' : fmtHours(record.hours)}</td>
                    <td className="r">
                      <select
                        value={record.dayType === 'custom' ? '1' : { full: 1, half: 0.5, double: 2 }[record.dayType]}
                        onChange={(event) => setDays(record.date, event.target.value, record.hours)}
                        aria-label={`Days for ${record.date}`}
                        style={{ width: 90 }}
                      >
                        {DAY_OPTIONS.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="r">
                      {record.approved ? <Chip tone="good">Approved</Chip> : <Chip tone="warn">Pending</Chip>}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="muted">
                    No punches in this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="cols even">
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Advances</h3>
          <form className="rowform" onSubmit={addAdvance} style={{ marginBottom: 12 }}>
            <label className="field">
              <span>Amount ₹</span>
              <input
                type="number"
                min="1"
                step="100"
                required
                value={advance.amount}
                onChange={(event) => setAdvance({ ...advance, amount: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                max={todayISO()}
                value={advance.date}
                onChange={(event) => setAdvance({ ...advance, date: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Note</span>
              <input
                type="text"
                maxLength={80}
                value={advance.note}
                onChange={(event) => setAdvance({ ...advance, note: event.target.value })}
              />
            </label>
            <button className="btn primary" type="submit">
              Add advance
            </button>
          </form>

          {file.advances.length ? (
            file.advances.map((item) => {
              const monthDeduction = item.deductions.find((entry) => entry.month === month)?.amount || 0;
              return (
                <div className="logrow" key={item.id}>
                  <div className="grow">
                    <b className="mono">{money(item.amount)}</b>
                    <br />
                    <span className="small muted">
                      {prettyDate(item.date)} {item.note ? `· ${item.note}` : ''}
                      <br />
                      Deducted {money(item.deducted)} · outstanding {money(item.amount - item.deducted)}
                    </span>
                  </div>
                  <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    This month
                    <input
                      className="sm"
                      type="number"
                      min="0"
                      step="100"
                      defaultValue={monthDeduction}
                      onBlur={(event) => {
                        if (Number(event.target.value) !== monthDeduction) deduct(item.id, event.target.value);
                      }}
                      aria-label="Deduction this month"
                    />
                  </label>
                </div>
              );
            })
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              No advances.
            </p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Salary estimate · {month}</h3>
          <div className="pay">
            <div>
              <span className="cap">Payable</span>
              <div className="big num">{money(approvedHours * employee.hourlyRate)}</div>
            </div>
            <div className="formula">
              {fmtHours(approvedHours)} × {money(employee.hourlyRate)}
            </div>
          </div>
          <p className="small muted" style={{ margin: '12px 0 0' }}>
            {units.toFixed(2)} day units counted. {pendingHours > 0 ? `${fmtHours(pendingHours)} still waiting for approval.` : 'No hours waiting for approval.'}
          </p>
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            <Icon name="shield" size={13} /> Salary is calculated only from hours you have approved.
          </p>
        </div>
      </div>
    </div>
  );
}
