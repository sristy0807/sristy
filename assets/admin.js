// Site dashboard: edits content.json, games.json and sync-games.json in sristy0807/sristy via the GitHub API.
{
const REPO = 'sristy0807/sristy', BRANCH = 'main', API = 'https://api.github.com';
const FILES = { content: 'content.json', games: 'games.json', sync: 'sync-games.json' };
const TAB_FILES = { profile: ['content'], work: ['content'], games: ['games'], publish: ['sync'] };

let token = '';
try { token = localStorage.getItem('site-dash-token') || sessionStorage.getItem('site-dash-token') || ''; } catch (e) {}
const data = {}, sha = {}, saved = {};
let tab = 'profile', runsTimer = null;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, err) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); setTimeout(() => t.remove(), err ? 6000 : 3000);
}

async function gh(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', ...(opts.headers || {}) } });
  if (!r.ok) {
    let m = r.status + ''; try { m = (await r.json()).message || m; } catch (e) {}
    if (r.status === 401) m = 'GitHub rejected the token. Check it hasn\'t expired.';
    if (r.status === 403 || r.status === 404) m += ' — check the token has access to this repo and the right permissions.';
    throw new Error(m);
  }
  return r.status === 204 ? null : r.json();
}

const b64ToText = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\n/g, '')), c => c.charCodeAt(0)));
const bytesToB64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const textToB64 = t => bytesToB64(new TextEncoder().encode(t));

async function load(key) {
  const f = await gh(`/repos/${REPO}/contents/${FILES[key]}?ref=${BRANCH}`);
  sha[key] = f.sha; data[key] = JSON.parse(b64ToText(f.content)); saved[key] = JSON.stringify(data[key]);
}
async function putFile(path, b64, message, fileSha) {
  return gh(`/repos/${REPO}/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message, content: b64, branch: BRANCH, ...(fileSha ? { sha: fileSha } : {}) }) });
}
async function saveKey(key) {
  const res = await putFile(FILES[key], textToB64(JSON.stringify(data[key], null, 2) + '\n'), `Dashboard: update ${FILES[key]}`, sha[key]);
  sha[key] = res.content.sha; saved[key] = JSON.stringify(data[key]);
}

const dirtyKeys = () => Object.keys(FILES).filter(k => data[k] && JSON.stringify(data[k]) !== saved[k]);
function refreshSavebar() {
  const d = dirtyKeys();
  $('savebar').classList.toggle('show', d.length > 0);
  $('savemsg').textContent = d.length ? `Unsaved changes in ${d.map(k => FILES[k]).join(', ')}.` : '';
}
addEventListener('beforeunload', e => { if (dirtyKeys().length) { e.preventDefault(); e.returnValue = ''; } });

// Bind inputs: data-bind="key.path.to.field" ; data-kind="lines" | "csv" | "num"
function getPath(obj, path) { return path.split('.').reduce((o, k) => o?.[k], obj); }
function setPath(obj, path, v) { const ks = path.split('.'), last = ks.pop(); const o = ks.reduce((o, k) => o[k], obj); o[last] = v; }
function fieldVal(v, kind) { return kind === 'lines' ? (v || []).join('\n') : kind === 'csv' ? (v || []).join(', ') : (v ?? ''); }
function parseVal(v, kind) {
  if (kind === 'lines') return v.split('\n').map(s => s.trim()).filter(Boolean);
  if (kind === 'csv') return v.split(',').map(s => s.trim()).filter(Boolean);
  if (kind === 'num') return v === '' ? '' : Number(v);
  return v;
}
const F = (label, bind, kind = '', type = 'input', extra = '') => {
  const [key, ...rest] = bind.split('.'), v = fieldVal(getPath(data[key], rest.join('.')), kind), id = 'f-' + bind.replace(/\W/g, '-');
  return `<label for="${id}">${label}</label>` + (type === 'textarea'
    ? `<textarea id="${id}" data-bind="${bind}" data-kind="${kind}" ${extra}>${esc(v)}</textarea>`
    : `<input id="${id}" data-bind="${bind}" data-kind="${kind}" value="${esc(v)}" ${kind === 'num' ? 'inputmode="numeric"' : ''} ${extra}>`);
};
function bindInputs() {
  $('panel').querySelectorAll('[data-bind]').forEach(el => el.addEventListener('input', () => {
    const [key, ...rest] = el.dataset.bind.split('.');
    setPath(data[key], rest.join('.'), parseVal(el.value, el.dataset.kind));
    refreshSavebar();
  }));
}
// List controls: data-list="key.path" data-i data-op="up|down|del"
function bindLists() {
  $('panel').querySelectorAll('[data-op]').forEach(b => b.onclick = () => {
    const [key, ...rest] = b.dataset.list.split('.'), arr = getPath(data[key], rest.join('.')), i = +b.dataset.i;
    if (b.dataset.op === 'del') { if (!confirmDel(b)) return; arr.splice(i, 1); }
    if (b.dataset.op === 'up' && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    if (b.dataset.op === 'down' && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    render(); refreshSavebar();
  });
  $('panel').querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
    const [key, ...rest] = b.dataset.add.split('.');
    getPath(data[key], rest.join('.')).push(JSON.parse(b.dataset.tpl));
    render(); refreshSavebar();
    const items = $('panel').querySelectorAll(`[data-listbox="${b.dataset.add}"] .item`);
    items[items.length - 1]?.querySelector('input,textarea')?.focus();
  });
}
// Two-tap delete instead of a blocking confirm() dialog.
function confirmDel(b) {
  if (b.dataset.armed) return true;
  b.dataset.armed = '1'; b.textContent = 'Delete?'; b.style.minWidth = '80px';
  setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = '✕'; b.style.minWidth = ''; } }, 2500);
  return false;
}
const ctrls = (list, i, label) => `<div class="head"><strong>${esc(label)}</strong>
  <button class="mini" data-list="${list}" data-i="${i}" data-op="up" aria-label="Move up">↑</button>
  <button class="mini" data-list="${list}" data-i="${i}" data-op="down" aria-label="Move down">↓</button>
  <button class="mini del" data-list="${list}" data-i="${i}" data-op="del" aria-label="Delete">✕</button></div>`;

// ---------- panels ----------
const PANELS = {
  profile() {
    return `<h2>Profile</h2><p class="hint">The text at the top and bottom of your site.</p>
      ${F('Name', 'content.name')}
      ${F('Headline', 'content.headline', '', 'textarea')}
      ${F('Intro paragraph', 'content.intro', '', 'textarea')}
      ${F('GitHub profile URL', 'content.github', '', 'input', 'type="url"')}
      ${F('What I work with', 'content.skills', '', 'textarea')}
      ${F('Clients line', 'content.clients', '', 'textarea')}
      ${F('Education (one per line)', 'content.education', 'lines', 'textarea')}
      ${F('Contact intro', 'content.contactIntro', '', 'textarea')}
      <h3 style="margin-top:2rem">Contact links</h3>
      <div data-listbox="content.links">${(data.content.links || []).map((l, i) => `<div class="item">${ctrls('content.links', i, l.label || 'New link')}
        <div class="grid2">${F('Text', `content.links.${i}.label`)}${F('Link (https://… or mailto:…)', `content.links.${i}.url`)}</div></div>`).join('')}</div>
      <button class="btn" data-add="content.links" data-tpl='{"label":"","url":""}'>Add link</button>
      ${F('Footer', 'content.footer')}`;
  },
  work() {
    return `<h2>Work history</h2><p class="hint">Newest first. Use the arrows to reorder.</p>
      <div data-listbox="content.work">${(data.content.work || []).map((w, i) => `<div class="item">${ctrls('content.work', i, w.title || 'New role')}
        <div class="grid2">${F('Role and company', `content.work.${i}.title`)}${F('Years', `content.work.${i}.when`)}</div>
        ${F('What you did', `content.work.${i}.text`, '', 'textarea')}</div>`).join('')}</div>
      <button class="btn" data-add="content.work" data-tpl='{"when":"","title":"","text":""}'>Add role</button>`;
  },
  games() {
    const g = data.games;
    return `<h2>Games</h2><p class="hint">Featured games get a big card with a Play button. "Play" is the game's folder on the site (e.g. <code>games/card-school/</code>) or a full URL.</p>
      <div data-listbox="games.featured">${g.featured.map((x, i) => `<div class="item">${ctrls('games.featured', i, x.title || 'New game')}
        <div class="grid3">${F('Title', `games.featured.${i}.title`)}${F('Year', `games.featured.${i}.year`, 'num')}${F('Engine', `games.featured.${i}.engine`)}</div>
        ${F('Description', `games.featured.${i}.description`, '', 'textarea')}
        ${F('Tags (comma separated)', `games.featured.${i}.tags`, 'csv')}
        ${F('Controls', `games.featured.${i}.controls`)}
        <div class="grid2">${F('Play (folder or URL)', `games.featured.${i}.play`)}${F('Source code URL', `games.featured.${i}.source`)}</div>
        ${F('Cover image path', `games.featured.${i}.thumbnail`)}
        <div class="row">${x.thumbnail ? `<img class="thumb" src="${esc(x.thumbnail)}" alt="">` : ''}
          <label class="btn" style="margin:0;font-weight:600">Upload cover<input type="file" accept="image/*" data-cover="${i}" hidden></label>
          <small class="hint" style="margin:0">16:10, resized to 1280 px wide JPEG</small></div></div>`).join('')}</div>
      <button class="btn" data-add="games.featured" data-tpl='{"title":"","year":${new Date().getFullYear()},"engine":"","description":"","tags":[],"controls":"","play":"","source":"","thumbnail":""}'>Add featured game</button>
      <h3 style="margin-top:2.5rem">Earlier projects</h3>
      <div data-listbox="games.archive">${g.archive.map((x, i) => `<div class="item">${ctrls('games.archive', i, x.title || 'New project')}
        <div class="grid3">${F('Title', `games.archive.${i}.title`)}${F('Year', `games.archive.${i}.year`, 'num')}${F('Engine', `games.archive.${i}.engine`)}</div>
        <div class="grid2">${F('Play (optional)', `games.archive.${i}.play`)}${F('Source code URL', `games.archive.${i}.source`)}</div></div>`).join('')}</div>
      <button class="btn" data-add="games.archive" data-tpl='{"title":"","year":${new Date().getFullYear()},"engine":"Unity","source":"","play":""}'>Add project</button>`;
  },
  publish() {
    return `<h2>Sync and publish</h2>
      <p class="hint">Each game lives in its own repo. When you push to that repo, its copy on this site updates automatically: straight away if the repo has the <b>SITE_TOKEN</b> secret, otherwise within 15 minutes. GitHub Pages then republishes the site in about a minute.</p>
      <div class="row" style="margin:0 0 1.5rem"><button class="btn primary" id="syncnow">Sync games now</button>
        <a class="btn" href="https://github.com/${REPO}/actions" target="_blank" rel="noopener">Open Actions</a></div>
      <h3>Recent activity</h3><ul class="runs" id="runs"><li><span></span><span>Loading…</span><span></span></li></ul>
      <h3 style="margin-top:2.5rem">Games that sync</h3>
      <p class="hint">Folder on this site ← repo it comes from. Files are copied from the repo's main branch.</p>
      <div data-listbox="sync.games">${data.sync.games.map((x, i) => `<div class="item">${ctrls('sync.games', i, x.folder || 'New game')}
        <div class="grid3">${F('Repo (owner/name)', `sync.games.${i}.repo`)}${F('Folder in games/', `sync.games.${i}.folder`)}${F('Files (comma separated)', `sync.games.${i}.files`, 'csv')}</div></div>`).join('')}</div>
      <button class="btn" data-add="sync.games" data-tpl='{"folder":"","repo":"sristy0807/","files":["index.html"]}'>Add game to sync</button>`;
  }
};

async function ensure(keys) {
  for (const k of keys) if (!data[k]) await load(k);
}
async function render() {
  clearInterval(runsTimer);
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  try { await ensure(TAB_FILES[tab]); } catch (e) { $('panel').innerHTML = `<p class="hint">Couldn't load ${esc(TAB_FILES[tab].map(k => FILES[k]).join(', '))}: ${esc(e.message)}</p>`; return; }
  $('panel').innerHTML = PANELS[tab]();
  bindInputs(); bindLists();
  $('panel').querySelectorAll('[data-cover]').forEach(inp => inp.onchange = () => uploadCover(+inp.dataset.cover, inp.files[0]));
  if (tab === 'publish') { $('syncnow').onclick = syncNow; loadRuns(); runsTimer = setInterval(loadRuns, 8000); }
}

// ---------- cover upload ----------
function slug(s) { return String(s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game'; }
async function uploadCover(i, file) {
  if (!file) return;
  const g = data.games.featured[i];
  try {
    const img = await createImageBitmap(file);
    const W = Math.min(1280, img.width), H = Math.round(W * 10 / 16);
    const c = Object.assign(document.createElement('canvas'), { width: W, height: H }), x = c.getContext('2d');
    const s = Math.max(W / img.width, H / img.height);
    x.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
    const b64 = bytesToB64(new Uint8Array(await blob.arrayBuffer()));
    const folder = (g.play && !/^https?:/.test(g.play)) ? g.play.replace(/\/?$/, '/') : `games/${slug(g.title)}/`;
    const path = folder + 'cover.jpg';
    let old; try { old = (await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`)).sha; } catch (e) {}
    toast('Uploading cover…');
    await putFile(path, b64, `Dashboard: cover for ${g.title}`, old);
    g.thumbnail = path; render(); refreshSavebar();
    toast('Cover uploaded. Save to show it on the site.');
  } catch (e) { toast('Cover upload failed: ' + e.message, true); }
}

// ---------- sync + activity ----------
async function syncNow() {
  try {
    await gh(`/repos/${REPO}/actions/workflows/sync-games.yml/dispatches`, { method: 'POST', body: JSON.stringify({ ref: BRANCH }) });
    toast('Sync started. It shows below in a few seconds.'); setTimeout(loadRuns, 4000);
  } catch (e) { toast('Could not start the sync: ' + e.message, true); }
}
const ago = t => { const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
async function loadRuns() {
  const el = $('runs'); if (!el) return;
  try {
    const r = await gh(`/repos/${REPO}/actions/runs?per_page=10`);
    const why = { schedule: 'scheduled', repository_dispatch: 'a game repo changed', workflow_dispatch: 'started by you', push: 'site files changed', dynamic: 'publish' };
    el.innerHTML = r.workflow_runs.map(w => {
      const st = w.status !== 'completed' ? 'run' : w.conclusion === 'success' ? 'ok' : w.conclusion === 'skipped' ? '' : 'bad';
      const name = w.name === 'pages-build-deployment' ? 'Publish site' : w.name;
      const res = w.status !== 'completed' ? 'running' : w.conclusion;
      return `<li><span class="dot ${st}" aria-hidden="true"></span><span><a href="${esc(w.html_url)}" target="_blank" rel="noopener">${esc(name)}</a> <small>${esc(why[w.event] || w.event)}</small></span><small>${esc(res)}, ${ago(w.created_at)}</small></li>`;
    }).join('') || '<li><span></span><span>No runs yet.</span><span></span></li>';
  } catch (e) { el.innerHTML = `<li><span class="dot bad"></span><span>${esc(e.message)}</span><span></span></li>`; }
}

// ---------- save ----------
$('save').onclick = async () => {
  const keys = dirtyKeys(); $('save').disabled = true;
  try {
    for (const k of keys) await saveKey(k);
    refreshSavebar(); toast('Saved. Your site updates in about a minute.');
  } catch (e) {
    toast('Save failed: ' + e.message + (/sha|match/i.test(e.message) ? ' Reload the page to get the latest version.' : ''), true);
  } finally { $('save').disabled = false; }
};
$('discard').onclick = () => { for (const k of dirtyKeys()) data[k] = JSON.parse(saved[k]); refreshSavebar(); render(); };

// ---------- sign in ----------
async function start() {
  try {
    await gh(`/repos/${REPO}`);
    $('login').hidden = true; $('app').hidden = false; $('logout').hidden = false;
    render();
  } catch (e) {
    $('login').hidden = false; $('app').hidden = true;
    if (token) toast(e.message, true);
  }
}
$('connect').onclick = () => {
  token = $('token').value.trim(); if (!token) return toast('Paste your token first.', true);
  try { ($('remember').checked ? localStorage : sessionStorage).setItem('site-dash-token', token); } catch (e) {}
  start();
};
$('token').addEventListener('keydown', e => { if (e.key === 'Enter') $('connect').click(); });
$('logout').onclick = () => {
  try { localStorage.removeItem('site-dash-token'); sessionStorage.removeItem('site-dash-token'); } catch (e) {}
  location.reload();
};
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });

if (token) start();
}
