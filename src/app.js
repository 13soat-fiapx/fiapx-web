const CONFIG = {
  AUTH0_DOMAIN: window.__AUTH0_DOMAIN__ || 'SEU_TENANT.us.auth0.com',
  AUTH0_CLIENT_ID: window.__AUTH0_CLIENT_ID__ || 'SEU_CLIENT_ID',
  AUTH0_AUDIENCE: window.__AUTH0_AUDIENCE__ || 'https://fiapx.io',
  API_BASE: window.__API_BASE__ || 'http://localhost:8080',
};

const ROUTES = {
  login:    '/login',
  register: '/register',
  status:   '/videos',
  upload:   '/upload',
  settings: '/settings',
};

const ROUTES_BY_PATH = {
  '/login':    'login',
  '/register': 'register',
  '/videos':   'status',
  '/upload':   'upload',
  '/settings': 'settings',
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
    userEmail: null,

    loginEmail: '',
    loginPass: '',
    loginError: '',
    loginLoading: false,

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

    STATUS_LABELS: { queued: 'aguardando', processing: 'processando', done: 'concluído', error: 'erro' },

    init() {
      window.addEventListener('popstate', () => this._navigate(window.location.pathname));

      window.addEventListener('storage', e => {
        if (e.key !== 'fiapx_token') return;
        if (!e.newValue) {
          this.token = null;
          this.userEmail = null;
          this.go('login');
        } else {
          this.token = e.newValue;
          this.userEmail = localStorage.getItem('fiapx_email');
          this.go('status');
        }
      });

      const saved = localStorage.getItem('fiapx_token');
      const savedEmail = localStorage.getItem('fiapx_email');
      if (saved) {
        this.token = saved;
        this.userEmail = savedEmail;
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
            scope: 'openid profile email',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          this.loginError = data.error_description || 'credenciais inválidas';
          return;
        }

        this.token = data.access_token;
        this.userEmail = this.loginEmail;
        localStorage.setItem('fiapx_token', this.token);
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
      this.userEmail = null;
      localStorage.removeItem('fiapx_token');
      localStorage.removeItem('fiapx_email');
      this.go('login');
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
     * Uploads the selected video via XHR (required for upload progress events).
     * Progress is capped at 80% until the server responds.
     */
    upload() {
      if (!this.selectedFile) return;

      this.uploading = true;
      this.uploadDone = false;
      this.uploadProgress = 0;
      this.uploadError = '';
      this.uploadMsg = '';

      const form = new FormData();
      form.append('video', this.selectedFile);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${CONFIG.API_BASE}/videos`);
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.token);

      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) this.uploadProgress = Math.round((e.loaded / e.total) * 80);
      });

      xhr.addEventListener('load', () => {
        this.uploadProgress = 100;
        if (xhr.status >= 200 && xhr.status < 300) {
          this.uploadDone = true;
          this.uploadMsg = 'vídeo enviado — acompanhe em vídeos';
          this.selectedFile = null;
          this.fileName = '';
          this.$refs.fileInput.value = '';
        } else {
          try { this.uploadError = JSON.parse(xhr.responseText).message || 'erro no upload'; }
          catch { this.uploadError = 'erro no upload'; }
          this.uploading = false;
        }
      });

      xhr.addEventListener('error', () => {
        this.uploadError = 'erro de conexão';
        this.uploading = false;
      });

      xhr.send(form);
    },

    // #endregion

    // #region videos

    /**
     * Fetches the authenticated user's video list from the API.
     */
    async loadVideos() {
      this.videosLoading = true;
      this.videosError = '';
      this.videos = [];
      try {
        const res = await fetch(`${CONFIG.API_BASE}/videos`, {
          headers: { 'Authorization': 'Bearer ' + this.token },
        });
        if (!res.ok) {
          this.videosError = 'erro ao carregar vídeos.';
          return;
        }
        this.videos = await res.json();
      } catch {
        this.videosError = 'erro de conexão.';
      } finally {
        this.videosLoading = false;
      }
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
        return `curl -s -X POST '${this.config.API_BASE}/videos' \\\n  -H 'Authorization: Bearer ${mask}' \\\n  -F 'video=@arquivo.mp4'`;
      if (page === 'status')
        return `curl -s '${this.config.API_BASE}/videos' \\\n  -H 'Authorization: Bearer ${mask}'`;
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
        text = `curl -s -X POST '${this.config.API_BASE}/videos' \\\n  -H 'Authorization: Bearer ${tok}' \\\n  -F 'video=@arquivo.mp4'`;
      else if (page === 'status')
        text = `curl -s '${this.config.API_BASE}/videos' \\\n  -H 'Authorization: Bearer ${tok}'`;
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
