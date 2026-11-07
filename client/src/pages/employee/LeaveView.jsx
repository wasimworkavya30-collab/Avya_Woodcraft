import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Chip, ErrorNote, Loading, prettyDate, todayISO, useToast, Toast } from '../../ui.jsx';

const TYPES = ['Casual', 'Sick', 'Unpaid'];

export default function LeaveView() {
  const [requests, setRequests] = useState(null);
  const [form, setForm] = useState({ type: 'Casual', from: todayISO(), to: todayISO(), reason: '' });
  const [error, setError] = useState(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      setRequests(await api.get('/leave'));
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
      const created = await api.post('/leave', form);
      setRequests((current) => [created, ...current]);
      setForm({ type: 'Casual', from: todayISO(), to: todayISO(), reason: '' });
      notify('Request sent for approval.');
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!requests) return <Loading />;

  const days =
    Math.round((new Date(`${form.to}T00:00:00`) - new Date(`${form.from}T00:00:00`)) / 86400000) + 1;

  return (
    <div className="stack">
      <Toast message={toast.message} error={toast.error} />

      <form className="card" onSubmit={submit}>
        <h3 style={{ marginBottom: 12 }}>Request leave</h3>

        <label className="field">
          <span>Type</span>
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <div className="two">
          <label className="field">
            <span>From</span>
            <input
              type="date"
              min={todayISO()}
              value={form.from}
              onChange={(event) =>
                setForm({
                  ...form,
                  from: event.target.value,
                  to: form.to < event.target.value ? event.target.value : form.to,
                })
              }
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="date"
              min={form.from}
              value={form.to}
              onChange={(event) => setForm({ ...form, to: event.target.value })}
            />
          </label>
        </div>

        <label className="field">
          <span>Reason</span>
          <input
            maxLength={120}
            required
            placeholder="Short reason"
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
          />
        </label>

        <p className="small muted" style={{ margin: '0 0 10px' }}>
          {days} day{days > 1 ? 's' : ''} requested.
        </p>

        <button className="btn primary" type="submit">
          Send for approval
        </button>
      </form>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>My requests</h3>
        {requests.length ? (
          requests.map((request) => {
            const span =
              Math.round((new Date(`${request.to}T00:00:00`) - new Date(`${request.from}T00:00:00`)) / 86400000) + 1;
            return (
              <div className="logrow" key={request.id}>
                <div className="grow">
                  <b>
                    {request.type} · {span} day{span > 1 ? 's' : ''}
                  </b>
                  <br />
                  <span className="small muted">
                    {prettyDate(request.from)}
                    {request.to !== request.from ? ` to ${prettyDate(request.to)}` : ''} · {request.reason}
                  </span>
                </div>
                <Chip
                  tone={request.status === 'approved' ? 'good' : request.status === 'rejected' ? 'bad' : 'warn'}
                >
                  {request.status}
                </Chip>
              </div>
            );
          })
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            No requests yet.
          </p>
        )}
      </div>
    </div>
  );
}
