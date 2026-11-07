import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { ErrorNote, Loading, MonthNav, num, todayISO, useToast, Toast } from '../../ui.jsx';

const MARK_CLASS = { P: 'P', H: 'H', D: 'D', C: 'C', L: 'L', A: 'A', S: 'S' };

export default function Report() {
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      setData(await api.get(`/payroll/report?month=${month}`));
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    setData(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const toggleSunday = async (date) => {
    try {
      await api.put('/payroll/sunday', { date, isOff: !data.offDays[date] });
      await load();
      notify('Sunday policy updated for that date.');
    } catch (err) {
      fail(err);
    }
  };

  const setWeeks = async (weeks) => {
    try {
      await api.patch('/settings', { sundayWeeks: weeks });
      await load();
      notify('Sunday off policy saved.');
    } catch (err) {
      fail(err);
    }
  };

  const saveCell = async (row, date, value) => {
    try {
      await api.put('/attendance/cell', { employeeId: row.employeeId, date, units: Number(value) });
      setEditing(null);
      await load();
      notify('Attendance saved.');
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;

  const weeks = data.sundayWeeks || [];

  return (
    <div className="card">
      <Toast message={toast.message} error={toast.error} />
      <div className="head-row">
        <div>
          <h3>Monthly attendance report</h3>
          <span className="small muted">
            Click a day to change the days worked. Click a Sunday (S) to mark it off or working.
          </span>
        </div>
        <MonthNav month={month} onChange={setMonth} />
      </div>

      <div className="head-row" style={{ marginBottom: 14 }}>
        <div>
          <b>Sunday off policy</b>
          <div className="small muted">Sundays marked off are not counted absent.</div>
        </div>
        <div className="seg" role="group" aria-label="Sundays off">
          {[1, 2, 3, 4, 5].map((week) => (
            <button
              key={week}
              type="button"
              className={weeks.includes(week) ? 'on' : ''}
              onClick={() => setWeeks(weeks.includes(week) ? weeks.filter((value) => value !== week) : [...weeks, week])}
            >
              {week}
              {['st', 'nd', 'rd', 'th', 'th'][week - 1]}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll">
        <table className="mx">
          <thead>
            <tr>
              <th className="name">Employee</th>
              {data.dates.map((date) => (
                <th key={date}>{Number(date.slice(8, 10))}</th>
              ))}
              <th>P</th>
              <th>H</th>
              <th>D</th>
              <th>L</th>
              <th>A</th>
              <th>Days</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.employeeId}>
                <td className="name">
                  {row.name} <span className="small muted">· {row.hourlyRate}</span>
                </td>
                {row.days.map((day) => {
                  const isEditing = editing?.employeeId === row.employeeId && editing?.date === day.date;
                  return (
                    <td
                      key={day.date}
                      className={`${MARK_CLASS[day.mark] || ''} ${day.mark === 'S' ? 'sun' : 'cell'}`}
                      onClick={() => {
                        if (day.mark === 'S') {
                          toggleSunday(day.date);
                          return;
                        }
                        if (day.date > todayISO()) return;
                        setEditing({ employeeId: row.employeeId, date: day.date, units: day.units });
                      }}
                      title={isEditing ? '' : `${row.name} · ${day.date}`}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          max="3"
                          step="0.5"
                          defaultValue={day.units || 0}
                          style={{ width: 52, padding: '2px 4px', fontSize: '0.72rem' }}
                          onClick={(event) => event.stopPropagation()}
                          onBlur={(event) => saveCell(row, day.date, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') saveCell(row, day.date, event.currentTarget.value);
                            if (event.key === 'Escape') setEditing(null);
                          }}
                        />
                      ) : (
                        day.mark
                      )}
                    </td>
                  );
                })}
                <td className="tot">{row.totals.present}</td>
                <td className="tot">{row.totals.half}</td>
                <td className="tot">{row.totals.double}</td>
                <td className="tot">{row.totals.leave}</td>
                <td className="tot">{row.totals.absent}</td>
                <td className="tot">{num(row.totals.units)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="legend">
        <span><b className="P">P</b>Full day</span>
        <span><b className="H">H</b>Half day (0.5)</span>
        <span><b className="D">D</b>Double shift (2)</span>
        <span><b className="L">L</b>Approved leave</span>
        <span><b className="A">A</b>Absent</span>
        <span><b className="S">S</b>Sunday off</span>
      </div>
    </div>
  );
}
