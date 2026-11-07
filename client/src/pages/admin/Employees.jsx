import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Avatar, Chip, ErrorNote, Icon, Loading, money, useToast, Toast } from '../../ui.jsx';

/** Downscale a photo in the browser before sending it to the API. */
const readPhoto = (file, size = 160) =>
  new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Please choose a photo.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const min = Math.min(image.width, image.height);
        context.drawImage(
          image,
          (image.width - min) / 2,
          (image.height - min) / 2,
          min,
          min,
          0,
          0,
          size,
          size,
        );
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = () => reject(new Error('Could not read that photo.'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read that photo.'));
    reader.readAsDataURL(file);
  });

export default function Employees() {
  const [employees, setEmployees] = useState(null);
  const [teams, setTeams] = useState([]);
  const [query, setQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', teamId: 'carp', hourlyRate: 100, pin: '1234' });
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [pinTarget, setPinTarget] = useState(null);
  const [pinValue, setPinValue] = useState('');
  const [error, setError] = useState(null);
  const fileInput = useRef(null);
  const photoTarget = useRef(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      const [staff, teamList] = await Promise.all([api.get('/employees?includeInactive=1'), api.get('/teams')]);
      setEmployees(staff);
      setTeams(teamList);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (id, patch) => {
    try {
      const updated = await api.patch(`/employees/${id}`, patch);
      setEmployees((current) => current.map((employee) => (employee.id === id ? updated : employee)));
      notify('Saved.');
    } catch (err) {
      fail(err);
    }
  };

  const addEmployee = async (event) => {
    event.preventDefault();
    try {
      const created = await api.post('/employees', {
        ...form,
        hourlyRate: Number(form.hourlyRate),
      });
      setEmployees((current) => [created, ...current]);
      setForm({ name: '', role: '', teamId: 'carp', hourlyRate: 100, pin: '1234' });
      setAdding(false);
      notify(`${created.name} added with code ${created.code}.`);
    } catch (err) {
      fail(err);
    }
  };

  const remove = async (employee) => {
    try {
      await api.del(`/employees/${employee.id}`);
      setEmployees((current) =>
        current.map((item) => (item.id === employee.id ? { ...item, active: false } : item)),
      );
      setConfirmRemove(null);
      notify(`${employee.name} removed. Past records are kept.`);
    } catch (err) {
      fail(err);
    }
  };

  const restore = async (employee) => {
    try {
      const updated = await api.post(`/employees/${employee.id}/restore`);
      setEmployees((current) => current.map((item) => (item.id === employee.id ? updated : item)));
      notify(`${employee.name} restored.`);
    } catch (err) {
      fail(err);
    }
  };

  const pickPhoto = (employee) => {
    photoTarget.current = employee;
    fileInput.current?.click();
  };

  const onPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !photoTarget.current) return;
    try {
      const photo = await readPhoto(file);
      await save(photoTarget.current.id, { photo });
    } catch (err) {
      fail(err);
    }
  };

  const savePin = async (employee) => {
    try {
      await api.patch(`/employees/${employee.id}`, { pin: pinValue });
      setPinTarget(null);
      setPinValue('');
      notify(`PIN updated for ${employee.name}.`);
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!employees) return <Loading />;

  const search = query.trim().toLowerCase();
  const active = employees.filter(
    (employee) =>
      employee.active &&
      (teamFilter === 'all' || employee.teamId === teamFilter) &&
      (!search || `${employee.name} ${employee.role} ${employee.code}`.toLowerCase().includes(search)),
  );
  const removed = employees.filter((employee) => !employee.active);

  return (
    <div className="stack">
      <Toast message={toast.message} error={toast.error} />
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPhoto} />

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input
            type="search"
            placeholder="Search name, role or code"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} aria-label="Filter by team">
          <option value="all">All teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <span className="grow" />
        <button type="button" className="btn primary" onClick={() => setAdding((value) => !value)}>
          <Icon name="plus" size={16} /> Add employee
        </button>
      </div>

      {adding ? (
        <form className="card" onSubmit={addEmployee}>
          <h3 style={{ marginBottom: 12 }}>Add employee</h3>
          <div className="rowform">
            <label className="field">
              <span>Full name</span>
              <input
                type="text"
                maxLength={60}
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Role</span>
              <input
                type="text"
                maxLength={40}
                required
                placeholder="Carpenter"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Team</span>
              <select value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })}>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Hourly rate ₹</span>
              <input
                type="number"
                min="0"
                step="5"
                value={form.hourlyRate}
                onChange={(event) => setForm({ ...form, hourlyRate: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Login PIN</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={form.pin}
                onChange={(event) => setForm({ ...form, pin: event.target.value })}
              />
            </label>
            <button className="btn primary" type="submit">
              Save employee
            </button>
          </div>
          <p className="small muted" style={{ margin: '10px 0 0' }}>
            A code is created automatically (AW-101, AW-102 …). Add a photo from the list after saving.
          </p>
        </form>
      ) : null}

      <div className="card">
        <div className="head-row">
          <h3>
            Employees <span className="muted">({active.length})</span>
          </h3>
        </div>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Team</th>
                <th className="r">Rate ₹/hour</th>
                <th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Avatar person={employee} size={38} ring />
                      <div>
                        <input
                          type="text"
                          maxLength={60}
                          defaultValue={employee.name}
                          aria-label="Name"
                          onBlur={(event) => {
                            if (event.target.value.trim() && event.target.value !== employee.name) {
                              save(employee.id, { name: event.target.value.trim() });
                            }
                          }}
                        />
                        {employee.isLead ? <span className="lead">LEAD</span> : null}
                        <br />
                        <span className="small muted mono">{employee.code}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      maxLength={40}
                      defaultValue={employee.role}
                      aria-label={`Role for ${employee.name}`}
                      onBlur={(event) => {
                        if (event.target.value.trim() && event.target.value !== employee.role) {
                          save(employee.id, { role: event.target.value.trim() });
                        }
                      }}
                    />
                  </td>
                  <td>
                    <select
                      value={employee.teamId}
                      aria-label={`Team for ${employee.name}`}
                      onChange={(event) => save(employee.id, { teamId: event.target.value })}
                    >
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="r">
                    <input
                      className="sm"
                      type="number"
                      min="0"
                      step="5"
                      defaultValue={employee.hourlyRate}
                      aria-label={`Hourly rate for ${employee.name}`}
                      onBlur={(event) => {
                        if (Number(event.target.value) !== employee.hourlyRate) {
                          save(employee.id, { hourlyRate: Number(event.target.value) });
                        }
                      }}
                    />
                  </td>
                  <td className="r">
                    {confirmRemove === employee.id ? (
                      <span className="inl">
                        <span className="small">Remove?</span>
                        <button type="button" className="btn sm no" onClick={() => remove(employee)}>
                          Yes, remove
                        </button>
                        <button type="button" className="btn sm" onClick={() => setConfirmRemove(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <div className="inl" style={{ justifyContent: 'flex-end' }}>
                        <Link className="btn sm" to={`/admin/employees/${employee.id}`}>
                          <Icon name="file" size={13} /> File
                        </Link>
                        <button type="button" className="btn sm" onClick={() => pickPhoto(employee)}>
                          <Icon name="cam" size={13} /> Photo
                        </button>
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => {
                            setPinTarget(employee.id);
                            setPinValue('');
                          }}
                        >
                          PIN
                        </button>
                        <button type="button" className="btn sm no" onClick={() => setConfirmRemove(employee.id)}>
                          <Icon name="trash" size={13} /> Remove
                        </button>
                      </div>
                    )}
                    {pinTarget === employee.id ? (
                      <div className="inl" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="New PIN"
                          value={pinValue}
                          onChange={(event) => setPinValue(event.target.value)}
                          style={{ width: 100 }}
                        />
                        <button type="button" className="btn sm primary" onClick={() => savePin(employee)}>
                          Save
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!active.length ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No employee matches.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ margin: '12px 0 0' }}>
          Removed employees cannot log in. Their past attendance and salary records are kept. Today's payroll for
          this list is {money(active.reduce((sum, employee) => sum + employee.hourlyRate, 0))} per hour.
        </p>
      </div>

      {removed.length ? (
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>Removed employees</h3>
          {removed.map((employee) => (
            <div className="logrow" key={employee.id}>
              <Avatar person={employee} size={34} />
              <div className="grow">
                <b>{employee.name}</b>
                <br />
                <span className="small muted">{employee.role}</span>
              </div>
              <button type="button" className="btn sm" onClick={() => restore(employee)}>
                <Icon name="undo" size={13} /> Restore
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
