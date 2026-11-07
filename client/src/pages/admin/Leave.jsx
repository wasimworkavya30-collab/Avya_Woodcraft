import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';
import { Avatar, Chip, ErrorNote, Icon, Loading, prettyDate, useToast, Toast } from '../../ui.jsx';

export default function Leave() {
  const [requests, setRequests] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      const [leave, staff] = await Promise.all([api.get('/leave'), api.get('/employees?includeInactive=1')]);
      setRequests(leave);
      setEmployees(staff);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const staffById = useMemo(
    () => Object.fromEntries(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const decide = async (request, status) => {
    try {
      await api.patch(`/leave/${request.id}`, { status });
      setRequests((current) => current.map((item) => (item.id === request.id ? { ...item, status } : item)));
      notify(status === 'approved' ? 'Leave approved.' : 'Leave rejected.');
    } catch (err) {
      fail(err);
    }
  };

  const remove = async (request) => {
    try {
      await api.del(`/leave/${request.id}`);
      setRequests((current) => current.filter((item) => item.id !== request.id));
      notify('Request deleted.');
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!requests) return <Loading />;

  const pending = requests.filter((request) => request.status === 'pending');
  const decided = requests.filter((request) => request.status !== 'pending');

  const row = (request, actionable) => {
    const employee = staffById[request.employeeId] || { id: request.employeeId, name: request.employeeName };
    const days =
      Math.round(
        (new Date(`${request.to}T00:00:00`) - new Date(`${request.from}T00:00:00`)) / 86400000,
      ) + 1;

    return (
      <div className="pend" key={request.id}>
        <Avatar person={employee} size={40} ring />
        <div className="grow">
          <b>{employee.name}</b>
          <br />
          <span className="small muted">
            {request.type} · {days} day{days > 1 ? 's' : ''} · {prettyDate(request.from)}
            {request.to !== request.from ? ` to ${prettyDate(request.to)}` : ''}
            <br />
            {request.reason}
          </span>
        </div>
        {actionable ? (
          <>
            <button type="button" className="btn sm ok" onClick={() => decide(request, 'approved')}>
              Approve
            </button>
            <button type="button" className="btn sm no" onClick={() => decide(request, 'rejected')}>
              Reject
            </button>
          </>
        ) : (
          <>
            <Chip tone={request.status === 'approved' ? 'good' : 'bad'}>
              {request.status === 'approved' ? 'Approved' : 'Rejected'}
            </Chip>
            <button
              type="button"
              className="btn sm ghost no"
              onClick={() => remove(request)}
              aria-label="Delete request"
            >
              <Icon name="trash" size={13} />
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="cols even">
      <Toast message={toast.message} error={toast.error} />
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Pending requests</h3>
        {pending.length ? pending.map((request) => row(request, true)) : <p className="muted">No pending requests.</p>}
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Decided</h3>
        {decided.length ? decided.map((request) => row(request, false)) : <p className="muted">Nothing decided yet.</p>}
      </div>
    </div>
  );
}
