// Renders games.json into the Games section.
(function () {
  const featuredEl = document.getElementById('featured');
  const archiveEl = document.getElementById('archive');

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => { u = String(u || '').trim(); return /^(https?:\/\/|mailto:)/i.test(u) || /^[\w.\/-]+$/.test(u) ? u : ''; };
  const playHref = g => !g.play ? '' : /^(https?:\/\/|games\/)/i.test(g.play) ? (g.play ? (/^https?:/.test(g.play) ? g.play : `play.html?game=${encodeURIComponent(g.play)}&title=${encodeURIComponent(g.title || '')}`) : '') : '';

  // A generated cover for games without a thumbnail: a seeded block mosaic.
  function cover(title) {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 400;
    const x = c.getContext('2d');
    let s = 0; for (const ch of String(title || 'Game')) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const pal = ['#0d171d', '#16232b', '#2a52d4', '#e5a634', '#e6ecea', '#3c6b8f'];
    x.fillStyle = pal[0]; x.fillRect(0, 0, 640, 400);
    const cell = 40;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 10; j++) {
      const r = rnd();
      if (r < .55) continue;
      x.fillStyle = r > .97 ? pal[3] : r > .9 ? pal[2] : r > .8 ? pal[5] : pal[1];
      x.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
    }
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  function renderFeatured(list) {
    featuredEl.innerHTML = '';
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const g = { ...raw, title: String(raw.title || 'Untitled game'), tags: Array.isArray(raw.tags) ? raw.tags : raw.tags ? String(raw.tags).split(',') : [] };
      try {
      const art = document.createElement('article');
      art.className = 'game';
      const meta = [g.engine, g.year].filter(Boolean).join(', ');
      art.innerHTML = `
        <div class="cover">${g.thumbnail ? `<img src="${esc(g.thumbnail)}" alt="" loading="lazy">` : ''}</div>
        <div class="body">
          <h3>${esc(g.title)}</h3>
          <p class="meta">${esc(meta)}</p>
          <p class="desc">${esc(g.description)}</p>
          ${g.tags?.length ? `<ul class="tags">${g.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          ${g.controls ? `<p class="controls">${esc(g.controls)}</p>` : ''}
          <div class="actions">
            ${playHref(g) ? `<a class="btn primary" href="${esc(playHref(g))}">Play ${esc(g.title)}</a>` : ''}
            ${safeUrl(g.source) ? `<a class="btn" href="${esc(safeUrl(g.source))}">View source</a>` : ''}
          </div>
        </div>`;
      if (!g.thumbnail) art.querySelector('.cover').appendChild(cover(g.title));
      featuredEl.appendChild(art);
      } catch (e) { console.warn('Skipped a game entry', raw, e); }
    }
    if (!featuredEl.children.length) featuredEl.innerHTML = '<p class="section-intro">No games listed yet.</p>';
  }

  function renderArchive(list) {
    archiveEl.innerHTML = list.filter(g => g && typeof g === 'object')
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .map(g => `
        <li>
          <span class="t">${esc(g.title || 'Untitled')}</span>
          <span class="y">${esc(g.year)}</span>
          <span class="e">${esc(g.engine)}</span>
          <span class="l">
            ${playHref(g) ? `<a class="play" href="${esc(playHref(g))}">Play</a>` : ''}
            ${safeUrl(g.source) ? `<a href="${esc(safeUrl(g.source))}">Source</a>` : ''}
          </span>
        </li>`).join('');
  }

  fetch('games.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => {
      renderFeatured(Array.isArray(d.featured) ? d.featured : []);
      renderArchive(Array.isArray(d.archive) ? d.archive : []);
    })
    .catch(() => {
      featuredEl.innerHTML = '<p>Games list could not load. Check that games.json is valid JSON and the page is served over http (not opened as a file).</p>';
    });
})();

// Site text from content.json (edited in the dashboard, admin.html).
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const text = (id, v) => { if ($(id) && v != null) $(id).textContent = v; };
  fetch('content.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject()).then(c => {
    text('c-name', c.name); text('c-footer', c.footer);
    if (c.name) document.title = c.name;
    if (Array.isArray(c.work) && $('c-work')) $('c-work').innerHTML = c.work.map(w =>
      `<li><span class="when">${esc(w.when)}</span><div><h3>${esc(w.title)}</h3><p>${esc(w.text)}</p></div></li>`).join('');
    const safeUrl = u => { u = String(u || '').trim(); return /^(https?:\/\/|mailto:)/i.test(u) ? u : ''; };
    if (Array.isArray(c.links) && $('c-links')) { const ls = c.links.filter(l => l && safeUrl(l.url)); if (ls.length) $('c-links').innerHTML = ls.map(l =>
      `<li><a href="${esc(safeUrl(l.url))}" rel="me">${esc(l.label || l.url)}</a></li>`).join(''); }
    if (safeUrl(c.github)) document.querySelectorAll('a[href="https://github.com/sristy0807"]').forEach(a => a.href = safeUrl(c.github));
  }).catch(() => { /* keep the text already in the HTML */ });
})();
