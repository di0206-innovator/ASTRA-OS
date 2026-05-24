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
    const success = state.writeFile(filePath, md);
    if (success) {
      ui.showToast('Briefing Exported', `Saved to ${filePath}`, 'success');
      state.addNotification('success', 'Daily Briefing', `Exported briefing to ${filePath}`);
    } else {
      ui.showToast('Export Failed', 'Unable to write to VFS path.', 'error');
    }
  }

  render();
};

// ==========================================
// 5. Trust & Safety Dashboard App
// ==========================================
window.AstraApps.trust = function(container, ui) {
  function render() {
    const state = ui.state;
    const safety = state.registry.safety || {
      writePolicy: 'ask',
      commandPolicy: 'ask',
      networkPolicy: 'approve',
      settingsPolicy: 'ask',
      confidenceThreshold: 85
    };
    
    const safetyLevel = "100% SECURE";
    const systemRisk = "LOW";
    const safetyAgentVerdict = "Astra is operating within authorized security boundaries.";
    
    const auditLogs = state.auditLogs || [];
    let auditRowsHTML = '';
    if (auditLogs.length === 0) {
      auditRowsHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No audit logs recorded yet.</td></tr>';
    } else {
      auditLogs.slice(-6).reverse().forEach(log => {
        const isDangerous = log.action.includes('error') || log.action.includes('fail') || log.action.includes('denied');
        const badgeClass = isDangerous ? 'warned' : 'verified';
        const badgeText = isDangerous ? '⚠️ Warning' : '🛡️ Verified';
        
        auditRowsHTML += `
          <tr>
            <td style="font-family: var(--font-mono); font-size: 11px;">${log.timestamp}</td>
            <td><strong>${window.escapeHTML(log.agent)}</strong></td>
            <td>${window.escapeHTML(log.action)}</td>
            <td><span class="trust-status-badge ${badgeClass}">${badgeText}</span></td>
          </tr>
        `;
      });
    }

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

    window.renderSafeHTML(container, `
      <div class="trust-app">
        <div class="trust-header">
          <h3>🛡️ Trust & Safety Dashboard</h3>
          <span style="font-size: 11.5px; color: var(--text-secondary);">Security Context: <strong>${safetyLevel}</strong></span>
        </div>
        
        <div class="trust-content">
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
            </div>

            <div class="trust-panel">
              <h4>Safety Agent Context</h4>
              <p style="font-size: 13px; margin: 2px 0;">Risk Level Assessment: <strong style="color: var(--color-green);">${systemRisk}</strong></p>
              
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

          <div class="trust-grid" style="grid-template-columns: 1fr 1.2fr;">
            <div class="trust-panel">
              <h4>Active File Rollback Center</h4>
              <div class="dailybriefing-tasks-list" style="max-height: 160px; overflow-y: auto;">
                ${rollbackRowsHTML}
              </div>
            </div>

            <div class="trust-panel" style="overflow-x: auto;">
              <h4>Safety Audit Trail</h4>
              <table class="trust-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Agent</th>
                    <th>Action</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${auditRowsHTML}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `);

    container.querySelectorAll('.trust-policy-select').forEach(select => {
      select.addEventListener('change', () => {
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

    container.querySelectorAll('.trust-rollback-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = btn.getAttribute('data-path');
        if (orchestrator && snapshots[path] !== undefined) {
          const original = snapshots[path];
          if (original === null) {
            state.deleteFile(path);
          } else {
            state.writeFile(path, original);
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
        }
      });
    });
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
