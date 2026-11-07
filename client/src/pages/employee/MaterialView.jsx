import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Chip, ErrorNote, Loading, prettyDate, useToast, Toast } from '../../ui.jsx';

const UNITS = ['pcs', 'cft', 'sheet', 'litre', 'kg', 'metre', 'box', 'roll', 'set'];

export default function MaterialView() {
  const [requests, setRequests] = useState(null);
  const [form, setForm] = useState({ itemName: '', qty: 1, unit: 'pcs', urgency: 'Normal', note: '' });
  const [error, setError] = useState(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      setRequests(await api.get('/ops/material-requests'));
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    try {
      const created = await api.post('/ops/material-requests', { ...form, qty: Number(form.qty) });
      setRequests((current) => [created, ...current]);
      setForm({ itemName: '', qty: 1, unit: 'pcs', urgency: 'Normal', note: '' });
      notify('Request sent to the admin.');
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!requests) return <Loading />;

  return (
    <div className="stack">
      <Toast message={toast.message} error={toast.error} />

      <form className="card" onSubmit={submit}>
        <h3 style={{ marginBottom: 4 }}>Need material?</h3>
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          Send a request to the admin for stock, tools or consumables.
        </p>

        <label className="field">
          <span>Item</span>
          <input
            maxLength={80}
            required
            placeholder="PU polish (clear gloss)"
            value={form.itemName}
            onChange={(event) => setForm({ ...form, itemName: event.target.value })}
          />
        </label>

        <div className="two">
          <label className="field">
            <span>Quantity</span>
            <input
              type="number"
              min="0.01"
              step="any"
              value={form.qty}
              onChange={(event) => setForm({ ...form, qty: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Unit</span>
            <select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Urgency</span>
          <select value={form.urgency} onChange={(event) => setForm({ ...form, urgency: event.target.value })}>
            <option>Normal</option>
            <option>Urgent</option>
          </select>
        </label>

        <label className="field">
          <span>Note (optional)</span>
          <input
            maxLength={100}
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </label>

        <button className="btn primary" type="submit">
          Send request
        </button>
      </form>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>My requests</h3>
        {requests.length ? (
          requests.map((request) => (
            <div className="logrow" key={request.id}>
              <div className="grow">
                <b>
                  {request.itemName}{' '}
                  <span className="mono small">
                    {request.qty} {request.unit}
                  </span>
                </b>
                <br />
                <span className="small muted">
                  {prettyDate(request.date)} · {request.urgency}
                  {request.note ? ` · ${request.note}` : ''}
                </span>
              </div>
              <Chip tone={request.status === 'approved' ? 'good' : request.status === 'rejected' ? 'bad' : request.status === 'ordered' ? 'info' : 'warn'}>
                {request.status}
              </Chip>
            </div>
          ))
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            No requests yet.
          </p>
        )}
      </div>
    </div>
  );
}
