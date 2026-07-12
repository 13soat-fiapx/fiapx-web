const CONFIG = {
  AUTH0_DOMAIN: window.__AUTH0_DOMAIN__ || 'SEU_TENANT.us.auth0.com',
  AUTH0_CLIENT_ID: window.__AUTH0_CLIENT_ID__ || 'SEU_CLIENT_ID',
  AUTH0_AUDIENCE: window.__AUTH0_AUDIENCE__ || 'https://fiapx.io',
  API_BASE: window.__API_BASE__ || 'http://localhost:5000',
};

const ROUTES = {
  login:    '/login',
  register: '/register',
  status:   '/videos',
  upload:   '/upload',
  settings: '/settings',
  docs:     '/docs',
};

const ROUTES_BY_PATH = {
  '/login':    'login',
  '/register': 'register',
  '/videos':   'status',
  '/upload':   'upload',
  '/settings': 'settings',
  '/docs':     'docs',
};

function isStrongPassword(p) {
  const checks = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/];
  return p.length >= 8 && checks.filter(r => r.test(p)).length >= 3;
}

function app() {
  return {
    config: CONFIG,
    curlCopied: null,

    page: 'login',
    token: null,
    refreshToken: null,
    userEmail: null,

    loginEmail: '',
    loginPass: '',
    loginError: '',
    loginLoading: false,
    rememberMe: true,

    regName: '',
    regEmail: '',
    regPass: '',
    regError: '',
    regSuccess: '',

    selectedFile: null,
    fileName: '',
    dragging: false,
    uploading: false,
    uploadDone: false,
    uploadProgress: 0,
    uploadError: '',
    uploadSuccess: '',
    uploadMsg: '',

    videos: [],
    videosLoading: false,
    videosError: '',

    settingsApiBase: '',
    settingsSaved: false,
    tokenCopied: false,

    STATUS_LABELS: { upload_pending: 'aguardando upload', queued: 'na fila', processing: 'processando', succeeded: 'concluído', failed: 'erro' },

    init() {
      window.addEventListener('popstate', () => this._navigate(window.location.pathname));

      window.addEventListener('storage', e => {
        if (e.key === 'fiapx_refresh_token') {
          this.refreshToken = e.newValue || null;
          return;
        }
        if (e.key !== 'fiapx_token') return;
        if (!e.newValue) {
          this.token = null;
          this.refreshToken = null;
          this.userEmail = null;
          this.go('login');
        } else {
          this.token = e.newValue;
          this.refreshToken = localStorage.getItem('fiapx_refresh_token') || null;
          this.userEmail = localStorage.getItem('fiapx_email');
          this.go('status');
        }
      });

      const saved = localStorage.getItem('fiapx_token');
      const savedRefresh = localStorage.getItem('fiapx_refresh_token');
      const savedEmail = localStorage.getItem('fiapx_email');
      if (saved) {
        this.token = saved;
        this.refreshToken = savedRefresh;
        this.userEmail = savedEmail;
        if (this._isTokenExpired()) {
          if (savedRefresh) {
            this._refreshToken().catch(() => this.logout());
          } else {
            this.logout();
          }
        }
      }

      const savedApiBase = localStorage.getItem('fiapx_api_base');
      if (savedApiBase) this.config.API_BASE = savedApiBase;
      this.settingsApiBase = this.config.API_BASE;

      this._navigate(window.location.pathname);
    },

    go(page) {
      const path = ROUTES[page] || '/login';
      if (window.location.pathname !== path)
        history.pushState(null, '', path);
      this.page = page;
      if (page === 'status') this.loadVideos();
    },

    /**
     * Resolves a pathname to a page, applying auth guards.
     * Called on init and on popstate (browser back/forward).
     * @param {string} path
     */
    _navigate(path) {
      const page = ROUTES_BY_PATH[path];

      if (!page) {
        this.go(this.token ? 'status' : 'login');
        return;
      }

      const authRequired = ['status', 'upload', 'settings'];
      if (authRequired.includes(page) && !this.token) {
        this.go('login');
        return;
      }

      this.page = page;
      if (page === 'status') this.loadVideos();
    },

    // #region auth

    /**
     * Authenticates via Auth0 Resource Owner Password Grant.
     * On success, stores token in localStorage and navigates to status page.
     */
    async login() {
      this.loginError = '';
      if (!this.loginEmail || !this.loginPass) {
        this.loginError = 'preencha todos os campos';
        return;
      }

      this.loginLoading = true;
      try {
        const res = await fetch(`https://${CONFIG.AUTH0_DOMAIN}/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'password',
            username: this.loginEmail,
            password: this.loginPass,
            audience: CONFIG.AUTH0_AUDIENCE,
            client_id: CONFIG.AUTH0_CLIENT_ID,
            scope: 'openid profile email offline_access',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          this.loginError = data.error_description || 'credenciais inválidas';
          return;
        }

        this.token = data.access_token;
        this.refreshToken = (this.rememberMe && data.refresh_token) ? data.refresh_token : null;
        this.userEmail = this.loginEmail;
        localStorage.setItem('fiapx_token', this.token);
        if (this.refreshToken) localStorage.setItem('fiapx_refresh_token', this.refreshToken);
        else localStorage.removeItem('fiapx_refresh_token');
        localStorage.setItem('fiapx_email', this.userEmail);
        this.go('status');
      } catch (e) {
        this.loginError = 'erro de conexão: ' + e.message;
      } finally {
        this.loginLoading = false;
      }
    },

    /**
     * Creates a new user via Auth0 /dbconnections/signup.
     * Redirects to login after 2s on success.
     */
    async register() {
      this.regError = '';
      this.regSuccess = '';

      if (!this.regName || !this.regEmail || !this.regPass) {
        this.regError = 'preencha todos os campos';
        return;
      }
      if (this.regPass.length < 8) {
        this.regError = 'senha deve ter no mínimo 8 caracteres';
        return;
      }
      if (!isStrongPassword(this.regPass)) {
        this.regError = 'senha deve conter pelo menos 3 dos seguintes tipos de caracteres: letra maiúscula, letra minúscula, número e caractere especial';
        return;
      }

      try {
        const res = await fetch(`https://${CONFIG.AUTH0_DOMAIN}/dbconnections/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: CONFIG.AUTH0_CLIENT_ID,
            connection: 'Username-Password-Authentication',
            email: this.regEmail,
            password: this.regPass,
            user_metadata: { name: this.regName },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          this.regError = data.message || 'erro ao criar conta';
          return;
        }

        this.regSuccess = 'conta criada — faça login para continuar';
        setTimeout(() => this.go('login'), 2000);
      } catch (e) {
        this.regError = 'erro de conexão: ' + e.message;
      }
    },

    logout() {
      this.token = null;
      this.refreshToken = null;
      this.userEmail = null;
      localStorage.removeItem('fiapx_token');
      localStorage.removeItem('fiapx_refresh_token');
      localStorage.removeItem('fiapx_email');
      this.go('login');
    },

    _isTokenExpired() {
      if (!this.token) return true;
      try {
        const b64 = this.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=');
        const payload = JSON.parse(atob(padded));
        return payload.exp * 1000 < Date.now() + 30_000;
      } catch {
        return true;
      }
    },

    async _refreshToken() {
      if (!this.refreshToken) throw new Error('no refresh token');
      const res = await fetch(`https://${CONFIG.AUTH0_DOMAIN}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: CONFIG.AUTH0_CLIENT_ID,
          refresh_token: this.refreshToken,
        }),
      });
      if (!res.ok) throw new Error('refresh failed');
      const data = await res.json();
      this.token = data.access_token;
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
        localStorage.setItem('fiapx_refresh_token', this.refreshToken);
      } else {
        this.refreshToken = null;
        localStorage.removeItem('fiapx_refresh_token');
      }
      localStorage.setItem('fiapx_token', this.token);
      return this.token;
    },

    async _apiFetch(url, opts = {}) {
      const withAuth = (token) => ({
        ...opts,
        headers: { ...opts.headers, 'Authorization': 'Bearer ' + token },
      });
      let res = await fetch(url, withAuth(this.token));
      if (res.status === 401) {
        try {
          const newToken = await this._refreshToken();
          res = await fetch(url, withAuth(newToken));
        } catch {
          this.logout();
          throw new Error('sessão expirada — faça login novamente');
        }
      }
      return res;
    },

    // #endregion

    // #region upload

    onFileSelect(e) {
      const f = e.target.files[0];
      this.selectedFile = f || null;
      this.fileName = f ? `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)` : '';
      this.uploading = false;
      this.uploadProgress = 0;
      this.uploadDone = false;
      this.uploadError = '';
      this.uploadSuccess = '';
      this.uploadMsg = '';
    },

    onDrop(e) {
      this.dragging = false;
      const f = e.dataTransfer.files[0];
      if (!f) return;
      const dt = new DataTransfer();
      dt.items.add(f);
      this.$refs.fileInput.files = dt.files;
      this.selectedFile = f;
      this.fileName = `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`;
      this.uploading = false;
      this.uploadProgress = 0;
      this.uploadDone = false;
      this.uploadError = '';
      this.uploadSuccess = '';
      this.uploadMsg = '';
    },

    /**
     * Uploads a video via 3-step flow per the OpenAPI contract:
     * 1. POST /v1/processing-jobs — get presigned S3 URL
     * 2. PUT directly to S3 (XHR for progress events)
     * 3. POST /v1/processing-jobs/{id}/upload-completion — confirm upload
     *
     * Note: S3 must have CORS configured to allow PUT from the app origin.
     * The download flow depends on the backend exposing the signed URL in
     * the FileResult _links (e.g. _links.content.href).
     */
    async upload() {
      if (!this.selectedFile) return;

      const file = this.selectedFile;
      this.uploading = true;
      this.uploadDone = false;
      this.uploadProgress = 0;
      this.uploadError = '';
      this.uploadSuccess = '';
      this.uploadMsg = '';

      try {
        // Step 1: Create processing job — returns presigned upload URL
        const createRes = await this._apiFetch(`${CONFIG.API_BASE}/v1/processing-jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputFile: {
              originalFileName: file.name,
              contentType: file.type || 'video/mp4',
              sizeBytes: file.size,
            },
          }),
        });
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}));
          this.uploadError = err.detail || err.title || 'erro ao criar job de processamento';
          this.uploading = false;
          return;
        }
        const job = await createRes.json(); // ProcessingJobCreated
        this.uploadProgress = 10;

        // Step 2: PUT file directly to S3 using the presigned URL (XHR for progress)
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(job.upload.method, job.upload.url);

          const extraHeaders = job.upload.headers || {};
          Object.entries(extraHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));

          xhr.upload.addEventListener('progress', e => {
            if (e.lengthComputable)
              this.uploadProgress = 10 + Math.round((e.loaded / e.total) * 80);
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`upload S3 falhou (HTTP ${xhr.status})`));
          });
          xhr.addEventListener('error', () => reject(new Error('erro de conexão com S3')));
          xhr.send(file);
        });

        this.uploadProgress = 90;

        // Step 3: Confirm upload completion
        const confirmRes = await this._apiFetch(
          `${CONFIG.API_BASE}/v1/processing-jobs/${job.id}/upload-completion`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sizeBytes: file.size }),
          },
        );
        if (!confirmRes.ok) {
          const err = await confirmRes.json().catch(() => ({}));
          this.uploadError = err.detail || err.title || 'erro ao confirmar upload';
          this.uploading = false;
          return;
        }

        this.uploadProgress = 100;
        this.uploadDone = true;
        this.uploadSuccess = 'vídeo enviado — acompanhe em vídeos';
        this.selectedFile = null;
        this.fileName = '';
        this.$refs.fileInput.value = '';
      } catch (e) {
        this.uploadError = e.message || 'erro no upload';
        this.uploading = false;
      }
    },

    // #endregion

    // #region videos

    /**
     * Fetches the authenticated user's processing jobs from the API.
     */
    async loadVideos() {
      this.videosLoading = true;
      this.videosError = '';
      this.videos = [];
      try {
        const res = await this._apiFetch(`${CONFIG.API_BASE}/v1/processing-jobs`);
        if (!res.ok) {
          this.videosError = 'erro ao carregar jobs de processamento.';
          return;
        }
        const data = await res.json();
        this.videos = data.items || [];
      } catch {
        this.videosError = 'erro de conexão.';
      } finally {
        this.videosLoading = false;
      }
    },

    /**
     * Downloads the result ZIP for a succeeded processing job.
     * Follows the 303 from GET /v1/processing-jobs/{id} to GET /v1/files/{fileId},
     * then opens the presigned download URL from the FileResult _links.
     * Requires the backend to expose the signed URL in _links.content.href or similar.
     */
    async downloadJob(job) {
      try {
        const res = await this._apiFetch(`${CONFIG.API_BASE}/v1/processing-jobs/${job.id}`, {
          redirect: 'follow', // follows 303 → /v1/files/{fileId}
        });
        if (!res.ok) return;
        const file = await res.json(); // FileResult
        const href = file._links?.content?.href || file._links?.download?.href;
        if (href) window.open(href, '_blank');
      } catch { /* silent */ }
    },

    // #endregion

    // #region curl

    /**
     * Returns the masked curl string for display (token replaced with dots).
     * @param {'login'|'register'|'upload'|'status'} page
     * @returns {string}
     */
    curlDisplay(page) {
      const mask = '••••••••••••';
      if (page === 'login')
        return `curl -s -X POST 'https://${CONFIG.AUTH0_DOMAIN}/oauth/token' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"grant_type":"password","username":"...","password":"...","audience":"${CONFIG.AUTH0_AUDIENCE}","client_id":"${CONFIG.AUTH0_CLIENT_ID}","scope":"openid profile email"}'`;
      if (page === 'register')
        return `curl -s -X POST 'https://${CONFIG.AUTH0_DOMAIN}/dbconnections/signup' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"client_id":"${CONFIG.AUTH0_CLIENT_ID}","connection":"Username-Password-Authentication","email":"...","password":"...","user_metadata":{"name":"..."}}'`;
      if (page === 'upload')
        return `curl -s -X POST '${this.config.API_BASE}/v1/processing-jobs' \\\n  -H 'Authorization: Bearer ${mask}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"inputFile":{"originalFileName":"video.mp4","contentType":"video/mp4","sizeBytes":0}}'`;
      if (page === 'status')
        return `curl -s '${this.config.API_BASE}/v1/processing-jobs' \\\n  -H 'Authorization: Bearer ${mask}'`;
      return '';
    },

    /**
     * Copies the real curl string (with actual token) to the clipboard.
     * Highlights the icon briefly to confirm the copy.
     * @param {'login'|'register'|'upload'|'status'} page
     */
    copyCurl(page) {
      const tok = this.token || '{token}';
      let text = '';
      if (page === 'login')
        text = `curl -s -X POST 'https://${CONFIG.AUTH0_DOMAIN}/oauth/token' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"grant_type":"password","username":"...","password":"...","audience":"${CONFIG.AUTH0_AUDIENCE}","client_id":"${CONFIG.AUTH0_CLIENT_ID}","scope":"openid profile email"}'`;
      else if (page === 'register')
        text = `curl -s -X POST 'https://${CONFIG.AUTH0_DOMAIN}/dbconnections/signup' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"client_id":"${CONFIG.AUTH0_CLIENT_ID}","connection":"Username-Password-Authentication","email":"...","password":"...","user_metadata":{"name":"..."}}'`;
      else if (page === 'upload')
        text = `curl -s -X POST '${this.config.API_BASE}/v1/processing-jobs' \\\n  -H 'Authorization: Bearer ${tok}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"inputFile":{"originalFileName":"video.mp4","contentType":"video/mp4","sizeBytes":0}}'`;
      else if (page === 'status')
        text = `curl -s '${this.config.API_BASE}/v1/processing-jobs' \\\n  -H 'Authorization: Bearer ${tok}'`;
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        this.curlCopied = page;
        setTimeout(() => { this.curlCopied = null; }, 1500);
      }).catch(() => {});
    },

    // #endregion

    // #region settings

    copyToken() {
      if (!this.token) return;
      navigator.clipboard.writeText(this.token).then(() => {
        this.tokenCopied = true;
        setTimeout(() => { this.tokenCopied = false; }, 1500);
      }).catch(() => {});
    },

    saveSettings() {
      const v = this.settingsApiBase.trim();
      if (!v) return;
      this.config.API_BASE = v;
      localStorage.setItem('fiapx_api_base', v);
      this.settingsSaved = true;
      setTimeout(() => { this.settingsSaved = false; }, 2000);
    },

    resetSettings() {
      const defaultBase = window.__API_BASE__ || 'http://localhost:8080';
      this.settingsApiBase = defaultBase;
      this.config.API_BASE = defaultBase;
      localStorage.removeItem('fiapx_api_base');
      this.settingsSaved = true;
      setTimeout(() => { this.settingsSaved = false; }, 2000);
    },

    // #endregion
  };
}
