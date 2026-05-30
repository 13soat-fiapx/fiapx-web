const CONFIG = {
  AUTH0_DOMAIN: window.__AUTH0_DOMAIN__ || 'SEU_TENANT.us.auth0.com',
  AUTH0_CLIENT_ID: window.__AUTH0_CLIENT_ID__ || 'SEU_CLIENT_ID',
  AUTH0_AUDIENCE: window.__AUTH0_AUDIENCE__ || 'https://fiapx-video-api',
  API_BASE: window.__API_BASE__ || 'http://localhost:8080',
};

let token = null, userEmail = null;

// tabs por estado de autenticacao
const TABS_ANON = [
  { id: 'login', label: 'login' },
  { id: 'register', label: 'cadastro' },
];
const TABS_AUTH = [
  { id: 'status', label: 'vídeos' },
  { id: 'upload', label: 'upload' },
];

function renderTabbar(activePage) {
  const tabs = token ? TABS_AUTH : TABS_ANON;
  const bar = document.getElementById('tabbar');
  bar.innerHTML =
    '<div class="tabbar-left">' +
    tabs.map(t =>
      `<button class="tab${activePage === t.id ? ' active' : ''}" onclick="go('${t.id}')">${t.label}</button>`
    ).join('') +
    '</div>';
  document.getElementById('header-auth').style.display = token ? 'flex' : 'none';
  if (token) document.getElementById('header-email').textContent = userEmail || '';
}

function go(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  renderTabbar(page);
  if (page === 'status') { renderVideos(); }
}

// --- AUTH ---

async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass = document.getElementById('l-pass').value;
  const err = document.getElementById('login-err');
  const spin = document.getElementById('login-loading');
  err.style.display = 'none';
  if (!email || !pass) { showAlert(err, 'preencha todos os campos'); return; }
  spin.textContent = 'autenticando…';
  try {
    const res = await fetch(`https://${CONFIG.AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        username: email,
        password: pass,
        audience: CONFIG.AUTH0_AUDIENCE,
        client_id: CONFIG.AUTH0_CLIENT_ID,
        scope: 'openid profile email',
      }),
    });
    const data = await res.json();
    if (!res.ok) { showAlert(err, data.error_description || 'credenciais inválidas'); return; }
    token = data.access_token;
    userEmail = email;
    sessionStorage.setItem('fiapx_token', token);
    sessionStorage.setItem('fiapx_email', userEmail);
    go('status');
  } catch (e) {
    showAlert(err, 'erro de conexão: ' + e.message);
  } finally {
    spin.textContent = '';
  }
}

async function doRegister() {
  const name = document.getElementById('r-name').value.trim();
  const email = document.getElementById('r-email').value.trim();
  const pass = document.getElementById('r-pass').value;
  const err = document.getElementById('reg-err');
  const ok = document.getElementById('reg-ok');

  function isStrongPassword(p) {
    const checks = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/];
    return p.length >= 8 && checks.filter(r => r.test(p)).length >= 3;
  }

  err.style.display = 'none'; ok.style.display = 'none';
  if (!name || !email || !pass) { showAlert(err, 'preencha todos os campos'); return; }
  if (pass.length < 8) { showAlert(err, 'senha deve ter no mínimo 8 caracteres'); return; }
  if (!isStrongPassword(pass)) { showAlert(err, 'senha deve conter pelo menos 3 dos seguintes tipos de caracteres: letra maiúscula, letra minúscula, número e caractere especial'); return; }
  try {
    const res = await fetch(`https://${CONFIG.AUTH0_DOMAIN}/dbconnections/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CONFIG.AUTH0_CLIENT_ID,
        connection: 'Username-Password-Authentication',
        email,
        password: pass,
        user_metadata: { name },
      }),
    });
    const data = await res.json();
    if (!res.ok) { showAlert(err, data.message || 'erro ao criar conta'); return; }
    showAlert(ok, 'conta criada — faça login para continuar');
    setTimeout(() => go('login'), 2000);
  } catch (e) {
    showAlert(err, 'erro de conexão: ' + e.message);
  }
}

function doLogout() {
  token = null; userEmail = null;
  sessionStorage.removeItem('fiapx_token');
  sessionStorage.removeItem('fiapx_email');
  go('login');
}

// --- UPLOAD ---

function onFileSelect(input) {
  const f = input.files[0];
  document.getElementById('file-name').textContent =
    f ? f.name + ' (' + (f.size / 1024 / 1024).toFixed(1) + ' MB)' : '';
  document.getElementById('btn-upload').disabled = !f;
  document.getElementById('upload-err').style.display = 'none';
  document.getElementById('upload-ok').style.display = 'none';
}

function doUpload() {
  const input = document.getElementById('file-input');
  if (!input.files[0]) return;
  const btn = document.getElementById('btn-upload');
  const wrap = document.getElementById('prog-wrap');
  const fill = document.getElementById('prog-fill');
  const pct = document.getElementById('prog-pct');
  const lbl = document.getElementById('prog-label');
  const msg = document.getElementById('up-msg');
  const errEl = document.getElementById('upload-err');
  btn.disabled = true; wrap.style.display = 'block'; msg.textContent = '';
  errEl.style.display = 'none';

  const form = new FormData();
  form.append('video', input.files[0]);
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${CONFIG.API_BASE}/videos`);
  xhr.setRequestHeader('Authorization', 'Bearer ' + token);
  xhr.upload.addEventListener('progress', e => {
    if (e.lengthComputable) {
      const p = Math.round((e.loaded / e.total) * 80);
      fill.style.width = p + '%'; pct.textContent = p + '%';
    }
  });
  xhr.addEventListener('load', () => {
    fill.style.width = '100%'; pct.textContent = '100%'; lbl.textContent = 'concluído';
    if (xhr.status >= 200 && xhr.status < 300) {
      msg.textContent = 'vídeo enviado — acompanhe em vídeos';
      msg.style.color = 'var(--success)';
      input.value = ''; document.getElementById('file-name').textContent = '';
    } else {
      try { showAlert(errEl, JSON.parse(xhr.responseText).message || 'erro no upload'); }
      catch { showAlert(errEl, 'erro no upload'); }
      btn.disabled = false;
    }
  });
  xhr.addEventListener('error', () => { showAlert(errEl, 'erro de conexão'); btn.disabled = false; });
  xhr.send(form);
}

// --- STATUS ---

const STATUS_LABELS = { queued: 'aguardando', processing: 'processando', done: 'concluído', error: 'erro' };

async function renderVideos() {
  const tbody = document.getElementById('videos-body');
  tbody.innerHTML = '<tr><td colspan="4" class="empty">carregando...</td></tr>';
  try {
    const res = await fetch(`${CONFIG.API_BASE}/videos`, {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) { tbody.innerHTML = '<tr><td colspan="4" class="empty">erro ao carregar vídeos.</td></tr>'; return; }
    const videos = await res.json();
    if (!videos.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">nenhum vídeo encontrado.</td></tr>'; return; }
    tbody.innerHTML = videos.map(v => {
      const badge = `<span class="badge badge-${v.status}"><span class="dot"></span>${STATUS_LABELS[v.status] || v.status}</span>`;
      const dl = v.status === 'done' && v.zip_url
        ? `<a href="${v.zip_url}" class="btn btn-sm" style="text-decoration:none">download</a>`
        : `<button class="btn btn-sm" disabled>download</button>`;
      return `<tr>
        <td class="mono">${v.name}</td>
        <td style="color:var(--muted);font-size:11px">${v.created_at}</td>
        <td>${badge}</td>
        <td>${dl}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">erro de conexão.</td></tr>';
  }
}

function refreshStatus() { renderVideos(); }

// --- DRAG AND DROP ---

const dz = document.getElementById('drop-zone');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (f) {
    const dt = new DataTransfer(); dt.items.add(f);
    document.getElementById('file-input').files = dt.files;
    onFileSelect(document.getElementById('file-input'));
  }
});

// --- UTIL ---

function showAlert(el, msg) { el.textContent = msg; el.style.display = 'block'; }

// --- INIT ---

(function init() {
  const saved = sessionStorage.getItem('fiapx_token');
  const savedEmail = sessionStorage.getItem('fiapx_email');
  if (saved) { token = saved; userEmail = savedEmail; go('status'); }
  else { renderTabbar('login'); }
})();
