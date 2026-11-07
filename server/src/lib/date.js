export const pad = (n) => String(n).padStart(2, '0');

export const ymd = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const today = () => ymd(new Date());

export const currentMonth = () => today().slice(0, 7);

export const addDays = (isoDate, days) => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return ymd(date);
};

export const daysInMonth = (month) => {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m, 0).getDate();
};

export const monthDates = (month) => {
  const total = daysInMonth(month);
  return Array.from({ length: total }, (_, i) => `${month}-${pad(i + 1)}`);
};

export const isSunday = (isoDate) => new Date(`${isoDate}T00:00:00`).getDay() === 0;

export const isValidDate = (value) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

export const isValidMonth = (value) =>
  typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** Minutes from midnight -> "9:15 am" */
export const formatMinutes = (minutes) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${pad(m)} ${suffix}`;
};

export const minutesNow = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export const weekOfMonth = (isoDate) => Math.ceil(Number(isoDate.slice(8, 10)) / 7);
