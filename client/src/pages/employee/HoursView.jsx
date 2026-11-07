import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import {
  Chip,
  ErrorNote,
  Loading,
  MonthNav,
  hours as fmtHours,
  money,
  prettyDate,
  clock12,
  todayISO,
} from '../../ui.jsx';

export default function HoursView({ employee }) {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [records, setRecords] = useState(null);
  const [pay, setPay] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setRecords(null);
    Promise.all([api.get(`/attendance/me?month=${month}`), api.get(`/payroll/me?month=${month}`)])
      .then(([attendance, payroll]) => {
        setRecords(attendance.records);
        setPay(payroll);
      })
      .catch(setError);
  }, [month]);

  if (error) return <ErrorNote error={error} />;
  if (!records || !pay) return <Loading />;

  return (
    <div className="stack">
      <div className="card">
        <div className="head-row">
          <div>
            <span className="cap">Payable for {month}</span>
            <div className="big num" style={{ fontFamily: 'var(--f-head)', fontWeight: 800, fontSize: '2rem' }}>
              {money(pay.payable)}
            </div>
          </div>
          <MonthNav month={month} onChange={setMonth} />
        </div>
        <div className="pay">
          <div className="formula">
            {fmtHours(pay.approvedHours)} approved × {money(employee.hourlyRate)}
            {pay.deduction ? ` − ${money(pay.deduction)} advance` : ''}
          </div>
        </div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          {pay.units.toFixed(2)} day{pay.units === 1 ? '' : 's'} counted ({pay.half} half, {pay.double} double
          shift).{' '}
          {pay.pendingHours > 0
            ? `${fmtHours(pay.pendingHours)} still waiting for approval.`
            : 'No hours waiting for approval.'}
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Days in this month</h3>
        {records.length ? (
          records.map((record) => (
            <div className="logrow" key={record.id}>
              <div className="grow">
                <b>{prettyDate(record.date)}</b>{' '}
                {record.dayType !== 'full' ? <Chip tone="info">{record.dayType}</Chip> : null}
                <br />
                <span className="small muted mono">
                  {clock12(record.inMin)} → {record.outMin != null ? clock12(record.outMin) : 'open'}
                </span>
              </div>
              <span className="mono">{record.outMin != null ? fmtHours(record.hours) : '–'}</span>
              {record.approved ? (
                <Chip tone="good">Approved</Chip>
              ) : (
                <Chip tone="warn">{record.outMin == null ? 'Open' : 'Pending'}</Chip>
              )}
            </div>
          ))
        ) : (
          <p className="muted">No punches in this month yet.</p>
        )}
      </div>
    </div>
  );
}
