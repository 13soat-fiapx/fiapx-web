## Context

The "meus vídeos" (status) page currently reloads its whole list on every refresh, which causes an empty-table flash, shows an unhelpful file-name column (every upload is just `original.EXT`), prints raw ISO date strings, and only updates when the user manually clicks "atualizar". The user wants a smoother, self-refreshing list: keep old rows visible during reload, give the refresh button clear loading feedback, drop the useless file-name column, show a locale-formatted date, and auto-refresh on a configurable interval — with the interval reliably stopped when the user navigates away, to avoid a leaked `setInterval` running forever in the background.

## Approach

All changes live in the three existing files (`web/app.js`, `web/index.html`, `web/style.css`) — no new files, no build step. The polling feature reuses the exact same "draft setting + applied config + localStorage" pattern already used for `settingsApiBase` / `config.API_BASE` (app.js:67, 111-113, 533-549), just for a new `config.POLL_INTERVAL_SEC`. To guarantee the interval is cleared on every way of leaving the status page (tab click, browser back/forward, logout), the page-transition tail logic that's currently duplicated in `go()` (app.js:118-124) and `_navigate()` (app.js:131-147) is centralized into one `_setPage(page)` helper that both call.

## File Changes

- **Modify** `web/app.js` — state fields, `init()`, `go()`/`_navigate()` refactor into `_setPage()`, new polling start/stop helpers, `loadVideos()` no longer clears the array, new `formatDate()` helper, `saveSettings()`/`resetSettings()` handle the new poll-interval setting.
- **Modify** `web/index.html` — refresh button loading state, drop "arquivo" column + fix colspans, use `formatDate()`, add poll-interval field to Settings page.
- **Modify** `web/style.css` — add `.spin` / `@keyframes spin`, add `input[type=number]` to the existing form-input selector.

## Implementation Steps

### 1. `web/app.js` — state (around lines 33-71)

- Add `POLL_INTERVAL_SEC: 5` as a default inside the top-level `CONFIG` object (line 1-6), same place `API_BASE` lives, so it flows through `this.config` the same way.
- Add new instance state near `videos`/`videosLoading` (line 63-65): `_videosPollId: null,`
- Add new settings draft field near `settingsApiBase` (line 67): `settingsPollInterval: 5,`

### 2. `web/app.js` — `init()` (lines 111-113)

After the existing API base restore block, add the poll-interval restore, following the identical pattern:

```js
const savedPollInterval = parseInt(localStorage.getItem('fiapx_poll_interval'), 10);
if (Number.isFinite(savedPollInterval) && savedPollInterval > 0) this.config.POLL_INTERVAL_SEC = savedPollInterval;
this.settingsPollInterval = this.config.POLL_INTERVAL_SEC;
```

### 3. `web/app.js` — centralize page transitions (lines 118-147)

Replace the duplicated tails of `go()` and `_navigate()` with a shared `_setPage()`:

```js
go(page) {
  const path = ROUTES[page] || '/login';
  if (window.location.pathname !== path)
    history.pushState(null, '', path);
  this._setPage(page);
},
```

```js
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

  this._setPage(page);
},

/**
 * Applies the page transition, starting/stopping videos polling as needed.
 */
_setPage(page) {
  if (this.page === 'status' && page !== 'status') this._stopVideosPolling();
  this.page = page;
  if (page === 'status') {
    this.loadVideos();
    this._startVideosPolling();
  }
},
```

This covers every navigation path: tab clicks (`go`), popstate/init (`_navigate`), and `logout()` (app.js:250, which calls `this.go('login')`).

### 4. `web/app.js` — polling helpers (new, in the `#region videos` block near line 434-456)

```js
_startVideosPolling() {
  this._stopVideosPolling();
  const seconds = this.config.POLL_INTERVAL_SEC > 0 ? this.config.POLL_INTERVAL_SEC : 5;
  this._videosPollId = setInterval(() => this.loadVideos(), seconds * 1000);
},

_stopVideosPolling() {
  if (this._videosPollId) {
    clearInterval(this._videosPollId);
    this._videosPollId = null;
  }
},
```

### 5. `web/app.js` — `loadVideos()` no longer clears the list (lines 439-456)

Remove `this.videos = [];` (line 442) so previously-loaded rows stay on screen while a refresh (manual or polled) is in flight; the array is only replaced once fresh data arrives at line 450. Error state (`videosError`) is unaffected — on a failed background refresh the stale rows simply stay visible with the error message shown above them.

```js
async loadVideos() {
  this.videosLoading = true;
  this.videosError = '';
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
```

### 6. `web/app.js` — date formatter (new top-level function, alongside `isStrongPassword`, line 26-29)

```js
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
```

Exposed to the template via a thin instance method that delegates to it so `x-text="formatDate(v.createdAt)"` works in index.html:

```js
formatDate(iso) {
  return formatDate(iso);
},
```
(placed in the `#region videos` block, near `downloadJob`)

### 7. `web/app.js` — `saveSettings()` / `resetSettings()` (lines 533-549)

```js
saveSettings() {
  const v = this.settingsApiBase.trim();
  if (v) {
    this.config.API_BASE = v;
    localStorage.setItem('fiapx_api_base', v);
  }
  const seconds = Number(this.settingsPollInterval);
  if (Number.isFinite(seconds) && seconds > 0) {
    this.config.POLL_INTERVAL_SEC = seconds;
    localStorage.setItem('fiapx_poll_interval', String(seconds));
  }
  this.settingsSaved = true;
  setTimeout(() => { this.settingsSaved = false; }, 2000);
},

resetSettings() {
  const defaultBase = window.__API_BASE__ || 'http://localhost:5000';
  this.settingsApiBase = defaultBase;
  this.config.API_BASE = defaultBase;
  localStorage.removeItem('fiapx_api_base');

  this.settingsPollInterval = 5;
  this.config.POLL_INTERVAL_SEC = 5;
  localStorage.removeItem('fiapx_poll_interval');

  this.settingsSaved = true;
  setTimeout(() => { this.settingsSaved = false; }, 2000);
},
```

Note: previously `saveSettings()` returned early (doing nothing) if the API base field was blank. This changes that to validate each field independently, so clearing/fixing one setting doesn't block saving the other.

### 8. `web/index.html` — refresh button (line 157)

```html
<button class="btn btn-sm" @click="loadVideos()" :disabled="videosLoading">
  <i class="ph-duotone ph-arrow-clockwise" :class="{ spin: videosLoading }"></i>
  <span x-text="videosLoading ? 'carregando...' : 'atualizar'"></span>
</button>
```

### 9. `web/index.html` — drop "arquivo" column, fix colspans, format date (lines 159-189)

- Remove `<th>arquivo</th>` (line 162).
- Remove `<td class="mono" x-text="v.inputFile?.key?.split('/').pop() || v.id"></td>` (line 174).
- Change the three state rows' `colspan="4"` → `colspan="3"` (lines 169-171).
- Gate the loading placeholder on an empty list so it doesn't appear stacked above stale rows during a background poll: `x-show="videosLoading && videos.length === 0"`.
- Update the date cell to use the new formatter: `<td style="color:var(--muted);font-size:11px" x-text="formatDate(v.createdAt)"></td>`.

Resulting block:

```html
<table class="table">
  <thead>
    <tr>
      <th>enviado em</th>
      <th>status</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr x-show="videosLoading && videos.length === 0"><td colspan="3" class="empty">carregando...</td></tr>
    <tr x-show="!videosLoading && videosError"><td colspan="3" class="empty" x-text="videosError"></td></tr>
    <tr x-show="!videosLoading && !videosError && videos.length === 0"><td colspan="3" class="empty">nenhum vídeo encontrado.</td></tr>
    <template x-for="v in videos" :key="v.id">
      <tr>
        <td style="color:var(--muted);font-size:11px" x-text="formatDate(v.createdAt)"></td>
        <td>
          <span class="badge" :class="'badge-' + v.status">
            <span class="dot"></span>
            <span x-text="STATUS_LABELS[v.status] || v.status"></span>
          </span>
        </td>
        <td>
          <button x-show="v.status === 'succeeded'" @click="downloadJob(v)" class="btn btn-sm"><i class="ph-duotone ph-download-simple"></i> download</button>
          <button x-show="v.status !== 'succeeded'" class="btn btn-sm" disabled><i class="ph-duotone ph-download-simple"></i> download</button>
        </td>
      </tr>
    </template>
  </tbody>
</table>
```

### 10. `web/index.html` — Settings page, add poll-interval field (lines 209-216)

Insert a new field after the API base field, before the save/reset buttons:

```html
<div class="field">
  <label>URL base da API</label>
  <input type="text" x-model="settingsApiBase" placeholder="https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/api" @keydown.enter="saveSettings()">
</div>
<div class="field">
  <label>Intervalo de atualização automática (segundos)</label>
  <input type="number" min="1" step="1" x-model.number="settingsPollInterval" placeholder="5" @keydown.enter="saveSettings()">
</div>
<div style="display:flex;gap:8px;align-items:center;margin-top:4px">
  <button class="btn btn-primary" @click="saveSettings()"><i class="ph-duotone ph-floppy-disk"></i> salvar</button>
  <button class="btn" @click="resetSettings()"><i class="ph-duotone ph-arrow-counter-clockwise"></i> restaurar padrões</button>
</div>
```

### 11. `web/style.css` — spin animation + number input styling

Add `input[type=number]` to the existing form selector (line 135):

```css
input[type=text], input[type=email], input[type=password], input[type=number] {
```

Add a spin keyframe near the buttons region (after line 188 `/* #endregion */` for buttons):

```css
@keyframes spin { to { transform: rotate(360deg); } }
.spin { display: inline-block; animation: spin 0.8s linear infinite; }
```

## Acceptance Criteria

- Clicking "atualizar" or waiting for an auto-refresh no longer blanks the table — existing rows stay visible until the new response replaces them.
- While `videosLoading` is true: the refresh button is disabled, its icon has the `spin` class (visibly rotating), and its label reads "carregando...". When not loading, it reads "atualizar" and is enabled.
- The videos table has exactly 3 columns: "enviado em", "status", and the actions column (no "arquivo" header or cell).
- A job with `createdAt: "2026-07-11T17:35:00Z"` renders as `11/07/2026 14:35` (or the equivalent local-timezone conversion for the test machine's TZ) in the "enviado em" column.
- Navigating to the Settings page shows an "intervalo de atualização automática (segundos)" number field defaulting to 5 (or the previously saved value); saving a new value (e.g. 10) persists it to `localStorage['fiapx_poll_interval']` and takes effect the next time the status page is entered; "restaurar padrões" resets it to 5 and removes the localStorage key.
- While on the status page, `loadVideos()` is invoked automatically every `config.POLL_INTERVAL_SEC` seconds without any user action.
- Navigating away from the status page (clicking another tab, browser back button, or logging out) stops the polling — no further `loadVideos()` calls occur until the status page is re-entered, and no interval keeps running indefinitely.

## Verification Steps

1. `docker compose up -d --build`, open http://localhost:8080, log in.
2. On the "vídeos" page, open browser DevTools console and temporarily confirm behavior by watching the Network tab: observe a `GET /v1/processing-jobs` request every 5 seconds (default) without the table flashing empty between requests.
3. Click "atualizar" manually — verify the icon spins, the button is disabled, and the label reads "carregando..." for the duration of the request, then reverts.
4. Confirm the table header only shows "enviado em", "status", and the actions column — no "arquivo" column.
5. Confirm the "enviado em" values render as `dd/mm/aaaa HH:MM` rather than raw ISO strings.
6. Go to Settings, change the auto-refresh interval to e.g. `10`, save, confirm the success banner, reload the page, return to Settings, and confirm the value persisted (also check `localStorage.getItem('fiapx_poll_interval')` in DevTools).
7. Return to the "vídeos" page and confirm refreshes now happen every 10 seconds (via Network tab timing).
8. Switch to another tab (e.g. "upload") or click logout while on the status page, then watch the Network tab for ~30 seconds — confirm no further `GET /v1/processing-jobs` requests fire, proving the interval was cleared.
9. Click "restaurar padrões" in Settings and confirm the interval field resets to `5` and the localStorage key is removed.

## Risks & Mitigations

- **Stale data shown after a failed background refresh**: since `loadVideos()` no longer clears `videos` before fetching, a failed poll leaves old rows on screen alongside the error message. This is the intended UX per the request (don't clear before load) — the error banner still clearly signals the failure.
- **Interval leak via a code path that sets `this.page` directly without going through `_setPage`**: verified no other call sites set `this.page` outside `go()`/`_navigate()` (both now routed through `_setPage`), so this is not a concern with the current codebase.
