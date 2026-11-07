import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { ErrorNote, Icon, Loading, Tile, money, prettyDate, todayISO, useToast, Toast } from '../../ui.jsx';

const CATEGORIES = [
  'Tea & food',
  'Transport',
  'Fuel',
  'Hardware & tools',
  'Repair & maintenance',
  'Stationery',
  'Courier',
  'Labour advance',
  'Cash added',
  'Other',
];

export default function Petty() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    direction: 'out',
    category: 'Tea & food',
    description: '',
    amount: '',
    paidTo: '',
    date: todayISO(),
  });
  const [error, setError] = useState(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      setData(await api.get('/ops/petty'));
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (event) => {
    event.preventDefault();
    try {
      const updated = await api.post('/ops/petty', { ...form, amount: Number(form.amount) });
      setData(updated);
      setForm({ ...form, description: '', amount: '', paidTo: '' });
      notify('Entry saved.');
    } catch (err) {
      fail(err);
    }
  };

  const remove = async (entry) => {
    try {
      setData(await api.del(`/ops/petty/${entry.id}`));
      notify('Entry removed.');
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;

  return (
    <div className="stack">
      <Toast message={toast.message} error={toast.error} />

      <div className="tiles">
        <Tile icon="wallet" label="Balance now" value={money(data.balance)} tone={data.balance <= data.low ? 'var(--bad)' : 'var(--good)'} />
        <Tile icon="rupee" label="Opening balance" value={money(data.opening)} tone="var(--muted)" />
        <Tile icon="clock" label="Spent today" value={money(data.spentToday)} tone="var(--warn)" />
        <Tile icon="shield" label="Low balance alert" value={money(data.low)} tone="var(--primary)" />
      </div>

      <div className="cols">
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Cash book</h3>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Details</th>
                  <th>Category</th>
                  <th className="r">In</th>
                  <th className="r">Out</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="small">{prettyDate(entry.date)}</td>
                    <td>
                      <b>{entry.description || entry.category}</b>
                      <br />
                      <span className="small muted">{entry.paidTo}</span>
                    </td>
                    <td className="small muted">{entry.category}</td>
                    <td className="r mono" style={{ color: 'var(--good)' }}>
                      {entry.direction === 'in' ? money(entry.amount) : ''}
                    </td>
                    <td className="r mono" style={{ color: 'var(--bad)' }}>
                      {entry.direction === 'out' ? money(entry.amount) : ''}
                    </td>
                    <td className="r">
                      <button
                        type="button"
                        className="btn sm ghost no"
                        onClick={() => remove(entry)}
                        aria-label="Delete entry"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!data.entries.length ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No entries yet. Add cash from the owner to start the book.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <form className="card" onSubmit={add} style={{ alignSelf: 'start' }}>
          <h3 style={{ marginBottom: 12 }}>Add entry</h3>
          <div className="seg" style={{ width: '100%', marginBottom: 12 }}>
            <button
              type="button"
              className={form.direction === 'out' ? 'on' : ''}
              style={{ flex: 1 }}
              onClick={() => setForm({ ...form, direction: 'out', category: 'Tea & food' })}
            >
              Money out
            </button>
            <button
              type="button"
              className={form.direction === 'in' ? 'on' : ''}
              style={{ flex: 1 }}
              onClick={() => setForm({ ...form, direction: 'in', category: 'Cash added' })}
            >
              Cash in
            </button>
          </div>

          <div className="two">
            <label className="field">
              <span>Amount ₹</span>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                max={todayISO()}
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>
          </div>

          <label className="field">
            <span>Category</span>
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Description</span>
            <input
              value={form.description}
              maxLength={90}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Tea and snacks"
            />
          </label>
          <label className="field">
            <span>Paid to</span>
            <input
              value={form.paidTo}
              maxLength={60}
              onChange={(event) => setForm({ ...form, paidTo: event.target.value })}
              placeholder="Canteen"
            />
          </label>

          <button className="btn primary big" type="submit">
            Save entry
          </button>
          <p className="small muted" style={{ margin: '10px 0 0' }}>
            Opening balance {money(data.opening)} from {data.openDate ? prettyDate(data.openDate) : 'the start'}.
          </p>
        </form>
      </div>
    </div>
  );
}
