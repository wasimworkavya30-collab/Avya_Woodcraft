import { useCallback, useEffect, useState } from 'react';

const ICONS = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 010 6.4M18 14.4c2.2.7 3.5 2.6 3.5 5.6" />
    </>
  ),
  team: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="19" r="2.5" />
      <circle cx="19" cy="19" r="2.5" />
      <path d="M12 8v4M12 12H5v4M12 12h7v4" />
    </>
  ),
  cal: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2L19 19M5 19l1.8-1.8M17.2 6.8L19 5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M16 15h2" />
    </>
  ),
  box: <path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5zM3 7.5L12 12l9-4.5M12 12v9" />,
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.2" />
    </>
  ),
  file: <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" />,
  rupee: <path d="M7 5h10M7 9h10M7 5c5 0 6 2.5 6 4s-1 4-6 4l7 6" />,
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  out: <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  cam: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  work: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M9 8V5h6v3" />
    </>
  ),
  clip: (
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 12h6M9 16h6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  upload: <path d="M12 17V5M7 10l5-5 5 5M4 21h16" />,
};

export function Icon({ name, size = 18 }) {
  return (
    <svg
      className="ic"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] || ICONS.home}
    </svg>
  );
}

export const Chip = ({ tone = '', children }) => <span className={`chip ${tone}`}>{children}</span>;

export function Avatar({ person, src, size = 38, ring = false }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  const image = src || person?.photo;
  const name = person?.name || '?';
  const initials = name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (image) {
    return <img className={`av ${ring ? 'ring' : ''}`} style={style} src={image} alt={`Photo of ${name}`} />;
  }
  const hue = ((person?.id || 3) * 57) % 360;
  return (
    <span className={`av ${ring ? 'ring' : ''}`} style={{ ...style, background: `hsl(${hue} 38% 36%)` }} aria-hidden="true">
      {initials}
    </span>
  );
}

export const Tile = ({ icon, label, value, tone = 'var(--accent)', extra }) => (
  <div className="tile" style={{ '--tc': tone }}>
    {icon ? (
      <span className="ti">
        <Icon name={icon} size={19} />
      </span>
    ) : null}
    <span className="cap">{label}</span>
    <b className="num">{value}</b>
    {extra}
  </div>
);

export const money = (value) => `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
export const hours = (value) => `${(Number(value) || 0).toFixed(2)} h`;
export const num = (value) => (Math.round((Number(value) || 0) * 100) / 100).toLocaleString('en-IN');

export const monthLabel = (month) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export const prettyDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export const clock12 = (minutes) => {
  if (minutes == null) return '–';
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
};

export const currentMonth = () => new Date().toISOString().slice(0, 7);
export const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export function MonthNav({ month, onChange }) {
  const shift = (delta) => {
    const [year, value] = month.split('-').map(Number);
    const date = new Date(year, value - 1 + delta, 1);
    onChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };
  return (
    <div className="mnav" role="group" aria-label="Month">
      <button type="button" onClick={() => shift(-1)} aria-label="Previous month">
        ‹
      </button>
      <span>{monthLabel(month)}</span>
      <button type="button" onClick={() => shift(1)} aria-label="Next month">
        ›
      </button>
    </div>
  );
}

export function Toast({ message, error }) {
  return <div className={`toast ${message ? 'show' : ''} ${error ? 'err' : ''}`}>{message}</div>;
}

export function useToast() {
  const [state, setState] = useState({ message: '', error: false });

  const notify = useCallback((message) => setState({ message, error: false }), []);
  const fail = useCallback((error) => setState({ message: error?.message || String(error), error: true }), []);

  useEffect(() => {
    if (!state.message) return undefined;
    const timer = setTimeout(() => setState({ message: '', error: false }), 2800);
    return () => clearTimeout(timer);
  }, [state]);

  return { toast: state, notify, fail };
}

export const Loading = ({ label = 'Loading…' }) => <div className="card muted">{label}</div>;

export const ErrorNote = ({ error }) => (error ? <div className="card error-note">{error.message}</div> : null);
