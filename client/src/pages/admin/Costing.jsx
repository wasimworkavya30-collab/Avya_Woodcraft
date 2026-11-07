import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Chip, ErrorNote, Icon, Loading, Tile, money, useToast, Toast } from '../../ui.jsx';

const UNITS = ['pcs', 'cft', 'sheet', 'litre', 'kg', 'metre', 'box', 'roll', 'lot', 'h'];
const KINDS = [
  ['material', 'Material'],
  ['labour', 'Labour'],
  ['overhead', 'Other'],
];

export default function Costing() {
  const [products, setProducts] = useState(null);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(1);
  const [newName, setNewName] = useState('');
  const [line, setLine] = useState({ kind: 'material', name: '', qty: 1, unit: 'pcs', rate: 0 });
  const [error, setError] = useState(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      const list = await api.get('/ops/products');
      setProducts(list);
      setSelected((current) => current || list[0]?.id || null);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const product = products?.find((item) => item.id === selected) || products?.[0];

  const setPrice = async (value) => {
    try {
      await api.patch(`/ops/products/${product.id}`, { price: Number(value) });
      await load();
      notify('Selling price saved.');
    } catch (err) {
      fail(err);
    }
  };

  const addProduct = async (event) => {
    event.preventDefault();
    try {
      const created = await api.post('/ops/products', { name: newName });
      setNewName('');
      await load();
      setSelected(created.id);
      notify('Product added.');
    } catch (err) {
      fail(err);
    }
  };

  const addLine = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/ops/products/${product.id}/lines`, {
        ...line,
        qty: Number(line.qty),
        rate: Number(line.rate),
      });
      setLine({ kind: 'material', name: '', qty: 1, unit: 'pcs', rate: 0 });
      await load();
      notify('Cost line added.');
    } catch (err) {
      fail(err);
    }
  };

  const updateLine = async (id, patch) => {
    try {
      await api.patch(`/ops/products/lines/${id}`, patch);
      await load();
    } catch (err) {
      fail(err);
    }
  };

  const removeLine = async (id) => {
    try {
      await api.del(`/ops/products/lines/${id}`);
      await load();
      notify('Cost line removed.');
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!products) return <Loading />;

  if (!product) {
    return (
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>No products yet</h3>
        <form className="rowform" onSubmit={addProduct}>
          <label className="field">
            <span>Product name</span>
            <input value={newName} onChange={(event) => setNewName(event.target.value)} required />
          </label>
          <button className="btn primary" type="submit">
            Add product
          </button>
        </form>
      </div>
    );
  }

  const percent = (value) => (product.totals.total ? Math.round((value / product.totals.total) * 100) : 0);
  const margin = product.margin;
  const sampleQty = Math.max(1, Number(qty) || 1);

  return (
    <div className="stack">
      <Toast message={toast.message} error={toast.error} />

      <div className="cols even">
        <div className="stack">
          {products.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`prodbtn${item.id === product.id ? ' on' : ''}`}
              onClick={() => setSelected(item.id)}
            >
              <b>{item.name}</b>
              <span className="small muted">
                Cost {money(item.totals.total)} · Price {money(item.price)}
              </span>
              <Chip tone={item.margin >= 25 ? 'good' : item.margin >= 10 ? 'warn' : 'bad'}>
                {item.margin.toFixed(0)}% margin
              </Chip>
            </button>
          ))}

          <form className="card" onSubmit={addProduct}>
            <h3 style={{ marginBottom: 10 }}>New product</h3>
            <label className="field">
              <span>Product name</span>
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                maxLength={60}
                placeholder="Teak study table"
                required
              />
            </label>
            <button className="btn primary sm" type="submit">
              Add product
            </button>
          </form>
        </div>

        <div className="stack">
          <div className="tiles">
            <Tile label="Material" value={money(product.totals.material)} />
            <Tile label="Labour" value={money(product.totals.labour)} />
            <Tile label="Other costs" value={money(product.totals.overhead)} />
            <Tile label="Cost of 1 unit" value={money(product.totals.total)} tone="var(--accent)" />
          </div>

          <div className="card">
            <div className="split" role="img" aria-label="Cost split">
              <i className="c-mat" style={{ width: `${percent(product.totals.material)}%` }} />
              <i className="c-lab" style={{ width: `${percent(product.totals.labour)}%` }} />
              <i className="c-ovh" style={{ width: `${percent(product.totals.overhead)}%` }} />
            </div>
            <div className="legend">
              <span><i className="sw c-mat" />Material {percent(product.totals.material)}%</span>
              <span><i className="sw c-lab" />Labour {percent(product.totals.labour)}%</span>
              <span><i className="sw c-ovh" />Other {percent(product.totals.overhead)}%</span>
            </div>
          </div>

          <div className="card">
            <div className="two">
              <label className="field">
                <span>Selling price of 1 unit (₹)</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  defaultValue={product.price}
                  key={`${product.id}-${product.price}`}
                  onBlur={(event) => {
                    if (Number(event.target.value) !== product.price) setPrice(event.target.value);
                  }}
                />
              </label>
              <div className="field">
                <span>Profit on 1 unit</span>
                <b className={`num ${product.profit < 0 ? 'neg' : 'pos'}`} style={{ fontSize: '1.4rem' }}>
                  {money(product.profit)}
                </b>
                <Chip tone={margin >= 25 ? 'good' : margin >= 10 ? 'warn' : 'bad'}>{margin.toFixed(0)}% margin</Chip>
              </div>
            </div>

            <label className="field" style={{ maxWidth: 220 }}>
              <span>If we make this many units</span>
              <input type="number" min="1" step="1" value={qty} onChange={(event) => setQty(event.target.value)} />
            </label>

            <div className="small muted">
              Material {money(product.totals.material * sampleQty)} · Labour {money(product.totals.labour * sampleQty)} · Other{' '}
              {money(product.totals.overhead * sampleQty)}
              <br />
              <b style={{ color: 'var(--ink)' }}>Total cost {money(product.totals.total * sampleQty)}</b> · Revenue{' '}
              {money(product.price * sampleQty)} · Profit{' '}
              <b className={product.profit < 0 ? 'neg' : 'pos'}>{money(product.profit * sampleQty)}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="head-row">
          <div>
            <h3>Cost lines · {product.name}</h3>
            <span className="small muted">Material, labour and overhead for one unit. Quantities and rates are editable.</span>
          </div>
        </div>

        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Kind</th>
                <th>Name</th>
                <th className="r">Qty</th>
                <th>Unit</th>
                <th className="r">Rate ₹</th>
                <th className="r">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {product.lines.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Chip tone={row.kind === 'material' ? 'info' : row.kind === 'labour' ? '' : 'warn'}>
                      {row.kind}
                    </Chip>
                  </td>
                  <td>{row.name}</td>
                  <td className="r">
                    <input
                      className="sm"
                      type="number"
                      min="0"
                      step="any"
                      defaultValue={row.qty}
                      onBlur={(event) => {
                        if (Number(event.target.value) !== row.qty) updateLine(row.id, { qty: Number(event.target.value) });
                      }}
                      aria-label={`Quantity of ${row.name}`}
                    />
                  </td>
                  <td>{row.unit}</td>
                  <td className="r">
                    <input
                      className="sm"
                      type="number"
                      min="0"
                      step="any"
                      defaultValue={row.rate}
                      onBlur={(event) => {
                        if (Number(event.target.value) !== row.rate) updateLine(row.id, { rate: Number(event.target.value) });
                      }}
                      aria-label={`Rate of ${row.name}`}
                    />
                  </td>
                  <td className="r mono">{money(row.qty * row.rate)}</td>
                  <td className="r">
                    <button
                      type="button"
                      className="btn sm ghost no"
                      onClick={() => removeLine(row.id)}
                      aria-label={`Remove ${row.name}`}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Total</td>
                <td className="r mono">{money(product.totals.total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <form className="rowform" onSubmit={addLine} style={{ marginTop: 14 }}>
          <label className="field">
            <span>Kind</span>
            <select value={line.kind} onChange={(event) => setLine({ ...line, kind: event.target.value })}>
              {KINDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Name</span>
            <input
              value={line.name}
              onChange={(event) => setLine({ ...line, name: event.target.value })}
              placeholder="Teak wood planks"
              required
            />
          </label>
          <label className="field">
            <span>Qty</span>
            <input
              type="number"
              min="0.01"
              step="any"
              value={line.qty}
              onChange={(event) => setLine({ ...line, qty: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Unit</span>
            <select value={line.unit} onChange={(event) => setLine({ ...line, unit: event.target.value })}>
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Rate ₹</span>
            <input
              type="number"
              min="0"
              step="any"
              value={line.rate}
              onChange={(event) => setLine({ ...line, rate: event.target.value })}
            />
          </label>
          <button className="btn primary" type="submit">
            Add line
          </button>
        </form>
      </div>
    </div>
  );
}
