const API_URL = 'https://bot-eloha.discloud.app/';

function getToken() {
  return localStorage.getItem('jwt_token');
}

function setToken(token) {
  localStorage.setItem('jwt_token', token);
}

function clearToken() {
  localStorage.removeItem('jwt_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, { method = 'GET', headers = {}, body, auth = true } = {}) {
  const finalHeaders = {
    ...(auth ? authHeaders() : {}),
    ...headers
  };

  const options = { method, headers: finalHeaders };

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (body !== undefined) {
    if (!isFormData) {
      options.headers['Content-Type'] = 'application/json';
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    } else {
      options.body = body;
    }
  }

  const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const res = await fetch(`${base}${path}`, options);

  if (res.status === 401) {
    clearToken();
    const here = window.location.pathname.split('/').pop();
    if (here !== 'index.html' && here !== '') {
      window.location.href = 'index.html';
    }
    throw new Error('Não autorizado');
  }

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }

  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `Erro HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function ensureAuthed() {
  if (!getToken()) {
    window.location.href = 'index.html';
  }
}

function mountToasts() {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  return wrap;
}

function toast({ title, message, type = 'success', timeout = 3200 } = {}) {
  const wrap = mountToasts();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<p class="t"></p><p class="m"></p>`;
  el.querySelector('.t').textContent = title || 'Aviso';
  el.querySelector('.m').textContent = message || '';
  wrap.appendChild(el);

  const t = setTimeout(() => {
    el.remove();
  }, timeout);

  el.addEventListener('click', () => {
    clearTimeout(t);
    el.remove();
  });
}
