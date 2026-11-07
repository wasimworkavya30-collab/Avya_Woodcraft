import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Avatar, Icon } from '../../ui.jsx';

const NAV = [
  {
    group: 'Workspace',
    items: [
      { to: '/admin', label: 'Overview', icon: 'home', end: true },
      { to: '/admin/approvals', label: 'Approvals', icon: 'check', badge: 'pendingHours' },
      { to: '/admin/work', label: 'Work log', icon: 'clip' },
    ],
  },
  {
    group: 'People',
    items: [
      { to: '/admin/employees', label: 'Employees', icon: 'users' },
      { to: '/admin/teams', label: 'Teams', icon: 'team' },
      { to: '/admin/leave', label: 'Leave', icon: 'sun', badge: 'pendingLeave' },
    ],
  },
  {
    group: 'Business',
    items: [
      { to: '/admin/costing', label: 'Costing', icon: 'tag' },
      { to: '/admin/petty', label: 'Petty cash', icon: 'wallet' },
      { to: '/admin/inventory', label: 'Inventory', icon: 'box' },
      { to: '/admin/production', label: 'Production', icon: 'work' },
    ],
  },
  {
    group: 'Reports',
    items: [
      { to: '/admin/salary', label: 'Salary', icon: 'rupee' },
      { to: '/admin/report', label: 'Monthly report', icon: 'cal' },
    ],
  },
  {
    group: 'Security',
    items: [
      { to: '/admin/devices', label: 'Devices', icon: 'shield' },
      { to: '/admin/data', label: 'Data & backup', icon: 'file' },
    ],
  },
];

const TITLES = {
  '/admin': ['Overview', 'Live view of the workshop today'],
  '/admin/approvals': ['Approvals', 'Approve hours and set the day type'],
  '/admin/work': ['Daily work log', 'What every employee worked on'],
  '/admin/employees': ['Employees', 'Add, remove and manage staff, teams and rates'],
  '/admin/teams': ['Teams', 'Who works in which team and who leads it'],
  '/admin/leave': ['Leave', 'Review leave requests'],
  '/admin/salary': ['Salary report', 'Approved hours × hourly rate'],
  '/admin/report': ['Monthly report', 'Attendance with half day, double shift and Sunday off'],
  '/admin/devices': ['Devices', 'Authorized company mobile and blocked phones'],
  '/admin/costing': ['Product costing', 'Material, labour and other cost of each product'],
  '/admin/petty': ['Petty cash', 'Balance and daily spending'],
  '/admin/inventory': ['Inventory', 'Stock, requests and the order list'],
  '/admin/production': ['Production', 'Stages and dates for each order'],
  '/admin/data': ['Data & backup', 'Export, import or clear the database'],
};

export function BrandMark({ size = 34 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: 'linear-gradient(140deg,#3a2c17,#a8802f)',
        color: '#1a1208',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'var(--f-head)',
        fontWeight: 800,
        fontSize: Math.round(size * 0.44),
        flex: 'none',
      }}
    >
      AW
    </span>
  );
}

export default function AdminLayout() {
  const { session, logout } = useAuth();
  const location = useLocation();
  const [counts, setCounts] = useState({});

  useEffect(() => {
    api
      .get('/dashboard')
      .then((data) => setCounts(data.counts || {}))
      .catch(() => setCounts({}));
  }, [location.pathname]);

  const isEmployeeFile = /^\/admin\/employees\/\d+/.test(location.pathname);
  const [title, subtitle] = isEmployeeFile
    ? ['Employee file', 'Monthly attendance and advances']
    : TITLES[location.pathname] || ['Admin', ''];

  return (
    <div className="shell">
      <aside className="side">
        <div className="sbrand">
          <BrandMark size={38} />
          <div>
            <b>Avya Woodcraft LLP</b>
            <small>Operations console</small>
          </div>
        </div>

        <nav className="snav" aria-label="Admin sections">
          {NAV.map((group) => (
            <div key={group.group} style={{ display: 'contents' }}>
              <div className="sgroup">{group.group}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nv${isActive ? ' on' : ''}`}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                  {item.badge && counts[item.badge] ? <em>{counts[item.badge]}</em> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="suser">
          <Avatar person={{ id: 0, name: session.admin?.name || 'Main Admin' }} size={34} />
          <div>
            <b>{session.admin?.name || 'Main Admin'}</b>
            <small>{session.admin?.email}</small>
          </div>
        </div>
        <button type="button" className="nv" onClick={logout} style={{ marginTop: 8 }}>
          <Icon name="out" size={18} />
          Log out
        </button>
      </aside>

      <main className="main gut">
        <div className="top">
          <div className="tl">
            <div>
              <h1>{title}</h1>
              <p className="muted small">{subtitle}</p>
            </div>
          </div>
          <div className="tr">
            <div className="uchip">
              <Avatar person={{ id: 0, name: session.admin?.name || 'Main Admin' }} size={28} />
              {session.admin?.name || 'Main Admin'}
            </div>
            <button type="button" className="btn sm" onClick={logout}>
              <Icon name="out" size={14} /> Log out
            </button>
          </div>
        </div>

        <Outlet />

        <p className="note">
          Every punch, approval and leave decision is stored in the SQLite database and checked on the server.
          Admins, managers and employees all read the same records.
        </p>
      </main>
    </div>
  );
}
