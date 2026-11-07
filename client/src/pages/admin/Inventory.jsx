import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Chip, ErrorNote, Icon, Loading, Tile, money, prettyDate, useToast, Toast } from '../../ui.jsx';

const CATEGORIES = ['Wood', 'Polish & paint', 'Hardware', 'Fabric & foam', 'Consumables', 'Packing', 'Tools'];
const UNITS = ['pcs', 'cft', 'sheet', 'litre', 'kg', 'metre', 'box', 'roll', 'set'];

export default function Inventory() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'Wood', unit: 'pcs', qty: 0, minQty: 0, rate: 0 });
  const [error, setError] = useState(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      setData(await api.get('/ops/inventory'));
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
      await api.post('/ops/inventory', {
        ...form,
        qty: Number(form.qty),
        minQty: Number(form.minQty),
        rate: Number(form.rate),
      });
      setForm({ name: '', category: 'Wood', unit: 'pcs', qty: 0, minQty: 0, rate: 0 });
      await load();
      notify('Item added.');
    } catch (err) {
      fail(err);
    }
  };

  const update = async (item, patch) => {
    try {
      await api.patch(`/ops/inventory/${item.id}`, patch);
      await load();
    } catch (err) {
      fail(err);
    }
  };

  const remove = async (item) => {
    try {
      await api.del(`/ops/inventory/${item.id}`);
      await load();
      notify('Item removed.');
    } catch (err) {
      fail(err);
    }
  };

  const decide = async (request, status) => {
    try {
      await api.patch(`/ops/material-requests/${request.id}`, { status });
      await load();
      notify(`Request marked ${status}.`);
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
        <Tile icon="box" label="Items tracked" value={data.items.length} tone="var(--primary)" />
        <Tile icon="shield" label="Low stock" value={data.lowStock} tone="var(--bad)" />
        <Tile icon="wallet" label="Stock value" value={money(data.stockValue)} tone="var(--good)" />
        <Tile icon="clip" label="Open requests" value={data.requests.filter((r) => r.status === 'pending').length} tone="var(--warn)" />
      </div>

      <div className="cols">
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Stock</h3>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="r">Qty</th>
                  <th>Unit</th>
                  <th className="r">Min</th>
                  <th className="r">Rate ₹</th>
                  <th className="r">Value</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b>{item.name}</b>
                      {item.low ? <Chip tone="bad">Low</Chip> : null}
                    </td>
                    <td className="small muted">{item.category}</td>
                    <td className="r">
                      <input
                        className="sm"
                        type="number"
                        min="0"
                        step="any"
                        defaultValue={item.qty}
                        onBlur={(event) => {
                          if (Number(event.target.value) !== item.qty) update(item, { qty: Number(event.target.value) });
                        }}
                        aria-label={`Quantity of ${item.name}`}
                      />
                    </td>
                    <td className="small">{item.unit}</td>
                    <td className="r mono small">{item.minQty}</td>
                    <td className="r">
                      <input
                        className="sm"
                        type="number"
                        min="0"
                        step="any"
                        defaultValue={item.rate}
                        onBlur={(event) => {
                          if (Number(event.target.value) !== item.rate) update(item, { rate: Number(event.target.value) });
                        }}
                        aria-label={`Rate of ${item.name}`}
                      />
                    </td>
                    <td className="r mono">{money(item.value)}</td>
                    <td className="r">
                      <button
                        type="button"
                        className="btn sm ghost no"
                        onClick={() => remove(item)}
                        aria-label={`Remove ${item.name}`}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form className="card" onSubmit={add} style={{ alignSelf: 'start' }}>
          <h3 style={{ marginBottom: 12 }}>Add item</h3>
          <label className="field">
            <span>Item name</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Teak wood planks"
              required
            />
          </label>
          <div className="two">
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
          <div className="two">
            <label className="field">
              <span>In stock</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.qty}
                onChange={(event) => setForm({ ...form, qty: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Minimum</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.minQty}
                onChange={(event) => setForm({ ...form, minQty: event.target.value })}
              />
            </label>
          </div>
          <label className="field">
            <span>Rate ₹</span>
            <input
              type="number"
              min="0"
              step="any"
              value={form.rate}
              onChange={(event) => setForm({ ...form, rate: event.target.value })}
            />
          </label>
          <button className="btn primary big" type="submit">
            Add item
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Material requests</h3>
        <span className="small muted">Raised by employees from the Material tab.</span>
        {data.requests.length ? (
          data.requests.map((request) => (
            <div className="pend" key={request.id}>
              <div className="grow">
                <b>
                  {request.itemName}{' '}
                  <span className="mono small">
                    {request.qty} {request.unit}
                  </span>{' '}
                  {request.urgency === 'Urgent' ? <Chip tone="bad">Urgent</Chip> : null}
                </b>
                <br />
                <span className="small muted">
                  {request.employeeName} · {prettyDate(request.date)}
                  {request.note ? ` · ${request.note}` : ''}
                </span>
              </div>
              {request.status === 'pending' ? (
                <>
                  <button type="button" className="btn sm ok" onClick={() => decide(request, 'approved')}>
                    Approve
                  </button>
                  <button type="button" className="btn sm" onClick={() => decide(request, 'ordered')}>
                    Mark ordered
                  </button>
                  <button type="button" className="btn sm no" onClick={() => decide(request, 'rejected')}>
                    Reject
                  </button>
                </>
              ) : (
                <Chip tone={request.status === 'approved' ? 'good' : request.status === 'rejected' ? 'bad' : 'info'}>
                  {request.status}
                </Chip>
              )}
            </div>
          ))
        ) : (
          <p className="muted" style={{ margin: '8px 0 0' }}>
            No material requests yet.
          </p>
        )}
      </div>
    </div>
  );
}
