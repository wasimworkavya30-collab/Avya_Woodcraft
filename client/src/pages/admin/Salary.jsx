import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Avatar, ErrorNote, Loading, MonthNav, money, num, todayISO } from '../../ui.jsx';

export default function Salary() {
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    api.get(`/payroll/salary?month=${month}`).then(setData).catch(setError);
  }, [month]);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;

  const max = Math.max(1, ...data.rows.map((row) => row.payable));

  return (
    <div className="card">
      <div className="head-row">
        <div>
          <h3>Monthly salary report</h3>
          <span className="small muted">Payable = approved hours × hourly rate, minus advance deductions</span>
        </div>
        <MonthNav month={month} onChange={setMonth} />
      </div>

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th className="r">Days</th>
              <th className="r">Half</th>
              <th className="r">Double</th>
              <th className="r">Approved h</th>
              <th className="r">Pending h</th>
              <th className="r">Rate</th>
              <th className="r">Advance</th>
              <th className="r">Payable</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.employeeId}>
                <td>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Avatar person={{ id: row.employeeId, name: row.name }} size={34} ring />
                    <div>
                      <b>{row.name}</b>
                      <br />
                      <span className="small muted">
                        {row.role}
                        {row.active ? '' : ' · removed'}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="r mono">{num(row.units)}</td>
                <td className="r mono">{row.half}</td>
                <td className="r mono">{row.double}</td>
                <td className="r mono">{row.approvedHours.toFixed(2)}</td>
                <td className="r mono" style={row.pendingHours ? { color: 'var(--warn)' } : undefined}>
                  {row.pendingHours.toFixed(2)}
                </td>
                <td className="r mono">{row.hourlyRate}</td>
                <td className="r mono">{row.deduction ? money(row.deduction) : '–'}</td>
                <td className="r" style={{ minWidth: 130 }}>
                  <b className="mono">{money(row.payable)}</b>
                  <div className="bar" style={{ width: `${Math.round((Math.max(row.payable, 0) / max) * 100)}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="r mono">{num(data.totals.units)}</td>
              <td />
              <td />
              <td className="r mono">{data.totals.approvedHours.toFixed(2)}</td>
              <td className="r mono">{data.totals.pendingHours.toFixed(2)}</td>
              <td />
              <td className="r mono">{money(data.totals.deductions)}</td>
              <td className="r mono">{money(data.totals.payable)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="small muted" style={{ margin: '12px 0 0' }}>
        A full day counts 1, a half day 0.5 and a double shift 2.
        {data.totals.pendingHours > 0
          ? ` ${data.totals.pendingHours.toFixed(2)} hours are still unapproved and not included in the payable amount.`
          : ''}
      </p>
    </div>
  );
}
