import { useCallback, useEffect, useRef, useState } from 'react';
import { api, deviceId, deviceLabel } from '../../api.js';
import {
  Chip,
  Icon,
  MonthNav,
  Toast,
  hours as fmtHours,
  money,
  prettyDate,
  clock12,
  useToast,
} from '../../ui.jsx';

const haversine = (lat1, lng1, lat2, lng2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const sampleSelfie = () =>
  new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 160;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 160, 160);
    gradient.addColorStop(0, '#6b84b8');
    gradient.addColorStop(1, '#1b2b52');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 160, 160);
    context.fillStyle = '#d9b48a';
    context.beginPath();
    context.arc(80, 66, 30, 0, 7);
    context.fill();
    context.fillStyle = '#2f4a5c';
    context.beginPath();
    context.ellipse(80, 160, 56, 52, 0, Math.PI, 0);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,.85)';
    context.font = '600 11px sans-serif';
    context.fillText('SAMPLE', 6, 152);
    resolve(canvas.toDataURL('image/jpeg', 0.8));
  });

const readImage = (file) =>
  new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Please choose a photo.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 220 / Math.max(image.width, image.height));
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      image.onerror = () => reject(new Error('Could not read that photo.'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read that photo.'));
    reader.readAsDataURL(file);
  });

export default function TodayView({ employee }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState([]);
  const [pay, setPay] = useState(null);
  const [device, setDevice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [coords, setCoords] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(true);
  const [simulate, setSimulate] = useState(false);
  const [selfie, setSelfie] = useState(null);
  const [pairCode, setPairCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const fileInput = useRef(null);
  const { toast, notify, fail } = useToast();

  const refresh = useCallback(async () => {
    try {
      const [attendance, payroll, deviceInfo, config] = await Promise.all([
        api.get(`/attendance/me?month=${month}`),
        api.get(`/payroll/me?month=${month}`),
        api.get(`/devices/whoami?deviceId=${encodeURIComponent(deviceId())}`),
        api.get('/settings'),
      ]);
      setRecords(attendance.records);
      setPay(payroll);
      setDevice(deviceInfo);
      setSettings(config);
    } catch (err) {
      fail(err);
    }
  }, [month, fail]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocating(false);
      setLocationError('Location is not available in this browser.');
      return undefined;
    }
    setLocating(true);
    setLocationError('');
    // Browsers can leave the request pending forever behind a blocked prompt.
    const watchdog = setTimeout(() => {
      setLocating(false);
      setLocationError('Location is not responding. Allow location access, or use practice mode.');
    }, 12000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(watchdog);
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationError('');
        setLocating(false);
      },
      () => {
        clearTimeout(watchdog);
        setLocating(false);
        setLocationError('Allow location access to punch from the workshop.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
    return () => clearTimeout(watchdog);
  }, []);

  useEffect(() => locate(), [locate]);

  const todayRecord = records.find((record) => new Date(`${record.date}T00:00:00`).toDateString() === now.toDateString());
  const open = todayRecord && todayRecord.outMin == null;

  const distance =
    coords && settings
      ? haversine(coords.lat, coords.lng, Number(settings.workshop_lat), Number(settings.workshop_lng))
      : null;

  const limit = Number(settings?.geofence_metres || 150);
  const locationOk = simulate || (distance != null && distance <= limit);

  const pickSelfie = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setSelfie(await readImage(file));
    } catch (err) {
      fail(err);
    }
  };

  const punch = async (kind) => {
    setBusy(true);
    try {
      const payload = { selfie };
      if (simulate) payload.distanceM = 42;
      else if (coords) {
        payload.latitude = coords.lat;
        payload.longitude = coords.lng;
      }
      const result = await api.post(`/attendance/punch-${kind}`, payload);
      setSelfie(null);
      await refresh();
      notify(kind === 'in' ? 'Checked in. Have a good shift.' : result.message || 'Checked out.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const pair = async () => {
    try {
      await api.post('/devices/pair', {
        code: pairCode,
        deviceId: deviceId(),
        model: deviceLabel(),
      });
      setPairCode('');
      await refresh();
      notify('This phone is now the authorized company mobile.');
    } catch (err) {
      fail(err);
    }
  };

  const status = open ? 'On shift' : todayRecord ? 'Attendance done' : 'Not checked in';

  const blockedReason = !device
    ? 'Checking this phone…'
    : !device.authorized
      ? 'Pair this phone before you can check in.'
      : !locationOk
        ? 'Location must be inside the workshop gate.'
        : !selfie
          ? 'Add a selfie for this punch.'
          : '';

  return (
    <div className="stack">
      <Toast message={toast.message} error={toast.error} />

      <section className="hero">
        <span className="cap">
          {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
        <div className="clock">
          {now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="row">
          <Chip tone={open ? 'good' : ''}>{status}</Chip>
          <span className="small" style={{ color: '#AEB9D6' }}>
            {money(employee.hourlyRate)} per hour
          </span>
        </div>
      </section>

      <div className="card">
        <div className="gates">
          <div className={`gate ${device?.authorized ? 'ok' : 'bad'}`}>
            <span className="gi">{device?.authorized ? <Icon name="check" size={16} /> : '✕'}</span>
            <div>
              <b>Device</b>
              <span className="small muted">
                {device?.authorized
                  ? `Authorized company mobile (${device.deviceId})`
                  : 'This is a personal phone. Attendance is blocked.'}
              </span>
            </div>
          </div>
          <div className={`gate ${locationOk ? 'ok' : locationError ? 'bad' : ''}`}>
            <span className="gi">{locationOk ? <Icon name="check" size={16} /> : locationError ? '✕' : '–'}</span>
            <div>
              <b>Location</b>
              <span className="small muted">
                {simulate
                  ? 'Practice mode: sending 42 m from the workshop.'
                  : distance != null
                    ? `${distance} m from the workshop gate. Limit is ${limit} m.`
                    : locating
                      ? 'Finding your location…'
                      : locationError || 'Location unavailable.'}
              </span>
              {!simulate && distance == null && !locating ? (
                <button type="button" className="btn sm ghost" style={{ marginTop: 6 }} onClick={locate}>
                  Retry location
                </button>
              ) : null}
            </div>
          </div>
          <div className={`gate ${selfie ? 'ok' : ''}`}>
            <span className="gi">{selfie ? <Icon name="check" size={16} /> : '–'}</span>
            <div>
              <b>Selfie</b>
              <span className="small muted">
                {selfie ? 'Selfie ready for this punch.' : 'Take a fresh selfie before each punch.'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {!device?.authorized ? (
        <div className="card">
          <h3 style={{ marginBottom: 6 }}>Pair this phone</h3>
          <p className="small muted" style={{ margin: '0 0 10px' }}>
            Ask the admin for a one-time pairing code, then enter it here. This makes this phone the
            authorized company mobile.
          </p>
          <div className="inl">
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              value={pairCode}
              onChange={(event) => setPairCode(event.target.value)}
              style={{ maxWidth: 160 }}
            />
            <button type="button" className="btn primary sm" onClick={pair} disabled={pairCode.length < 6}>
              Pair this phone
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="selfie-row">
          <div className="selfie-prev">
            {selfie ? <img src={selfie} alt="Your selfie preview" /> : 'No selfie yet'}
          </div>
          <div className="grow" style={{ minWidth: 160 }}>
            <b>Selfie verification</b>
            <p className="small muted" style={{ margin: '2px 0 10px' }}>
              The admin sees this photo with your punch.
            </p>
            <div className="inl">
              <button type="button" className="btn sm" onClick={() => fileInput.current?.click()}>
                <Icon name="cam" size={14} /> Take selfie
              </button>
              <button type="button" className="btn sm ghost" onClick={async () => setSelfie(await sampleSelfie())}>
                Use sample selfie
              </button>
            </div>
            <input ref={fileInput} type="file" accept="image/*" capture="user" hidden onChange={pickSelfie} />
          </div>
        </div>
        <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <input
            type="checkbox"
            checked={simulate}
            onChange={(event) => setSimulate(event.target.checked)}
            style={{ width: 'auto' }}
          />
          Practice mode: send a workshop location for this punch
        </label>
      </div>

      {open ? (
        <button type="button" className="btn primary big" onClick={() => punch('out')} disabled={busy || !device?.authorized}>
          Check out
        </button>
      ) : todayRecord ? (
        <button type="button" className="btn big" disabled>
          Attendance done for today
        </button>
      ) : (
        <button type="button" className="btn primary big" onClick={() => punch('in')} disabled={busy || !device?.authorized}>
          Check in
        </button>
      )}

      {(open || !todayRecord) && blockedReason ? (
        <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
          {blockedReason}
        </p>
      ) : null}

      <div className="card">
        <div className="head-row">
          <h3>Pay estimate</h3>
          <MonthNav month={month} onChange={setMonth} />
        </div>
        {pay ? (
          <>
            <div className="pay">
              <div>
                <span className="cap">Payable</span>
                <div className="big num">{money(pay.payable)}</div>
              </div>
              <div className="formula">
                {fmtHours(pay.approvedHours)} approved × {money(pay.hourlyRate)}
                {pay.deduction ? ` − ${money(pay.deduction)} advance` : ''}
              </div>
            </div>
            <p className="small muted" style={{ margin: '10px 0 0' }}>
              {pay.units.toFixed(2)} day{pay.units === 1 ? '' : 's'} counted ({pay.half} half, {pay.double} double
              shift).{' '}
              {pay.pendingHours > 0
                ? `${fmtHours(pay.pendingHours)} still waiting for admin approval.`
                : 'No hours waiting for approval.'}
            </p>
          </>
        ) : null}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Recent punches</h3>
        {records.length ? (
          records.slice(0, 4).map((record) => (
            <div className="logrow" key={record.id}>
              <div className="grow">
                <b>{prettyDate(record.date)}</b>{' '}
                {record.outMin != null && record.dayType !== 'full' ? (
                  <Chip tone="info">{record.dayType}</Chip>
                ) : null}
                <br />
                <span className="small muted mono">
                  {clock12(record.inMin)} → {record.outMin != null ? clock12(record.outMin) : 'working'}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                {record.outMin != null ? <span className="mono">{fmtHours(record.hours)}</span> : null}
                <br />
                {record.outMin == null ? (
                  <Chip tone="good">Open</Chip>
                ) : record.approved ? (
                  <Chip tone="good">Approved</Chip>
                ) : (
                  <Chip tone="warn">Awaiting approval</Chip>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            No punches in this month yet.
          </p>
        )}
      </div>
    </div>
  );
}
