import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Chip, ErrorNote, Icon, Loading, todayISO, useToast, Toast } from '../../ui.jsx';

export default function Production() {
  const [orders, setOrders] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ label: '', customer: '', qty: 1, startDate: todayISO() });
  const [stageNames, setStageNames] = useState({});
  const [error, setError] = useState(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      const [list, staff] = await Promise.all([api.get('/ops/orders'), api.get('/employees')]);
      setOrders(list);
      setEmployees(staff);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addOrder = async (event) => {
    event.preventDefault();
    try {
      await api.post('/ops/orders', {
        ...form,
        qty: Number(form.qty),
      });
      setForm({ label: '', customer: '', qty: 1, startDate: todayISO() });
      await load();
      notify('Item added. Adjust its stages and days.');
    } catch (err) {
      fail(err);
    }
  };

  const patchStage = async (stage, patch) => {
    try {
      await api.patch(`/ops/orders/stages/${stage.id}`, patch);
      await load();
    } catch (err) {
      fail(err);
    }
  };

  const addStage = async (order) => {
    const name = (stageNames[order.id] || '').trim();
    if (!name) return;
    try {
      await api.post(`/ops/orders/${order.id}/stages`, { name, plannedDays: 1 });
      setStageNames({ ...stageNames, [order.id]: '' });
      await load();
    } catch (err) {
      fail(err);
    }
  };

  const removeStage = async (stage) => {
    try {
      await api.del(`/ops/orders/stages/${stage.id}`);
      await load();
    } catch (err) {
      fail(err);
    }
  };

  const assign = async (stage, employeeId) => {
    if (!employeeId) return;
    try {
      await api.post(`/ops/orders/stages/${stage.id}/assignees`, { employeeId: Number(employeeId) });
      await load();
      notify('Person added to the stage.');
    } catch (err) {
      fail(err);
    }
  };

  const unassign = async (stage, employeeId) => {
    try {
      await api.del(`/ops/orders/stages/${stage.id}/assignees/${employeeId}`);
      await load();
    } catch (err) {
      fail(err);
    }
  };

  const removeOrder = async (order) => {
    try {
      await api.del(`/ops/orders/${order.id}`);
      await load();
      notify('Item deleted.');
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!orders) return <Loading />;

  return (
    <div className="stack">
      <Toast message={toast.message} error={toast.error} />

      <form className="card" onSubmit={addOrder}>
        <h3 style={{ marginBottom: 12 }}>New item</h3>
        <div className="rowform">
          <label className="field">
            <span>Item name</span>
            <input
              value={form.label}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
              placeholder="Teak dining table (Order #218)"
              required
            />
          </label>
          <label className="field">
            <span>Customer</span>
            <input value={form.customer} onChange={(event) => setForm({ ...form, customer: event.target.value })} />
          </label>
          <label className="field">
            <span>Quantity</span>
            <input
              type="number"
              min="1"
              value={form.qty}
              onChange={(event) => setForm({ ...form, qty: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Start date</span>
            <input
              type="date"
              value={form.startDate}
              onChange={(event) => setForm({ ...form, startDate: event.target.value })}
            />
          </label>
          <button className="btn primary" type="submit">
            Add item
          </button>
        </div>
      </form>

      {orders.length ? (
        orders.map((order) => {
          const done = order.stages.filter((stage) => stage.doneDate).length;
          return (
            <div className="card" key={order.id}>
              <div className="head-row">
                <div>
                  <h3>{order.label}</h3>
                  <span className="small muted">
                    {order.customer || 'No customer'} · qty {order.qty} · started {order.startDate}
                  </span>
                </div>
                <div className="inl">
                  <Chip tone={done === order.stages.length && order.stages.length ? 'good' : 'info'}>
                    {done}/{order.stages.length} stages done
                  </Chip>
                  <button type="button" className="btn sm no" onClick={() => removeOrder(order)}>
                    <Icon name="trash" size={13} /> Delete
                  </button>
                </div>
              </div>

              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Stage</th>
                      <th className="r">Planned days</th>
                      <th>Start</th>
                      <th>Done</th>
                      <th>Assigned</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {order.stages.map((stage) => (
                      <tr key={stage.id}>
                        <td>{stage.name}</td>
                        <td className="r">
                          <input
                            className="sm"
                            type="number"
                            min="0.5"
                            max="60"
                            step="0.5"
                            defaultValue={stage.plannedDays}
                            onBlur={(event) => {
                              if (Number(event.target.value) !== stage.plannedDays) {
                                patchStage(stage, { plannedDays: Number(event.target.value) });
                              }
                            }}
                            aria-label={`Planned days for ${stage.name}`}
                          />
                        </td>
                        <td className="small mono">{stage.startDate || '–'}</td>
                        <td className="small mono">{stage.doneDate || '–'}</td>
                        <td>
                          <div className="inl">
                            {stage.assignees.map((person) => (
                              <button
                                key={person.id}
                                type="button"
                                className="chip info"
                                onClick={() => unassign(stage, person.id)}
                                title="Remove from stage"
                              >
                                {person.name} ✕
                              </button>
                            ))}
                            <select
                              value=""
                              onChange={(event) => assign(stage, event.target.value)}
                              aria-label={`Assign someone to ${stage.name}`}
                              style={{ width: 130, padding: '4px 6px' }}
                            >
                              <option value="">+ assign</option>
                              {employees.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                  {employee.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="r">
                          <div className="inl" style={{ justifyContent: 'flex-end' }}>
                            {stage.doneDate ? (
                              <button
                                type="button"
                                className="btn sm"
                                onClick={() => patchStage(stage, { doneDate: null })}
                              >
                                Reopen
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn sm ok"
                                onClick={() =>
                                  patchStage(stage, {
                                    doneDate: todayISO(),
                                    startDate: stage.startDate || todayISO(),
                                  })
                                }
                              >
                                Mark done
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn sm ghost no"
                              onClick={() => removeStage(stage)}
                              aria-label="Delete stage"
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="inl" style={{ marginTop: 12 }}>
                <input
                  placeholder="New stage name"
                  value={stageNames[order.id] || ''}
                  onChange={(event) => setStageNames({ ...stageNames, [order.id]: event.target.value })}
                  style={{ maxWidth: 240 }}
                />
                <button type="button" className="btn sm" onClick={() => addStage(order)}>
                  <Icon name="plus" size={13} /> Add stage
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            No items in production yet.
          </p>
        </div>
      )}
    </div>
  );
}
