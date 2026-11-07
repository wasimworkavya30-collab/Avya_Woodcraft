import { useState } from 'react';
import { useAuth } from '../../auth.jsx';
import { Icon } from '../../ui.jsx';
import { BrandMark } from '../admin/AdminLayout.jsx';
import TodayView from './TodayView.jsx';
import WorkView from './WorkView.jsx';
import MaterialView from './MaterialView.jsx';
import HoursView from './HoursView.jsx';
import LeaveView from './LeaveView.jsx';

const TABS = [
  ['today', 'Today', 'clock'],
  ['work', 'Work', 'work'],
  ['material', 'Material', 'box'],
  ['history', 'Hours', 'file'],
  ['leave', 'Leave', 'sun'],
];

export default function EmployeeApp() {
  const { session, logout } = useAuth();
  const [tab, setTab] = useState('today');
  const employee = session.employee;

  const body = {
    today: <TodayView employee={employee} />,
    work: <WorkView employee={employee} />,
    material: <MaterialView employee={employee} />,
    history: <HoursView employee={employee} />,
    leave: <LeaveView employee={employee} />,
  }[tab];

  return (
    <>
      <header className="ehead">
        <div className="in gut" style={{ maxWidth: 640, margin: '0 auto' }}>
          <BrandMark size={34} />
          <div className="grow">
            <b>Avya Woodcraft LLP</b>
            <small>
              {employee.name} · {employee.code}
            </small>
          </div>
          <button type="button" className="btn sm" onClick={logout}>
            <Icon name="out" size={14} /> Log out
          </button>
        </div>
      </header>

      <main className="emp gut">{body}</main>

      <nav className="bnav" aria-label="Sections">
        <div className="in">
          {TABS.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              className={`bn${tab === id ? ' on' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon name={icon} size={20} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
