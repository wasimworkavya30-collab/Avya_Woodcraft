import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';
import { Avatar, Chip, ErrorNote, Icon, Loading, Tile, hours as fmtHours, prettyDate, useToast, Toast, todayISO } from '../../ui.jsx';

export default function WorkLog() {
  const [entries, setEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [date, setDate] = useState(todayISO());
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const { toast, notify, fail } = useToast();

  const load = async (targetDate) => {
    try {
      const [staff, dayEntries] = await Promise.all([api.get('/employees'), api.get(`/work?date=${targetDate}`)]);
      const dayAttendance = await api.get(`/attendance?date=${targetDate}`);
      setEmployees(staff);
      setEntries(dayEntries);
      setAttendance(dayAttendance);
      setReady(true);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const dates = useMemo(() => {
    const all = new Set([todayISO(), ...entries.map((entry) => entry.date), date]);
    return [...all].sort().reverse();
  }, [entries, date]);

  const total = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const staffById = Object.fromEntries(employees.map((employee) => [employee.id, employee]));

  const byTask = entries.reduce((acc, entry) => {
    acc[entry.task] = (acc[entry.task] || 0) + entry.hours;
    return acc;
  }, {});
  const taskKeys = Object.keys(byTask).sort((a, b) => byTask[b] - byTask[a]);
  const maxTask = Math.max(1, ...taskKeys.map((key) => byTask[key]));

  const visible = employees.filter(
    (employee) =>
      employeeFilter === 'all' ||
      String(employee.id) === String(employeeFilter) ||
      entries.some((entry) => entry.employeeId === employee.id),
  );

  const loggedCount = employees.filter((employee) => entries.some((entry) => entry.employeeId === employee.id)).length;
  const presentNoLog = employees.filter(
    (employee) =>
      attendance.some((record) => record.employeeId === employee.id) &&
      !entries.some((entry) => entry.employeeId === employee.id),
  ).length;

  const updateHours = async (entry, value) => {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0) return;
    try {
      await api.patch(`/work/${entry.id}`, { hours });
      setEntries((current) => current.map((item) => (item.id === entry.id ? { ...item, hours } : item)));
      notify('Hours saved.');
    } catch (err) {
      fail(err);
    }
  };

  const remove = async (entry) => {
    try {
      await api.del(`/work/${entry.id}`);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      notify('Entry removed.');
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;

  return (
    <div className="stack">
      <Toast message={toast.message} error={toast.error} />
      <div className="two" style={{ maxWidth: 520 }}>
        <label className="field" style={{ margin: 0 }}>
          <span>Date</span>
          <select value={date} onChange={(event) => setDate(event.target.value)}>
            {dates.map((value) => (
              <option key={value} value={value}>
                {prettyDate(value)}
                {value === todayISO() ? ' (today)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span>Employee</span>
          <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
            <option value="all">All employees</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="tiles">
        <Tile icon="clock" label="Hours logged" value={fmtHours(total).replace(' h', '')} tone="var(--primary)" />
        <Tile icon="users" label="Employees logged" value={loggedCount} tone="var(--good)" />
        <Tile icon="clip" label="Present, no log" value={presentNoLog} tone="var(--warn)" />
      </div>

      <div className="cols">
        <div className="stack">
          {!ready ? <Loading /> : null}
          {ready &&
            visible
              .map((employee) => {
                const mine = entries.filter((entry) => entry.employeeId === employee.id);
                const record = attendance.find((item) => item.employeeId === employee.id);
                if (!mine.length && !record) return null;
                const logged = mine.reduce((sum, entry) => sum + entry.hours, 0);

                return (
                  <div className="card" key={employee.id}>
                    <div className="logrow" style={{ paddingTop: 0 }}>
                      <Avatar person={employee} src={record?.selfie} size={40} ring />
                      <div className="grow">
                        <b>{employee.name}</b>
                        <br />
                        <span className="small muted">
                          {employee.role}
                          {record ? ` · in ${record.inMin ? `${Math.floor(record.inMin / 60)}:${String(record.inMin % 60).padStart(2, '0')}` : ''}` : ''}
                        </span>
                      </div>
                      {mine.length ? <Chip tone="good">{fmtHours(logged)} logged</Chip> : <Chip tone="warn">No work logged</Chip>}
                    </div>

                    {mine.length ? (
                      mine.map((entry) => (
                        <div className="logrow" key={entry.id}>
                          <div className="grow">
                            <b>{entry.task}</b>
                            <br />
                            <span className="small muted">
                              {entry.item}
                              {entry.note ? ` · ${entry.note}` : ''}
                            </span>
                          </div>
                          <input
                            className="sm"
                            type="number"
                            min="0.25"
                            max="12"
                            step="0.25"
                            defaultValue={entry.hours}
                            onBlur={(event) => {
                              if (Number(event.target.value) !== entry.hours) updateHours(entry, event.target.value);
                            }}
                            aria-label={`Hours for ${entry.task}`}
                          />
                          <button
                            type="button"
                            className="btn sm ghost no"
                            onClick={() => remove(entry)}
                            aria-label="Delete entry"
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="small muted" style={{ margin: '8px 0 0' }}>
                        This employee was present but did not add any work.
                      </p>
                    )}
                  </div>
                );
              })}
        </div>

        <div className="card" style={{ alignSelf: 'start' }}>
          <h3 style={{ marginBottom: 12 }}>Hours by kind of work</h3>
          {taskKeys.length ? (
            taskKeys.map((key) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div className="head-row" style={{ margin: 0 }}>
                  <span>{key}</span>
                  <span className="mono">{byTask[key].toFixed(2)}</span>
                </div>
                <div className="track">
                  <div className="bar" style={{ width: `${Math.round((byTask[key] / maxTask) * 100)}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              No work logged on this day.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
