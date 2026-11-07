import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Chip, ErrorNote, Loading, prettyDate, useToast, Toast } from '../../ui.jsx';

export default function Devices() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      setData(await api.get('/devices'));
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    try {
      const result = await api.post('/devices/pairing-code');
      await load();
      notify(`Pairing code ${result.code} created. It expires in 10 minutes.`);
    } catch (err) {
      fail(err);
    }
  };

  const revoke = async (device) => {
    try {
      await api.del(`/devices/${device.id}`);
      await load();
      notify(`${device.deviceId} can no longer punch.`);
    } catch (err) {
      fail(err);
    }
  };

  const clearBlocked = async () => {
    try {
      await api.del('/devices/blocked/all');
      await load();
      notify('Blocked attempts cleared.');
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;

  return (
    <div className="cols">
      <Toast message={toast.message} error={toast.error} />
      <div className="stack">
        <div className="card">
          <div className="head-row">
            <h3>Authorized company mobile</h3>
            <Chip tone={data.devices.some((device) => device.status === 'authorized') ? 'good' : 'bad'}>
              {data.devices.some((device) => device.status === 'authorized') ? 'Authorized' : 'None authorized'}
            </Chip>
          </div>

          {data.devices.map((device) => (
            <div className="logrow" key={device.id}>
              <div className="grow">
                <b className="mono">{device.deviceId}</b>
                <br />
                <span className="small muted">
                  {device.model || 'Phone'} · paired {prettyDate(device.pairedOn)}
                  {device.lastSeen ? ` · last seen ${prettyDate(device.lastSeen)}` : ''}
                </span>
              </div>
              {device.status === 'authorized' ? (
                <button type="button" className="btn sm no" onClick={() => revoke(device)}>
                  Revoke
                </button>
              ) : (
                <Chip tone="bad">Revoked</Chip>
              )}
            </div>
          ))}

          {!data.devices.length ? <p className="muted">No device has been paired yet.</p> : null}

          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn sm" onClick={generate}>
              Generate pairing code
            </button>
            {data.pairing ? (
              <div style={{ marginTop: 12 }}>
                <span className="code">{data.pairing.code}</span>
                <p className="small muted" style={{ margin: '8px 0 0' }}>
                  One-time code, valid for 10 minutes. The employee enters it on the new company phone under
                  Today → This phone.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 8 }}>How blocking works</h3>
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>Only one device is authorized at a time.</li>
            <li>The server checks the device id on every check-in and check-out.</li>
            <li>A punch from any other phone is rejected and logged here.</li>
            <li>Replacing the phone needs a code created by the admin.</li>
          </ul>
        </div>
      </div>

      <div className="card" style={{ alignSelf: 'start' }}>
        <div className="head-row">
          <h3>Blocked attempts</h3>
          {data.blocked.length ? (
            <button type="button" className="btn sm ghost" onClick={clearBlocked}>
              Clear
            </button>
          ) : null}
        </div>
        {data.blocked.length ? (
          data.blocked.map((attempt) => (
            <div className="logrow" key={attempt.id}>
              <div className="grow">
                <b>{attempt.who}</b>
                <br />
                <span className="small muted">
                  {attempt.device} · {attempt.at}
                </span>
              </div>
              <Chip tone="bad">{attempt.reason}</Chip>
            </div>
          ))
        ) : (
          <p className="muted">No blocked attempts.</p>
        )}
      </div>
    </div>
  );
}
