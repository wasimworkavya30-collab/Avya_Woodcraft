import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Avatar, Chip, Icon, Loading, ErrorNote, Tile, clock12, money, monthLabel } from '../../ui.jsx';

const statusFor = (person, sundayOff) => {
  if (person.onLeave) return { chip: <Chip tone="warn">On leave</Chip>, kind: 'leave' };
  if (person.record && person.record.outMin == null) {
    return {
      chip: <Chip tone="good">{person.record.inMin > 555 ? 'Working · late' : 'Working'}</Chip>,
      kind: 'in',
    };
  }
  if (person.record) return { chip: <Chip tone="good">Done</Chip>, kind: 'in' };
  if (sundayOff) return { chip: <Chip>Sunday off</Chip>, kind: 'off' };
  return { chip: <Chip>Not in yet</Chip>, kind: 'out' };
};

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(setData).catch(setError);
  }, []);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;

  const sundayOff = false;
  return (
    <div className="stack">
      <div className="tiles">
        <Tile icon="users" label="Present now" value={<>{data.counts.present}<small> / {data.people.length}</small></>} tone="var(--good)" />
        <Tile icon="sun" label="On leave" value={data.counts.onLeave} tone="var(--warn)" />
        <Tile icon="clock" label="Not in yet" value={data.counts.notIn} tone="var(--muted)" />
        <Tile icon="check" label="Hours to approve" value={data.counts.pendingHours} tone="var(--primary)" />
      </div>

      <div className="cols">
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>Today at the workshop</h3>
          {data.people.map((person) => {
            const status = statusFor(person, sundayOff);
            return (
              <div className="logrow" key={person.id}>
                <Avatar person={person} src={person.record?.selfie} size={40} ring />
                <div className="grow">
                  <b>
                    {person.name} {person.isLead ? <span className="lead">LEAD</span> : null}
                  </b>
                  <br />
                  <span className="small muted">
                    {person.role}
                    {person.record ? ` · in ${clock12(person.record.inMin)} · ${person.record.distanceM} m` : ''}
                  </span>
                </div>
                {status.chip}
              </div>
            );
          })}
        </div>

        <div className="stack">
          <div className="card">
            <span className="cap">Approved payroll · {monthLabel(data.month)}</span>
            <div className="pay" style={{ marginTop: 6 }}>
              <div className="big num">{money(data.payrollApproved)}</div>
              <Link className="btn sm" to="/admin/salary">
                Open report
              </Link>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Team presence today</h3>
            {data.teamPresence
              .filter((team) => team.total > 0)
              .map((team) => (
                <div key={team.id} style={{ '--tc': team.color, marginBottom: 12 }}>
                  <div className="head-row" style={{ margin: '0 0 4px' }}>
                    <span className="tchip">{team.name}</span>
                    <span className="mono small">
                      {team.present}/{team.total}
                    </span>
                  </div>
                  <div className="track">
                    <div className="bar" style={{ width: `${Math.round((team.present / team.total) * 100)}%` }} />
                  </div>
                </div>
              ))}
          </div>

          <div className="card">
            <span className="cap">Device security</span>
            <p style={{ margin: '6px 0 10px' }}>
              <b className="num">{data.counts.blocked}</b> blocked attempts from unregistered phones.
            </p>
            <Link className="btn sm" to="/admin/devices">
              Review devices
            </Link>
          </div>

          <div className="card">
            <span className="cap">Waiting on you</span>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              <Link className="logrow" to="/admin/leave" style={{ textDecoration: 'none', paddingTop: 0 }}>
                <Icon name="sun" size={18} />
                <span className="grow">Leave requests</span>
                <span className="num">{data.counts.pendingLeave}</span>
              </Link>
              <Link className="logrow" to="/admin/inventory" style={{ textDecoration: 'none' }}>
                <Icon name="box" size={18} />
                <span className="grow">Material requests</span>
                <span className="num">{data.counts.pendingMaterial}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
