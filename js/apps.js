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
    const kernel = window.AstraKernel;
    const parts = rawCmd.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const cmd = parts[0];
    const args = parts.slice(1).map(a => a.replace(/^"|"$/g, ''));

    // Handle sudo prefix
    if (cmd === 'sudo') {
      if (!kernel) return addOutput('sudo: kernel not loaded', 'error');
      const user = ui.state.users.find(u => u.username === ui.state.currentSession.currentUser);
      if (!user || user.role !== 'admin') return addOutput('sudo: permission denied', 'error');
      addOutput('[sudo] password accepted for ' + ui.state.currentSession.currentUser, 'success');
      processCommand(parts.slice(1).join(' '));
      return;
    }

    switch (cmd) {
      // ---- HELP ----
      case 'help':
        addOutputLines([
          '━━━ Astra OS Terminal — Command Reference ━━━',
          '',
          'FILESYSTEM:  ls, cat, pwd, cd, mkdir, touch, rm, cp, mv, chmod, chown, tree, find, grep, echo, wc',
          'PROCESSES:   ps, kill, top, uptime',
          'USER:        whoami, su, sudo, passwd, id',
          'PACKAGE:     apt update, apt install, apt remove, apt list, apt search',
          'NETWORK:     ping, curl, ifconfig, nslookup, netstat, wget, hostname',
          'GIT:         git init/status/add/commit/log/diff/branch/checkout',
          'SYSTEM:      neofetch, uname, date, df, free, dmesg, clear, history, sysreset',
          'FUN:         cowsay, fortune, sl, figlet (install via apt)',
          ''
        ], 'info');
        break;

      // ---- FILESYSTEM ----
      case 'ls': {
        const target = args[0] ? resolveRelativePath(args[0]) : currentDir;
        const showHidden = args.includes('-a') || args.includes('-la') || args.includes('-al');
        const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');
        const dir = ui.state.resolvePath(target);
        if (!dir || dir.type !== 'dir') return addOutput(`ls: cannot access '${args[0] || target}': No such file or directory`, 'error');
        const entries = Object.keys(dir.children || {}).filter(n => showHidden || !n.startsWith('.')).sort();
        if (showLong) {
          entries.forEach(name => {
            const node = Reflect.get(dir.children, window.sanitizeKey(name));
            const perm = node.permissions || (node.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--');
            const owner = node.owner || 'divyanshu';
            const size = node.type === 'file' ? (node.content || '').length : 4096;
            const prefix = node.type === 'dir' ? 'd' : '-';
            addOutput(`${prefix}${perm}  ${owner.padEnd(12)} ${String(size).padStart(8)}  ${name}${node.type === 'dir' ? '/' : ''}`);
          });
        } else {
          addOutput(entries.map(n => Reflect.get(dir.children, window.sanitizeKey(n)).type === 'dir' ? n + '/' : n).join('  '));
        }
        break;
      }
      case 'cat': {
        if (!args[0]) return addOutput('cat: missing operand', 'error');
        const path = resolveRelativePath(args[0]);
        const file = ui.state.resolvePath(path);
        if (!file) return addOutput(`cat: ${args[0]}: No such file or directory`, 'error');
        if (file.type === 'dir') return addOutput(`cat: ${args[0]}: Is a directory`, 'error');
        addOutputLines((file.content || '').split('\n'));
        break;
      }
      case 'pwd':
        addOutput(currentDir);
        break;
      case 'cd': {
        if (!args[0] || args[0] === '~') { currentDir = '/home/' + (ui.state.currentSession.currentUser || 'divyanshu'); }
        else if (args[0] === '..') {
          const parts = currentDir.split('/').filter(Boolean);
          parts.pop();
          currentDir = '/' + parts.join('/');
        } else if (args[0] === '-') { addOutput(currentDir); }
        else {
          const target = resolveRelativePath(args[0]);
          const dir = ui.state.resolvePath(target);
          if (!dir || dir.type !== 'dir') return addOutput(`cd: ${args[0]}: No such directory`, 'error');
          currentDir = target;
        }
        // Update prompt
        const prompt = container.querySelector('.terminal-prompt');
        if (prompt) prompt.textContent = `${ui.state.currentSession.currentUser || 'divyanshu'}@astra:${shortPath(currentDir)}$`;
        break;
      }
      case 'mkdir': {
        if (!args[0]) return addOutput('mkdir: missing operand', 'error');
        const path = resolveRelativePath(args[0]);
        ui.state.createDir(path);
        break;
      }
      case 'touch': {
        if (!args[0]) return addOutput('touch: missing operand', 'error');
        const path = resolveRelativePath(args[0]);
        if (!ui.state.resolvePath(path)) ui.state.writeFile(path, '');
        break;
      }
      case 'rm': {
        if (!args[0]) return addOutput('rm: missing operand', 'error');
        const path = resolveRelativePath(args[0].replace('-rf ', '').replace('-r ', ''));
        if (kernel) kernel.moveToTrash(path);
        else ui.state.deleteFile(path);
        break;
      }
      case 'cp': {
        if (args.length < 2) return addOutput('cp: missing operand', 'error');
        const src = resolveRelativePath(args[0]);
        const dst = resolveRelativePath(args[1]);
        if (!ui.state.copyFile(src, dst)) addOutput(`cp: cannot copy '${args[0]}'`, 'error');
        break;
      }
      case 'mv': {
        if (args.length < 2) return addOutput('mv: missing operand', 'error');
        const src = resolveRelativePath(args[0]);
        const dst = resolveRelativePath(args[1]);
        if (!ui.state.moveFile(src, dst)) addOutput(`mv: cannot move '${args[0]}'`, 'error');
        break;
      }
      case 'chmod': {
        if (args.length < 2) return addOutput('chmod: missing operand', 'error');
        if (kernel) kernel.chmod(resolveRelativePath(args[1]), args[0]);
        break;
      }
      case 'chown': {
        if (args.length < 2) return addOutput('chown: missing operand', 'error');
        if (kernel) kernel.chown(resolveRelativePath(args[1]), args[0]);
        break;
      }
      case 'tree': {
        const target = args[0] ? resolveRelativePath(args[0]) : currentDir;
        const dir = ui.state.resolvePath(target);
        if (!dir || dir.type !== 'dir') return addOutput('tree: not a directory', 'error');
        addOutput(target);
        printTree(dir, '');
        break;
      }
      case 'find': {
        const pattern = args[0] || '*';
        const dir = ui.state.resolvePath(currentDir);
        if (!dir) return;
        const results = findFiles(dir, currentDir, pattern);
        addOutputLines(results.length > 0 ? results : ['(no matches)'], 'info');
        break;
      }
      case 'grep': {
        if (args.length < 2) return addOutput('grep: usage: grep <pattern> <file>', 'error');
        const pattern = args[0];
        const path = resolveRelativePath(args[1]);
        const file = ui.state.resolvePath(path);
        if (!file || file.type !== 'file') return addOutput(`grep: ${args[1]}: No such file`, 'error');
        const lines = (file.content || '').split('\n');
        let found = false;
        lines.forEach((line, i) => {
          if (line.toLowerCase().includes(pattern.toLowerCase())) {
            addOutput(`${i + 1}: ${line}`, 'success');
            found = true;
          }
        });
        if (!found) addOutput('(no matches)', 'info');
        break;
      }
      case 'echo':
        addOutput(args.join(' '));
        break;
      case 'wc': {
        if (!args[0]) return addOutput('wc: missing operand', 'error');
        const path = resolveRelativePath(args[0]);
        const file = ui.state.resolvePath(path);
        if (!file || file.type !== 'file') return addOutput(`wc: ${args[0]}: No such file`, 'error');
        const lines = (file.content || '').split('\n').length;
        const words = (file.content || '').split(/\s+/).filter(Boolean).length;
        const chars = (file.content || '').length;
        addOutput(`  ${lines}  ${words}  ${chars} ${args[0]}`);
        break;
      }

      // ---- PROCESSES ----
      case 'ps': {
        if (!kernel) return addOutput('kernel not loaded', 'error');
        const procs = kernel.listProcesses();
        addOutput('  PID   NAME             STATE      CPU%   MEM(MB)');
        addOutput('  ---   ----             -----      ----   -------');
        procs.forEach(p => {
          addOutput(`  ${String(p.pid).padEnd(6)}${p.name.padEnd(17)}${p.state.padEnd(11)}${String(p.cpuPercent).padEnd(7)}${p.memMB}`);
        });
        break;
      }
      case 'kill': {
        if (!args[0]) return addOutput('kill: usage: kill <pid>', 'error');
        if (!kernel) return addOutput('kernel not loaded', 'error');
        const result = kernel.killProcess(args[0]);
        addOutput(result.success ? `Killed ${window.escapeHTML(result.name)} (PID ${args[0]})` : result.error, result.success ? 'success' : 'error');
        break;
      }
      case 'top': {
        if (!kernel) return addOutput('kernel not loaded', 'error');
        addOutput(`top - ${new Date().toLocaleTimeString()}, up ${kernel.getUptime()}, ${kernel.listProcesses().length} tasks`);
        addOutput(`CPU: ${kernel.getTotalCpu()}%   MEM: ${kernel.getTotalMem()}MB / ${ui.state.hardware.ram.totalGB * 1024}MB`);
        addOutput('');
        const procs = kernel.listProcesses().sort((a, b) => parseFloat(b.cpuPercent) - parseFloat(a.cpuPercent)).slice(0, 15);
        addOutput('  PID   NAME             STATE      CPU%   MEM');
        procs.forEach(p => addOutput(`  ${String(p.pid).padEnd(6)}${p.name.padEnd(17)}${p.state.padEnd(11)}${String(p.cpuPercent).padEnd(7)}${p.memMB}MB`));
        break;
      }
      case 'uptime':
        if (kernel) addOutput(`up ${kernel.getUptime()}, ${kernel.listProcesses().length} processes`);
        break;

      // ---- USER ----
      case 'whoami':
        addOutput(ui.state.currentSession.currentUser || 'divyanshu');
        break;
      case 'id': {
        const s = ui.state.currentSession;
        addOutput(`uid=${s.uid}(${s.currentUser}) gid=1000(staff) groups=1000(staff)${s.role === 'admin' ? ',27(sudo)' : ''}`);
        break;
      }
      case 'su': {
        if (!args[0]) return addOutput('su: usage: su <username>', 'error');
        if (kernel && kernel.switchUser(args[0])) {
          addOutput(`Switched to ${args[0]}`, 'success');
          const prompt = container.querySelector('.terminal-prompt');
          if (prompt) prompt.textContent = `${args[0]}@astra:${shortPath(currentDir)}$`;
        } else addOutput(`su: user '${args[0]}' not found`, 'error');
        break;
      }
      case 'passwd': {
        addOutput('Password change is handled via Settings > Security.', 'info');
        break;
      }

      // ---- PACKAGE MANAGER ----
      case 'apt': {
        if (!kernel) return addOutput('kernel not loaded', 'error');
        const subCmd = args[0];
        if (subCmd === 'update') {
          addOutputLines(kernel.aptUpdate());
        } else if (subCmd === 'install') {
          if (!args[1]) return addOutput('apt install: missing package name', 'error');
          const result = kernel.aptInstall(args[1]);
          addOutputLines(result.lines, result.success ? '' : 'error');
        } else if (subCmd === 'remove') {
          if (!args[1]) return addOutput('apt remove: missing package name', 'error');
          const result = kernel.aptRemove(args[1]);
          addOutputLines(result.lines, result.success ? '' : 'error');
        } else if (subCmd === 'list') {
          const installed = args.includes('--installed');
          const pkgs = kernel.aptList(installed);
          pkgs.forEach(p => addOutput(`${window.escapeHTML(p.name)}/${p.version} ${p.installed ? '[installed]' : ''}`));
        } else if (subCmd === 'search') {
          if (!args[1]) return addOutput('apt search: missing query', 'error');
          const pkgs = kernel.aptSearch(args[1]);
          pkgs.forEach(p => addOutput(`${window.escapeHTML(p.name)} - ${p.description}`));
        } else {
          addOutput('apt: usage: apt [update|install|remove|list|search] ...', 'error');
        }
        break;
      }

      // ---- NETWORK ----
      case 'ping': {
        if (!args[0]) return addOutput('ping: missing host', 'error');
        if (!kernel) return addOutput('kernel not loaded', 'error');
        addOutputLines(kernel.ping(args[0]));
        break;
      }
      case 'curl': {
        if (!args[0]) return addOutput('curl: missing URL', 'error');
        if (!kernel) return addOutput('kernel not loaded', 'error');
        addOutputLines(kernel.curl(args[0]));
        break;
      }
      case 'ifconfig':
        if (kernel) addOutputLines(kernel.ifconfig());
        break;
      case 'nslookup': {
        if (!args[0]) return addOutput('nslookup: missing host', 'error');
        if (kernel) addOutputLines(kernel.nslookup(args[0]));
        break;
      }
      case 'netstat':
        if (kernel) addOutputLines(kernel.netstat());
        break;
      case 'wget': {
        if (!args[0]) return addOutput('wget: missing URL', 'error');
        const fileName = args[0].split('/').pop() || 'index.html';
        addOutput(`--${new Date().toLocaleTimeString()}--  ${args[0]}`);
        addOutput(`Resolving host... connected.`);
        addOutput(`HTTP request sent, awaiting response... 200 OK`);
        addOutput(`Length: ${Math.floor(Math.random() * 50000 + 5000)} bytes`);
        addOutput(`Saving to: '${fileName}'`);
        addOutput(`${fileName}  100%[==================>]  saved.`, 'success');
        break;
      }
      case 'hostname':
        addOutput(ui.state.network.hostname || 'astra-desktop');
        break;

      // ---- GIT ----
      case 'git': {
        if (!kernel) return addOutput('kernel not loaded', 'error');
        const sub = args[0];
        if (sub === 'init') { addOutputLines(kernel.gitInit(currentDir)); }
        else if (sub === 'status') { addOutputLines(kernel.gitStatus(currentDir)); }
        else if (sub === 'add') { 
          const result = kernel.gitAdd(currentDir, args[1] || '.');
          if (result.length > 0) addOutputLines(result, 'error');
        }
        else if (sub === 'commit') {
          const mFlag = args.indexOf('-m');
          const msg = mFlag >= 0 ? args.slice(mFlag + 1).join(' ').replace(/^"|"$/g, '') : 'No message';
          addOutputLines(kernel.gitCommit(currentDir, msg));
        }
        else if (sub === 'log') { addOutputLines(kernel.gitLog(currentDir)); }
        else if (sub === 'diff') { addOutputLines(kernel.gitDiff(currentDir)); }
        else if (sub === 'branch') { addOutputLines(kernel.gitBranch(currentDir)); }
        else if (sub === 'checkout') {
          const isNew = args[1] === '-b';
          const branchName = isNew ? args[2] : args[1];
          if (!branchName) return addOutput('git checkout: specify branch name', 'error');
          addOutputLines(kernel.gitCheckoutBranch(currentDir, branchName, isNew));
        }
        else { addOutput(`git: '${sub}' is not a git command. See 'help'.`, 'error'); }
        break;
      }

      // ---- SYSTEM ----
      case 'neofetch':
        if (kernel) {
          if (!kernel.isPackageInstalled('neofetch')) return addOutput('neofetch: command not found. Install with: apt install neofetch', 'error');
          addOutputLines(kernel.neofetch());
        }
        break;
      case 'uname':
        addOutput(args.includes('-a') ? 'Astra astra-desktop 6.2.0-astra #1 SMP x86_64 GNU/Astra' : 'Astra');
        break;
      case 'date':
        addOutput(new Date().toString());
        break;
      case 'df':
        if (kernel) {
          addOutput('Filesystem   Type   Size   Used   Avail  Use%  Mounted');
          addOutputLines(kernel.dfHuman());
        }
        break;
      case 'free':
        if (kernel) addOutputLines(kernel.freeHuman());
        break;
      case 'dmesg':
        if (kernel) addOutputLines(kernel.dmesg(args[0] ? parseInt(args[0]) : 30));
        break;
      case 'clear':
        const outEl = container.querySelector('#term-out');
        if (outEl) window.renderSafeHTML(outEl, '');
        break;
      case 'history':
        commandHistory.forEach((c, i) => addOutput(`  ${i + 1}  ${c}`));
        break;
      case 'sysreset':
        addOutput('⚠ Factory resetting Astra OS...', 'alert');
        setTimeout(() => { ui.state.resetAllState(); location.reload(); }, 1000);
        break;

      // ---- FUN PACKAGES ----
      case 'cowsay': {
        if (!kernel || !kernel.isPackageInstalled('cowsay')) return addOutput('cowsay: command not found. Install with: apt install cowsay', 'error');
        const msg = args.join(' ') || 'Moo!';
        const pad = msg.length + 2;
        addOutputLines([
          ' ' + '_'.repeat(pad),
          html`< ${msg} >`,
          ' ' + '-'.repeat(pad),
          '        \\   ^__^',
          '         \\  (oo)\\_______',
          '            (__)\\       )\\/\\',
          '                ||----w |',
          '                ||     ||'
        ]);
        break;
      }
      case 'fortune': {
        if (!kernel || !kernel.isPackageInstalled('fortune')) return addOutput('fortune: command not found. Install with: apt install fortune', 'error');
        const fortunes = [
          'The best way to predict the future is to invent it. — Alan Kay',
          'Programs must be written for people to read, and only incidentally for machines to execute. — Abelson & Sussman',
          'Any sufficiently advanced technology is indistinguishable from magic. — Arthur C. Clarke',
          'First, solve the problem. Then, write the code. — John Johnson',
          'Talk is cheap. Show me the code. — Linus Torvalds',
          'The computer was born to solve problems that did not exist before. — Bill Gates',
          'The most disastrous thing that you can ever learn is your first programming language. — Alan Kay'
        ];
        addOutput(Reflect.get(fortunes, Math.floor(Math.random() * fortunes.length)));
        break;
      }
      case 'sl': {
        if (!kernel || !kernel.isPackageInstalled('sl')) return addOutput('sl: command not found. Install with: apt install sl', 'error');
        addOutputLines([
          '      ====        ________                ___________',
          '  _D _|  |_______/        \\__I_I_____===__|___________|',
          '   |(_)---  |   H\\________/ |   |        =|___ ___|',
          '   /     |  |   H  |  |     |   |         ||_| |_||',
          '  |      |  |   H  |__--------------------| [___] |',
          '  | ________|___H__/__|_____/[][]~\\_______|       |',
          '  |/ |   |-----------I_____I [][] []  D   |=======|__',
          '__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__',
          ' |/-=|___|=    ||    ||    ||    |_____/~\\___/        ',
          '  \\_/      \\O=====O=====O=====O_/      \\_/           '
        ]);
        break;
      }
      case 'figlet': {
        if (!kernel || !kernel.isPackageInstalled('figlet')) return addOutput('figlet: command not found. Install with: apt install figlet', 'error');
        const text = args.join(' ') || 'ASTRA';
        // Simple block text
        const bigMap = {
          'A': ['  █  ', ' █ █ ', '█████', '█   █', '█   █'],
          'B': ['████ ', '█   █', '████ ', '█   █', '████ '],
          'S': [' ████', '█    ', ' ███ ', '    █', '████ '],
          'T': ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
          'R': ['████ ', '█   █', '████ ', '█ █  ', '█  █ ']
        };
        const chars = text.toUpperCase().split('');
        for (let row = 0; row < 5; row++) {
          let line = '';
          chars.forEach(c => { line += (Reflect.get(bigMap, c) ? Reflect.get(bigMap, c)[row] : '     ') + ' '; });
          addOutput(line);
        }
        break;
      }

      // ---- AGENT COMMANDS ----
      case 'agent':
        if (args[0] === 'status') {
          addOutput('Agent System: ONLINE');
          addOutput(`Active: PlannerAgent, ExecutorAgent, MemoryAgent, WatcherAgent, SafetyLayer`);
          addOutput(`Tasks: ${ui.state.agentTasks.filter(t => t.status === 'pending').length} pending, ${ui.state.agentTasks.filter(t => t.status === 'completed').length} completed`);
        } else if (args[0] === 'run') {
          addOutput('Initiating agent workflow...', 'working');
          ui.showToast('Agent Activated', 'Starting task execution...', 'info');
          setTimeout(() => {
            if (window.triggerAgentWorkflow) {
              window.triggerAgentWorkflow();
            }
          }, 1000);
        } else {
          addOutput('agent: usage: agent [status|run]', 'error');
        }
        break;

      default:
        addOutput(`${cmd}: command not found. Type 'help' for available commands.`, 'error');
    }
  }

  function printTree(node, prefix) {
    if (!node || !node.children) return;
    const keys = Object.keys(node.children);
    keys.forEach((name, idx) => {
      const isLast = idx === keys.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const child = Reflect.get(node.children, name);
      addOutput(`${prefix}${connector}${name}${child.type === 'dir' ? '/' : ''}`);
      if (child.type === 'dir') printTree(child, prefix + (isLast ? '    ' : '│   '));
    });
  }

  function findFiles(node, basePath, pattern) {
    let results = [];
    if (!node || !node.children) return results;
    Object.keys(node.children).forEach(name => {
      const child = Reflect.get(node.children, name);
      const fullPath = basePath === '/' ? `/${name}` : `${basePath}/${name}`;
      if (pattern === '*' || name.includes(pattern.replace('*', ''))) results.push(fullPath);
      if (child.type === 'dir') results = results.concat(findFiles(child, fullPath, pattern));
    });
    return results;
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
