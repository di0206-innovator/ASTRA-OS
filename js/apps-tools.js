// ==========================================
// Astra OS Tool Applications
// ==========================================

// ==========================================
// 1. Browser Simulator
// ==========================================
window.AstraApps.browser = function(container, ui) {
  let currentUrl = 'astra://newtab';
  let history = ['astra://newtab'];
  let historyIndex = 0;

  const bookmarks = [
    { name: 'Google', url: 'https://google.com' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Stack Overflow', url: 'https://stackoverflow.com' },
    { name: 'MDN', url: 'https://mdn.mozilla.org' }
  ];

  const pages = {
    'astra://newtab': () => `
      <div class="browser-newtab">
        <div class="browser-newtab-logo">△ Astra</div>
        <div class="browser-newtab-search">
          <input type="text" class="browser-newtab-input" placeholder="Search the web or enter URL...">
        </div>
        <div class="browser-newtab-tiles">
          ${bookmarks.map(b => '<a class="browser-tile" data-url="' + b.url + '"><div class="browser-tile-icon">' + b.name[0] + '</div><div class="browser-tile-label">' + window.escapeHTML(b.name) + '</div></a>').join('')}
        </div>
      </div>
    `,
    'astra://settings': () => html`<div class="browser-page"><h2>⚙ Redirecting to Settings...</h2><p>Opening Settings app...</p></div>`,
    'google.com': () => `
      <div class="browser-page browser-google">
        <div class="browser-page-header"><h1 style="font-size: 48px; letter-spacing: -1px"><span style="color:#4285f4">G</span><span style="color:#ea4335">o</span><span style="color:#fbbc05">o</span><span style="color:#4285f4">g</span><span style="color:#34a853">l</span><span style="color:#ea4335">e</span></h1></div>
        <div class="browser-search-bar"><input type="text" placeholder="Search Google or type a URL" disabled><button>Search</button></div>
        <div class="browser-page-footer">Astra OS Simulated Browser — This is not a real webpage.</div>
      </div>
    `,
    'github.com': () => `
      <div class="browser-page browser-github">
        <div class="browser-gh-header">
          <span style="font-size: 24px; font-weight: 700">GitHub</span>
          <span style="color: var(--text-muted)">Where the world builds software</span>
        </div>
        <div class="browser-gh-hero">
          <h2>Let's build from here</h2>
          <p>The AI-powered developer platform to build, scale, and deliver secure software.</p>
          <div class="browser-gh-stats">
            <div class="gh-stat"><span class="gh-stat-num">100M+</span><span>Developers</span></div>
            <div class="gh-stat"><span class="gh-stat-num">420M+</span><span>Repositories</span></div>
            <div class="gh-stat"><span class="gh-stat-num">90%</span><span>Fortune 100</span></div>
          </div>
        </div>
      </div>
    `,
    'stackoverflow.com': () => `
      <div class="browser-page browser-so">
        <div class="browser-so-header">
          <span style="font-size: 20px; font-weight: 700">Stack<span style="color: #f48024">Overflow</span></span>
        </div>
        <div class="browser-so-content">
          <h2>Every developer has a tab open to Stack Overflow</h2>
          <div class="browser-so-questions">
            <div class="so-question"><span class="so-votes">247</span><span>How do I undo the most recent local commits in Git?</span></div>
            <div class="so-question"><span class="so-votes">189</span><span>What does the "yield" keyword do in Python?</span></div>
            <div class="so-question"><span class="so-votes">156</span><span>What is the difference between "==" and "===" in JavaScript?</span></div>
            <div class="so-question"><span class="so-votes">134</span><span>How can I remove a specific item from an array?</span></div>
          </div>
        </div>
      </div>
    `,
    'mdn.mozilla.org': () => `
      <div class="browser-page browser-mdn">
        <div class="browser-mdn-header"><span style="font-size: 22px; font-weight: 700">MDN Web Docs</span></div>
        <div class="browser-mdn-content">
          <h2>Resources for Developers, by Developers</h2>
          <p>Documenting web technologies, including CSS, HTML, and JavaScript, since 2005.</p>
          <div class="mdn-cards">
            <div class="mdn-card"><h4>HTML</h4><p>The backbone of web content</p></div>
            <div class="mdn-card"><h4>CSS</h4><p>Style and layout web pages</p></div>
            <div class="mdn-card"><h4>JavaScript</h4><p>Dynamic client-side scripting</p></div>
          </div>
        </div>
      </div>
    `
  };

  function render() {
    window.renderSafeHTML(container, `
      <div class="browser-app">
        <div class="browser-toolbar">
          <div class="browser-nav-btns">
            <button class="browser-nav-btn" id="br-back" ${historyIndex === 0 ? 'disabled' : ''}>◀</button>
            <button class="browser-nav-btn" id="br-forward" ${historyIndex >= history.length - 1 ? 'disabled' : ''}>▶</button>
            <button class="browser-nav-btn" id="br-refresh">⟳</button>
          </div>
          <input class="browser-url-bar" id="br-url" value="${currentUrl}" spellcheck="false">
          <button class="browser-nav-btn" id="br-go">→</button>
        </div>
        <div class="browser-bookmarks">
          ${bookmarks.map(b => '<button class="browser-bm-chip" data-url="' + b.url + '">' + window.escapeHTML(b.name) + '</button>').join('')}
        </div>
        <div class="browser-viewport" id="br-viewport"></div>
      </div>
    `);

    // Events
    container.querySelector('#br-back')?.addEventListener('click', goBack);
    container.querySelector('#br-forward')?.addEventListener('click', goForward);
    container.querySelector('#br-refresh')?.addEventListener('click', () => navigate(currentUrl));
    container.querySelector('#br-go')?.addEventListener('click', () => navigate(container.querySelector('#br-url').value));
    container.querySelector('#br-url')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(e.target.value); });
    container.querySelectorAll('.browser-bm-chip').forEach(c => c.addEventListener('click', () => navigate(c.getAttribute('data-url'))));

    renderPage();
  }

  function navigate(url) {
    url = url.trim();
    if (!url.includes('://') && !url.startsWith('astra://')) url = 'https://' + url;
    currentUrl = url;
    if (historyIndex < history.length - 1) history = history.slice(0, historyIndex + 1);
    history.push(url);
    historyIndex = history.length - 1;
    const urlInput = container.querySelector('#br-url');
    if (urlInput) urlInput.value = url;
    
    // Check for astra:// protocol
    if (url === 'astra://settings') {
      ui.openApp('settings');
      return;
    }

    renderPage();
    updateNavButtons();
  }

  function goBack() {
    if (historyIndex > 0) { historyIndex--; currentUrl = history[historyIndex]; renderPage(); updateNavButtons(); }
    const urlInput = container.querySelector('#br-url');
    if (urlInput) urlInput.value = currentUrl;
  }

  function goForward() {
    if (historyIndex < history.length - 1) { historyIndex++; currentUrl = history[historyIndex]; renderPage(); updateNavButtons(); }
    const urlInput = container.querySelector('#br-url');
    if (urlInput) urlInput.value = currentUrl;
  }

  function updateNavButtons() {
    const back = container.querySelector('#br-back');
    const fwd = container.querySelector('#br-forward');
    if (back) back.disabled = historyIndex === 0;
    if (fwd) fwd.disabled = historyIndex >= history.length - 1;
  }

  function renderPage() {
    const vp = container.querySelector('#br-viewport');
    if (!vp) return;
    const host = currentUrl.replace(/^https?:\/\//, '').replace(/^astra:\/\//, 'astra://').split('/')[0];
    const key = currentUrl.startsWith('astra://') ? currentUrl : host;
    const pageGenerator = pages[key];
    if (pageGenerator) {
      window.renderSafeHTML(vp, pageGenerator());
    } else {
      window.renderSafeHTML(vp, `
        <div class="browser-page browser-404">
          <h2>🌐 ${host}</h2>
          <p>This site can't be reached — Simulated DNS did not resolve.</p>
          <p style="color: var(--text-muted); font-size: 12px">ERR_NAME_NOT_RESOLVED</p>
        </div>
      `);
    }
    // Bind new tab search
    const ntInput = vp.querySelector('.browser-newtab-input');
    if (ntInput) ntInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.value.trim()) navigate(e.target.value.trim()); });
    // Bind tile clicks
    vp.querySelectorAll('.browser-tile').forEach(t => t.addEventListener('click', () => navigate(t.getAttribute('data-url'))));
  }

  render();
};

// ==========================================
// 2. App Store
// ==========================================
window.AstraApps.appstore = function(container, ui) {
  let searchQuery = '';
  let installing = null;

  function render() {
    const kernel = window.AstraKernel;
    if (!kernel) return;
    const pkgs = searchQuery ? kernel.aptSearch(searchQuery) : kernel.aptList();
    const categories = [...new Set(pkgs.map(p => p.category))];
    let appStoreGridHTML = '';
    categories.forEach(cat => {
      let cardsHTML = '';
      pkgs.filter(p => p.category === cat).forEach(p => {
        const actionHTML = installing === p.name ? '<div class="appstore-installing">Installing...</div>' : 
          p.installed ? '<span class="appstore-installed">✓ Installed</span>' : 
          '<button class="btn btn-primary btn-sm" data-pkg="' + window.escapeHTML(p.name) + '">Install</button>';
        
        cardsHTML += `
          <div class="appstore-card">
            <div class="appstore-card-icon">${getPackageIcon(p.name)}</div>
            <div class="appstore-card-info">
              <div class="appstore-card-name">${window.escapeHTML(p.name)}</div>
              <div class="appstore-card-ver">v${p.version}</div>
              <div class="appstore-card-desc">${p.description}</div>
            </div>
            <div class="appstore-card-action">
              ${actionHTML}
            </div>
          </div>
        `;
      });

      appStoreGridHTML += `
        <div class="appstore-category">
          <div class="appstore-cat-title">${cat.toUpperCase()}</div>
          <div class="appstore-cards">
            ${cardsHTML}
          </div>
        </div>
      `;
    });

    window.renderSafeHTML(container, `
      <div class="appstore-app">
        <div class="appstore-header">
          <h3>App Store</h3>
          <input class="appstore-search" placeholder="Search packages..." id="as-search" value="${searchQuery}">
        </div>
        <div class="appstore-grid">
          ${appStoreGridHTML}
        </div>
      </div>
    `);

    container.querySelector('#as-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
    });

    container.querySelectorAll('[data-pkg]').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-pkg');
        installing = name;
        render();
        setTimeout(() => {
          const result = kernel.aptInstall(name);
          installing = null;
          if (result.success) {
            ui.showToast('Package Installed', `${name} has been installed successfully.`, 'success');
            ui.state.addNotification('success', 'App Store', `Installed ${name}`);
          }
          render();
        }, 1500);
      });
    });
  }

  function getPackageIcon(name) {
    const icons = {
      neofetch: '🖥', cowsay: '🐄', fortune: '🔮', htop: '📊', git: '🔀', python: '🐍', gcc: '⚙',
      vim: '📝', nano: '📄', wget: '⬇', tree: '🌳', sl: '🚂', figlet: '🔤', lolcat: '🌈',
      bat: '🦇', jq: '📋', fzf: '🔍', tmux: '🪟', nmap: '🗺', whois: '🔎', curl: '🔗',
      nodejs: '💚', npm: '📦'
    };
    return Reflect.get(icons, name) || '📦';
  }

  render();
};

// ==========================================
// 3. Notification Center Viewer
// ==========================================
window.AstraApps.notifcenter = function(container, ui) {
  let filter = 'all';

  function render() {
    const notifs = ui.state.notifications.slice().reverse();
    const filtered = filter === 'all' ? notifs :
      filter === 'errors' ? notifs.filter(n => n.type === 'error') :
      filter === 'agent' ? notifs.filter(n => n.source.includes('Agent') || n.source === 'astrad') :
      notifs.filter(n => n.type !== 'error' && !n.source.includes('Agent'));

    let notifListHTML = '';
    if (filtered.length === 0) {
      notifListHTML = '<div class="notifcenter-empty">No notifications</div>';
    } else {
      filtered.forEach(n => {
        const icon = n.type === 'error' ? '🔴' : n.type === 'warning' ? '🟡' : n.type === 'success' ? '🟢' : '🔵';
        const unreadClass = n.read ? '' : 'unread';
        notifListHTML += `
          <div class="notif-item ${unreadClass}">
            <div class="notif-icon">${icon}</div>
            <div class="notif-body">
              <div class="notif-source">${n.source}</div>
              <div class="notif-msg">${n.message}</div>
            </div>
            <div class="notif-time">${n.time}</div>
          </div>
        `;
      });
    }

    window.renderSafeHTML(container, `
      <div class="notifcenter-app">
        <div class="notifcenter-header">
          <h3>Notifications</h3>
          <div class="notifcenter-actions">
            <button class="btn btn-secondary btn-sm" id="nc-markread">Mark All Read</button>
            <button class="btn btn-secondary btn-sm" id="nc-clearall">Clear All</button>
          </div>
        </div>
        <div class="notifcenter-tabs">
          ${['all', 'agent', 'system', 'errors'].map(t =>
            '<button class="nc-tab ' + (t === filter ? 'active' : '') + '" data-filter="' + t + '">' + (t.charAt(0).toUpperCase() + t.slice(1)) + '</button>'
          ).join('')}
        </div>
        <div class="notifcenter-list">
          ${notifListHTML}
        </div>
      </div>
    `);

    container.querySelectorAll('.nc-tab').forEach(tab => {
      tab.addEventListener('click', () => { filter = tab.getAttribute('data-filter'); render(); });
    });
    container.querySelector('#nc-markread')?.addEventListener('click', () => { ui.state.markAllNotificationsRead(); ui.updateNotifBadge(); render(); });
    container.querySelector('#nc-clearall')?.addEventListener('click', () => { ui.state.notifications = []; ui.state.saveState(); ui.updateNotifBadge(); render(); });
  }

  render();
};
