const CONFIG = {
  AUTH0_DOMAIN: window.__AUTH0_DOMAIN__ || 'SEU_TENANT.us.auth0.com',
  AUTH0_CLIENT_ID: window.__AUTH0_CLIENT_ID__ || 'SEU_CLIENT_ID',
  AUTH0_AUDIENCE: window.__AUTH0_AUDIENCE__ || 'https://fiapx.io',
  API_BASE: window.__API_BASE__ || 'http://localhost:8080',
};

function app() {
  return {
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

    STATUS_LABELS: { queued: 'aguardando', processing: 'processando', done: 'concluído', error: 'erro' },

    init() {
      const saved = sessionStorage.getItem('fiapx_token');
      const savedEmail = sessionStorage.getItem('fiapx_email');
      if (saved) {
        this.token = saved;
        this.userEmail = savedEmail;
        this.go('status');
      }
    },

    go(page) {
      this.page = page;
      if (page === 'status')
        this.loadVideos();
    },

    async login() {
      this.loginError = '';
      if (!this.loginEmail || !this.loginPass) { this.loginError = 'preencha todos os campos'; return; }
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
        if (!res.ok) { this.loginError = data.error_description || 'credenciais inválidas'; return; }
        this.token = data.access_token;
        this.userEmail = this.loginEmail;
        sessionStorage.setItem('fiapx_token', this.token);
        sessionStorage.setItem('fiapx_email', this.userEmail);
        this.go('status');
      } catch (e) {
        this.loginError = 'erro de conexão: ' + e.message;
      } finally {
        this.loginLoading = false;
      }
    },

    async register() {
      this.regError = '';
      this.regSuccess = '';
      if (!this.regName || !this.regEmail || !this.regPass) { this.regError = 'preencha todos os campos'; return; }
      if (this.regPass.length < 8) { this.regError = 'senha deve ter no mínimo 8 caracteres'; return; }
      if (!this._strongPassword(this.regPass)) {
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
        if (!res.ok) { this.regError = data.message || 'erro ao criar conta'; return; }
        this.regSuccess = 'conta criada — faça login para continuar';
        setTimeout(() => this.go('login'), 2000);
      } catch (e) {
        this.regError = 'erro de conexão: ' + e.message;
      }
    },

    _strongPassword(p) {
      const checks = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/];
      return p.length >= 8 && checks.filter(r => r.test(p)).length >= 3;
    },

    logout() {
      this.token = null;
      this.userEmail = null;
      sessionStorage.removeItem('fiapx_token');
      sessionStorage.removeItem('fiapx_email');
      this.go('login');
    },

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
        this.uploadDone = true;
        if (xhr.status >= 200 && xhr.status < 300) {
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

    async loadVideos() {
      this.videosLoading = true;
      this.videosError = '';
      this.videos = [];
      try {
        const res = await fetch(`${CONFIG.API_BASE}/videos`, {
          headers: { 'Authorization': 'Bearer ' + this.token },
        });
        if (!res.ok) { this.videosError = 'erro ao carregar vídeos.'; return; }
        this.videos = await res.json();
      } catch {
        this.videosError = 'erro de conexão.';
      } finally {
        this.videosLoading = false;
      }
    },
  };
}
