// ==========================================
// Astra OS Core Applications (Enhanced)
// ==========================================

window.AstraApps = window.AstraApps || {};

// ==========================================
// FILE EXPLORER — with CRUD toolbar, breadcrumbs, context menu
// ==========================================
window.AstraApps.explorer = function(container, ui) {
  let currentPath = '/home/divyanshu';
  let selectedItem = null;

  function render() {
    const dir = ui.state.resolvePath(currentPath);
    if (!dir || dir.type !== 'dir') { currentPath = '/'; render(); return; }

    const pathParts = currentPath.split('/').filter(Boolean);
    const entries = Object.keys(dir.children || {}).map(name => ({ name, ...Reflect.get(dir.children, window.sanitizeKey(name)) }));
    let explorerGridHTML = '';
    if (entries.length === 0) {
      explorerGridHTML = '<div class="explorer-empty">This folder is empty</div>';
    } else {
      entries.forEach(e => {
        const selectedClass = selectedItem === e.name ? 'selected' : '';
        const icon = e.type === 'dir' ? '📁' : getFileIcon(e.name);
        const sizeHTML = e.type === 'file' ? '<div class="explorer-item-size">' + getFileSize(e.content) + '</div>' : '';
        explorerGridHTML += `
          <div class="explorer-item-v2 ${selectedClass}" data-name="${window.escapeHTML(e.name)}" data-type="${window.escapeHTML(e.type)}">
            <div class="explorer-item-icon">${icon}</div>
            <div class="explorer-item-name">${window.escapeHTML(e.name)}</div>
            ${sizeHTML}
          </div>
        `;
      });
    }

    const breadcrumbHTML = pathParts.map((p, i) => {
      const path = '/' + pathParts.slice(0, i + 1).join('/');
      return '<span class="breadcrumb-sep">/</span><span class="breadcrumb-part" data-path="' + path + '">' + window.escapeHTML(p) + '</span>';
    }).join('');

    window.renderSafeHTML(container, `
      <div class="explorer-app-v2">
        <div class="explorer-toolbar">
          <button class="explorer-tb-btn" id="exp-back" title="Back">◀</button>
          <div class="explorer-breadcrumb">
            <span class="breadcrumb-part" data-path="/">/</span>
            ${breadcrumbHTML}
          </div>
          <div class="explorer-tb-actions">
            <button class="explorer-tb-btn" id="exp-newfolder" title="New Folder">📁+</button>
            <button class="explorer-tb-btn" id="exp-newfile" title="New File">📄+</button>
            <button class="explorer-tb-btn" id="exp-rename" title="Rename" ${!selectedItem ? 'disabled' : ''}>✏️</button>
            <button class="explorer-tb-btn" id="exp-delete" title="Delete" ${!selectedItem ? 'disabled' : ''}>🗑</button>
          </div>
        </div>
        <div class="explorer-sidebar-v2">
          <div class="explorer-fav-section">
            <div class="explorer-fav-title">Favorites</div>
            <div class="explorer-fav-item" data-path="/home/divyanshu">🏠 Home</div>
            <div class="explorer-fav-item" data-path="/home/divyanshu/Desktop">🖥 Desktop</div>
            <div class="explorer-fav-item" data-path="/home/divyanshu/Documents">📁 Documents</div>
            <div class="explorer-fav-item" data-path="/home/divyanshu/Downloads">⬇ Downloads</div>
            <div class="explorer-fav-item" data-path="/Project_Astra">🚀 Project Astra</div>
          </div>
          <div class="explorer-fav-section">
            <div class="explorer-fav-title">System</div>
            <div class="explorer-fav-item" data-path="/"">💽 Root (/)</div>
            <div class="explorer-fav-item" data-path="/etc">⚙ /etc</div>
            <div class="explorer-fav-item" data-path="/var/log">📋 /var/log</div>
            <div class="explorer-fav-item" data-path="/tmp">🗑 /tmp</div>
          </div>
        </div>
        <div class="explorer-main-v2" id="exp-main">
          ${explorerGridHTML}
        </div>
        <div class="explorer-statusbar">${entries.length} items • ${currentPath}</div>
      </div>
    `);

    // Events
    container.querySelector('#exp-back')?.addEventListener('click', () => {
      const parts = currentPath.split('/').filter(Boolean);
      if (parts.length > 0) { parts.pop(); currentPath = '/' + parts.join('/'); selectedItem = null; render(); }
    });
    container.querySelectorAll('.breadcrumb-part').forEach(b => {
      b.addEventListener('click', () => { currentPath = b.getAttribute('data-path') || '/'; selectedItem = null; render(); });
    });
    container.querySelectorAll('.explorer-fav-item').forEach(f => {
      f.addEventListener('click', () => { currentPath = f.getAttribute('data-path'); selectedItem = null; render(); });
    });
    container.querySelectorAll('.explorer-item-v2').forEach(item => {
      item.addEventListener('click', (e) => {
        selectedItem = item.getAttribute('data-name');
        container.querySelectorAll('.explorer-item-v2').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        updateToolbarButtons();
      });
      item.addEventListener('dblclick', () => {
        const name = item.getAttribute('data-name');
        const type = item.getAttribute('data-type');
        if (type === 'dir') { currentPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`; selectedItem = null; render(); }
        else {
          const filePath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
          if (window.editorOpenFile) {
            window.editorOpenFile(filePath);
          } else {
            ui.openApp('editor');
            setTimeout(() => { if (window.AstraApps._editorOpen) window.AstraApps._editorOpen(filePath); }, 200);
          }
        }
      });
    });

    // Toolbar actions
    container.querySelector('#exp-newfolder')?.addEventListener('click', () => {
      const name = prompt('Folder name:');
      if (name && name.trim()) {
        const path = currentPath === '/' ? `/${name.trim()}` : `${currentPath}/${name.trim()}`;
        ui.state.createDir(path);
        ui.showToast('Folder Created', name.trim(), 'success');
        render();
      }
    });
    container.querySelector('#exp-newfile')?.addEventListener('click', () => {
      const name = prompt('File name:');
      if (name && name.trim()) {
        const path = currentPath === '/' ? `/${name.trim()}` : `${currentPath}/${name.trim()}`;
        ui.state.writeFile(path, '');
        ui.showToast('File Created', name.trim(), 'success');
        render();
      }
    });
    container.querySelector('#exp-rename')?.addEventListener('click', () => {
      if (!selectedItem) return;
      const newName = prompt('Rename to:', selectedItem);
      if (newName && newName.trim() && newName !== selectedItem) {
        const path = currentPath === '/' ? `/${selectedItem}` : `${currentPath}/${selectedItem}`;
        ui.state.renameFile(path, newName.trim());
        selectedItem = newName.trim();
        ui.showToast('Renamed', `→ ${newName.trim()}`, 'info');
        render();
      }
    });
    container.querySelector('#exp-delete')?.addEventListener('click', () => {
      if (!selectedItem) return;
      const path = currentPath === '/' ? `/${selectedItem}` : `${currentPath}/${selectedItem}`;
      const kernel = window.AstraKernel;
      if (kernel) { kernel.moveToTrash(path); ui.showToast('Moved to Trash', selectedItem, 'info'); }
      else { ui.state.deleteFile(path); }
      selectedItem = null;
      render();
    });
  }

  function updateToolbarButtons() {
    const renameBtn = container.querySelector('#exp-rename');
    const deleteBtn = container.querySelector('#exp-delete');
    if (renameBtn) renameBtn.disabled = !selectedItem;
    if (deleteBtn) deleteBtn.disabled = !selectedItem;
  }

  function getFileIcon(name) {
    if (name.endsWith('.js')) return '📜';
    if (name.endsWith('.json')) return '📋';
    if (name.endsWith('.md')) return '📝';
    if (name.endsWith('.txt')) return '📄';
    if (name.endsWith('.sh')) return '⚡';
    if (name.endsWith('.zip')) return '📦';
    if (name.endsWith('.log')) return '📋';
    return '📄';
  }

  function getFileSize(content) {
    if (!content) return '0 B';
    const bytes = new Blob([content]).size;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  render();
};

// ==========================================
// CODE EDITOR
// ==========================================
window.AstraApps.editor = function(container, ui) {
  let openFiles = [];
  let activeFileIdx = -1;

  function getAllFiles(node, path = '') {
    let files = [];
    if (!node || !node.children) return files;
    Object.keys(node.children).sort().forEach(name => {
      const child = Reflect.get(node.children, name);
      const fullPath = path ? `${path}/${name}` : `/${name}`;
      if (child.type === 'dir') {
        files.push({ name, path: fullPath, type: 'dir' });
        files = files.concat(getAllFiles(child, fullPath));
      } else {
        files.push({ name, path: fullPath, type: 'file' });
      }
    });
    return files;
  }

  function openFileInEditor(path) {
    const existing = openFiles.findIndex(f => f.path === path);
    if (existing >= 0) { activeFileIdx = existing; renderEditor(); return; }
    const node = ui.state.resolvePath(path);
    if (!node || node.type !== 'file') return;
    openFiles.push({ path, name: node.name, content: node.content });
    activeFileIdx = openFiles.length - 1;
    renderEditor();
  }

  window.AstraApps._editorOpen = openFileInEditor;

  function renderEditor() {
    const projectDir = ui.state.resolvePath('/Project_Astra');
    const homeDir = ui.state.resolvePath('/home/divyanshu');
    let sidebarFiles = getAllFiles(projectDir, '/Project_Astra');
    if (sidebarFiles.length === 0) sidebarFiles = getAllFiles(homeDir, '/home/divyanshu');

    const activeFile = openFiles[activeFileIdx];

    const editorTabsHTML = openFiles.map((f, i) => {
      const activeClass = i === activeFileIdx ? 'active' : '';
      return `
        <div class="editor-tab ${activeClass}" data-idx="${i}">
          <span>${window.escapeHTML(f.name)}</span>
          <span class="editor-tab-close" data-close="${i}">×</span>
        </div>
      `;
    }).join('');

    window.renderSafeHTML(container, `
      <div class="editor-app">
        <div class="editor-sidebar">
          <div class="editor-sidebar-title">Explorer</div>
          <ul class="editor-file-list">
            ${sidebarFiles.map(f => {
              const indent = (f.path.split('/').length - 2) * 12;
              const icon = f.type === 'dir' ? '📁' : '📄';
              const isActive = activeFile && activeFile.path === f.path;
              const activeClass = isActive ? 'active' : '';
              return '<li class="editor-file-item ' + window.escapeHTML(f.type) + ' ' + activeClass + '" data-path="' + f.path + '" style="padding-left: ' + (indent + 10) + 'px">' + icon + ' ' + window.escapeHTML(f.name) + '</li>';
            }).join('')}
          </ul>
        </div>
        <div class="editor-main">
          <div class="editor-tabs">
            ${editorTabsHTML}
          </div>
          <textarea class="editor-textarea" id="editor-content" spellcheck="false" ${!activeFile ? 'disabled placeholder="Select a file to edit..."' : ''}>${activeFile ? activeFile.content : ''}</textarea>
          <div class="editor-statusbar">
            <span>${activeFile ? activeFile.path : 'No file open'}</span>
            <span>${activeFile ? `${activeFile.content.split('\n').length} lines` : ''}</span>
          </div>
        </div>
      </div>
    `);

    // Events
    container.querySelectorAll('.editor-file-item.file').forEach(item => {
      item.addEventListener('click', () => openFileInEditor(item.getAttribute('data-path')));
    });
    container.querySelectorAll('.editor-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        if (e.target.classList.contains('editor-tab-close')) return;
        activeFileIdx = parseInt(tab.getAttribute('data-idx'));
        renderEditor();
      });
    });
    container.querySelectorAll('.editor-tab-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-close'));
        openFiles.splice(idx, 1);
        if (activeFileIdx >= openFiles.length) activeFileIdx = openFiles.length - 1;
        renderEditor();
      });
    });
    container.querySelector('#editor-content')?.addEventListener('input', (e) => {
      if (activeFile) {
        activeFile.content = e.target.value;
        ui.state.writeFile(activeFile.path, activeFile.content);
      }
    });
  }

  renderEditor();
};

// ==========================================
// MEMORY GRAPH
// ==========================================
window.AstraApps.memory = function(container, ui) {
  function renderGraph() {
    const { nodes, links } = ui.state.memoryGraph;
    const svgW = 600, svgH = 400;
    const typeColors = { user: '#a855f7', project: '#3b82f6', tech: '#10b981', preference: '#f59e0b', file: '#6366f1', event: '#ef4444', default: '#94a3b8' };

    const linksHTML = links.map(l => {
      const src = nodes.find(n => n.id === l.source);
      const tgt = nodes.find(n => n.id === l.target);
      if (!src || !tgt) return '';
      return '<line class="edge" x1="' + src.x + '" y1="' + src.y + '" x2="' + tgt.x + '" y2="' + tgt.y + '"/>';
    }).join('');

    const nodesHTML = nodes.map(n => {
      const color = Reflect.get(typeColors, n.type) || typeColors.default;
      const cleanLabel = n.label.length > 20 ? n.label.substring(0, 18) + '…' : n.label;
      return `
        <g class="node" transform="translate(${n.x}, ${n.y})">
          <circle r="24" fill="${color}" opacity="0.3" stroke="${color}" stroke-width="2"/>
          <circle r="6" fill="${color}"/>
          <text dy="36" font-size="9" fill="white" text-anchor="middle">${cleanLabel}</text>
        </g>
      `;
    }).join('');

    window.renderSafeHTML(container, `
      <div class="memory-app">
        <div class="memory-header-row">
          <div><strong>Memory Graph</strong> <span style="color: var(--text-muted); font-size: 12px">${nodes.length} nodes, ${links.length} links</span></div>
          <button class="btn btn-secondary" id="mem-clear">Clear Graph</button>
        </div>
        <div class="memory-visualizer">
          <svg class="graph-svg" viewBox="0 0 ${svgW} ${svgH}">
            ${linksHTML}
            ${nodesHTML}
          </svg>
        </div>
      </div>
    `);
    container.querySelector('#mem-clear')?.addEventListener('click', () => { ui.state.clearMemoryGraph(); renderGraph(); });
  }
  renderGraph();
};

// ==========================================
// TERMINAL — 40+ commands
// ==========================================
window.AstraApps.terminal = function(container, ui) {
  let history = [];
  let historyIdx = -1;
  let currentDir = '/home/divyanshu';
  let commandHistory = [];

  window.printTerminalRow = (text, cls) => {
    addOutput(text, cls);
  };

  window.AstraApps.terminalExecute = (cmd) => {
    const input = container.querySelector('#term-input');
    if (input) {
      input.value = cmd;
      addOutput(`${shortPath(currentDir)}$ ${cmd}`, 'cmd');
      processCommand(cmd);
      input.value = '';
      return true;
    }
    return false;
  };

  function render() {
    window.renderSafeHTML(container, `
      <div class="terminal-app">
        <div class="terminal-outputs" id="term-out"></div>
        <div class="terminal-input-row">
          <span class="terminal-prompt">${ui.state.currentSession.currentUser || 'divyanshu'}@astra:${shortPath(currentDir)}$</span>
          <input class="terminal-input" id="term-input" autofocus spellcheck="false" autocomplete="off">
        </div>
      </div>
    `);

    const input = container.querySelector('#term-input');
    const outEl = container.querySelector('#term-out');

    addOutput(`Astra OS 1.0 (Quantum) — Type 'help' for a list of commands.`, 'info');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = input.value.trim();
        if (cmd) {
          commandHistory.push(cmd);
          historyIdx = commandHistory.length;
          addOutput(`${shortPath(currentDir)}$ ${cmd}`, 'cmd');
          processCommand(cmd);
        }
        input.value = '';
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIdx > 0) { historyIdx--; input.value = commandHistory[historyIdx]; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIdx < commandHistory.length - 1) { historyIdx++; input.value = commandHistory[historyIdx]; }
        else { historyIdx = commandHistory.length; input.value = ''; }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        tabComplete(input);
      }
    });

    input.focus();
  }

  function addOutput(text, cls = '') {
    const outEl = container.querySelector('#term-out');
    if (!outEl) return;
    const row = document.createElement('div');
    row.className = `terminal-output-row ${cls}`;
    row.textContent = text;
    outEl.appendChild(row);
    outEl.scrollTop = outEl.scrollHeight;
  }

  function addOutputLines(lines, cls = '') {
    lines.forEach(l => addOutput(l, cls));
  }

  function tabComplete(input) {
    const val = input.value;
    const parts = val.split(' ');
    const lastWord = Reflect.get(parts, parts.length - 1);
    if (!lastWord) return;
    const dir = ui.state.resolvePath(currentDir);
    if (!dir || !dir.children) return;
    const matches = Object.keys(dir.children).filter(n => n.startsWith(lastWord));
    if (matches.length === 1) {
      Reflect.set(parts, parts.length - 1, matches[0]);
      input.value = parts.join(' ');
    } else if (matches.length > 1) {
      addOutput(matches.join('  '), 'info');
    }
  }

  function resolveRelativePath(path) {
    if (path.startsWith('/')) return path;
    if (path === '~') return '/home/' + (ui.state.currentSession.currentUser || 'divyanshu');
    if (path.startsWith('~/')) return '/home/' + (ui.state.currentSession.currentUser || 'divyanshu') + '/' + path.substring(2);
    if (currentDir === '/') return '/' + path;
    return currentDir + '/' + path;
  }

  function shortPath(p) {
    const home = '/home/' + (ui.state.currentSession.currentUser || 'divyanshu');
    if (p === home) return '~';
    if (p.startsWith(home + '/')) return '~' + p.substring(home.length);
    return p;
  }

  function processCommand(rawCmd) {
    const res = window.AstraKernel.executeCommand(rawCmd, currentDir, commandHistory);
    if (res.action === 'clear') {
      const outEl = container.querySelector('#term-out');
      if (outEl) window.renderSafeHTML(outEl, '');
    } else {
      if (res.output && res.output.length > 0) {
        addOutputLines(res.output, res.cls || '');
      }
    }
    if (res.newDir) {
      currentDir = res.newDir;
    }
    // Always refresh prompt in case directory or current user changes (e.g. su switch)
    const prompt = container.querySelector('.terminal-prompt');
    if (prompt) {
      prompt.textContent = `${ui.state.currentSession.currentUser || 'divyanshu'}@astra:${shortPath(currentDir)}$`;
    }
    if (res.action === 'reset') {
      setTimeout(() => { ui.state.resetAllState(); location.reload(); }, 1000);
    } else if (res.action === 'agent-run') {
      setTimeout(() => {
        if (window.triggerAgentWorkflow) {
          window.triggerAgentWorkflow();
        }
      }, 1000);
    }
    if (res.toast) {
      ui.showToast(res.toast.title, res.toast.message, res.toast.type);
    }
  }

  render();
};

// ==========================================
// TASKS BOARD (unchanged from original)
// ==========================================
window.AstraApps.tasks = function(container, ui) {
  function renderBoard() {
    const tasks = ui.state.agentTasks;
    const pending = tasks.filter(t => t.status === 'pending');
    const inProgress = tasks.filter(t => t.status === 'progress' || t.status === 'in-progress');
    const completed = tasks.filter(t => t.status === 'completed');

    window.renderSafeHTML(container, `
      <div class="tasks-app">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
          <h3 style="font-size: 15px; font-weight: 600">Agent Task Board</h3>
          <span style="font-size: 12px; color: var(--text-muted)">${tasks.length} total tasks</span>
        </div>
        <div class="tasks-grid">
          ${renderColumn('Pending', pending, '#f59e0b')}
          ${renderColumn('In Progress', inProgress, '#3b82f6')}
          ${renderColumn('Completed', completed, '#10b981')}
        </div>
      </div>
    `);
  }

  function renderColumn(title, items, color) {
    const cardsHTML = items.map(t => `
      <div class="task-card-ui" data-id="${window.escapeHTML(t.id)}">
        <div class="task-card-title">${window.escapeHTML(t.title)}</div>
        <div class="task-card-desc">${window.escapeHTML(t.desc)}</div>
        <div class="task-card-badge">${t.assigned}</div>
      </div>
    `).join('');

    return `
      <div class="tasks-column">
        <div class="tasks-col-title" style="color: ${color}">${title} (${items.length})</div>
        <div class="task-list">
          ${cardsHTML}
        </div>
      </div>
    `;
  }

  renderBoard();
};

// ==========================================
// AI DASHBOARD
// ==========================================
window.AstraApps.dashboard = function(container, ui) {
  function render() {
    const sv = ui.state.systemVars;
    const tasks = ui.state.agentTasks;
    const logs = ui.state.auditLogs;
    const currentFocus = ui.state.registry.system?.focusMode || 'coding';

    const statsHTML = [
      { label: 'Active Agents', val: '5', color: 'var(--color-green)' },
      { label: 'Tasks Completed', val: String(tasks.filter(t => t.status === 'completed').length), color: 'var(--color-blue)' },
      { label: 'Tokens Used', val: sv.tokensConsumed.toLocaleString(), color: 'var(--color-purple)' },
      { label: 'Focus Mode', val: currentFocus.toUpperCase(), color: 'var(--color-primary)' }
    ].map(s => `
      <div class="stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="dashboard-card-val" style="color: ${s.color}">${s.val}</div>
      </div>
    `).join('');

    const logsHTML = logs.slice(0, 10).map(l => `
      <div class="audit-row">
        <span class="audit-action"><strong>[${l.agent}]</strong> ${l.action}</span>
        <span class="audit-time">${l.timestamp}</span>
      </div>
    `).join('');

    // Scanners for Work Conscience
    const indexJs = ui.state.resolvePath('/Project_Astra/index.js');
    const hasSyntaxError = indexJs && (indexJs.content.includes('SyntaxError') || indexJs.content.includes('Unexpected token'));
    const readme = ui.state.resolvePath('/Project_Astra/README.md');
    const readmeOutdated = readme && indexJs && indexJs.content.includes('/api/v1/council') && !readme.content.includes('/api/v1/council');
    const pendingTasks = tasks.filter(t => t.status === 'pending');

    let conscienceHTML = '';
    const insightsList = [];

    if (hasSyntaxError) {
      insightsList.push({
        type: 'error',
        text: 'Syntax Error in Project_Astra/index.js: Unexpected token ) on line 20 prevents compilation.',
        actionLabel: 'Open index.js in Editor',
        action: 'open-index'
      });
    }
    if (readmeOutdated) {
      insightsList.push({
        type: 'warning',
        text: 'README.md is missing documentation for route `/api/v1/council` implemented in index.js.',
        actionLabel: 'Open README.md',
        action: 'open-readme'
      });
    }
    if (pendingTasks.length > 0) {
      insightsList.push({
        type: 'info',
        text: `You have ${pendingTasks.length} pending task(s) remaining in your Agent Task Board checklist.`,
        actionLabel: 'View Task Board',
        action: 'open-tasks'
      });
    }

    if (insightsList.length === 0) {
      conscienceHTML = `
        <div class="conscience-card success">
          <div class="conscience-text">🟢 All systems active & codebase compiled cleanly. No conscience alerts found!</div>
        </div>
      `;
    } else {
      insightsList.forEach((ins, idx) => {
        conscienceHTML += `
          <div class="conscience-card ${ins.type}">
            <div class="conscience-text">${window.escapeHTML(ins.text)}</div>
            <button class="conscience-action-btn" data-act="${ins.action}">${window.escapeHTML(ins.actionLabel)}</button>
          </div>
        `;
      });
    }

    const gitRepo = Reflect.get(ui.state.gitRepos, '/Project_Astra');
    const gitBranch = gitRepo ? gitRepo.branch : 'main';

    window.renderSafeHTML(container, `
      <div class="dashboard-app">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: -4px;">Welcome back, ${window.escapeHTML(sv.user)}</div>
        <div style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 4px;">Astra OS active workspace: <strong>/Project_Astra</strong> (Branch: ${window.escapeHTML(gitBranch)})</div>
        
        <div class="dashboard-stats">
          ${statsHTML}
        </div>
        
        <div class="dashboard-details-row" style="grid-template-columns: 1.2fr 1fr; margin-top: 4px;">
          <!-- Left Column: Smart Desk Workspace Controller -->
          <div class="dashboard-panel" style="gap: 10px;">
            <h3>Smart Desk Control Panel</h3>
            
            <div style="display: flex; flex-direction: column; gap: 4px; background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px; border: 1px solid var(--border-glass);">
              <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">Focus Mode Switcher</span>
              <div class="focus-mode-switches">
                <button class="focus-btn ${currentFocus === 'coding' ? 'active' : ''}" data-focus="coding">Coding Mode</button>
                <button class="focus-btn ${currentFocus === 'deepwork' ? 'active' : ''}" data-focus="deepwork">Deep Work</button>
                <button class="focus-btn ${currentFocus === 'research' ? 'active' : ''}" data-focus="research">Research</button>
              </div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 4px;">
              <button class="btn btn-primary" id="dashboard-continue-work" style="flex: 1; padding: 10px; font-size: 12.5px; font-weight: 600;">🔄 Continue Work (Restore Workspace)</button>
              <button class="btn btn-secondary" id="dashboard-briefing" style="padding: 10px; font-size: 12.5px;">📅 View Daily Briefing</button>
            </div>

            <div style="margin-top: 6px; font-size: 11.5px; color: var(--text-secondary); border-top: 1px solid var(--border-glass); padding-top: 8px;">
              <strong>Workspace Status Summary:</strong>
              <ul style="margin: 4px 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 3px;">
                <li>Active Workspace Index: Desktop ${sv.currentWorkspace + 1}</li>
                <li>VFS filesystem state: ${Object.keys(ui.state.fs.children || {}).length} root folders tracked</li>
                <li>Audit Log: ${logs.length} background operations recorded</li>
              </ul>
            </div>
          </div>

          <!-- Right Column: Work Conscience Scanner -->
          <div class="dashboard-panel">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3>AI Workspace Conscience</h3>
              <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">Real-Time Scan</span>
            </div>
            <div class="conscience-list">
              ${conscienceHTML}
            </div>
          </div>
        </div>

        <!-- Bottom Row: Recent Audit Events -->
        <div class="dashboard-panel" style="flex-grow: 0; min-height: 120px;">
          <h3>Agent Activity Audit Log (Recent Events)</h3>
          <div class="logs-audit-list" style="height: 100px;">
            ${logsHTML}
          </div>
        </div>
      </div>
    `);

    // Wire up events
    container.querySelectorAll('.focus-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-focus');
        ui.setFocusMode(mode);
        render();
      });
    });

    container.querySelector('#dashboard-continue-work')?.addEventListener('click', () => {
      ui.restoreWorkspace();
    });

    container.querySelector('#dashboard-briefing')?.addEventListener('click', () => {
      ui.openApp('dailybriefing');
    });

    container.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-act');
        if (act === 'open-index') {
          ui.openApp('editor');
          setTimeout(() => { if (window.editorOpenFile) window.editorOpenFile('/Project_Astra/index.js'); }, 200);
        } else if (act === 'open-readme') {
          ui.openApp('editor');
          setTimeout(() => { if (window.editorOpenFile) window.editorOpenFile('/Project_Astra/README.md'); }, 200);
        } else if (act === 'open-tasks') {
          ui.openApp('tasks');
        }
      });
    });
  }

  render();
};
