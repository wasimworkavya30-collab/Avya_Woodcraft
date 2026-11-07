const TOKEN_KEY = 'avya_token';
const DEVICE_KEY = 'avya_device_id';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

/** A stable id for this browser, so the admin can authorize this phone. */
export const deviceId = () => {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `WEB-${(crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`).slice(0, 8).toUpperCase()}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
};

export const deviceLabel = () => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android phone';
  if (/iphone|ipad/i.test(ua)) return 'iPhone';
  if (/mac/i.test(ua)) return 'Mac browser';
  if (/windows/i.test(ua)) return 'Windows browser';
  return 'Browser device';
};

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-device-id': deviceId() };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // A request that never settles would leave buttons spinning forever.
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new ApiError('The server is not responding. Check the connection and try again.', 0, null);
    }
    throw new ApiError('Cannot reach the server. Check the connection and try again.', 0, null);
  }

  if (response.status === 401 && token) {
    setToken('');
    window.dispatchEvent(new Event('avya:session-expired'));
  }

  if (raw) {
    if (!response.ok) throw new ApiError('Request failed.', response.status, null);
    return response;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.error || 'Request failed.', response.status, payload);
  }
  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  raw: (path) => request(path, { raw: true }),
};
