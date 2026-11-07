import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Chip, ErrorNote, Loading, hours as fmtHours, prettyDate, todayISO, useToast, Toast } from '../../ui.jsx';

const TASKS = [
  'Cutting',
  'Planing',
  'Joinery',
  'Carving',
  'Assembly',
  'Sanding',
  'Polishing',
  'Finishing',
  'Design work',
  'Supervision',
  'Cleaning',
  'Packing',
  'Loading',
  'Other',
];

const ITEMS = [
  'Teak dining table (Order #214)',
  'Teak chair set of 6 (Order #215)',
  'Teak bed frame (Order #210)',
  'Wardrobe door panels (Order #212)',
  'Sofa frame (Order #217)',
];

export default function WorkView({ employee }) {
  const [entries, setEntries] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [form, setForm] = useState({ task: 'Cutting', item: '', hours: 1, note: '' });
  const [error, setError] = useState(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      const month = todayISO().slice(0, 7);
      const [work, records] = await Promise.all([
        api.get(`/work?month=${month}`),
        api.get(`/attendance/me?month=${month}`),
      ]);
      setEntries(work);
      setAttendance(records.records);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const today = todayISO();
  const present = attendance.some((record) => record.date === today);
  const todays = (entries || []).filter((entry) => entry.date === today);
  const total = todays.reduce((sum, entry) => sum + entry.hours, 0);

  const add = async (event) => {
    event.preventDefault();
    try {
      const created = await api.post('/work', {
        task: form.task,
        item: form.item,
        hours: Number(form.hours),
        note: form.note,
      });
      setEntries((current) => [created, ...current]);
      setForm({ ...form, item: '', note: '', hours: 1 });
      notify('Added to today’s log.');
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
  if (!entries) return <Loading />;

  const previousDays = [...new Set(entries.filter((entry) => entry.date < today).map((entry) => entry.date))]
    .sort()
    .reverse()
    .slice(0, 5);

  return (
    <div className="stack">
      <Toast message={toast.message} error={toast.error} />

      <form className="card" onSubmit={add}>
        <h3 style={{ marginBottom: 4 }}>What did you work on?</h3>
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          Add each job you did today. You can add several entries.
        </p>

        <label className="field">
          <span>Kind of work</span>
          <select value={form.task} onChange={(event) => setForm({ ...form, task: event.target.value })}>
            {TASKS.map((task) => (
              <option key={task} value={task}>
                {task}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Item or order</span>
          <input
            list="work-items"
            maxLength={80}
            placeholder="Teak dining table (Order #214)"
            value={form.item}
            onChange={(event) => setForm({ ...form, item: event.target.value })}
          />
          <datalist id="work-items">
            {ITEMS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        <div className="two">
          <label className="field">
            <span>Hours spent</span>
            <input
              type="number"
              min="0.25"
              max="12"
              step="0.25"
              value={form.hours}
              onChange={(event) => setForm({ ...form, hours: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Note (optional)</span>
            <input
              maxLength={100}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </label>
        </div>

        <button className="btn primary" type="submit" disabled={!present}>
          Add to today’s log
        </button>
        {!present ? (
          <p className="small muted" style={{ margin: '10px 0 0' }}>
            Check in first. You can add work only on days you are present.
          </p>
        ) : null}
      </form>

      <div className="card">
        <div className="head-row">
          <h3>Today’s work</h3>
          <Chip tone={total > 0 ? 'good' : ''}>{fmtHours(total)} logged</Chip>
        </div>
        {todays.length ? (
          todays.map((entry) => (
            <div className="logrow" key={entry.id}>
              <div className="grow">
                <b>{entry.task}</b>
                <br />
                <span className="small muted">
                  {entry.item}
                  {entry.note ? ` · ${entry.note}` : ''}
                </span>
              </div>
              <span className="mono">{fmtHours(entry.hours)}</span>
              <button type="button" className="btn sm no" onClick={() => remove(entry)}>
                Remove
              </button>
            </div>
          ))
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Nothing logged yet.
          </p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Previous days</h3>
        {previousDays.length ? (
          previousDays.map((date) => {
            const dayEntries = entries.filter((entry) => entry.date === date);
            return (
              <div className="logrow" key={date}>
                <div className="grow">
                  <b>{prettyDate(date)}</b>
                  <br />
                  <span className="small muted">{dayEntries.map((entry) => entry.task).join(', ')}</span>
                </div>
                <span className="mono">{fmtHours(dayEntries.reduce((sum, entry) => sum + entry.hours, 0))}</span>
              </div>
            );
          })
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            No earlier entries.
          </p>
        )}
      </div>
    </div>
  );
}
