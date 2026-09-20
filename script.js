/* Browser widget - script.js (Cloudflare Proxy & HTML Engine Fixed) */

(() => {
  const KEY_BM = 'browser_bookmarks_v1';
  const KEY_HIST = 'browser_history_v1';
  const KEY_SETTINGS = 'browser_settings_v1';

  // Your Cloudflare Worker Proxy URL
  const CUSTOM_PROXY_URL = 'https://dhur.mdadibalzian.workers.dev/?url=';

  const DEFAULT_ENGINES = [
    { name: 'DuckDuckGo (Lite)', url: 'https://html.duckduckgo.com/html/?q=' },
    { name: 'Bing', url: 'https://www.bing.com/search?q=' },
    { name: 'Google', url: 'https://www.google.com/search?q=' },
    { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=' }
  ];

  const DEFAULT_BOOKMARKS = [
    { title: 'Wikipedia', url: 'https://wikipedia.org' },
    { title: 'DuckDuckGo', url: 'https://html.duckduckgo.com/html/' },
    { title: 'Bing', url: 'https://www.bing.com' }
  ];

  let bookmarks = [];
  let historyEntries = [];
  let settings = { engineUrl: DEFAULT_ENGINES[0].url, customEngines: [] };
  let editMode = false;

  // Navigation stacks
  const navStack = [];
  const fwdStack = [];

  // Inject View Screen dynamically if not present
  let screenView = document.getElementById('screen-view');
  if (!screenView) {
    screenView = document.createElement('main');
    screenView.className = 'screen';
    screenView.id = 'screen-view';
    screenView.setAttribute('data-screen', 'view');
    screenView.innerHTML = `
      <div id="page-content" style="padding: 6px; overflow-y: auto; height: 100%; font-size: 12px; line-height: 1.4; color: #eee; word-break: break-word;"></div>
    `;
    const appContainer = document.getElementById('app');
    const softkeyBar = document.querySelector('.softkey-bar');
    appContainer.insertBefore(screenView, softkeyBar);
  }

  const pageContent = document.getElementById('page-content');

  const screens = {
    home: document.getElementById('screen-home'),
    menu: document.getElementById('screen-menu'),
    address: document.getElementById('screen-address'),
    history: document.getElementById('screen-history'),
    view: screenView
  };

  const el = (id) => document.getElementById(id);
  const searchInput = el('search-input');
  const btnGo = el('btn-go');
  const engineSelect = el('engine-select');
  const bmList = el('bm-list');
  const app = el('app');
  const btnEditToggle = el('btn-edit-toggle');
  const addBmForm = el('add-bm-form');
  const bmTitleInput = el('bm-title');
  const bmUrlInput = el('bm-url');
  const btnSaveBm = el('btn-save-bm');
  const menuList = el('menu-list');
  const directInput = el('direct-input');
  const btnDirectGo = el('btn-direct-go');
  const histList = el('hist-list');
  const btnClearHistory = el('btn-clear-history');
  const btnLsk = el('btn-lsk');
  const btnRsk = el('btn-rsk');
  const statusEl = el('status');
  const clockEl = el('clock');

  // Persistence
  function safeGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function loadAll() {
    bookmarks = safeGet(KEY_BM, null);
    if (!Array.isArray(bookmarks)) bookmarks = DEFAULT_BOOKMARKS.slice();
    historyEntries = safeGet(KEY_HIST, []);
    if (!Array.isArray(historyEntries)) historyEntries = [];
    const s = safeGet(KEY_SETTINGS, null);
    if (s && typeof s === 'object') settings = Object.assign(settings, s);
  }
  function saveBookmarks(){ safeSet(KEY_BM, bookmarks); }
  function saveHistory(){ safeSet(KEY_HIST, historyEntries); }
  function saveSettings(){ safeSet(KEY_SETTINGS, settings); }

  // Status
  let statusTimer = null;
  function setStatus(text) {
    statusEl.textContent = text || '';
    if (statusTimer) clearTimeout(statusTimer);
    if (text) statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 3000);
  }

  // FIXED: Smart URL Normalizer & Search Fallback
  function normalizeUrl(u) {
    if (!u) return '';
    u = u.trim();
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    
    // Check if it looks like a valid domain (e.g. example.com)
    if (u.includes('.') && !u.includes(' ')) {
      return 'https://' + u;
    }
    
    // Fallback: treat as a search query
    const engine = settings.engineUrl || DEFAULT_ENGINES[0].url;
    return engine + encodeURIComponent(u);
  }

  function addHistory(title, url) {
    historyEntries.push({ title: title || url, url, time: Date.now() });
    if (historyEntries.length > 300) historyEntries.shift();
    saveHistory();
    renderHistory();
  }

  // FIXED: Fetch and Load page through Cloudflare Worker Proxy with Base URL Injection
  function openUrl(targetUrl, title) {
    const fullUrl = normalizeUrl(targetUrl);
    addHistory(title || fullUrl, fullUrl);
    showScreen('view');

    pageContent.innerHTML = '<div style="text-align:center; padding-top: 20px;">Loading page...</div>';
    setStatus('Loading…');

    const proxiedReqUrl = CUSTOM_PROXY_URL + encodeURIComponent(fullUrl);

    fetch(proxiedReqUrl)
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then((html) => {
        // Inject <base> tag so relative CSS, images, and links resolve correctly
        const baseTag = `<base href="${fullUrl}">`;
        let cleanHtml = html;
        if (cleanHtml.includes('<head>')) {
          cleanHtml = cleanHtml.replace('<head>', `<head>${baseTag}`);
        } else {
          cleanHtml = baseTag + cleanHtml;
        }

        pageContent.innerHTML = cleanHtml;
        setStatus('Loaded');

        // Intercept inner links to load via proxy
        const links = pageContent.querySelectorAll('a');
        links.forEach((a) => {
          a.addEventListener('click', (e) => {
            e.preventDefault();
            const href = a.getAttribute('href');
            if (href && !href.startsWith('javascript:')) {
              try {
                const resolved = new URL(href, fullUrl).href;
                openUrl(resolved);
              } catch (err) {
                openUrl(href);
              }
            }
          });
        });

        // Intercept Form Submissions (e.g., search boxes inside pages)
        const forms = pageContent.querySelectorAll('form');
        forms.forEach((form) => {
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            const action = form.getAttribute('action') || '';
            const method = (form.getAttribute('method') || 'GET').toUpperCase();
            
            try {
              const target = new URL(action, fullUrl).href;
              if (method === 'GET') {
                const formData = new FormData(form);
                const params = new URLSearchParams(formData).toString();
                const finalTarget = target + (target.includes('?') ? '&' : '?') + params;
                openUrl(finalTarget);
              }
            } catch (err) {
              console.error('Form submit error', err);
            }
          });
        });

      })
      .catch((err) => {
        pageContent.innerHTML = `<div style="color:#ff6b6b; padding:10px;">Failed to load page.<br><br><small>${err.message}</small></div>`;
        setStatus('Error loading page');
      });
  }

  // Search Engine
  function allEngines() {
    return DEFAULT_ENGINES.concat(settings.customEngines || []);
  }
  function renderEngines() {
    engineSelect.innerHTML = '';
    allEngines().forEach((eng) => {
      const opt = document.createElement('option');
      opt.value = eng.url;
      opt.textContent = eng.name;
      engineSelect.appendChild(opt);
    });
    const addOpt = document.createElement('option');
    addOpt.value = '__add__';
    addOpt.textContent = '+ Add engine…';
    engineSelect.appendChild(addOpt);
    engineSelect.value = settings.engineUrl;
  }
  function addCustomEngine() {
    const name = (prompt('Search engine name:') || '').trim();
    if (!name) { engineSelect.value = settings.engineUrl; return; }
    const base = (prompt('Search URL:', 'https://') || '').trim();
    if (!base) { engineSelect.value = settings.engineUrl; return; }
    settings.customEngines = settings.customEngines || [];
    settings.customEngines.push({ name, url: base });
    settings.engineUrl = base;
    saveSettings();
    renderEngines();
    setStatus('Engine added');
  }

  function performSearch(query) {
    if (!query || !query.trim()) { setStatus('Enter a search term'); return; }
    const engine = settings.engineUrl || DEFAULT_ENGINES[0].url;
    const searchUrl = engine + encodeURIComponent(query.trim());
    openUrl(searchUrl, query.trim());
  }

  // Bookmarks
  function renderBookmarks() {
    bmList.innerHTML = '';
    if (bookmarks.length === 0) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="empty-note">No bookmarks yet.</span>';
      bmList.appendChild(li);
      return;
    }
    bookmarks.forEach((b, i) => {
      const li = document.createElement('li');

      const idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = (i + 1) + '.';

      const a = document.createElement('a');
      a.href = b.url;
      a.textContent = b.title || b.url;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (editMode) return;
        openUrl(b.url, b.title);
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove';
      removeBtn.textContent = '✕';
      removeBtn.setAttribute('aria-label', 'Remove bookmark');
      removeBtn.addEventListener('click', () => {
        bookmarks.splice(i, 1);
        saveBookmarks();
        renderBookmarks();
        setStatus('Bookmark removed');
      });

      li.appendChild(idx);
      li.appendChild(a);
      li.appendChild(removeBtn);
      bmList.appendChild(li);
    });
  }

  function addBookmarkInline() {
    const title = bmTitleInput.value.trim();
    const url = bmUrlInput.value.trim();
    if (!title || !url) { setStatus('Title and URL required'); return; }
    bookmarks.push({ title, url: normalizeUrl(url) });
    saveBookmarks();
    renderBookmarks();
    bmTitleInput.value = '';
    bmUrlInput.value = '';
    setStatus('Bookmark added');
  }

  function setEditMode(on) {
    editMode = !!on;
    app.classList.toggle('edit-mode', editMode);
    updateRsk();
  }

  // History
  function renderHistory() {
    histList.innerHTML = '';
    if (historyEntries.length === 0) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="empty-note">No history yet.</span>';
      histList.appendChild(li);
      return;
    }
    historyEntries.slice().reverse().forEach((h) => {
      const li = document.createElement('li');
      const meta = document.createElement('div');
      meta.className = 'meta';
      const a = document.createElement('a');
      a.href = h.url;
      a.textContent = h.title || h.url;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        openUrl(h.url, h.title);
      });

      const time = document.createElement('div');
      time.className = 'time';
      time.textContent = new Date(h.time).toLocaleString();
      meta.appendChild(a);
      meta.appendChild(time);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        const idx = historyEntries.indexOf(h);
        if (idx > -1) { historyEntries.splice(idx, 1); saveHistory(); renderHistory(); }
      });

      li.appendChild(meta);
      li.appendChild(removeBtn);
      histList.appendChild(li);
    });
  }

  // Navigation
  function currentScreenName() {
    const cur = document.querySelector('.screen.active');
    return cur ? cur.getAttribute('data-screen') : 'home';
  }

  function updateRsk() {
    btnRsk.textContent = currentScreenName() === 'home' ? (editMode ? 'Done' : 'Edit') : 'Back';
  }

  function activate(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
    updateRsk();
    if (name === 'menu') renderMenu();
    if (name === 'address') { try { directInput.focus(); } catch (e) {} }
  }

  function showScreen(name) {
    if (!screens[name]) return;
    const cur = currentScreenName();
    if (cur !== name) {
      navStack.push(cur);
      fwdStack.length = 0;
    }
    activate(name);
  }

  function goBackward() {
    if (currentScreenName() === 'home' && editMode) { setEditMode(false); return; }
    if (navStack.length === 0) { setStatus('At start page'); return; }
    const cur = currentScreenName();
    const prev = navStack.pop();
    fwdStack.push(cur);
    activate(prev);
  }

  function goForward() {
    if (fwdStack.length === 0) { setStatus('No next page'); return; }
    const cur = currentScreenName();
    const next = fwdStack.pop();
    navStack.push(cur);
    activate(next);
  }

  function handleRsk() {
    if (currentScreenName() === 'home') { setEditMode(!editMode); return; }
    goBackward();
  }

  function openMenu() { showScreen('menu'); }

  // Menu
  function renderMenu() {
    const items = [
      { action: 'bookmarks', label: 'Bookmarks' },
      { action: 'enteraddress', label: 'Enter address' },
      { action: 'startpage', label: 'Start page' },
      { action: 'history', label: 'History' }
    ];
    if (navStack.length > 0) items.push({ action: 'backward', label: 'Backward' });
    if (fwdStack.length > 0) items.push({ action: 'forward', label: 'Forward' });
    items.push({ action: 'reload', label: 'Reload' });
    items.push({ action: 'exit', label: 'Exit' });

    menuList.innerHTML = '';
    items.forEach((it, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'menu-item';
      btn.setAttribute('data-action', it.action);
      btn.innerHTML = '<span class="num">' + (i + 1) + '</span> ' + it.label;
      li.appendChild(btn);
      menuList.appendChild(li);
    });
    const first = menuList.querySelector('.menu-item');
    if (first) try { first.focus(); } catch (e) {}
  }

  function handleMenuAction(action) {
    switch (action) {
      case 'bookmarks':
        setEditMode(true);
        showScreen('home');
        break;
      case 'enteraddress':
        showScreen('address');
        break;
      case 'startpage':
        setEditMode(false);
        showScreen('home');
        break;
      case 'history':
        showScreen('history');
        break;
      case 'backward':
        goBackward();
        break;
      case 'forward':
        goForward();
        break;
      case 'reload':
        if (currentScreenName() === 'view' && navStack.length > 0) {
          const lastEntry = historyEntries[historyEntries.length - 1];
          if (lastEntry) openUrl(lastEntry.url, lastEntry.title);
        } else {
          location.reload();
        }
        break;
      case 'exit':
        setStatus('Exiting…');
        setTimeout(() => {
          try { window.close(); } catch (e) {}
          setStatus('Cannot exit — close manually');
        }, 300);
        break;
    }
  }

  // Clock
  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Events
  function wireEvents() {
    btnLsk.addEventListener('click', openMenu);
    btnRsk.addEventListener('click', handleRsk);

    btnGo.addEventListener('click', () => performSearch(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); performSearch(searchInput.value); }
    });

    engineSelect.addEventListener('change', (e) => {
      if (e.target.value === '__add__') { addCustomEngine(); return; }
      settings.engineUrl = e.target.value;
      saveSettings();
      setStatus('Search engine set');
    });

    btnEditToggle.addEventListener('click', () => setEditMode(!editMode));
    btnSaveBm.addEventListener('click', addBookmarkInline);
    addBmForm.addEventListener('submit', (e) => { e.preventDefault(); addBookmarkInline(); });

    menuList.addEventListener('click', (e) => {
      const item = e.target.closest('.menu-item');
      if (item) handleMenuAction(item.getAttribute('data-action'));
    });

    btnDirectGo.addEventListener('click', () => {
      const v = directInput.value.trim();
      if (!v) { setStatus('Enter an address'); return; }
      openUrl(v);
      directInput.value = '';
    });
    directInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); btnDirectGo.click(); }
    });

    btnClearHistory.addEventListener('click', () => {
      historyEntries = [];
      saveHistory();
      renderHistory();
      setStatus('History cleared');
    });

    document.addEventListener('keydown', (e) => {
      const t = e.target;
      const isTyping = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
      if (['Escape', 'SoftLeft', 'MenuKey', 'F1'].includes(e.key) && !isTyping) {
        e.preventDefault(); openMenu(); return;
      }
      if (['SoftRight', 'F2', 'Backspace'].includes(e.key) && !isTyping) {
        e.preventDefault(); handleRsk(); return;
      }
      if (currentScreenName() === 'menu' && /^[1-8]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const btns = Array.from(menuList.querySelectorAll('.menu-item'));
        if (btns[idx]) { e.preventDefault(); btns[idx].click(); }
      }
    });
  }

  function init() {
    loadAll();
    renderEngines();
    renderBookmarks();
    renderHistory();
    wireEvents();
    updateClock();
    setInterval(updateClock, 30000);
    updateRsk();
    try { searchInput.focus(); } catch (e) {}
  }

  init();
})();
