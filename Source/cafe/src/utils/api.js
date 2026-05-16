const RAW_BASE = process.env.REACT_APP_API_URL || '';
const BASE_URL = RAW_BASE.replace(/\/$/, '');

function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch (e) {
    // ignore (server-side rendering or restricted env)
  }
  return headers;
}

export function getImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return BASE_URL ? `${BASE_URL}${path.startsWith('/') ? path : '/' + path}` : path;
}

export async function postJson(url, body) {
  const fullUrl = BASE_URL ? `${BASE_URL}${url}` : url;
  const headers = buildHeaders();

  console.log('API Request:', {
    url: fullUrl,
    method: 'POST',
    headers: { ...headers, Authorization: headers.Authorization ? 'Bearer ***' : 'none' },
    body: body
  });

  const res = await fetch(fullUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    console.warn('Failed to parse JSON response:', text);
    data = text;
  }

  console.log('API Response:', {
    status: res.status,
    statusText: res.statusText,
    ok: res.ok,
    data: data
  });

  if (!res.ok) {
    const message = data?.Message || data?.message || data || res.statusText || 'Request failed';
    const err = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    // attach status for callers
    try { err.status = res.status; } catch { /* ignore */ }
    throw err;
  }

  return data;
}

export async function getJson(url) {
  const fullUrl = BASE_URL ? `${BASE_URL}${url}` : url;
  const headers = buildHeaders();

  console.time(`GET ${url}`);
  try {
    const res = await fetch(fullUrl, { headers });
    console.timeEnd(`GET ${url}`);

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const message = data?.error || data?.Message || data?.message || data || res.statusText;
      const err = new Error(typeof message === 'string' ? message : JSON.stringify(message));
      try { err.status = res.status; } catch { }
      throw err;
    }
    return data;
  } catch (err) {
    console.timeEnd(`GET ${url}`);
    throw err;
  }
}

export async function putJson(url, body) {
  const fullUrl = BASE_URL ? `${BASE_URL}${url}` : url;
  const headers = buildHeaders();

  console.log('API Request:', {
    url: fullUrl,
    method: 'PUT',
    headers: { ...headers, Authorization: headers.Authorization ? 'Bearer ***' : 'none' },
    body: body
  });

  const res = await fetch(fullUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    console.warn('Failed to parse JSON response:', text);
    data = text;
  }

  console.log('API Response:', {
    status: res.status,
    statusText: res.statusText,
    ok: res.ok,
    data: data
  });

  if (!res.ok) {
    const message = data?.Message || data?.message || data || res.statusText || 'Request failed';
    const err = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    try { err.status = res.status; } catch { /* ignore */ }
    throw err;
  }

  return data;
}

export async function deleteJson(url) {
  const fullUrl = BASE_URL ? `${BASE_URL}${url}` : url;
  const headers = buildHeaders();

  const res = await fetch(fullUrl, {
    method: 'DELETE',
    headers,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    console.warn('Failed to parse JSON response:', text);
    data = text;
  }

  if (!res.ok) {
    const message = data?.Message || data?.message || data || res.statusText || 'Request failed';
    const err = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    try { err.status = res.status; } catch { /* ignore */ }
    throw err;
  }

  return data;
}

export async function uploadFile(url, file, fieldName = 'file') {
  const fullUrl = BASE_URL ? `${BASE_URL}${url}` : url;
  
  const headers = {};
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch (e) {
    // ignore
  }

  const formData = new FormData();
  formData.append(fieldName, file);

  console.log('API Upload Request:', {
    url: fullUrl,
    method: 'POST',
    fileName: file.name,
    fileSize: file.size
  });

  const res = await fetch(fullUrl, {
    method: 'POST',
    headers, // Note: Do NOT set Content-Type to multipart/form-data here, browser does it automatically with boundary
    body: formData,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    console.warn('Failed to parse JSON response:', text);
    data = text;
  }

  if (!res.ok) {
    const message = data?.Message || data?.message || data || res.statusText || 'Upload failed';
    const err = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    try { err.status = res.status; } catch { /* ignore */ }
    throw err;
  }

  return data;
}