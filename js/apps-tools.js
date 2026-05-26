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
            if (name === 'astroid') {
              ui.addDockShortcut('astroid', 'Astro Defender Game', '🎮');
            } else if (name === 'pulsewave') {
              ui.addDockShortcut('pulsewave', 'PulseWave Ambient Player', '🎵');
            }
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
      nodejs: '💚', npm: '📦', astroid: '🎮', pulsewave: '🎵'
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

// ==========================================
// 4. Daily Briefing & Evening Wrap-up App
// ==========================================
window.AstraApps.dailybriefing = function(container, ui) {
  let activeTab = 'morning';
  const quotes = [
    { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
    { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
    { text: "Make it simple, but significant.", author: "Don Draper" },
    { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
    { text: "Quality is not an act, it is a habit.", author: "Aristotle" }
  ];
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  function render() {
    const state = ui.state;
    const projectPath = '/home/divyanshu/Project_Astra';
    
    if (window.AstraKernel && !Reflect.get(state.gitRepos, projectPath)) {
      window.AstraKernel.gitInit(projectPath);
    }

    const tasks = state.agentTasks || [];
    const focusMode = state.registry?.system?.focusMode || 'none';
    const activeProject = state.systemVars?.activeProject || 'None';

    let contentHTML = '';

    if (activeTab === 'morning') {
      let tasksListHTML = '';
      if (tasks.length === 0) {
        tasksListHTML = '<div class="dailybriefing-empty">No tasks scheduled for today.</div>';
      } else {
        tasks.forEach(t => {
          const isCompleted = t.status === 'completed';
          const checkbox = isCompleted ? '☑' : '☐';
          tasksListHTML += `
            <div class="db-task-item ${isCompleted ? 'completed' : ''}">
              <span class="db-task-check">${checkbox}</span>
              <span class="db-task-title"><strong>${window.escapeHTML(t.title)}</strong> - ${window.escapeHTML(t.desc)}</span>
              <span class="db-task-tag ${t.status}">${t.status}</span>
            </div>
          `;
        });
      }

      const pendingTask = tasks.find(t => t.status !== 'completed');
      const priorityText = pendingTask 
        ? `Focus on completing: <strong>${window.escapeHTML(pendingTask.title)}</strong> (Assigned to ${window.escapeHTML(pendingTask.assigned || 'Agent')}).` 
        : 'All tasks completed! Start planning the next iteration.';

      contentHTML = `
        <div class="dailybriefing-card">
          <h4>🌅 Welcome, Divyanshu</h4>
          <p>Active Project: <strong>${window.escapeHTML(activeProject)}</strong> | Focus: <strong>${window.escapeHTML(focusMode.toUpperCase())}</strong></p>
          <div class="dailybriefing-quote">
            "${window.escapeHTML(quote.text)}" — <em>${window.escapeHTML(quote.author)}</em>
          </div>
        </div>
        <div class="dailybriefing-card">
          <h4>📋 Today's Schedule & Tasks</h4>
          <div class="dailybriefing-tasks-list">
            ${tasksListHTML}
          </div>
        </div>
        <div class="dailybriefing-card">
          <h4>💡 Suggested Focus & Priorities</h4>
          <p>${priorityText}</p>
          <p style="font-size: 12px; color: var(--text-muted);">
            Focus Tip: ${focusMode === 'deepwork' ? 'DND is active. Focus on coding blocks without interruption.' : 'Consider switching to Deep Work mode for distraction-free implementation.'}
          </p>
        </div>
      `;
    } else {
      const completedTasks = tasks.filter(t => t.status === 'completed');
      let accomplishmentsHTML = '';
      if (completedTasks.length === 0) {
        accomplishmentsHTML = '<p>No tasks marked completed today. Let\'s make progress tomorrow!</p>';
      } else {
        completedTasks.forEach(t => {
          accomplishmentsHTML += `
            <div class="db-task-item completed">
              <span class="db-task-check">☑</span>
              <span class="db-task-title"><strong>${window.escapeHTML(t.title)}</strong> - ${window.escapeHTML(t.desc)}</span>
            </div>
          `;
        });
      }

      let gitStatusHTML = '';
      let repoFilesHTML = '';
      if (window.AstraKernel) {
        const statusLines = window.AstraKernel.gitStatus(projectPath);
        gitStatusHTML = statusLines.slice(0, 2).map(l => `<div>${window.escapeHTML(l)}</div>`).join('');
        
        const repo = Reflect.get(state.gitRepos, projectPath);
        if (repo) {
          const dir = state.resolvePath(projectPath);
          const allFiles = window.AstraKernel.getFilesRecursive ? window.AstraKernel.getFilesRecursive(dir, projectPath) : [];
          const lastCommitFiles = repo.commits.length > 0 ? Reflect.get(repo.commits, repo.commits.length - 1).files : [];
          
          const modified = allFiles.filter(f => !repo.staged.includes(f) && lastCommitFiles.includes(f));
          const untracked = allFiles.filter(f => !repo.staged.includes(f) && !lastCommitFiles.includes(f));
          const staged = repo.staged || [];

          if (modified.length === 0 && untracked.length === 0 && staged.length === 0) {
            repoFilesHTML = '<div class="dailybriefing-empty">Working tree is clean. No files modified.</div>';
          } else {
            staged.forEach(f => {
              repoFilesHTML += `
                <div class="db-file-item">
                  <span>${window.escapeHTML(f)}</span>
                  <span class="db-file-status new">staged (new)</span>
                </div>
              `;
            });
            modified.forEach(f => {
              repoFilesHTML += `
                <div class="db-file-item">
                  <span>${window.escapeHTML(f)}</span>
                  <span class="db-file-status modified">modified</span>
                </div>
              `;
            });
            untracked.forEach(f => {
              repoFilesHTML += `
                <div class="db-file-item">
                  <span>${window.escapeHTML(f)}</span>
                  <span class="db-file-status untracked">untracked</span>
                </div>
              `;
            });
          }
        }
      } else {
        repoFilesHTML = '<div>Virtual Git Engine offline.</div>';
      }

      const nodes = state.memoryGraph?.nodes || [];
      const recentMemories = nodes.slice(-3).map(n => `<li>${window.escapeHTML(n.label)}</li>`).join('');
      const memoriesHTML = recentMemories ? `<ul>${recentMemories}</ul>` : '<p>No new memories recorded this session.</p>';

      contentHTML = `
        <div class="dailybriefing-card">
          <h4>🏆 Today's Accomplishments</h4>
          <div class="dailybriefing-tasks-list">
            ${accomplishmentsHTML}
          </div>
        </div>
        <div class="dailybriefing-card">
          <h4>📦 Git Repository Status</h4>
          <div style="font-family: var(--font-mono); font-size: 11px; margin-bottom: 8px; color: var(--text-secondary);">
            ${gitStatusHTML}
          </div>
          <div class="dailybriefing-modified-list">
            ${repoFilesHTML}
          </div>
        </div>
        <div class="dailybriefing-card">
          <h4>🧠 Memories & Context Learned</h4>
          ${memoriesHTML}
        </div>
      `;
    }

    window.renderSafeHTML(container, `
      <div class="dailybriefing-app">
        <div class="dailybriefing-header">
          <h3>📅 Daily Briefing</h3>
          <button class="btn btn-primary btn-sm" id="db-export">Export to Documents</button>
        </div>
        <div class="dailybriefing-tabs">
          <button class="db-tab ${activeTab === 'morning' ? 'active' : ''}" id="db-tab-morning">Morning Agenda</button>
          <button class="db-tab ${activeTab === 'evening' ? 'active' : ''}" id="db-tab-evening">Evening Wrap-up</button>
        </div>
        <div class="dailybriefing-content">
          ${contentHTML}
        </div>
      </div>
    `);

    container.querySelector('#db-tab-morning')?.addEventListener('click', () => {
      activeTab = 'morning';
      render();
    });
    container.querySelector('#db-tab-evening')?.addEventListener('click', () => {
      activeTab = 'evening';
      render();
    });
    container.querySelector('#db-export')?.addEventListener('click', () => {
      exportBriefingDoc();
    });
  }

  function exportBriefingDoc() {
    const state = ui.state;
    const projectPath = '/home/divyanshu/Project_Astra';
    const focusMode = state.registry?.system?.focusMode || 'none';
    const activeProject = state.systemVars?.activeProject || 'None';
    const dateStr = new Date().toLocaleString();

    let md = `# Daily Briefing — Astra OS\n`;
    md += `**Timestamp**: ${dateStr}\n`;
    md += `**User**: Divyanshu\n`;
    md += `**Active Project**: ${activeProject}\n`;
    md += `**Focus Mode**: ${focusMode.toUpperCase()}\n\n`;

    md += `## 🌅 Morning Agenda\n`;
    md += `- **Quote of the Day**: "${quote.text}" — ${quote.author}\n`;
    md += `- **Active Tasks**:\n`;
    const tasks = state.agentTasks || [];
    if (tasks.length === 0) {
      md += `  - No tasks scheduled.\n`;
    } else {
      tasks.forEach(t => {
        const check = t.status === 'completed' ? '[x]' : '[ ]';
        md += `  - ${check} ${t.title}: ${t.desc} (${t.status})\n`;
      });
    }

    md += `\n## ## 🌃 Evening Wrap-up\n`;
    const completed = tasks.filter(t => t.status === 'completed');
    md += `- **Accomplishments**:\n`;
    if (completed.length === 0) {
      md += `  - No tasks completed today.\n`;
    } else {
      completed.forEach(t => {
        md += `  - ${t.title}: ${t.desc}\n`;
      });
    }

    md += `\n- **Git Repository Status**:\n`;
    if (window.AstraKernel) {
      const repo = Reflect.get(state.gitRepos, projectPath);
      if (repo) {
        const dir = state.resolvePath(projectPath);
        const allFiles = window.AstraKernel.getFilesRecursive ? window.AstraKernel.getFilesRecursive(dir, projectPath) : [];
        const lastCommitFiles = repo.commits.length > 0 ? Reflect.get(repo.commits, repo.commits.length - 1).files : [];
        const modified = allFiles.filter(f => !repo.staged.includes(f) && lastCommitFiles.includes(f));
        const untracked = allFiles.filter(f => !repo.staged.includes(f) && !lastCommitFiles.includes(f));
        const staged = repo.staged || [];

        md += `  - Branch: ${repo.branch}\n`;
        md += `  - Staged files: ${staged.length > 0 ? staged.join(', ') : 'none'}\n`;
        md += `  - Modified files: ${modified.length > 0 ? modified.join(', ') : 'none'}\n`;
        md += `  - Untracked files: ${untracked.length > 0 ? untracked.join(', ') : 'none'}\n`;
      } else {
        md += `  - Git repository not initialized.\n`;
      }
    } else {
      md += `  - Git engine offline.\n`;
    }

    md += `\n- **Memories Recorded**:\n`;
    const nodes = state.memoryGraph?.nodes || [];
    if (nodes.length === 0) {
      md += `  - No memories recorded.\n`;
    } else {
      nodes.slice(-5).forEach(n => {
        md += `  - ${n.label}\n`;
      });
    }

    const filePath = '/home/divyanshu/Documents/daily_briefings.md';
    window.Astra.syscall('fs:write', filePath, md)
      .then(() => {
        ui.showToast('Briefing Exported', `Saved to ${filePath}`, 'success');
        state.addNotification('success', 'Daily Briefing', `Exported briefing to ${filePath}`);
      })
      .catch(err => {
        ui.showToast('Export Failed', err.message, 'error');
      });
  }

  render();
};

// ==========================================
// 5. Trust & Safety Dashboard App
// ==========================================
window.AstraApps.trust = function(container, ui) {
  let activeTab = 'policies';
  let searchQuery = '';
  let filterType = 'all';
  let filterLevel = 'all';

  function computeDiff(oldText, newText) {
    const oldLines = oldText ? oldText.split('\n') : [];
    const newLines = newText ? newText.split('\n') : [];
    
    let diffHTML = '';
    if (oldLines.length === 0) {
      return newLines.map(line => `<div style="color: #34d399; background: rgba(52,211,153,0.05); padding: 2px 4px; border-radius: 2px; font-family: var(--font-mono); font-size: 11px;">+ ${window.escapeHTML(line)}</div>`).join('');
    }
    
    let i = 0, j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length) {
        if (oldLines[i] === newLines[j]) {
          diffHTML += `<div style="color: var(--text-secondary); padding: 2px 4px; font-family: var(--font-mono); font-size: 11px;">&nbsp; ${window.escapeHTML(oldLines[i])}</div>`;
          i++;
          j++;
        } else {
          let foundMatch = false;
          for (let k = j + 1; k < Math.min(j + 8, newLines.length); k++) {
            if (oldLines[i] === newLines[k]) {
              for (let addIdx = j; addIdx < k; addIdx++) {
                diffHTML += `<div style="color: #34d399; background: rgba(52,211,153,0.05); padding: 2px 4px; border-radius: 2px; font-family: var(--font-mono); font-size: 11px;">+ ${window.escapeHTML(newLines[addIdx])}</div>`;
              }
              j = k;
              foundMatch = true;
              break;
            }
          }
          if (!foundMatch) {
            for (let k = i + 1; k < Math.min(i + 8, oldLines.length); k++) {
              if (oldLines[k] === newLines[j]) {
                for (let delIdx = i; delIdx < k; delIdx++) {
                  diffHTML += `<div style="color: #ef4444; background: rgba(239,68,68,0.05); padding: 2px 4px; text-decoration: line-through; border-radius: 2px; font-family: var(--font-mono); font-size: 11px;">- ${window.escapeHTML(oldLines[delIdx])}</div>`;
                }
                i = k;
                foundMatch = true;
                break;
              }
            }
          }
          if (!foundMatch) {
            diffHTML += `<div style="color: #ef4444; background: rgba(239,68,68,0.05); padding: 2px 4px; text-decoration: line-through; border-radius: 2px; font-family: var(--font-mono); font-size: 11px;">- ${window.escapeHTML(oldLines[i])}</div>`;
            diffHTML += `<div style="color: #34d399; background: rgba(52,211,153,0.05); padding: 2px 4px; border-radius: 2px; font-family: var(--font-mono); font-size: 11px;">+ ${window.escapeHTML(newLines[j])}</div>`;
            i++;
            j++;
          }
        }
      } else if (i < oldLines.length) {
        diffHTML += `<div style="color: #ef4444; background: rgba(239,68,68,0.05); padding: 2px 4px; text-decoration: line-through; border-radius: 2px; font-family: var(--font-mono); font-size: 11px;">- ${window.escapeHTML(oldLines[i])}</div>`;
        i++;
      } else if (j < newLines.length) {
        diffHTML += `<div style="color: #34d399; background: rgba(52,211,153,0.05); padding: 2px 4px; border-radius: 2px; font-family: var(--font-mono); font-size: 11px;">+ ${window.escapeHTML(newLines[j])}</div>`;
        j++;
      }
    }
    return diffHTML;
  }

  // Listen to Bus events to automatically update the dashboard
  const unsubApprovals = window.AstraBus?.on('approvals.changed', () => {
    render();
  });
  const unsubFs = window.AstraBus?.on('fs.changed', () => {
    if (activeTab === 'rollback') render();
  });
  const unsubFsDel = window.AstraBus?.on('fs.deleted', () => {
    if (activeTab === 'rollback') render();
  });

  const checkInterval = setInterval(() => {
    if (!document.body.contains(container)) {
      clearInterval(checkInterval);
      unsubApprovals?.();
      unsubFs?.();
      unsubFsDel?.();
    }
  }, 1000);

  function render() {
    const state = ui.state;
    const safety = state.registry.safety || {
      writePolicy: 'ask',
      commandPolicy: 'ask',
      networkPolicy: 'approve',
      settingsPolicy: 'ask',
      confidenceThreshold: 85
    };
    
    const safeModeActive = state.registry.security?.safeMode === true;
    const safetyLevel = safeModeActive ? "🛡️ SAFE MODE ENABLED" : "100% SECURE";
    const systemRisk = safeModeActive ? "MINIMAL" : "LOW";
    const safetyAgentVerdict = safeModeActive
      ? "Safe Mode active: All agent VFS writes and process spawning are blocked."
      : "Astra is operating within authorized security boundaries.";
    
    const pendingCount = state.approvalsQueue ? state.approvalsQueue.length : 0;
    
    let activeTabContent = '';
    
    if (activeTab === 'policies') {
      activeTabContent = `
        <div class="trust-grid">
          <div class="trust-panel">
            <h4>Agent Autonomy Policies</h4>
            <div class="trust-policy-row">
              <span class="trust-policy-label">File Modification (Write)</span>
              <select class="trust-policy-select" id="policy-write">
                <option value="ask" ${safety.writePolicy === 'ask' ? 'selected' : ''}>Always Ask Approval</option>
                <option value="approve" ${safety.writePolicy === 'approve' ? 'selected' : ''}>Auto-Approve Bounded</option>
                <option value="deny" ${safety.writePolicy === 'deny' ? 'selected' : ''}>Deny Autonomous Edit</option>
              </select>
            </div>
            <div class="trust-policy-row">
              <span class="trust-policy-label">Terminal Execution (Command)</span>
              <select class="trust-policy-select" id="policy-command">
                <option value="ask" ${safety.commandPolicy === 'ask' ? 'selected' : ''}>Always Ask Approval</option>
                <option value="approve" ${safety.commandPolicy === 'approve' ? 'selected' : ''}>Auto-Approve Safe</option>
                <option value="deny" ${safety.commandPolicy === 'deny' ? 'selected' : ''}>Deny Commands</option>
              </select>
            </div>
            <div class="trust-policy-row">
              <span class="trust-policy-label">Network Access</span>
              <select class="trust-policy-select" id="policy-network">
                <option value="ask" ${safety.networkPolicy === 'ask' ? 'selected' : ''}>Always Ask Approval</option>
                <option value="approve" ${safety.networkPolicy === 'approve' ? 'selected' : ''}>Allow Secure Only</option>
                <option value="deny" ${safety.networkPolicy === 'deny' ? 'selected' : ''}>Block Internet</option>
              </select>
            </div>
            <div class="trust-policy-row">
              <span class="trust-policy-label">Modify System Settings</span>
              <select class="trust-policy-select" id="policy-settings">
                <option value="ask" ${safety.settingsPolicy === 'ask' ? 'selected' : ''}>Always Ask Approval</option>
                <option value="approve" ${safety.settingsPolicy === 'approve' ? 'selected' : ''}>Auto-Approve Non-Core</option>
                <option value="deny" ${safety.settingsPolicy === 'deny' ? 'selected' : ''}>Block All Changes</option>
              </select>
            </div>
            <div class="trust-policy-row" style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; margin-top: 4px;">
              <span class="trust-policy-label" style="font-weight: bold; color: var(--color-amber);">System Safe Mode</span>
              <select class="trust-policy-select" id="policy-safemode" style="border-color: var(--color-amber); color: var(--color-amber); font-weight: 500;">
                <option value="false" ${!safeModeActive ? 'selected' : ''}>Disabled (Normal)</option>
                <option value="true" ${safeModeActive ? 'selected' : ''}>Enabled (Blocks Agent Writes)</option>
              </select>
            </div>
          </div>

          <div class="trust-panel">
            <h4>Safety Agent Context</h4>
            <p style="font-size: 13px; margin: 2px 0;">Risk Level Assessment: <strong style="color: ${safeModeActive ? 'var(--color-primary)' : 'var(--color-green)'};">${systemRisk}</strong></p>
            
            <div class="trust-slider-container">
              <div class="trust-slider-label">
                <span>Confidence Threshold Escalation</span>
                <span id="threshold-val"><strong>${safety.confidenceThreshold}%</strong></span>
              </div>
              <input type="range" class="trust-slider" id="threshold-slider" min="50" max="100" value="${safety.confidenceThreshold}">
            </div>
            
            <p style="font-size: 12px; color: var(--text-muted); line-height: 1.4; margin-top: 4px;">
              <em>Verdict: ${safetyAgentVerdict}</em>
              <br>
              Confidence score below <strong>${safety.confidenceThreshold}%</strong> forces uncertainty escalation and prompts the user for approval.
            </p>
          </div>
        </div>
      `;
    } else if (activeTab === 'manifests') {
      const manifests = state.registry.appManifests || {};
      let manifestsHTML = '';
      Object.entries(manifests).forEach(([appName, manifest]) => {
        const perms = manifest.permissions || [];
        const sandbox = manifest.sandbox || [];
        const isAgent = appName.toLowerCase().includes('agent') || appName === 'AstraAgent';
        const badgeColor = isAgent ? 'var(--color-amber)' : 'var(--color-primary)';
        
        manifestsHTML += `
          <div class="trust-panel" style="margin-bottom: 12px; gap: 8px; background: var(--bg-glass-light); border: 1px solid var(--border-glass);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px; margin-bottom: 4px;">
              <span style="font-weight: 600; font-size: 13px; color: ${badgeColor}; font-family: var(--font-mono);">${window.escapeHTML(appName)}</span>
              <span style="font-size: 9px; padding: 2px 6px; border-radius: 10px; background: ${isAgent ? 'rgba(245,158,11,0.1)' : 'rgba(168,85,247,0.1)'}; color: ${badgeColor}; border: 1px solid ${isAgent ? 'rgba(245,158,11,0.2)' : 'rgba(168,85,247,0.2)'}; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">${isAgent ? 'Agent' : 'System App'}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Permissions:</span>
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px;">
                  ${perms.length === 0 ? '<span style="color: var(--text-muted); font-size: 11px; font-style: italic;">None</span>' : perms.map(p => `<span style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; padding: 1px 5px; font-family: var(--font-mono); font-size: 10px; color: var(--text-primary);">${window.escapeHTML(p)}</span>`).join('')}
                </div>
              </div>
              <div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">VFS Sandbox Paths:</span>
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px;">
                  ${sandbox.length === 0 ? '<span style="color: var(--text-muted); font-size: 11px; font-style: italic;">None</span>' : sandbox.map(s => `<span style="background: rgba(6,182,212,0.04); border: 1px solid rgba(6,182,212,0.15); border-radius: 4px; padding: 1px 5px; font-family: var(--font-mono); font-size: 10px; color: #67e8f9;">${window.escapeHTML(s)}</span>`).join('')}
                </div>
              </div>
            </div>
          </div>
        `;
      });
      activeTabContent = `
        <div class="trust-panel" style="flex-grow: 1; overflow: hidden; display: flex; flex-direction: column; gap: 10px;">
          <h4>Application & Agent Security Manifests</h4>
          <p style="font-size: 11.5px; color: var(--text-secondary); margin: 0; line-height: 1.4;">
            Every utility and autonomous agent declared in the registry runs under a manifest-based security policy, constraining its allowed syscall interfaces and sandboxed virtual filesystem scopes.
          </p>
          <div style="flex-grow: 1; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 8px;">
            ${manifestsHTML}
          </div>
        </div>
      `;
    } else if (activeTab === 'approvals') {
      const queue = state.approvalsQueue || [];
      let approvalsListHTML = '';
      if (queue.length === 0) {
        approvalsListHTML = '<div class="dailybriefing-empty">🛡️ No pending approvals required.</div>';
      } else {
        queue.forEach(appr => {
          const isDestructive = appr.callName.includes('delete') || appr.callName.includes('kill');
          const panelStyle = isDestructive ? 'border-color: var(--color-red); background: rgba(239,68,68,0.02);' : '';
          
          let diffHTML = '';
          if (appr.callName === 'fs:write') {
            const filePath = appr.args[0];
            const node = state.resolvePath(filePath);
            const oldText = node && node.type === 'file' ? (node.content || '') : '';
            const newText = appr.args[1] || '';
            diffHTML = computeDiff(oldText, newText);
          }

          approvalsListHTML += `
            <div class="db-file-item" style="flex-direction: column; align-items: stretch; gap: 8px; margin-bottom: 8px; background: var(--bg-glass-light); border: 1px solid var(--border-glass); ${panelStyle}">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><strong>${window.escapeHTML(appr.callerId)}</strong> requested <code>${window.escapeHTML(appr.callName)}</code></span>
                <span style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">${new Date(appr.timestamp).toLocaleTimeString()}</span>
              </div>
              <div style="font-size: 12px; color: var(--text-secondary);">Target: <code>${window.escapeHTML(String(appr.args[0]))}</code></div>
              ${appr.callName === 'fs:write' ? `
                <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary); margin: 6px 0 2px 0;">Proposed Code Patch Diff:</div>
                <div style="font-family: var(--font-mono); font-size:11px; background: rgba(0,0,0,0.3); padding: 8px; border-radius:4px; max-height:160px; overflow-y:auto; margin:4px 0; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 2px; text-align: left;">
                  ${diffHTML}
                </div>
              ` : ''}
              <div style="display: flex; gap: 8px; margin-top: 4px;">
                <button class="btn btn-sm btn-approve" data-id="${appr.id}" style="background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">✓ Approve</button>
                <button class="btn btn-sm btn-deny" data-id="${appr.id}" style="background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">✕ Deny</button>
              </div>
            </div>
          `;
        });
      }
      activeTabContent = `
        <div class="trust-panel">
          <h4>Pending Approvals Inbox</h4>
          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; padding-right: 4px;">
            ${approvalsListHTML}
          </div>
        </div>
      `;
    } else if (activeTab === 'rollback') {
      let rollbackRowsHTML = '';
      const orchestrator = ui.orchestrator;
      const snapshots = orchestrator ? orchestrator.vfsSnapshots : {};
      const modifiedPaths = Object.keys(snapshots || {});

      if (modifiedPaths.length === 0) {
        rollbackRowsHTML = '<div class="dailybriefing-empty">No files modified in the current session.</div>';
      } else {
        modifiedPaths.forEach(path => {
          rollbackRowsHTML += `
            <div class="db-file-item">
              <span style="font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-grow:1; max-width: 180px;">${window.escapeHTML(path)}</span>
              <button class="btn btn-secondary btn-sm trust-rollback-btn" data-path="${window.escapeHTML(path)}" style="border-color: var(--color-amber); color: var(--color-amber); background: rgba(245,158,11,0.05); padding: 2px 6px; font-size: 11px;">
                ↩ Rollback
              </button>
            </div>
          `;
        });
      }
      activeTabContent = `
        <div class="trust-panel">
          <h4>Active File Rollback Center</h4>
          <div class="dailybriefing-tasks-list" style="max-height: 250px; overflow-y: auto;">
            ${rollbackRowsHTML}
          </div>
        </div>
      `;
    } else if (activeTab === 'journal') {
      const logs = state.eventLog || [];
      const filteredLogs = logs.filter(log => {
        const matchesQuery = !searchQuery || JSON.stringify(log).toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'all' || log.type.startsWith(filterType);
        const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
        return matchesQuery && matchesType && matchesLevel;
      });

      let journalRowsHTML = '';
      if (filteredLogs.length === 0) {
        journalRowsHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No matching log events.</td></tr>';
      } else {
        filteredLogs.slice(-50).reverse().forEach(log => {
          const isWarning = log.level === 'WARN' || log.type.includes('fail') || log.type.includes('denied');
          const isError = log.level === 'ERROR';
          const rowStyle = isError ? 'color: var(--color-red);' : (isWarning ? 'color: var(--color-amber);' : '');
          
          let detailStr = '';
          if (log.detail) {
            if (typeof log.detail === 'string') {
              detailStr = log.detail;
            } else {
              detailStr = JSON.stringify(log.detail);
              if (detailStr.length > 80) detailStr = detailStr.slice(0, 80) + '...';
            }
          }
          
          journalRowsHTML += `
            <tr style="${rowStyle}">
              <td style="font-family: var(--font-mono); font-size: 11px; white-space: nowrap;">${new Date(log.timestamp).toLocaleTimeString()}</td>
              <td><strong>${window.escapeHTML(log.source)}</strong></td>
              <td><span style="font-family: var(--font-mono); font-size:11px;">${window.escapeHTML(log.type)}</span></td>
              <td><span style="font-weight:bold; font-size:10px;">${window.escapeHTML(log.level || 'INFO')}</span></td>
              <td style="font-size:11.5px; overflow:hidden; text-overflow:ellipsis; max-width: 250px;" title="${window.escapeHTML(JSON.stringify(log.detail))}">
                ${window.escapeHTML(detailStr)}
              </td>
            </tr>
          `;
        });
      }

      activeTabContent = `
        <div class="trust-panel" style="overflow-x: auto;">
          <h4>System Journal Auditor</h4>
          <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
            <input type="text" class="explorer-search" id="journal-search" placeholder="Search logs..." style="width: 180px; margin-left: 0;" value="${window.escapeHTML(searchQuery)}">
            <select class="trust-policy-select" id="journal-filter-type">
              <option value="all" ${filterType === 'all' ? 'selected' : ''}>All Subsystems</option>
              <option value="kernel" ${filterType === 'kernel' ? 'selected' : ''}>Kernel</option>
              <option value="security" ${filterType === 'security' ? 'selected' : ''}>Security</option>
              <option value="fs" ${filterType === 'fs' ? 'selected' : ''}>Filesystem</option>
              <option value="workflow" ${filterType === 'workflow' ? 'selected' : ''}>Workflow</option>
              <option value="agent" ${filterType === 'agent' ? 'selected' : ''}>Agent</option>
            </select>
            <select class="trust-policy-select" id="journal-filter-level">
              <option value="all" ${filterLevel === 'all' ? 'selected' : ''}>All Levels</option>
              <option value="INFO" ${filterLevel === 'INFO' ? 'selected' : ''}>INFO</option>
              <option value="WARN" ${filterLevel === 'WARN' ? 'selected' : ''}>WARNING</option>
              <option value="ERROR" ${filterLevel === 'ERROR' ? 'selected' : ''}>ERROR</option>
            </select>
            <button class="btn btn-secondary btn-sm" id="journal-clear-btn" style="padding: 4px 8px; font-size: 11px;">Clear Search</button>
          </div>
          <div style="max-height: 250px; overflow-y: auto;">
            <table class="trust-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Level</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                ${journalRowsHTML}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    window.renderSafeHTML(container, `
      <div class="trust-app">
        <div class="trust-header">
          <h3>🛡️ Trust & Safety Dashboard</h3>
          <span style="font-size: 11.5px; color: var(--text-secondary);">Security Context: <strong>${safetyLevel}</strong></span>
        </div>

        <div class="trust-tabs" style="display: flex; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid var(--border-glass); padding-bottom: 8px;">
          <button class="btn trust-tab ${activeTab === 'policies' ? 'active' : ''}" data-tab="policies" style="background: ${activeTab === 'policies' ? 'var(--bg-glass-light)' : 'transparent'}; border: none; color: var(--text-primary); cursor: pointer; padding: 6px 12px; border-radius: 4px; font-size: 12px;">Autonomy Policies</button>
          <button class="btn trust-tab ${activeTab === 'manifests' ? 'active' : ''}" data-tab="manifests" style="background: ${activeTab === 'manifests' ? 'var(--bg-glass-light)' : 'transparent'}; border: none; color: var(--text-primary); cursor: pointer; padding: 6px 12px; border-radius: 4px; font-size: 12px;">App Permissions</button>
          <button class="btn trust-tab ${activeTab === 'approvals' ? 'active' : ''}" data-tab="approvals" style="background: ${activeTab === 'approvals' ? 'var(--bg-glass-light)' : 'transparent'}; border: none; color: var(--text-primary); cursor: pointer; padding: 6px 12px; border-radius: 4px; font-size: 12px;">
            Approvals Inbox <span id="trust-pending-badge" style="background: var(--color-amber); color: #000; font-size: 10px; font-weight: bold; border-radius: 10px; padding: 1px 6px; margin-left: 4px; display: ${pendingCount > 0 ? 'inline-block' : 'none'};">${pendingCount}</span>
          </button>
          <button class="btn trust-tab ${activeTab === 'rollback' ? 'active' : ''}" data-tab="rollback" style="background: ${activeTab === 'rollback' ? 'var(--bg-glass-light)' : 'transparent'}; border: none; color: var(--text-primary); cursor: pointer; padding: 6px 12px; border-radius: 4px; font-size: 12px;">File Rollback</button>
          <button class="btn trust-tab ${activeTab === 'journal' ? 'active' : ''}" data-tab="journal" style="background: ${activeTab === 'journal' ? 'var(--bg-glass-light)' : 'transparent'}; border: none; color: var(--text-primary); cursor: pointer; padding: 6px 12px; border-radius: 4px; font-size: 12px;">System Journal</button>
        </div>
        
        <div class="trust-content">
          ${activeTabContent}
        </div>
      </div>
    `);

    // Tab Navigation Wireup
    container.querySelectorAll('.trust-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.getAttribute('data-tab');
        render();
      });
    });

    // Policies Tab Event Handlers
    if (activeTab === 'policies') {
      container.querySelectorAll('.trust-policy-select').forEach(select => {
        select.addEventListener('change', () => {
          if (select.id === 'policy-safemode') {
            const isSafe = select.value === 'true';
            if (!state.registry.security) state.registry.security = {};
            state.registry.security.safeMode = isSafe;
            state.saveState();
            ui.showToast('Safe Mode Updated', `Safe Mode is now ${isSafe ? 'ENABLED' : 'DISABLED'}.`, isSafe ? 'warning' : 'success');
            render();
            return;
          }
          const policyKey = select.id.replace('policy-', '') + 'Policy';
          if (!state.registry.safety) state.registry.safety = {};
          state.registry.safety[policyKey] = select.value;
          state.saveState();
          ui.showToast('Policy Updated', `Set ${select.id.replace('policy-', '')} access to ${select.value}.`, 'success');
        });
      });

      const slider = container.querySelector('#threshold-slider');
      if (slider) {
        slider.addEventListener('input', (e) => {
          container.querySelector('#threshold-val strong').textContent = `${e.target.value}%`;
        });
        slider.addEventListener('change', (e) => {
          if (!state.registry.safety) state.registry.safety = {};
          state.registry.safety.confidenceThreshold = parseInt(e.target.value);
          state.saveState();
          ui.showToast('Escalation Slider', `Confidence threshold updated to ${e.target.value}%.`, 'info');
        });
      }
    }

    // Approvals Tab Event Handlers
    if (activeTab === 'approvals') {
      container.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          state.resolveApprovalRequest(id, 'approved');
          ui.showToast('Action Approved', 'The pending syscall was approved and executed.', 'success');
          render();
        });
      });

      container.querySelectorAll('.btn-deny').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          state.resolveApprovalRequest(id, 'denied');
          ui.showToast('Action Denied', 'The pending syscall was denied.', 'error');
          render();
        });
      });
    }

    // Rollback Tab Event Handlers
    if (activeTab === 'rollback') {
      container.querySelectorAll('.trust-rollback-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const path = btn.getAttribute('data-path');
          const orchestrator = ui.orchestrator;
          const snapshots = orchestrator ? orchestrator.vfsSnapshots : {};
          if (orchestrator && snapshots[path] !== undefined) {
            const original = snapshots[path];
            try {
              if (original === null) {
                await window.Astra.syscall('fs:delete', path);
              } else {
                await window.Astra.syscall('fs:write', path, original);
              }
              delete snapshots[path];
              
              const textarea = document.getElementById('editor-text-area');
              const activeFile = document.getElementById('context-file')?.textContent;
              if (activeFile && path.endsWith(activeFile) && textarea) {
                textarea.value = original || '';
              }
              const editorContent = document.getElementById('editor-content');
              if (editorContent) {
                const tabActive = document.querySelector('.editor-tab.active span')?.textContent;
                if (tabActive && path.endsWith(tabActive)) {
                  editorContent.value = original || '';
                }
              }

              ui.showToast('File Rolled Back', `Reverted modifications in ${path.split('/').pop()}`, 'success');
              state.addNotification('success', 'Security Rollback', `Rolled back changes in ${path}`);
              render();
              if (window.refreshExplorerGrid) window.refreshExplorerGrid();
            } catch (err) {
              ui.showToast('Rollback Failed', err.message, 'error');
            }
          }
        });
      });
    }

    // Journal Tab Event Handlers
    if (activeTab === 'journal') {
      const searchInput = container.querySelector('#journal-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          searchQuery = e.target.value;
          // Re-render table dynamically without complete app rebuild
          updateJournalTable();
        });
      }

      const filterTypeSelect = container.querySelector('#journal-filter-type');
      if (filterTypeSelect) {
        filterTypeSelect.addEventListener('change', (e) => {
          filterType = e.target.value;
          updateJournalTable();
        });
      }

      const filterLevelSelect = container.querySelector('#journal-filter-level');
      if (filterLevelSelect) {
        filterLevelSelect.addEventListener('change', (e) => {
          filterLevel = e.target.value;
          updateJournalTable();
        });
      }

      const clearBtn = container.querySelector('#journal-clear-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          searchQuery = '';
          filterType = 'all';
          filterLevel = 'all';
          render();
        });
      }
    }
  }

  function updateJournalTable() {
    const tableBody = container.querySelector('.trust-table tbody');
    if (!tableBody) return;
    
    const state = ui.state;
    const logs = state.eventLog || [];
    const filteredLogs = logs.filter(log => {
      const matchesQuery = !searchQuery || JSON.stringify(log).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || log.type.startsWith(filterType);
      const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
      return matchesQuery && matchesType && matchesLevel;
    });

    let journalRowsHTML = '';
    if (filteredLogs.length === 0) {
      journalRowsHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No matching log events.</td></tr>';
    } else {
      filteredLogs.slice(-50).reverse().forEach(log => {
        const isWarning = log.level === 'WARN' || log.type.includes('fail') || log.type.includes('denied');
        const isError = log.level === 'ERROR';
        const rowStyle = isError ? 'color: var(--color-red);' : (isWarning ? 'color: var(--color-amber);' : '');
        
        let detailStr = '';
        if (log.detail) {
          if (typeof log.detail === 'string') {
            detailStr = log.detail;
          } else {
            detailStr = JSON.stringify(log.detail);
            if (detailStr.length > 80) detailStr = detailStr.slice(0, 80) + '...';
          }
        }
        
        journalRowsHTML += `
          <tr style="${rowStyle}">
            <td style="font-family: var(--font-mono); font-size: 11px; white-space: nowrap;">${new Date(log.timestamp).toLocaleTimeString()}</td>
            <td><strong>${window.escapeHTML(log.source)}</strong></td>
            <td><span style="font-family: var(--font-mono); font-size:11px;">${window.escapeHTML(log.type)}</span></td>
            <td><span style="font-weight:bold; font-size:10px;">${window.escapeHTML(log.level || 'INFO')}</span></td>
            <td style="font-size:11.5px; overflow:hidden; text-overflow:ellipsis; max-width: 250px;" title="${window.escapeHTML(JSON.stringify(log.detail))}">
              ${window.escapeHTML(detailStr)}
            </td>
          </tr>
        `;
      });
    }
    window.renderSafeHTML(tableBody, journalRowsHTML);
  }

  render();
};

// ==========================================
// 6. Cognitive Timeline & Capsules App
// ==========================================
window.AstraApps.timeline = function(container, ui) {
  let activeTimelineTab = 'timeline';
  
  function render() {
    const state = ui.state;
    const capsules = state.registry.system?.capsules || [];
    const auditLogs = state.auditLogs || [];
    
    const pulseValues = [30, 45, 60, 25, 80, 95, 75, 40, 65, 85, 90, 50, 70, 94];
    const pulseBarsHTML = pulseValues.map(v => `
      <div class="work-pulse-bar" style="height: ${v}%" title="Work Pulse Intensity: ${v}%"></div>
    `).join('');

    let tabContentHTML = '';

    if (activeTimelineTab === 'timeline') {
      let timelineEventsHTML = '';
      if (auditLogs.length === 0) {
        timelineEventsHTML = '<div class="dailybriefing-empty">No work timeline activity logged.</div>';
      } else {
        auditLogs.slice(-10).reverse().forEach(log => {
          let emoji = '⚙️';
          if (log.agent === 'User') emoji = '👤';
          else if (log.agent.includes('Planner')) emoji = '📋';
          else if (log.agent.includes('Executor')) emoji = '⚡';
          else if (log.agent.includes('Watcher')) emoji = '🔍';
          else if (log.agent.includes('Memory')) emoji = '🧠';
          else if (log.agent.includes('Safety')) emoji = '🛡️';
          
          timelineEventsHTML += `
            <div class="timeline-event">
              <span class="timeline-event-time">[${log.timestamp}]</span>
              <div class="timeline-event-body">
                <strong>${emoji} ${window.escapeHTML(log.agent)}</strong>: ${window.escapeHTML(log.action)}
              </div>
            </div>
          `;
        });
      }

      tabContentHTML = `
        <div class="timeline-grid">
          <div class="timeline-panel">
            <h4>Cognitive Activity Stream</h4>
            <div class="timeline-scroll" style="max-height: 320px; overflow-y: auto; padding-top: 10px;">
              ${timelineEventsHTML}
            </div>
          </div>
          
          <div class="timeline-panel">
            <h4>Work Pulse Momentum</h4>
            <p>Calculated velocity of active files edited, terminal builds, and agent operations.</p>
            <div class="work-pulse-chart">
              ${pulseBarsHTML}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-top: 4px;">
              <span>10:00 AM</span>
              <span>1:00 PM</span>
              <span>4:30 PM (Peak)</span>
              <span>Current</span>
            </div>
            <p style="font-size: 13px; margin-top: 10px;">
              Current Focus Momentum: <strong style="color: var(--color-primary);">94% (High Velocity)</strong>
            </p>
          </div>
        </div>
      `;
    } else if (activeTimelineTab === 'capsules') {
      let capsuleCardsHTML = '';
      capsules.forEach(capsule => {
        capsuleCardsHTML += `
          <div class="capsule-card" data-capsule-id="${window.escapeHTML(capsule.id)}">
            <div class="capsule-name">🎒 ${window.escapeHTML(capsule.name)}</div>
            <div class="capsule-desc">${window.escapeHTML(capsule.description)}</div>
            <div class="capsule-meta">Apps: ${capsule.openApps.join(', ')} | Focus: ${capsule.focusMode.toUpperCase()}</div>
          </div>
        `;
      });

      tabContentHTML = `
        <div class="timeline-grid" style="grid-template-columns: 1.2fr 1fr;">
          <div class="timeline-panel">
            <h4>Saved AI Session Capsules</h4>
            <p>Restore workspace capsules to instantly reconstruct active tabs, file selections, and focus settings.</p>
            <div class="capsule-grid" style="max-height: 300px; overflow-y: auto;">
              ${capsuleCardsHTML}
            </div>
          </div>
          
          <div class="timeline-panel">
            <h4>Take AI Session Capsule</h4>
            <p>Snapshots list of currently open windows, their positions, active focus mode, and active file context.</p>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
              <input type="text" class="browser-newtab-input" id="capsule-name-input" placeholder="Capsule Name (e.g. Satellite Defense)" style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-glass); border-radius: 4px; padding: 8px; color: #fff;">
              <button class="btn btn-primary" id="save-capsule-btn">🎒 Snapshot Current Session</button>
            </div>
          </div>
        </div>
      `;
    } else {
      tabContentHTML = `
        <div class="timeline-grid" style="grid-template-columns: 1.2fr 1fr;">
          <div class="timeline-panel">
            <h4>Active Project Twins</h4>
            <p>Autonomous AI representation of your repository directory state that synchs and runs background routines while you are away.</p>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
              <div class="twin-item">
                <div>
                  <strong>🛰️ Satellite_Defense_Twin</strong>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Path: /Satellite_Defense | Telemetry avoid</div>
                </div>
                <span class="twin-status-pill active">ACTIVE</span>
              </div>
              <div class="twin-item">
                <div>
                  <strong>🚀 Project_Astra_Twin</strong>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Path: /Project_Astra | Council routing</div>
                </div>
                <span class="twin-status-pill active">ACTIVE</span>
              </div>
            </div>
          </div>
          <div class="timeline-panel">
            <h4>Twin Task Ingestion</h4>
            <p style="font-size: 13px; line-height: 1.4; color: var(--text-secondary);">
              Project twins automatically listen to local workspace file changes and queue optimization checks in the Watcher agent. When you are AFK, the twins ingest code edits and run compile sanity routines seamlessly.
            </p>
          </div>
        </div>
      `;
    }

    window.renderSafeHTML(container, `
      <div class="timeline-app">
        <div class="timeline-header">
          <h3>⏳ Cognitive Timeline & Capsules</h3>
          <div class="dailybriefing-tabs" style="margin: 0; border: none; padding: 0;">
            <button class="db-tab ${activeTimelineTab === 'timeline' ? 'active' : ''}" id="tl-tab-timeline">Activity Timeline</button>
            <button class="db-tab ${activeTimelineTab === 'capsules' ? 'active' : ''}" id="tl-tab-capsules">Session Capsules</button>
            <button class="db-tab ${activeTimelineTab === 'twins' ? 'active' : ''}" id="tl-tab-twins">Project Twins</button>
          </div>
        </div>
        
        <div class="timeline-content">
          ${tabContentHTML}
        </div>
      </div>
    `);

    container.querySelector('#tl-tab-timeline')?.addEventListener('click', () => { activeTimelineTab = 'timeline'; render(); });
    container.querySelector('#tl-tab-capsules')?.addEventListener('click', () => { activeTimelineTab = 'capsules'; render(); });
    container.querySelector('#tl-tab-twins')?.addEventListener('click', () => { activeTimelineTab = 'twins'; render(); });

    container.querySelector('#save-capsule-btn')?.addEventListener('click', () => {
      const nameInput = container.querySelector('#capsule-name-input');
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) {
        ui.showToast('Failed to Save Capsule', 'Please enter a capsule name.', 'error');
        return;
      }
      
      const openApps = [];
      Object.keys(state.processes).forEach(appId => {
        const proc = Reflect.get(state.processes, window.sanitizeKey(appId));
        if (proc && proc.open) openApps.push(appId);
      });
      const focusMode = state.registry.system.focusMode || 'coding';
      const activeFile = document.getElementById('context-file')?.textContent || '';
      
      const newCapsule = {
        id: 'capsule-' + Date.now(),
        name: name,
        focusMode: focusMode,
        activeFile: activeFile,
        openApps: openApps,
        description: `User snapped state containing ${openApps.length} active apps.`
      };
      
      if (!state.registry.system.capsules) state.registry.system.capsules = [];
      state.registry.system.capsules.push(newCapsule);
      state.saveState();
      
      ui.showToast('Capsule Saved', `Session capsule "${name}" captured.`, 'success');
      state.addNotification('success', 'Timeline & Capsules', `Saved session capsule: ${name}`);
      render();
    });

    container.querySelectorAll('.capsule-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-capsule-id');
        const capsule = capsules.find(c => c.id === id);
        if (capsule) {
          restoreCapsuleState(capsule);
        }
      });
    });
  }

  function restoreCapsuleState(capsule) {
    const state = ui.state;
    Object.keys(state.processes).forEach(appId => {
      ui.closeApp(appId);
    });
    
    ui.setFocusMode(capsule.focusMode);
    
    capsule.openApps.forEach(appId => {
      ui.openApp(appId);
    });
    
    if (capsule.activeFile) {
      ui.openApp('editor');
      setTimeout(() => {
        if (window.editorOpenFile) window.editorOpenFile(capsule.activeFile);
      }, 300);
    }
    
    ui.showToast('Capsule Restored', `Restored capsule "${capsule.name}"`, 'success');
    state.addNotification('success', 'Capsule Engine', `Successfully restored work capsule: ${capsule.name}`);
    render();
  }

  render();
};

window.AstraApps.astroid = function(container, ui) {
  window.renderSafeHTML(container, html`
    <div class="astroid-app">
      <div class="astroid-header">
        <div class="astroid-stat">Score: <span id="astroid-score">0</span></div>
        <div class="astroid-stat">Level: <span id="astroid-level">1</span></div>
        <div class="astroid-stat">Lives: <span id="astroid-lives">3</span></div>
        <div class="astroid-stat">High Score: <span id="astroid-high">0</span></div>
      </div>
      <div class="astroid-canvas-container" style="position: relative; width: 560px; height: 280px; margin: 0 auto; background: #080b11; border: 1px solid var(--border-glass); border-radius: 6px; overflow: hidden;">
        <canvas id="astroid-canvas" width="560" height="280" tabindex="0" style="display: block; outline: none; width: 100%; height: 100%;"></canvas>
        <div id="astroid-overlay" class="astroid-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(8, 11, 17, 0.85); backdrop-filter: blur(4px); color: #fff; text-align: center; box-sizing: border-box; padding: 20px;">
          <h2 id="astroid-overlay-title" style="margin: 0 0 10px 0; font-family: sans-serif; font-size: 24px; font-weight: 800; color: var(--color-primary); text-shadow: 0 0 8px var(--color-primary); letter-spacing: 2px;">ASTRO DEFENDER</h2>
          <p id="astroid-overlay-desc" style="margin: 0 0 20px 0; font-size: 13px; color: var(--text-secondary); max-width: 400px; line-height: 1.4;">Protect the system filesystem from corrupted sectors! Click below to start.</p>
          <button id="astroid-play-btn" class="btn btn-primary" style="padding: 8px 24px; font-weight: 600;">Start Defense</button>
        </div>
      </div>
      <div class="astroid-instructions" style="text-align: center; margin-top: 10px; font-size: 11px; color: var(--text-muted);">
        Controls: A/D or Left/Right Arrows to Move. Spacebar to Fire. Click canvas to focus keyboard.
      </div>
    </div>
  `);

  const canvas = container.querySelector('#astroid-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const overlay = container.querySelector('#astroid-overlay');
  const playBtn = container.querySelector('#astroid-play-btn');
  const titleEl = container.querySelector('#astroid-overlay-title');
  const descEl = container.querySelector('#astroid-overlay-desc');

  const scoreEl = container.querySelector('#astroid-score');
  const levelEl = container.querySelector('#astroid-level');
  const livesEl = container.querySelector('#astroid-lives');
  const highEl = container.querySelector('#astroid-high');

  let score = 0;
  let level = 1;
  let lives = 3;
  let highscore = parseInt(localStorage.getItem('astra_astroid_highscore') || '0', 10);
  highEl.textContent = highscore;

  let isPlaying = false;
  let loopId = null;

  // Web Audio for retro sound FX
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playLaserSound() {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}
  }

  function playExplosionSound(pitch = 100) {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(20, audioCtx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {}
  }

  // Entities state
  const stars = [];
  for (let i = 0; i < 30; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.4 + 0.1
    });
  }

  let player = { x: canvas.width / 2, y: canvas.height - 25, w: 20, h: 16, speed: 5 };
  let lasers = [];
  let enemies = [];
  let particles = [];
  let keys = { left: false, right: false, space: false };
  let lastFireTime = 0;
  let fireInterval = 250;
  let shakeTime = 0;
  let waveSize = 5;
  let enemySpeed = 0.8;

  function spawnWave() {
    enemies = [];
    for (let i = 0; i < waveSize; i++) {
      enemies.push({
        x: Math.random() * (canvas.width - 40) + 20,
        y: -Math.random() * 150 - 20,
        w: 18,
        h: 14,
        speed: enemySpeed * (Math.random() * 0.4 + 0.8),
        color: `hsl(${(level * 40) % 360}, 90%, 65%)`
      });
    }
  }

  function triggerExplosion(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 2 + 1,
        color: color || '#ff5b5b',
        alpha: 1,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  canvas.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === ' ' || e.key === 'Spacebar') {
      keys.space = true;
      e.preventDefault();
    }
  });

  canvas.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    if (e.key === ' ' || e.key === 'Spacebar') keys.space = false;
  });

  canvas.addEventListener('focus', () => {
    canvas.style.borderColor = 'var(--color-primary)';
  });
  canvas.addEventListener('blur', () => {
    canvas.style.borderColor = 'var(--border-glass)';
    keys.left = false;
    keys.right = false;
    keys.space = false;
  });

  function startNewGame() {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    score = 0;
    level = 1;
    lives = 3;
    waveSize = 5;
    enemySpeed = 0.8;
    scoreEl.textContent = score;
    levelEl.textContent = level;
    livesEl.textContent = lives;

    player.x = canvas.width / 2;
    lasers = [];
    particles = [];
    spawnWave();

    isPlaying = true;
    overlay.style.display = 'none';
    canvas.focus();
    if (loopId) cancelAnimationFrame(loopId);
    gameLoop();
  }

  function gameOver() {
    isPlaying = false;
    if (score > highscore) {
      highscore = score;
      localStorage.setItem('astra_astroid_highscore', highscore.toString());
      highEl.textContent = highscore;
      ui.showToast('New High Score!', `You protected the filesystem with a score of ${score}!`, 'success');
    }
    
    titleEl.textContent = 'SYSTEM OVERRUN';
    titleEl.style.color = '#ff5b5b';
    titleEl.style.textShadow = '0 0 8px #ff5b5b';
    descEl.textContent = `A sector has been corrupted. Final Score: ${score} (Level ${level})`;
    playBtn.textContent = 'Reboot Defense';
    overlay.style.display = 'flex';
    if (loopId) cancelAnimationFrame(loopId);
  }

  function gameLoop() {
    if (!container.offsetParent) {
      isPlaying = false;
      return;
    }

    update();
    draw();

    if (isPlaying) {
      loopId = requestAnimationFrame(gameLoop);
    }
  }

  function update() {
    stars.forEach(s => {
      s.y += s.speed;
      if (s.y > canvas.height) {
        s.y = 0;
        s.x = Math.random() * canvas.width;
      }
    });

    if (keys.left) player.x = Math.max(10, player.x - player.speed);
    if (keys.right) player.x = Math.min(canvas.width - player.w - 10, player.x + player.speed);

    if (keys.space) {
      const now = Date.now();
      if (now - lastFireTime > fireInterval) {
        lasers.push({
          x: player.x + player.w / 2 - 1,
          y: player.y - 4,
          w: 2,
          h: 8,
          speed: 7
        });
        lastFireTime = now;
        playLaserSound();
      }
    }

    for (let i = lasers.length - 1; i >= 0; i--) {
      lasers[i].y -= lasers[i].speed;
      if (lasers[i].y < 0) {
        lasers.splice(i, 1);
      }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.y += e.speed;

      if (
        e.y + e.h >= player.y &&
        e.y <= player.y + player.h &&
        e.x + e.w >= player.x &&
        e.x <= player.x + player.w
      ) {
        triggerExplosion(e.x + e.w / 2, e.y + e.h / 2, '#ff5b5b');
        triggerExplosion(player.x + player.w / 2, player.y + player.h / 2, '#48bb78');
        enemies.splice(i, 1);
        lives--;
        livesEl.textContent = lives;
        shakeTime = 12;
        playExplosionSound(60);

        if (lives <= 0) {
          gameOver();
          return;
        }
        continue;
      }

      if (e.y > canvas.height) {
        enemies.splice(i, 1);
        lives--;
        livesEl.textContent = lives;
        shakeTime = 12;
        playExplosionSound(50);
        triggerExplosion(e.x + e.w / 2, canvas.height - 5, '#ff5b5b');

        if (lives <= 0) {
          gameOver();
          return;
        }
        continue;
      }

      for (let j = lasers.length - 1; j >= 0; j--) {
        const l = lasers[j];
        if (
          l.x + l.w >= e.x &&
          l.x <= e.x + e.w &&
          l.y + l.h >= e.y &&
          l.y <= e.y + e.h
        ) {
          triggerExplosion(e.x + e.w / 2, e.y + e.h / 2, e.color);
          playExplosionSound(180 + Math.random() * 40);
          enemies.splice(i, 1);
          lasers.splice(j, 1);
          score += 10;
          scoreEl.textContent = score;
          break;
        }
      }
    }

    if (enemies.length === 0 && isPlaying) {
      level++;
      levelEl.textContent = level;
      waveSize = 5 + level * 2;
      enemySpeed = 0.8 + level * 0.15;
      ui.showToast('Level Up!', `Sectors defense integrity reinforced. Level ${level} incoming.`, 'info');
      spawnWave();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        particles.splice(i, 1);
      }
    }

    if (shakeTime > 0) shakeTime--;
  }

  function draw() {
    ctx.save();
    
    if (shakeTime > 0) {
      const dx = (Math.random() - 0.5) * 6;
      const dy = (Math.random() - 0.5) * 6;
      ctx.translate(dx, dy);
    }

    ctx.fillStyle = '#080b11';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach(s => {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.speed * 1.5})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    });

    ctx.shadowBlur = 6;
    ctx.shadowColor = '#00f7ff';
    ctx.fillStyle = '#00f7ff';
    lasers.forEach(l => {
      ctx.fillRect(l.x, l.y, l.w, l.h);
    });
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#48bb78';
    const flameH = Math.sin(Date.now() / 40) * 5 + 6;
    ctx.fillStyle = '#f6ad55';
    ctx.beginPath();
    ctx.moveTo(player.x + player.w / 2 - 4, player.y + player.h);
    ctx.lineTo(player.x + player.w / 2, player.y + player.h + flameH);
    ctx.lineTo(player.x + player.w / 2 + 4, player.y + player.h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#48bb78';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#48bb78';
    ctx.beginPath();
    ctx.moveTo(player.x + player.w / 2, player.y);
    ctx.lineTo(player.x, player.y + player.h);
    ctx.lineTo(player.x + player.w, player.y + player.h);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    enemies.forEach(e => {
      ctx.fillStyle = e.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = e.color;
      
      ctx.beginPath();
      ctx.moveTo(e.x + e.w / 2, e.y + e.h);
      ctx.lineTo(e.x, e.y + e.h / 3);
      ctx.lineTo(e.x + e.w / 4, e.y);
      ctx.lineTo(e.x + (e.w * 3) / 4, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h / 3);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 0;
      ctx.fillRect(e.x + e.w / 4 + 1, e.y + e.h / 3 + 1, 2, 2);
      ctx.fillRect(e.x + (e.w * 3) / 4 - 3, e.y + e.h / 3 + 1, 2, 2);
    });

    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;

    ctx.restore();
  }

  playBtn.addEventListener('click', startNewGame);
};

window.AstraApps.pulsewave = function(container, ui) {
  window.renderSafeHTML(container, html`
    <div class="pulsewave-app">
      <div class="pulsewave-grid" style="display: grid; grid-template-columns: 240px 1fr; gap: 12px; height: 100%; min-height: 330px; box-sizing: border-box;">
        
        <div class="pulsewave-left-panel" style="display: flex; flex-direction: column; gap: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 6px; padding: 12px; box-sizing: border-box; justify-content: space-between;">
          <div>
            <h4 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px; color: var(--color-primary);">Controls & Waveforms</h4>
            
            <div class="pulsewave-control-group" style="margin-bottom: 10px;">
              <label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Generator Mode</label>
              <select id="pw-mode" class="browser-newtab-input" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--border-glass); border-radius: 4px; padding: 6px; color: #fff; font-size: 12px;">
                <option value="synth">Polyphonic Synthesizer</option>
                <option value="drone">Deep Space Ambient Drone</option>
                <option value="cyber">Cyberpunk Rain Soundscape</option>
                <option value="echo">Astra Echoes Pad</option>
              </select>
            </div>

            <div class="pulsewave-control-group synth-only" style="margin-bottom: 10px;">
              <label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Oscillator Type</label>
              <div style="display: flex; gap: 4px;">
                <button class="btn btn-sm btn-outline active pw-wave-btn" data-wave="sine" style="flex: 1; font-size: 10px; padding: 4px 0; text-align: center;">Sine</button>
                <button class="btn btn-sm btn-outline pw-wave-btn" data-wave="triangle" style="flex: 1; font-size: 10px; padding: 4px 0; text-align: center;">Tri</button>
                <button class="btn btn-sm btn-outline pw-wave-btn" data-wave="sawtooth" style="flex: 1; font-size: 10px; padding: 4px 0; text-align: center;">Saw</button>
                <button class="btn btn-sm btn-outline pw-wave-btn" data-wave="square" style="flex: 1; font-size: 10px; padding: 4px 0; text-align: center;">Sqr</button>
              </div>
            </div>

            <div class="pulsewave-control-group synth-only" style="margin-bottom: 10px;">
              <label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">ADSR Envelope</label>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 6px; font-size: 10px;">
                  <span style="width: 50px; color: var(--text-secondary);">Attack:</span>
                  <input type="range" id="pw-attack" min="0.02" max="1" step="0.05" value="0.1" style="flex: 1; height: 4px; accent-color: var(--color-primary);">
                  <span id="pw-attack-val" style="width: 25px; text-align: right;">0.1s</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; font-size: 10px;">
                  <span style="width: 50px; color: var(--text-secondary);">Release:</span>
                  <input type="range" id="pw-release" min="0.1" max="2.5" step="0.1" value="0.5" style="flex: 1; height: 4px; accent-color: var(--color-primary);">
                  <span id="pw-release-val" style="width: 25px; text-align: right;">0.5s</span>
                </div>
              </div>
            </div>

            <div class="pulsewave-control-group drone-only" style="display: none; margin-bottom: 10px;">
              <label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">LFO Rate Mod (<span id="pw-drone-intensity-val">0.5</span>Hz)</label>
              <input type="range" id="pw-drone-intensity" min="0.1" max="3" step="0.1" value="0.5" style="width: 100%; height: 4px; accent-color: var(--color-primary);">
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button id="pw-start-audio" class="btn btn-primary" style="width: 100%; font-size: 12px; padding: 8px; font-weight: 600;">🔊 Start Audio Engine</button>
            <div id="pw-status" style="font-size: 11px; text-align: center; color: var(--text-muted); font-family: monospace;">Context: Suspended</div>
          </div>
        </div>
        
        <div class="pulsewave-right-panel" style="display: flex; flex-direction: column; gap: 10px; justify-content: space-between; box-sizing: border-box;">
          <div class="pulsewave-visualizer-container" style="position: relative; flex: 1; background: #080b11; border: 1px solid var(--border-glass); border-radius: 6px; overflow: hidden; height: 160px; box-sizing: border-box;">
            <canvas id="pulsewave-canvas" width="300" height="160" style="display: block; width: 100%; height: 100%;"></canvas>
            <div id="pulsewave-wave-label" style="position: absolute; bottom: 8px; left: 8px; font-family: monospace; font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Oscilloscope Waveform</div>
          </div>

          <div class="pulsewave-keyboard-container" style="background: rgba(0,0,0,0.15); border: 1px solid var(--border-glass); border-radius: 6px; padding: 10px; box-sizing: border-box;">
            <div class="pulsewave-keyboard" id="pulsewave-keys" style="display: flex; justify-content: center; height: 80px; position: relative; user-select: none;">
              <!-- Keys injected dynamically -->
            </div>
            <div style="text-align: center; font-size: 10px; color: var(--text-muted); margin-top: 6px; font-family: monospace;">
              Controls: A S D F G H J K L on keyboard to play notes
            </div>
          </div>
        </div>
        
      </div>
    </div>
  `);

  const keysContainer = container.querySelector('#pulsewave-keys');
  const canvas = container.querySelector('#pulsewave-canvas');
  if (!canvas || !keysContainer) return;
  const ctx = canvas.getContext('2d');

  const pwMode = container.querySelector('#pw-mode');
  const attackSlider = container.querySelector('#pw-attack');
  const releaseSlider = container.querySelector('#pw-release');
  const attackVal = container.querySelector('#pw-attack-val');
  const releaseVal = container.querySelector('#pw-release-val');
  const intensitySlider = container.querySelector('#pw-drone-intensity');
  const intensityVal = container.querySelector('#pw-drone-intensity-val');
  const startBtn = container.querySelector('#pw-start-audio');
  const statusDiv = container.querySelector('#pw-status');

  const synthControls = container.querySelectorAll('.synth-only');
  const droneControls = container.querySelectorAll('.drone-only');

  let audioCtx = null;
  let analyser = null;
  let masterGain = null;
  let dataArray = null;
  let bufferLength = 0;
  let isRunning = false;
  let oscType = 'sine';
  let loopId = null;

  const activeNotes = new Map();
  const ambientNodes = [];

  const notesMap = [
    { note: 'C4', freq: 261.63, key: 'a', isBlack: false },
    { note: 'C#4', freq: 277.18, key: 'w', isBlack: true },
    { note: 'D4', freq: 293.66, key: 's', isBlack: false },
    { note: 'D#4', freq: 311.13, key: 'e', isBlack: true },
    { note: 'E4', freq: 329.63, key: 'd', isBlack: false },
    { note: 'F4', freq: 349.23, key: 'f', isBlack: false },
    { note: 'F#4', freq: 369.99, key: 't', isBlack: true },
    { note: 'G4', freq: 392.00, key: 'g', isBlack: false },
    { note: 'G#4', freq: 415.30, key: 'y', isBlack: true },
    { note: 'A4', freq: 440.00, key: 'h', isBlack: false },
    { note: 'A#4', freq: 466.16, key: 'u', isBlack: true },
    { note: 'B4', freq: 493.88, key: 'j', isBlack: false },
    { note: 'C5', freq: 523.25, key: 'k', isBlack: false },
    { note: 'C#5', freq: 554.37, key: 'o', isBlack: true },
    { note: 'D5', freq: 587.33, key: 'l', isBlack: false },
    { note: 'D#5', freq: 622.25, key: 'p', isBlack: true },
    { note: 'E5', freq: 659.25, key: ';', isBlack: false }
  ];

  function renderKeyboard() {
    keysContainer.innerHTML = '';
    notesMap.forEach(n => {
      const btn = document.createElement('div');
      btn.className = `pw-key ${n.isBlack ? 'black' : 'white'}`;
      btn.setAttribute('data-freq', n.freq);
      btn.setAttribute('title', `${n.note} (${n.key.toUpperCase()})`);
      keysContainer.appendChild(btn);

      btn.addEventListener('mousedown', () => {
        noteOn(n.freq);
        btn.classList.add('active');
      });
      const endNote = () => {
        noteOff(n.freq);
        btn.classList.remove('active');
      };
      btn.addEventListener('mouseup', endNote);
      btn.addEventListener('mouseleave', endNote);
    });
  }

  function handleKeyDown(e) {
    if (!isRunning || pwMode.value !== 'synth') return;
    const matchingNote = notesMap.find(n => n.key === e.key.toLowerCase());
    if (matchingNote) {
      noteOn(matchingNote.freq);
      const keyEl = keysContainer.querySelector(`[data-freq="${matchingNote.freq}"]`);
      if (keyEl) keyEl.classList.add('active');
    }
  }

  function handleKeyUp(e) {
    if (!isRunning) return;
    const matchingNote = notesMap.find(n => n.key === e.key.toLowerCase());
    if (matchingNote) {
      noteOff(matchingNote.freq);
      const keyEl = keysContainer.querySelector(`[data-freq="${matchingNote.freq}"]`);
      if (keyEl) keyEl.classList.remove('active');
    }
  }

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.25, audioCtx.currentTime);

    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  function noteOn(freq) {
    initAudio();
    if (!audioCtx || audioCtx.state === 'suspended') return;
    if (activeNotes.has(freq)) return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = oscType;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    const attack = parseFloat(attackSlider.value);
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + attack);

    osc.connect(gainNode);
    gainNode.connect(masterGain);

    osc.start();
    activeNotes.set(freq, { osc, gain: gainNode });
  }

  function noteOff(freq) {
    const note = activeNotes.get(freq);
    if (!note) return;

    const release = parseFloat(releaseSlider.value);
    note.gain.gain.cancelScheduledValues(audioCtx.currentTime);
    note.gain.gain.setValueAtTime(note.gain.gain.value, audioCtx.currentTime);
    note.gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + release);

    const stopTime = audioCtx.currentTime + release;
    note.osc.stop(stopTime);
    
    setTimeout(() => {
      try {
        note.osc.disconnect();
        note.gain.disconnect();
      } catch (e) {}
    }, (release + 0.2) * 1000);

    activeNotes.delete(freq);
  }

  function stopAllNotes() {
    activeNotes.forEach((note, freq) => {
      try {
        note.osc.stop();
        note.osc.disconnect();
        note.gain.disconnect();
      } catch (e) {}
    });
    activeNotes.clear();
  }

  function stopAmbient() {
    ambientNodes.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {}
    });
    ambientNodes.length = 0;
  }

  function playAmbientDrone() {
    stopAmbient();
    initAudio();
    if (!audioCtx) return;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, audioCtx.currentTime);
    filter.Q.setValueAtTime(4, audioCtx.currentTime);
    filter.connect(masterGain);

    const freqs = [55, 55.4, 110];
    freqs.forEach((f, idx) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, audioCtx.currentTime);

      const oscGain = audioCtx.createGain();
      oscGain.gain.setValueAtTime(0.15, audioCtx.currentTime);

      const lfo = audioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(parseFloat(intensitySlider.value) + idx * 0.1, audioCtx.currentTime);

      const lfoGain = audioCtx.createGain();
      lfoGain.gain.setValueAtTime(0.05, audioCtx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(oscGain.gain);
      
      osc.connect(oscGain);
      oscGain.connect(filter);

      lfo.start();
      osc.start();

      ambientNodes.push(lfo, osc);
    });
  }

  function playCyberpunkRain() {
    stopAmbient();
    initAudio();
    if (!audioCtx) return;

    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, audioCtx.currentTime);
    filter.Q.setValueAtTime(1, audioCtx.currentTime);

    const rainGain = audioCtx.createGain();
    rainGain.gain.setValueAtTime(0.12, audioCtx.currentTime);

    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.15, audioCtx.currentTime);
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(250, audioCtx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    whiteNoise.connect(filter);
    filter.connect(rainGain);
    rainGain.connect(masterGain);

    lfo.start();
    whiteNoise.start();

    ambientNodes.push(lfo, whiteNoise);
  }

  function playAstraEchoes() {
    stopAmbient();
    initAudio();
    if (!audioCtx) return;

    const notes = [220.00, 261.63, 329.63, 392.00, 440.00, 523.25, 659.25];
    let noteIdx = 0;

    const delay = audioCtx.createDelay();
    delay.delayTime.setValueAtTime(0.4, audioCtx.currentTime);
    const feedback = audioCtx.createGain();
    feedback.gain.setValueAtTime(0.4, audioCtx.currentTime);

    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(masterGain);

    function triggerNext() {
      if (!isRunning || pwMode.value !== 'echo') return;
      
      const f = notes[noteIdx];
      noteIdx = (noteIdx + Math.floor(Math.random() * 3 + 1)) % notes.length;

      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, audioCtx.currentTime);

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.9);

      osc.connect(gainNode);
      gainNode.connect(masterGain);
      gainNode.connect(delay);

      osc.start();
      osc.stop(audioCtx.currentTime + 1.0);

      setTimeout(triggerNext, 450 + Math.random() * 200);
    }

    triggerNext();
  }

  function updateMode() {
    const val = pwMode.value;
    stopAllNotes();
    stopAmbient();

    if (val === 'synth') {
      synthControls.forEach(el => el.style.display = 'block');
      droneControls.forEach(el => el.style.display = 'none');
    } else {
      synthControls.forEach(el => el.style.display = 'none');
      droneControls.forEach(el => el.style.display = 'block');
      
      if (isRunning) {
        if (val === 'drone') playAmbientDrone();
        else if (val === 'cyber') playCyberpunkRain();
        else if (val === 'echo') playAstraEchoes();
      }
    }
  }

  attackSlider.addEventListener('input', () => {
    attackVal.textContent = attackSlider.value + 's';
  });
  releaseSlider.addEventListener('input', () => {
    releaseVal.textContent = releaseSlider.value + 's';
  });
  intensitySlider.addEventListener('input', () => {
    intensityVal.textContent = intensitySlider.value + 'Hz';
    if (isRunning && pwMode.value === 'drone') {
      playAmbientDrone();
    }
  });

  pwMode.addEventListener('change', updateMode);

  container.querySelectorAll('.pw-wave-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.pw-wave-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      oscType = btn.getAttribute('data-wave');
    });
  });

  startBtn.addEventListener('click', () => {
    initAudio();
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (!isRunning) {
      isRunning = true;
      startBtn.textContent = '⏹ Stop Audio Engine';
      startBtn.classList.remove('btn-primary');
      startBtn.classList.add('btn-outline');
      statusDiv.textContent = 'Context: Active';
      statusDiv.style.color = '#48bb78';
      updateMode();
      
      if (loopId) cancelAnimationFrame(loopId);
      visualizerLoop();
    } else {
      isRunning = false;
      startBtn.textContent = '🔊 Start Audio Engine';
      startBtn.classList.remove('btn-outline');
      startBtn.classList.add('btn-primary');
      statusDiv.textContent = 'Context: Suspended';
      statusDiv.style.color = 'var(--text-muted)';
      stopAllNotes();
      stopAmbient();
    }
  });

  function visualizerLoop() {
    if (!container.offsetParent) {
      isRunning = false;
      startBtn.textContent = '🔊 Start Audio Engine';
      startBtn.classList.remove('btn-outline');
      startBtn.classList.add('btn-primary');
      statusDiv.textContent = 'Context: Suspended';
      statusDiv.style.color = 'var(--text-muted)';
      stopAllNotes();
      stopAmbient();
      return;
    }

    if (isRunning) {
      loopId = requestAnimationFrame(visualizerLoop);
    }

    ctx.fillStyle = '#080b11';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!analyser) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      return;
    }

    analyser.getByteTimeDomainData(dataArray);

    ctx.lineWidth = 3;
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#a855f7');
    gradient.addColorStop(0.5, '#3b82f6');
    gradient.addColorStop(1, '#00f7ff');
    ctx.strokeStyle = gradient;

    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00f7ff';

    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
  }

  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stopAllNotes();
      stopAmbient();
      if (audioCtx) audioCtx.close();
      observer.disconnect();
    }
  });
  observer.observe(container.parentNode || container, { childList: true });

  renderKeyboard();
  updateMode();
};

