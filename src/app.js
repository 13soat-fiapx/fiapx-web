let token = null, userEmail = null;

const mockVideos = [
  {id:'v001',name:'apresentacao.mp4',createdAt:'2025-05-29 09:12',status:'done',zipUrl:'#'},
  {id:'v002',name:'demo-produto.mov',createdAt:'2025-05-29 10:45',status:'processing',zipUrl:null},
  {id:'v003',name:'reuniao.mp4',createdAt:'2025-05-29 11:30',status:'queued',zipUrl:null},
  {id:'v004',name:'teste-erro.avi',createdAt:'2025-05-29 11:55',status:'error',zipUrl:null},
];

function go(page) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.getElementById('nav-'+page).classList.add('active');
  renderNavAuth();
  if(page==='upload') renderUploadAuth();
  if(page==='status') {renderStatusAuth(); renderVideos();}
}

function renderNavAuth() {
  const isAuthenticated = !!token;
  document.getElementById('nav-login').style.display = isAuthenticated ? 'none' : 'inline-flex';
  document.getElementById('nav-register').style.display = isAuthenticated ? 'none' : 'inline-flex';
  document.getElementById('nav-upload').style.display = isAuthenticated ? 'inline-flex' : 'none';
  document.getElementById('nav-status').style.display = isAuthenticated ? 'inline-flex' : 'none';
}

function renderUploadAuth() {
  document.getElementById('unauth-upload').style.display = token ? 'none' : 'block';
  document.getElementById('auth-upload').style.display = token ? 'block' : 'none';
  if(token) {
    document.getElementById('up-user').textContent = userEmail||'usuario';
    document.getElementById('up-token').textContent = 'Bearer ' + token.substring(0,40)+'…';
  }
}

function renderStatusAuth() {
  document.getElementById('unauth-status').style.display = token ? 'none' : 'block';
  document.getElementById('auth-status').style.display = token ? 'block' : 'none';
  if(token) document.getElementById('st-user').textContent = userEmail||'usuario';
}

function renderVideos() {
  if(!token) return;
  const tbody = document.getElementById('videos-body');
  if(!mockVideos.length){tbody.innerHTML='<tr><td colspan="4" class="empty">nenhum video encontrado.</td></tr>';return;}
  tbody.innerHTML = mockVideos.map(v=>{
    const badge = {
      queued:`<span class="badge badge-queued"><span class="dot"></span>aguardando</span>`,
        processing:`<span class="badge badge-processing"><span class="dot"></span>processando</span>`,
        done:`<span class="badge badge-done"><span class="dot"></span>concluído</span>`,
        error:`<span class="badge badge-error"><span class="dot"></span>erro</span>`,
    }[v.status]||'';
    const dl = v.status==='done'
      ? `<a href="${v.zipUrl}" class="btn btn-sm" style="text-decoration:none">download</a>`
      : `<button class="btn btn-sm" disabled style="opacity:0.4">download</button>`;
    return `<tr>
      <td class="mono">${v.name}</td>
      <td style="color:var(--muted);font-size:11px">${v.createdAt}</td>
      <td>${badge}</td>
      <td>${dl}</td>
    </tr>`;
  }).join('');
}

function doLogin() {
  const email = document.getElementById('l-email').value;
  const pass = document.getElementById('l-pass').value;
  const err = document.getElementById('login-err');
  const loading = document.getElementById('login-loading');
  err.style.display='none';
  if(!email||!pass){showAlert(err,'preencha todos os campos');return;}
  loading.textContent='autenticando…';
  setTimeout(()=>{
    loading.textContent='';
    if(pass.length<6){showAlert(err,'credenciais inválidas');return;}
    token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.demo_payload_' + btoa(email);
    userEmail = email;
    renderNavAuth();
    go('upload');
  },900);
}

function doRegister() {
  const name = document.getElementById('r-name').value;
  const email = document.getElementById('r-email').value;
  const pass = document.getElementById('r-pass').value;
  const err = document.getElementById('reg-err');
  const ok = document.getElementById('reg-ok');
  err.style.display='none'; ok.style.display='none';
  if(!name||!email||!pass){showAlert(err,'preencha todos os campos');return;}
  if(pass.length<8){showAlert(err,'senha deve ter no mínimo 8 caracteres');return;}
  setTimeout(()=>{
    showAlert(ok,'conta criada com sucesso — faça login para continuar');
    setTimeout(()=>go('login'),1800);
  },700);
}

function onFileSelect(input) {
  const f = input.files[0];
  if(f){
    document.getElementById('file-name').textContent = f.name + ' (' + (f.size/1024/1024).toFixed(1) + ' MB)';
    document.getElementById('btn-upload').disabled = false;
  }
}

function doUpload() {
  const btn = document.getElementById('btn-upload');
  const progWrap = document.getElementById('prog-wrap');
  const fill = document.getElementById('prog-fill');
  const pct = document.getElementById('prog-pct');
  const label = document.getElementById('prog-label');
  const msg = document.getElementById('up-msg');
  btn.disabled=true; progWrap.style.display='block'; msg.textContent='';
  let p=0;
  const iv = setInterval(()=>{
    p = Math.min(p + Math.random()*18, 95);
    fill.style.width=p+'%'; pct.textContent=Math.round(p)+'%';
    if(p>=40) label.textContent='processando…';
    if(p>=95){
      clearInterval(iv);
      fill.style.width='100%'; pct.textContent='100%'; label.textContent='concluído';
      msg.textContent='vídeo enviado — acompanhe em status';
      msg.style.color='var(--success)';
      document.getElementById('file-input').value='';
      document.getElementById('file-name').textContent='';
      btn.disabled=true;
      mockVideos.unshift({id:'v00'+Date.now(),name:'novo-video.mp4',createdAt:new Date().toISOString().slice(0,16).replace('T',' '),status:'queued',zipUrl:null});
    }
  },200);
}

function refreshStatus() { renderVideos(); }

function doLogout() { token=null; userEmail=null; go('login'); }

function showAlert(el, msg) { el.textContent=msg; el.style.display='block'; }

const dz = document.getElementById('drop-zone');
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag')});
dz.addEventListener('dragleave',()=>dz.classList.remove('drag'));
dz.addEventListener('drop',e=>{
  e.preventDefault(); dz.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if(f){const dt=new DataTransfer();dt.items.add(f);document.getElementById('file-input').files=dt.files;onFileSelect(document.getElementById('file-input'));}
});

renderNavAuth();
