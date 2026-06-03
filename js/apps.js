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
  let searchTerm = '';

  function render() {
    const state = ui.state;
    const isTrashView = currentPath === 'trash://';
    let entries = [];

    if (isTrashView) {
      entries = (state.trash || []).map((item, index) => ({
        name: item.path.split('/').pop() || item.path,
        type: item.node.type,
        trashIndex: index,
        originalPath: item.path,
        deletedAt: item.deletedAt,
        content: item.node.content || ''
      }));
    } else {
      const dir = state.resolvePath(currentPath);
      if (!dir || dir.type !== 'dir') { currentPath = '/'; render(); return; }
      entries = Object.keys(dir.children || {}).map(name => ({ name, ...Reflect.get(dir.children, window.sanitizeKey(name)) }));
    }
    
    // Apply search filter if active
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      entries = entries.filter(e => e.name.toLowerCase().includes(q));
    }

    let explorerGridHTML = '';
    if (entries.length === 0) {
      explorerGridHTML = window.html`<div class="explorer-empty">${searchTerm.trim() ? 'No matching files' : (isTrashView ? 'Trash Bin is empty' : 'This folder is empty')}</div>`;
    } else {
      entries.forEach(e => {
        const selectedClass = selectedItem === e.name ? 'selected' : '';
        const icon = e.type === 'dir' ? '📁' : getFileIcon(e.name);
        const sizeHTML = e.type === 'file' ? window.html`<div class="explorer-item-size">${getFileSize(e.content)}</div>` : '';
        explorerGridHTML += window.html`
          <div class="explorer-item-v2 ${selectedClass}" data-name="${e.name}" data-type="${e.type}">
            <div class="explorer-item-icon">${icon}</div>
            <div class="explorer-item-name" title="${isTrashView ? 'Original Path: ' + e.originalPath : e.name}">${e.name}</div>
            ${window.safeHTML(sizeHTML)}
          </div>
        `;
      });
    }

    const pathParts = isTrashView ? [] : currentPath.split('/').filter(Boolean);
    const breadcrumbHTML = isTrashView 
      ? '<span class="breadcrumb-sep">/</span><span class="breadcrumb-part" data-path="trash://">Trash Bin</span>'
      : pathParts.map((p, i) => {
          const path = '/' + pathParts.slice(0, i + 1).join('/');
          return '<span class="breadcrumb-sep">/</span><span class="breadcrumb-part" data-path="' + path + '">' + window.escapeHTML(p) + '</span>';
        }).join('');

    window.renderSafeHTML(container, window.html`
      <div class="explorer-app-v2">
        <div class="explorer-toolbar">
          <button class="explorer-tb-btn" id="exp-back" title="Back" ${isTrashView ? 'disabled' : ''}>◀</button>
          <div class="explorer-breadcrumb">
            ${window.safeHTML(isTrashView ? '' : '<span class="breadcrumb-part" data-path="/">/</span>')}
            ${window.safeHTML(breadcrumbHTML)}
          </div>
          <input type="text" class="explorer-search" id="exp-search" placeholder="Search..." value="${searchTerm}">
          <div class="explorer-tb-actions">
            ${window.safeHTML(isTrashView ? `
              <button class="explorer-tb-btn" id="exp-restore" title="Restore" ${!selectedItem ? 'disabled' : ''}>↩ Restore</button>
              <button class="explorer-tb-btn" id="exp-empty-trash" title="Empty Trash">🗑 Empty</button>
            ` : `
              <button class="explorer-tb-btn" id="exp-newfolder" title="New Folder">📁+</button>
              <button class="explorer-tb-btn" id="exp-newfile" title="New File">📄+</button>
              <button class="explorer-tb-btn" id="exp-copy" title="Copy" ${!selectedItem ? 'disabled' : ''}>📋</button>
              <button class="explorer-tb-btn" id="exp-paste" title="Paste" ${!window.AstraClipboard ? 'disabled' : ''}>📥</button>
              <button class="explorer-tb-btn" id="exp-rename" title="Rename" ${!selectedItem ? 'disabled' : ''}>✏️</button>
              <button class="explorer-tb-btn" id="exp-delete" title="Delete" ${!selectedItem ? 'disabled' : ''}>🗑</button>
            `)}
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
            <div class="explorer-fav-item" data-path="/">💽 Root (/)</div>
            <div class="explorer-fav-item" data-path="/etc">⚙ /etc</div>
            <div class="explorer-fav-item" data-path="/var/log">📋 /var/log</div>
            <div class="explorer-fav-item" data-path="/tmp">🗑 /tmp</div>
            <div class="explorer-fav-item" data-path="trash://">🗑 Trash Bin</div>
          </div>
        </div>
        <div class="explorer-main-v2" id="exp-main">
          ${window.safeHTML(explorerGridHTML)}
        </div>
        <div class="explorer-statusbar">${entries.length} items • ${isTrashView ? 'Trash Bin' : currentPath}</div>
      </div>
    `);

    // Highlight active sidebar item
    container.querySelectorAll('.explorer-fav-item').forEach(f => {
      if (f.getAttribute('data-path') === currentPath) {
        f.classList.add('active');
      } else {
        f.classList.remove('active');
      }
    });

    // Events
    container.querySelector('#exp-back')?.addEventListener('click', () => {
      if (isTrashView) return;
      const parts = currentPath.split('/').filter(Boolean);
      if (parts.length > 0) { parts.pop(); currentPath = '/' + parts.join('/'); selectedItem = null; searchTerm = ''; render(); }
    });
    container.querySelectorAll('.breadcrumb-part').forEach(b => {
      b.addEventListener('click', () => { currentPath = b.getAttribute('data-path') || '/'; selectedItem = null; searchTerm = ''; render(); });
    });
    container.querySelectorAll('.explorer-fav-item').forEach(f => {
      f.addEventListener('click', () => { currentPath = f.getAttribute('data-path'); selectedItem = null; searchTerm = ''; render(); });
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
        if (isTrashView) {
          const match = entries.find(e => e.name === name);
          if (match && window.AstraKernel) {
            window.AstraKernel.restoreFromTrash(match.trashIndex);
            ui.showToast('Restored File', name, 'success');
            selectedItem = null;
            render();
          }
          return;
        }
        if (type === 'dir') { currentPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`; selectedItem = null; searchTerm = ''; render(); }
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

    // Search Box Real-Time Event
    const searchInput = container.querySelector('#exp-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        const q = searchTerm.toLowerCase().trim();
        const items = container.querySelectorAll('.explorer-item-v2');
        const main = container.querySelector('#exp-main');
        let visibleCount = 0;

        items.forEach(item => {
          const name = item.getAttribute('data-name').toLowerCase();
          if (name.includes(q)) {
            item.style.display = '';
            visibleCount++;
          } else {
            item.style.display = 'none';
          }
        });

        let emptyMsg = container.querySelector('.explorer-empty');
        if (visibleCount === 0) {
          if (!emptyMsg) {
            const div = document.createElement('div');
            div.className = 'explorer-empty';
            div.textContent = 'No matching files';
            main.appendChild(div);
          } else {
            emptyMsg.textContent = 'No matching files';
            emptyMsg.style.display = '';
          }
        } else {
          if (emptyMsg) emptyMsg.style.display = 'none';
        }
      });
      // Only auto-focus search if user was actively searching
      if (searchTerm.trim()) {
        searchInput.focus();
        const len = searchInput.value.length;
        searchInput.setSelectionRange(len, len);
      }
    }

    // Toolbar actions
    if (isTrashView) {
      container.querySelector('#exp-restore')?.addEventListener('click', () => {
        if (!selectedItem) return;
        const match = entries.find(e => e.name === selectedItem);
        if (match && window.AstraKernel) {
          window.AstraKernel.restoreFromTrash(match.trashIndex);
          ui.showToast('Restored File', selectedItem, 'success');
          selectedItem = null;
          render();
        }
      });
      container.querySelector('#exp-empty-trash')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to permanently delete all items in Trash?')) {
          if (window.AstraKernel) {
            window.AstraKernel.emptyTrash();
            ui.showToast('Trash Emptied', 'All items deleted permanently.', 'info');
            selectedItem = null;
            render();
          }
        }
      });
    } else {
      container.querySelector('#exp-newfolder')?.addEventListener('click', () => {
        const name = prompt('Folder name:');
        if (name && name.trim()) {
          const path = currentPath === '/' ? `/${name.trim()}` : `${currentPath}/${name.trim()}`;
          Astra.syscall('fs:mkdir', path)
            .then(() => {
              ui.showToast('Folder Created', name.trim(), 'success');
              render();
            })
            .catch(err => {
              ui.showToast('Error', err.message, 'error');
            });
        }
      });
      container.querySelector('#exp-newfile')?.addEventListener('click', () => {
        const name = prompt('File name:');
        if (name && name.trim()) {
          const path = currentPath === '/' ? `/${name.trim()}` : `${currentPath}/${name.trim()}`;
          Astra.syscall('fs:write', path, '')
            .then(() => {
              ui.showToast('File Created', name.trim(), 'success');
              render();
            })
            .catch(err => {
              ui.showToast('Error', err.message, 'error');
            });
        }
      });
      container.querySelector('#exp-copy')?.addEventListener('click', () => {
        if (!selectedItem) return;
        const srcPath = currentPath === '/' ? `/${selectedItem}` : `${currentPath}/${selectedItem}`;
        if (!window.AstraState) window.AstraState = {};
        window.AstraState.clipboard = {
          type: state.resolvePath(srcPath).type,
          name: selectedItem,
          path: srcPath
        };
        // Keep legacy reference for backwards compatibility
        window.AstraClipboard = window.AstraState.clipboard;

        const node = state.resolvePath(srcPath);
        if (node && node.type === 'file') {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(node.content || '').then(() => {
              ui.showToast('Copied to Clipboard (Host Shared)', selectedItem, 'info');
            }).catch(err => {
              ui.showToast('Copied to Clipboard', selectedItem, 'info');
            });
          } else {
            ui.showToast('Copied to Clipboard', selectedItem, 'info');
          }
        } else {
          ui.showToast('Copied to Clipboard', selectedItem, 'info');
        }
        render();
      });
      container.querySelector('#exp-paste')?.addEventListener('click', async () => {
        let hostClipboardText = '';
        if (navigator.clipboard && navigator.clipboard.readText) {
          try {
            hostClipboardText = await navigator.clipboard.readText();
          } catch (err) {
            console.warn('Failed to read from host clipboard', err);
          }
        }

        const localFileContent = window.AstraClipboard && window.AstraClipboard.path ? 
          (state.resolvePath(window.AstraClipboard.path)?.content || '') : null;

        if (hostClipboardText && hostClipboardText !== localFileContent) {
          let fileName = 'pasted_text.txt';
          let dstPath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
          if (state.resolvePath(dstPath)) {
            let count = 1;
            do {
              fileName = `pasted_text_${count}.txt`;
              dstPath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
              count++;
            } while (state.resolvePath(dstPath));
          }
          try {
            Astra.syscall('fs:write', dstPath, hostClipboardText);
            ui.showToast('Pasted from Host Clipboard', fileName, 'success');
            render();
            return;
          } catch (e) {
            ui.showToast('Paste Error', e.message, 'error');
          }
        }

        if (!window.AstraClipboard) return;
        const srcPath = window.AstraClipboard.path;
        
        let newName = window.AstraClipboard.name;
        let dstPath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;
        
        if (state.resolvePath(dstPath)) {
          const parts = newName.split('.');
          const ext = parts.length > 1 ? '.' + parts.pop() : '';
          const base = parts.join('.');
          let count = 1;
          do {
            newName = `${base}_copy${count}${ext}`;
            dstPath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;
            count++;
          } while (state.resolvePath(dstPath));
        }

        async function copyRecursive(s, d) {
          const node = state.resolvePath(s);
          if (!node) return false;
          if (node.type === 'file') {
            await Astra.syscall('fs:write', d, node.content || '');
          } else if (node.type === 'dir') {
            await Astra.syscall('fs:mkdir', d);
            for (const name of Object.keys(node.children || {})) {
              await copyRecursive(s + '/' + name, d + '/' + name);
            }
          }
          return true;
        }

        try {
          await copyRecursive(srcPath, dstPath);
          ui.showToast('Pasted successfully', newName, 'success');
          render();
        } catch (e) {
          ui.showToast('Paste Failed', e.message, 'error');
        }
      });
      container.querySelector('#exp-rename')?.addEventListener('click', () => {
        if (!selectedItem) return;
        const newName = prompt('Rename to:', selectedItem);
        if (newName && newName.trim() && newName !== selectedItem) {
          const path = currentPath === '/' ? `/${selectedItem}` : `${currentPath}/${selectedItem}`;
          Astra.syscall('fs:rename', path, newName.trim())
            .then(() => {
              selectedItem = newName.trim();
              ui.showToast('Renamed', `→ ${newName.trim()}`, 'info');
              render();
            })
            .catch(err => {
              ui.showToast('Rename Error', err.message, 'error');
            });
        }
      });
      container.querySelector('#exp-delete')?.addEventListener('click', () => {
        if (!selectedItem) return;
        const path = currentPath === '/' ? `/${selectedItem}` : `${currentPath}/${selectedItem}`;
        Astra.syscall('fs:delete', path)
          .then(() => {
            ui.showToast('Moved to Trash', selectedItem, 'info');
            selectedItem = null;
            render();
          })
          .catch(err => {
            ui.showToast('Delete Error', err.message, 'error');
          });
      });
    }
  }

  function updateToolbarButtons() {
    const renameBtn = container.querySelector('#exp-rename');
    const deleteBtn = container.querySelector('#exp-delete');
    const copyBtn = container.querySelector('#exp-copy');
    const restoreBtn = container.querySelector('#exp-restore');
    if (renameBtn) renameBtn.disabled = !selectedItem;
    if (deleteBtn) deleteBtn.disabled = !selectedItem;
    if (copyBtn) copyBtn.disabled = !selectedItem;
    if (restoreBtn) restoreBtn.disabled = !selectedItem;
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

  function highlightSyntax(code, filename) {
    if (!filename) return window.escapeHTML(code);
    let escaped = window.escapeHTML(code);
    if (filename.endsWith('.js') || filename.endsWith('.json')) {
      const keywords = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|try|catch|finally|throw|class|export|import|from|default|null|undefined|true|false|this|async|await)\b/g;
      escaped = escaped.replace(keywords, '<span style="color: #ff757f; font-weight: bold;">$1</span>');
      escaped = escaped.replace(/\b(\d+)\b/g, '<span style="color: #ff966c;">$1</span>');
      escaped = escaped.replace(/(&quot;[^\n]*?&quot;)/g, '<span style="color: #c3e88d;">$1</span>');
      escaped = escaped.replace(/(&#39;[^\n]*?&#39;)/g, '<span style="color: #c3e88d;">$1</span>');
      escaped = escaped.replace(/(`[^\n]*?`)/g, '<span style="color: #c3e88d;">$1</span>');
      escaped = escaped.replace(/(\/\/.*)/g, '<span style="color: #637588; font-style: italic;">$1</span>');
    } else if (filename.endsWith('.sh')) {
      const keywords = /\b(if|then|else|fi|for|in|do|done|while|case|esac|exit|echo|export|unset|alias|source)\b/g;
      escaped = escaped.replace(keywords, '<span style="color: #82aaff; font-weight: bold;">$1</span>');
      escaped = escaped.replace(/(#.*)/g, '<span style="color: #637588; font-style: italic;">$1</span>');
    } else if (filename.endsWith('.md')) {
      escaped = escaped.replace(/^(#+ .*)$/gm, '<span style="color: #82aaff; font-weight: bold;">$1</span>');
      escaped = escaped.replace(/(\*\*.*?\*\*)/g, '<span style="color: #ff757f; font-weight: bold;">$1</span>');
      escaped = escaped.replace(/(`.*?`)/g, '<span style="color: #c3e88d;">$1</span>');
    }
    return escaped;
  }

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

  function formatCode(code) {
    let lines = code.split('\n');
    let indentLevel = 0;
    let formattedLines = lines.map(line => {
      let trimmed = line.trim();
      if (trimmed.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      const indent = '  '.repeat(indentLevel);
      
      const openBraces = (trimmed.match(/\{/g) || []).length;
      const closeBraces = (trimmed.match(/\}/g) || []).length;
      indentLevel += (openBraces - closeBraces);
      
      return trimmed ? indent + trimmed : '';
    });
    return formattedLines.join('\n');
  }

  async function openFileInEditor(path) {
    const existing = openFiles.findIndex(f => f.path === path);
    if (existing >= 0) { activeFileIdx = existing; renderEditor(); return; }
    try {
      const lockRes = await Astra.syscall('fs:lock', path, 'exclusive');
      const locked = lockRes && lockRes.status === 'success' ? lockRes.result : false;
      if (!locked) {
        ui.showToast('Lock Notice', 'File is locked or currently edited by another process.', 'warning');
      }
      const readRes = await Astra.syscall('fs:read', path);
      const content = readRes && readRes.status === 'success' ? readRes.result : '';
      const name = path.split('/').pop();
      openFiles.push({ path, name, content, locked });
      activeFileIdx = openFiles.length - 1;
      renderEditor();
    } catch (err) {
      ui.showToast('Error', err.message, 'error');
    }
  }

  window.AstraApps._editorOpen = openFileInEditor;
  window.editorOpenFile = openFileInEditor;

  function renderEditor() {
    const projectDir = ui.state.resolvePath('/Project_Astra');
    const homeDir = ui.state.resolvePath('/home/divyanshu');
    let sidebarFiles = getAllFiles(projectDir, '/Project_Astra');
    if (sidebarFiles.length === 0) sidebarFiles = getAllFiles(homeDir, '/home/divyanshu');

    const activeFile = openFiles[activeFileIdx];

    const editorTabsHTML = openFiles.map((f, i) => {
      const activeClass = i === activeFileIdx ? 'active' : '';
      return window.html`
        <div class="editor-tab ${activeClass}" data-idx="${i}">
          <span>${f.name}</span>
          <span class="editor-tab-close" data-close="${i}">×</span>
        </div>
      `;
    }).join('');

    const sidebarFilesHTML = sidebarFiles.map(f => {
      const indent = (f.path.split('/').length - 2) * 12;
      const icon = f.type === 'dir' ? '📁' : '📄';
      const isActive = activeFile && activeFile.path === f.path;
      const activeClass = isActive ? 'active' : '';
      return window.html`<li class="editor-file-item ${f.type} ${activeClass}" data-path="${f.path}" style="padding-left: ${(indent + 10)}px">${icon} ${f.name}</li>`;
    }).join('');

    window.renderSafeHTML(container, window.html`
      <div class="editor-app">
        <div class="editor-sidebar">
          <div class="editor-sidebar-title">Explorer</div>
          <ul class="editor-file-list">
            ${window.safeHTML(sidebarFilesHTML)}
          </ul>
        </div>
        <div class="editor-main">
          <div class="editor-tabs">
            <div style="display: flex;">
              ${window.safeHTML(editorTabsHTML)}
            </div>
            <div class="editor-actions-tb" style="display: flex; align-items: center; padding-right: 8px; gap: 6px;">
              <button class="editor-tb-btn" id="editor-run" title="Run Script" ${!activeFile ? 'disabled' : ''}>⚡ Run</button>
              <button class="editor-tb-btn" id="editor-format" title="Format Code" ${!activeFile ? 'disabled' : ''}>🧹 Format</button>
            </div>
          </div>
          <div class="editor-edit-container" style="position: relative; flex-grow: 1; display: flex; overflow: hidden; background: rgba(0,0,0,0.15); min-height: 0;">
            <pre class="editor-highlight" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: 0; padding: 16px; box-sizing: border-box; font-family: var(--font-mono), monospace; font-size: 12.5px; line-height: 1.5; white-space: pre; overflow: hidden; pointer-events: none; color: #a6accd; background: transparent; text-align: left;"></pre>
            <textarea class="editor-textarea" id="editor-content" spellcheck="false" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: transparent; color: transparent; caret-color: var(--text-primary); font-family: var(--font-mono), monospace; font-size: 12.5px; line-height: 1.5; padding: 16px; border: none; resize: none; box-sizing: border-box; outline: none; margin: 0; overflow: auto;" ${!activeFile ? 'disabled placeholder="Select a file to edit..."' : ''}>${activeFile ? activeFile.content : ''}</textarea>
          </div>
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
        const f = openFiles[idx];
        if (f && f.locked) {
          try {
            Astra.syscall('fs:unlock', f.path);
          } catch (err) {
            console.error('Failed to unlock path', f.path, err);
          }
        }
        openFiles.splice(idx, 1);
        if (activeFileIdx >= openFiles.length) activeFileIdx = openFiles.length - 1;
        renderEditor();
      });
    });
    // Highlight initial content & Sync Scroll
    const initialTextarea = container.querySelector('#editor-content');
    const initialPre = container.querySelector('.editor-highlight');
    if (initialTextarea && initialPre && activeFile) {
      window.renderSafeHTML(initialPre, highlightSyntax(activeFile.content, activeFile.name));
      initialTextarea.addEventListener('scroll', () => {
        initialPre.scrollTop = initialTextarea.scrollTop;
        initialPre.scrollLeft = initialTextarea.scrollLeft;
      });
    }

    // Debounced auto-save: persist only after 500ms of idle typing
    let _saveTimer = null;
    container.querySelector('#editor-content')?.addEventListener('input', (e) => {
      if (activeFile) {
        activeFile.content = e.target.value;
        const pre = container.querySelector('.editor-highlight');
        if (pre) {
          window.renderSafeHTML(pre, highlightSyntax(e.target.value, activeFile.name));
        }
        if (_saveTimer) clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => {
          Astra.syscall('fs:write', activeFile.path, activeFile.content)
            .catch(err => ui.showToast('Write Error', err.message, 'error'));
        }, 500);
      }
    });

    // Run Script
    container.querySelector('#editor-run')?.addEventListener('click', () => {
      if (!activeFile) return;
      const cmd = `node ${activeFile.path}`;
      ui.openApp('terminal');
      setTimeout(() => {
        if (window.AstraApps.terminalExecute) {
          window.AstraApps.terminalExecute(cmd);
        }
      }, 200);
    });

    // Format Code
    container.querySelector('#editor-format')?.addEventListener('click', () => {
      if (!activeFile) return;
      
      let formatted = activeFile.content;
      if (activeFile.name.endsWith('.json')) {
        try {
          formatted = JSON.stringify(JSON.parse(activeFile.content), null, 2);
        } catch (e) {
          formatted = formatCode(activeFile.content);
        }
      } else {
        formatted = formatCode(activeFile.content);
      }
      
      activeFile.content = formatted;
      const tx = container.querySelector('#editor-content');
      if (tx) tx.value = formatted;
      try {
        Astra.syscall('fs:write', activeFile.path, formatted);
      } catch (err) {
        ui.showToast('Write Error', err.message, 'error');
      }
      ui.showToast('Formatted Code', activeFile.name, 'success');
      renderEditor();
    });
  }

  renderEditor();
};

// ==========================================
// MEMORY GRAPH
// ==========================================
window.AstraApps.memory = function(container, ui) {
  let searchQuery = '';

  function renderGraph() {
    const { nodes, links } = ui.state.memoryGraph;
    const svgW = 600, svgH = 400;
    const typeColors = { user: '#a855f7', project: '#3b82f6', tech: '#10b981', preference: '#f59e0b', file: '#6366f1', event: '#ef4444', default: '#94a3b8' };

    const activeSearch = searchQuery.toLowerCase().trim();

    const linksHTML = links.map(l => {
      const src = nodes.find(n => n.id === l.source);
      const tgt = nodes.find(n => n.id === l.target);
      if (!src || !tgt) return '';
      const isHighlighted = activeSearch ? (src.label.toLowerCase().includes(activeSearch) || tgt.label.toLowerCase().includes(activeSearch)) : false;
      const opacity = activeSearch ? (isHighlighted ? '1' : '0.15') : '0.4';
      return window.html`<line class="edge" x1="${src.x}" y1="${src.y}" x2="${tgt.x}" y2="${tgt.y}" style="opacity: ${opacity}; transition: opacity 0.2s;" />`;
    }).join('');

    const nodesHTML = nodes.map(n => {
      const color = Reflect.get(typeColors, n.type) || typeColors.default;
      const cleanLabel = n.label.length > 20 ? n.label.substring(0, 18) + '…' : n.label;
      const isMatched = activeSearch ? n.label.toLowerCase().includes(activeSearch) || n.type.toLowerCase().includes(activeSearch) : true;
      const opacity = isMatched ? '1' : '0.2';
      const glow = (activeSearch && isMatched) ? `stroke: var(--color-primary); stroke-width: 3px; filter: drop-shadow(0 0 8px var(--color-primary));` : '';
      return window.html`
        <g class="node" transform="translate(${n.x}, ${n.y})" style="opacity: ${opacity}; transition: opacity 0.2s; ${glow}">
          <circle r="24" fill="${color}" opacity="0.3" stroke="${color}" stroke-width="2"/>
          <circle r="6" fill="${color}"/>
          <text dy="36" font-size="9" fill="white" text-anchor="middle">${cleanLabel}</text>
        </g>
      `;
    }).join('');

    const optionsHTML = nodes.map(n => window.html`<option value="${n.id}">${n.label}</option>`).join('');

    window.renderSafeHTML(container, window.html`
      <div class="memory-app">
        <div class="memory-header-row">
          <div><strong>Memory Graph</strong> <span style="color: var(--text-muted); font-size: 12px">${nodes.length} nodes, ${links.length} links</span></div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="text" class="memory-search-input" id="mem-search" placeholder="Search node..." value="${searchQuery}" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-glass); border-radius: var(--radius-base); color: var(--text-primary); padding: 4px 8px; font-size: 11px; outline: none; width: 120px;" />
            <button class="btn btn-secondary" id="mem-clear" style="padding: 4px 8px; font-size: 11px;">Clear</button>
          </div>
        </div>
        <div class="memory-main-layout" style="display: flex; flex-grow: 1; overflow: hidden; height: calc(100% - 40px);">
          <div class="memory-sidebar" style="width: 200px; border-right: 1px solid var(--border-glass); padding: 12px; display: flex; flex-direction: column; gap: 10px; background: rgba(0,0,0,0.1); overflow-y: auto;">
            <div style="font-size: 11px; font-weight: 700; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.5px;">Add Node</div>
            <div class="mem-form-group" style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 10px; color: var(--text-muted);">Node ID</label>
              <input type="text" id="mem-node-id" placeholder="e.g. tech-rust" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-glass); border-radius: var(--radius-base); color: var(--text-primary); padding: 4px 8px; font-size: 11px; outline: none;" />
            </div>
            <div class="mem-form-group" style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 10px; color: var(--text-muted);">Label</label>
              <input type="text" id="mem-node-label" placeholder="e.g. Rust Compiler" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-glass); border-radius: var(--radius-base); color: var(--text-primary); padding: 4px 8px; font-size: 11px; outline: none;" />
            </div>
            <div class="mem-form-group" style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 10px; color: var(--text-muted);">Type</label>
              <select id="mem-node-type" style="background: rgba(18, 33, 49, 0.95); border: 1px solid var(--border-glass); border-radius: var(--radius-base); color: var(--text-primary); padding: 4px 6px; font-size: 11px; outline: none;">
                <option value="tech">Technology</option>
                <option value="project">Project</option>
                <option value="file">File</option>
                <option value="user">User</option>
                <option value="preference">Preference</option>
                <option value="event">Event</option>
              </select>
            </div>
            
            <div style="border-top: 1px solid var(--border-glass); margin: 6px 0;"></div>
            
            <div style="font-size: 11px; font-weight: 700; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.5px;">Link (Optional)</div>
            <div class="mem-form-group" style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 10px; color: var(--text-muted);">Connect to</label>
              <select id="mem-link-target" style="background: rgba(18, 33, 49, 0.95); border: 1px solid var(--border-glass); border-radius: var(--radius-base); color: var(--text-primary); padding: 4px 6px; font-size: 11px; outline: none;">
                <option value="">(None)</option>
                ${window.safeHTML(optionsHTML)}
              </select>
            </div>
            <div class="mem-form-group" style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 10px; color: var(--text-muted);">Relation</label>
              <input type="text" id="mem-link-relation" placeholder="e.g. requires" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-glass); border-radius: var(--radius-base); color: var(--text-primary); padding: 4px 8px; font-size: 11px; outline: none;" />
            </div>
            <button class="btn btn-primary" id="mem-submit" style="padding: 6px; margin-top: 6px; font-size: 11px;">Create Node</button>
          </div>
          <div class="memory-visualizer" style="flex-grow: 1; display: flex; align-items: center; justify-content: center; position: relative;">
            <svg class="graph-svg" viewBox="0 0 ${svgW} ${svgH}" style="width: 100%; height: 100%;">
              ${window.safeHTML(linksHTML)}
              ${window.safeHTML(nodesHTML)}
            </svg>
          </div>
        </div>
      </div>
    `);

    // Bind search query input
    container.querySelector('#mem-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      const activeSearch = searchQuery.toLowerCase().trim();
      const nodesDOM = container.querySelectorAll('g.node');
      const edgesDOM = container.querySelectorAll('line.edge');
      
      nodesDOM.forEach((nodeG, idx) => {
        const node = nodes[idx];
        if (!node) return;
        const isMatched = activeSearch ? node.label.toLowerCase().includes(activeSearch) || node.type.toLowerCase().includes(activeSearch) : true;
        
        if (activeSearch && isMatched) {
          nodeG.setAttribute('style', `opacity: 1; transition: opacity 0.2s; filter: drop-shadow(0 0 8px var(--color-primary));`);
        } else {
          nodeG.setAttribute('style', `opacity: ${isMatched ? '1' : '0.2'}; transition: opacity 0.2s;`);
        }
      });
      
      edgesDOM.forEach((edgeLine, idx) => {
        const link = links[idx];
        if (!link) return;
        const src = nodes.find(n => n.id === link.source);
        const tgt = nodes.find(n => n.id === link.target);
        if (!src || !tgt) return;
        const isHighlighted = activeSearch ? (src.label.toLowerCase().includes(activeSearch) || tgt.label.toLowerCase().includes(activeSearch)) : false;
        edgeLine.style.opacity = activeSearch ? (isHighlighted ? '1' : '0.15') : '0.4';
      });
    });

    // Keep input cursor at end if focused
    const searchInput = container.querySelector('#mem-search');
    if (searchInput && document.activeElement === searchInput) {
      searchInput.focus();
      const len = searchInput.value.length;
      searchInput.setSelectionRange(len, len);
    }

    // Bind Clear button
    container.querySelector('#mem-clear')?.addEventListener('click', async () => {
      await Astra.syscall('state:clearMemoryGraph');
      renderGraph();
    });

    // Bind Submit button
    container.querySelector('#mem-submit')?.addEventListener('click', async () => {
      const nodeId = container.querySelector('#mem-node-id')?.value.trim();
      const nodeLabel = container.querySelector('#mem-node-label')?.value.trim();
      const nodeType = container.querySelector('#mem-node-type')?.value;
      const linkTarget = container.querySelector('#mem-link-target')?.value;
      const linkRelation = container.querySelector('#mem-link-relation')?.value.trim() || 'connects';
      
      if (!nodeId || !nodeLabel) {
        ui.showToast('Validation Error', 'ID and Label are required', 'error');
        return;
      }
      
      if (ui.state.memoryGraph.nodes.some(n => n.id === nodeId)) {
        ui.showToast('Error', 'Node ID already exists', 'error');
        return;
      }
      
      await Astra.syscall('state:addMemoryNode', nodeId, nodeLabel, nodeType);
      
      if (linkTarget) {
        await Astra.syscall('state:addMemoryLink', nodeId, linkTarget, linkRelation);
      }
      
      ui.showToast('Node Created', nodeLabel, 'success');
      renderGraph();
    });
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
    window.renderSafeHTML(container, window.html`
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
    const lastWord = parts[parts.length - 1];
    if (lastWord === undefined) return;
    
    let matches = [];
    const kernel = window.AstraKernel;
    
    // If completing the first word (command name)
    if (parts.length === 1) {
      const commandsList = [
        'help', 'export', 'env', 'unset', 'ls', 'cat', 'pwd', 'cd', 'mkdir', 'touch', 
        'rm', 'cp', 'mv', 'chmod', 'chown', 'tree', 'find', 'grep', 'echo', 'wc', 
        'ps', 'kill', 'top', 'uptime', 'whoami', 'su', 'sudo', 'passwd', 'id', 
        'ping', 'curl', 'ifconfig', 'nslookup', 'netstat', 'wget', 'hostname', 
        'git', 'jobs', 'fg', 'bg', 'neofetch', 'uname', 'date', 'df', 'free', 
        'dmesg', 'clear', 'history', 'sysreset', 'health', 'cowsay', 'fortune', 
        'sl', 'figlet', 'node', 'sysinfo', 'head', 'tail', 'sort', 'uniq',
        'source', 'alias', 'type', 'which', 'man', 'stat'
      ];
      matches = commandsList
        .filter(cmd => cmd.startsWith(lastWord))
        .map(cmd => ({ name: cmd, type: 'cmd' }));
      
      // Add aliases
      if (kernel && kernel.aliases) {
        Object.keys(kernel.aliases)
          .filter(a => a.startsWith(lastWord))
          .forEach(a => matches.push({ name: a, type: 'alias' }));
      }
      
      // Add shell functions
      if (kernel && kernel.shellFunctions) {
        Object.keys(kernel.shellFunctions)
          .filter(f => f.startsWith(lastWord))
          .forEach(f => matches.push({ name: f, type: 'cmd' }));
      }
    }
    
    // Path completion for file arguments (second word+)
    if (parts.length > 1 || (parts.length === 1 && lastWord.includes('/'))) {
      const targetWord = lastWord;
      let searchDir = currentDir;
      let prefix = '';
      
      if (targetWord.startsWith('/')) {
        // Absolute path
        const lastSlash = targetWord.lastIndexOf('/');
        searchDir = targetWord.substring(0, lastSlash) || '/';
        prefix = targetWord.substring(0, lastSlash + 1);
      } else if (targetWord.includes('/')) {
        // Relative path with slashes
        const lastSlash = targetWord.lastIndexOf('/');
        const relDir = targetWord.substring(0, lastSlash);
        searchDir = resolveRelativePath(relDir);
        prefix = targetWord.substring(0, lastSlash + 1);
      }
      
      const searchTerm = targetWord.includes('/') 
        ? targetWord.substring(targetWord.lastIndexOf('/') + 1) 
        : targetWord;
      
      const dir = ui.state.resolvePath(searchDir);
      if (dir && dir.children) {
        Object.keys(dir.children)
          .filter(n => n.startsWith(searchTerm))
          .forEach(n => {
            const child = Reflect.get(dir.children, window.sanitizeKey(n));
            const isDir = child && child.type === 'dir';
            matches.push({ 
              name: prefix + n + (isDir ? '/' : ''), 
              type: isDir ? 'dir' : 'file' 
            });
          });
      }
    } else {
      // Also search in current directory when completing first word with no slashes
      const dir = ui.state.resolvePath(currentDir);
      if (dir && dir.children) {
        Object.keys(dir.children)
          .filter(n => n.startsWith(lastWord))
          .forEach(n => {
            const child = Reflect.get(dir.children, window.sanitizeKey(n));
            const isDir = child && child.type === 'dir';
            matches.push({ 
              name: n + (isDir ? '/' : ''), 
              type: isDir ? 'dir' : 'file' 
            });
          });
      }
    }
    
    // Deduplicate matches by name
    const seen = new Set();
    matches = matches.filter(m => {
      if (seen.has(m.name)) return false;
      seen.add(m.name);
      return true;
    });
    
    if (matches.length === 1) {
      Reflect.set(parts, parts.length - 1, matches[0].name);
      input.value = parts.join(' ') + (matches[0].type === 'dir' ? '' : ' ');
    } else if (matches.length > 1) {
      // Find common prefix for partial completion
      const names = matches.map(m => m.name);
      let commonPrefix = names[0];
      for (let i = 1; i < names.length; i++) {
        while (!Reflect.get(names, i).startsWith(commonPrefix)) {
          commonPrefix = commonPrefix.substring(0, commonPrefix.length - 1);
        }
      }
      if (commonPrefix.length > lastWord.length) {
        Reflect.set(parts, parts.length - 1, commonPrefix);
        input.value = parts.join(' ');
      }
      
      // Show matches with type labels in terminal output
      const formatted = matches.map(m => {
        const typeLabel = m.type === 'dir' ? '\x1b[34m' : m.type === 'alias' ? '\x1b[35m' : '';
        return m.name;
      });
      addOutput(formatted.join('  '), 'info');
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
    // Detect background execution suffix (&)
    let isBackground = false;
    let cleanCmd = rawCmd;
    if (rawCmd.trimEnd().endsWith('&') && !rawCmd.trimEnd().endsWith('&&')) {
      isBackground = true;
      cleanCmd = rawCmd.trimEnd().slice(0, -1).trim();
    }

    const res = window.AstraKernel.executeCommand(cleanCmd, currentDir, commandHistory);
    
    const afterExecute = (finalRes) => {
      if (finalRes.newDir) {
        currentDir = finalRes.newDir;
      }
      const prompt = container.querySelector('.terminal-prompt');
      if (prompt) {
        prompt.textContent = `${ui.state.currentSession.currentUser || 'divyanshu'}@astra:${shortPath(currentDir)}$`;
      }
      if (finalRes.action === 'reset') {
        setTimeout(() => { ui.state.resetAllState(); location.reload(); }, 1000);
      } else if (finalRes.action === 'agent-run') {
        setTimeout(() => {
          if (window.triggerAgentWorkflow) {
            window.triggerAgentWorkflow();
          }
        }, 1000);
      }
      if (finalRes.toast) {
        ui.showToast(finalRes.toast.title, finalRes.toast.message, finalRes.toast.type);
      }
      if (window.refreshExplorerGrid) {
        window.refreshExplorerGrid();
      }
    };

    // Background job execution — run async commands without blocking the terminal
    if (isBackground && res.async) {
      const job = window.AstraKernel.createJob(cleanCmd);
      addOutput(`[${job.id}] Background job started: ${cleanCmd}`, 'info');

      res.run((text, cls) => {
        if (job.foreground) {
          // Job was foregrounded — redirect output to terminal
          addOutput(text, cls);
        } else {
          job.outputBuffer.push(text);
        }
      }).then(() => {
        job.status = 'Done';
        if (!job.foreground) {
          addOutput(`[${job.id}]  Done                    ${cleanCmd}`, 'info');
        }
      }).catch(() => {
        job.status = 'Failed';
      });

      afterExecute(res);
      return;
    }

    if (res.async) {
      res.run((text, cls) => addOutput(text, cls))
        .then(() => {
          afterExecute(res);
        })
        .catch((err) => {
          addOutput(`Error: ${err.message || err}`, 'error');
          afterExecute(res);
        });
      return;
    }

    if (res.action === 'clear') {
      const outEl = container.querySelector('#term-out');
      if (outEl) window.renderSafeHTML(outEl, '');
    } else {
      if (res.output && res.output.length > 0) {
        addOutputLines(res.output, res.cls || '');
      }
    }

    // Handle fg live output redirection
    if (res.foregroundJobId) {
      const job = window.AstraKernel.getJob(res.foregroundJobId);
      if (job) {
        job.foreground = true;
      }
    }

    afterExecute(res);
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
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="btn btn-secondary" id="btn-add-task" style="padding: 4px 8px; font-size: 11px;">+ Add Task</button>
            <span style="font-size: 12px; color: var(--text-muted)">${tasks.length} total tasks</span>
          </div>
        </div>
        <div class="tasks-grid">
          ${renderColumn('pending', 'Pending', pending, '#f59e0b')}
          ${renderColumn('progress', 'In Progress', inProgress, '#3b82f6')}
          ${renderColumn('completed', 'Completed', completed, '#10b981')}
        </div>
      </div>
    `);

    // Bind Add Task Button
    container.querySelector('#btn-add-task')?.addEventListener('click', async () => {
      const title = prompt('Task Title:');
      if (!title || !title.trim()) return;
      const desc = prompt('Task Description:') || '';
      const assigned = prompt('Assigned Agent (e.g. PlannerAgent, ExecutorAgent, User):') || 'User';
      
      await Astra.syscall('task:add', title.trim(), desc.trim(), 'pending', assigned.trim());
      ui.showToast('Task Added', title.trim(), 'success');
      
      if (window.updateDashboardStats) window.updateDashboardStats();
      renderBoard();
    });

    // Bind Move Buttons
    container.querySelectorAll('.task-card-move-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const nextStatus = btn.getAttribute('data-action');
        await Astra.syscall('task:updateStatus', id, nextStatus);
        
        if (window.updateDashboardStats) window.updateDashboardStats();
        renderBoard();
      });
    });

    // Bind Delete Buttons
    container.querySelectorAll('.task-card-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await Astra.syscall('task:delete', id);
        ui.showToast('Task Deleted', '', 'info');
        
        if (window.updateDashboardStats) window.updateDashboardStats();
        renderBoard();
      });
    });
  }

  function renderColumn(colId, title, items, color) {
    const cardsHTML = items.map(t => {
      let moveLeft = '';
      let moveRight = '';
      
      if (colId === 'pending') {
        moveRight = window.html`<button class="task-card-move-btn" data-id="${t.id}" data-action="progress" title="Move to In Progress">▶</button>`;
      } else if (colId === 'progress') {
        moveLeft = window.html`<button class="task-card-move-btn" data-id="${t.id}" data-action="pending" title="Move to Pending">◀</button>`;
        moveRight = window.html`<button class="task-card-move-btn" data-id="${t.id}" data-action="completed" title="Move to Completed">▶</button>`;
      } else if (colId === 'completed') {
        moveLeft = window.html`<button class="task-card-move-btn" data-id="${t.id}" data-action="progress" title="Move to In Progress">◀</button>`;
      }
      
      return window.html`
        <div class="task-card-ui" data-id="${t.id}">
          <div class="task-card-header">
            <div class="task-card-title">${t.title}</div>
            <button class="task-card-delete-btn" data-id="${t.id}" title="Delete Task">✕</button>
          </div>
          <div class="task-card-desc">${t.desc}</div>
          <div class="task-card-footer">
            <div class="task-card-badge">${t.assigned}</div>
            <div class="task-card-moves">
              ${window.safeHTML(moveLeft)}
              ${window.safeHTML(moveRight)}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return window.html`
      <div class="tasks-column">
        <div class="tasks-col-title" style="color: ${color}">${title} (${items.length})</div>
        <div class="task-list">
          ${window.safeHTML(cardsHTML)}
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
    const workflows = ui.state.workflows || [];
    const currentFocus = ui.state.registry.system?.focusMode || 'coding';

    const statsHTML = [
      { label: 'Active Agents', val: '5', color: 'var(--color-green)' },
      { label: 'Tasks Completed', val: String(tasks.filter(t => t.status === 'completed').length), color: 'var(--color-blue)' },
      { label: 'Workflows', val: String(workflows.length), color: 'var(--color-amber)' },
      { label: 'Tokens Used', val: sv.tokensConsumed.toLocaleString(), color: 'var(--color-purple)' },
      { label: 'Focus Mode', val: currentFocus.toUpperCase(), color: 'var(--color-primary)' }
    ].map(s => window.html`
      <div class="stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="dashboard-card-val" style="color: ${s.color}">${s.val}</div>
      </div>
    `).join('');

    const logsHTML = logs.slice(0, 10).map(l => window.html`
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
      conscienceHTML = window.html`
        <div class="conscience-card success">
          <div class="conscience-text">🟢 All systems active & codebase compiled cleanly. No conscience alerts found!</div>
        </div>
      `;
    } else {
      insightsList.forEach((ins, idx) => {
        conscienceHTML += window.html`
          <div class="conscience-card ${ins.type}">
            <div class="conscience-text">${ins.text}</div>
            <button class="conscience-action-btn" data-act="${ins.action}">${ins.actionLabel}</button>
          </div>
        `;
      });
    }

    const gitRepo = Reflect.get(ui.state.gitRepos, '/Project_Astra');
    const gitBranch = gitRepo ? gitRepo.branch : 'main';
    const latestWorkflow = workflows[0];

    window.renderSafeHTML(container, window.html`
      <div class="dashboard-app">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: -4px;">Welcome back, ${sv.user}</div>
        <div style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 4px;">Astra OS active workspace: <strong>/Project_Astra</strong> (Branch: ${gitBranch})</div>
        
        <div class="dashboard-stats">
          ${window.safeHTML(statsHTML)}
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
              ${window.safeHTML(conscienceHTML)}
            </div>
          </div>
        </div>

        <!-- Bottom Row: Recent Audit Events -->
        <div class="dashboard-panel" style="flex-grow: 0; min-height: 120px;">
          <h3>Agent Activity Audit Log (Recent Events)</h3>
          <div class="logs-audit-list" style="height: 100px;">
            ${window.safeHTML(logsHTML)}
          </div>
        </div>

        <div class="dashboard-panel" style="flex-grow: 0; min-height: 120px;">
          <h3>Latest Workflow</h3>
          ${window.safeHTML(latestWorkflow ? window.html`
            <div style="display:flex;flex-direction:column;gap:6px;">
              <div><strong>${latestWorkflow.goal}</strong></div>
              <div style="font-size:11px;color:var(--text-secondary)">${latestWorkflow.status} • ${latestWorkflow.steps.length} steps • ${latestWorkflow.approvals.length} approvals</div>
              <button class="btn btn-secondary" id="dashboard-open-workflow" style="width:max-content;">Open Workflow Console</button>
            </div>
          ` : '<div style="color:var(--text-muted)">No workflows available.</div>')}
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
    container.querySelector('#dashboard-open-workflow')?.addEventListener('click', () => {
      ui.openApp('workflow');
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

// ==========================================
// WORKFLOW CONSOLE
// ==========================================
window.AstraApps.workflow = function(container, ui) {
  function render() {
    const workflows = ui.state.workflows || [];
    const current = workflows[0];
    const failures = ui.state.failureMemory || [];
    const pendingApprovals = (ui.state.approvalsQueue || []).filter(appr => {
      const workflowId = appr.metadata?.workflowId;
      return current && workflowId === current.id;
    });
    
    const failureMemoryHTML = failures.length > 0 ? failures.map(f => window.html`
      <div class="failure-memory-item" style="padding: 6px 8px; margin-bottom: 6px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 4px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px;">
          <span style="color: #fca5a5;">⚠️ ${f.errorType}</span>
          <span style="color: var(--text-muted); font-size: 9px;">${new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
        </div>
        <div style="color: var(--text-secondary); margin-bottom: 2px;"><strong>Goal:</strong> ${f.workflowGoal}</div>
        <div style="color: var(--text-primary); font-family: monospace; font-size: 10px;">${f.details}</div>
      </div>
    `).join('') : '<div style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 10px;">No historical failures recorded.</div>';
    
    const timelineHTML = current ? current.steps.map(step => window.html`
      <div class="workflow-step ${step.status || 'pending'}" style="border-left: 3px solid ${step.status === 'completed' ? '#10b981' : step.status === 'failed' ? '#ef4444' : 'var(--text-muted)'}; padding-left: 8px; margin-bottom: 12px; font-size: 11px;">
        <div class="workflow-step-head" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <strong style="font-size: 12px; color: var(--text-primary);">${step.title || step.name || step.id}</strong>
          <span class="workflow-step-status" style="text-transform: uppercase; font-size: 9px; padding: 2px 6px; border-radius: 4px; background: ${step.status === 'completed' ? 'rgba(16,185,129,0.15)' : step.status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)'}; color: ${step.status === 'completed' ? '#10b981' : step.status === 'failed' ? '#ef4444' : 'var(--text-muted)'};">${step.status || 'pending'}</span>
        </div>
        <div class="workflow-step-meta" style="color: var(--text-secondary); margin-bottom: 4px; display: flex; justify-content: space-between;">
          <span>Agent: <strong>${step.assigned || 'System'}</strong> (Conf: ${step.confidence || 100}%)</span>
          <span>${new Date(step.updatedAt || step.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        </div>
        ${window.safeHTML(step.reason ? window.html`<div style="margin-top: 2px; color: var(--text-secondary);"><strong>Reason:</strong> ${step.reason}</div>` : '')}
        ${window.safeHTML(step.target ? window.html`<div style="margin-top: 2px; color: var(--text-secondary);"><strong>Target:</strong> <code>${step.target}</code></div>` : '')}
        ${window.safeHTML(step.outcome ? window.html`<div style="margin-top: 2px; color: var(--text-secondary);"><strong>Outcome:</strong> ${step.outcome}</div>` : '')}
        ${window.safeHTML(step.verification ? window.html`<div style="margin-top: 2px; color: #34d399;"><strong>Verification:</strong> ${step.verification}</div>` : '')}
      </div>
    `).join('') : '<div class="workflow-empty">No workflows recorded yet.</div>';

    const workflowCards = workflows.slice(0, 8).map(wf => window.html`
      <div class="workflow-card ${wf.status}">
        <div class="workflow-card-top">
          <strong>${wf.goal}</strong>
          <span>${wf.status}</span>
        </div>
        <div class="workflow-card-body">${wf.prompt}</div>
        <div class="workflow-card-foot">
          <span>${wf.steps.length} steps</span>
          <span>${wf.approvals.length} approvals</span>
        </div>
      </div>
    `).join('');

    const approvalButtons = current ? window.html`
      <div class="workflow-approval-panel">
        <h4>Workflow Decision</h4>
        <div class="workflow-approval-copy">${current.goal}</div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px;">
          Current status: <strong>${current.status}</strong> • Recorded approvals: <strong>${current.approvals.length}</strong>
        </div>
        <div class="workflow-approval-actions">
          <button class="btn btn-primary btn-sm" id="wf-approve">Approve</button>
          <button class="btn btn-secondary btn-sm" id="wf-reject">Reject</button>
        </div>
      </div>
    ` : '<div class="workflow-empty">No active workflow to approve.</div>';

    const pendingApprovalsHTML = pendingApprovals.length > 0
      ? pendingApprovals.map(appr => {
          const target = appr.metadata?.target || appr.args?.[0] || 'n/a';
          return window.html`
            <div style="padding: 8px 10px; border: 1px solid var(--border-glass); border-radius: 6px; background: var(--bg-glass-light); margin-top: 8px;">
              <div style="display: flex; justify-content: space-between; gap: 10px; font-size: 11px; margin-bottom: 4px;">
                <strong>${appr.callerId}</strong>
                <span style="color: var(--text-muted);">${new Date(appr.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
              </div>
              <div style="font-size: 11px; color: var(--text-secondary);"><strong>Call:</strong> <code>${appr.callName}</code></div>
              <div style="font-size: 11px; color: var(--text-secondary);"><strong>Target:</strong> <code>${target}</code></div>
              ${window.safeHTML(appr.details ? window.html`<div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px;"><strong>Why approval is needed:</strong> ${appr.details}</div>` : '')}
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 6px;">
                PID ${appr.metadata?.pid || 'n/a'} • ${appr.metadata?.user || 'unknown user'} (${appr.metadata?.role || 'unknown role'})
              </div>
            </div>
          `;
        }).join('')
      : '<div class="workflow-empty">No pending syscall approvals linked to this workflow.</div>';

    const orchestrator = window.AstraAgentOrchestrator;
    const isPaused = orchestrator ? orchestrator.isPaused : false;
    const isActive = orchestrator ? orchestrator.activeWorkflow : false;

    const controlButtons = current ? window.html`
      <div class="workflow-controls-panel" style="margin-top: 12px; padding: 10px; background: var(--bg-glass-light); border: 1px solid var(--border-glass); border-radius: 6px;">
        <h5 style="margin: 0 0 6px 0; font-size: 12px;">Execution & Recovery Controls</h5>
        <div style="display: flex; gap: 8px;">
          ${window.safeHTML(isActive ? window.html`
            <button class="btn btn-sm" id="wf-toggle-pause" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: var(--text-primary); cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
              ${isPaused ? '▶ Resume Agent' : '⏸ Pause Agent'}
            </button>
          ` : (current.status !== 'completed' && current.status !== 'failed' && current.status !== 'rejected' ? window.html`
              <button class="btn btn-sm btn-primary" id="wf-resume-workflow" style="padding: 4px 8px; font-size: 11px;">
                ▶ Resume Workflow
              </button>
            ` : ''))}
          <button class="btn btn-sm btn-secondary" id="wf-rollback-last" style="padding: 4px 8px; font-size: 11px; background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3);">
            ↩ Rollback Last Step
          </button>
        </div>
      </div>
    ` : '';

    window.renderSafeHTML(container, window.html`
      <div class="workflow-app">
        <div class="workflow-header">
          <div>
            <h3>Agent Workflow Console</h3>
            <p style="color: var(--text-muted); font-size: 12px;">Track plans, approvals, and execution state in one place.</p>
          </div>
          <button class="btn btn-primary btn-sm" id="workflow-refresh">Refresh</button>
        </div>
        <div class="workflow-grid">
          <div class="workflow-panel">
            <h4>Recent Workflows</h4>
            <div class="workflow-card-list">${window.safeHTML(workflowCards || '<div class="workflow-empty">No workflows yet.</div>')}</div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; margin-bottom: 6px;">
              <h4 style="margin: 0;">🧠 Planner Failure Memory</h4>
              ${window.safeHTML(failures.length > 0 ? `<button class="btn btn-secondary btn-sm" id="wf-clear-failures" style="padding: 2px 6px; font-size: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); cursor: pointer;">Clear</button>` : '')}
            </div>
            <p style="color: var(--text-muted); font-size: 11px; margin: 0 0 8px 0; line-height: 1.3;">Avoidance logs compiled to prevent repeating historical mistakes.</p>
            <div class="failure-memory-list" style="max-height: 140px; overflow-y: auto; padding-right: 4px;">
              ${window.safeHTML(failureMemoryHTML)}
            </div>
          </div>
          <div class="workflow-panel">
            <h4>Latest Workflow Steps</h4>
            <div class="workflow-timeline" style="max-height: 240px; overflow-y: auto; padding-right: 4px;">${window.safeHTML(timelineHTML)}</div>
            ${window.safeHTML(approvalButtons)}
            <div style="margin-top: 12px;">
              <h4 style="margin-bottom: 6px;">Pending Syscall Approvals</h4>
              <div style="max-height: 190px; overflow-y: auto; padding-right: 4px;">
                ${window.safeHTML(pendingApprovalsHTML)}
              </div>
            </div>
            ${window.safeHTML(controlButtons)}
          </div>
        </div>
      </div>
    `);

    container.querySelector('#workflow-refresh')?.addEventListener('click', render);
    container.querySelector('#wf-clear-failures')?.addEventListener('click', () => {
      Astra.syscall('workflow:clearFailureMemory').then(() => {
        ui.showToast('Failure Memory Cleared', 'Historical agent failures cleared.', 'success');
        render();
      });
    });
    container.querySelector('#wf-approve')?.addEventListener('click', () => {
      if (!current) return;
      const approval = {
        actor: ui.state.currentSession.currentUser || 'User',
        decision: 'approved',
        note: pendingApprovals.length > 0
          ? `Approved from workflow console with ${pendingApprovals.length} pending syscall approval(s) visible`
          : 'Approved from workflow console'
      };
      Astra.syscall('workflow:recordApproval', current.id, approval).then(() => {
        Astra.syscall('workflow:update', current.id, { status: 'approved' }).then(() => {
          ui.showToast('Workflow Approved', current.goal, 'success');
          if (window.AstraAgentOrchestrator) {
            window.AstraAgentOrchestrator.resumeWorkflow(current);
          }
          render();
        });
      });
    });
    container.querySelector('#wf-reject')?.addEventListener('click', () => {
      if (!current) return;
      const approval = {
        actor: ui.state.currentSession.currentUser || 'User',
        decision: 'rejected',
        note: pendingApprovals.length > 0
          ? `Rejected from workflow console with ${pendingApprovals.length} pending syscall approval(s) visible`
          : 'Rejected from workflow console'
      };
      Astra.syscall('workflow:recordApproval', current.id, approval).then(() => {
        Astra.syscall('workflow:update', current.id, { status: 'rejected' }).then(() => {
          ui.showToast('Workflow Rejected', current.goal, 'warning');
          render();
        });
      });
    });
    container.querySelector('#wf-toggle-pause')?.addEventListener('click', () => {
      if (orchestrator) {
        orchestrator.togglePauseWorkflow();
        render();
      }
    });
    container.querySelector('#wf-resume-workflow')?.addEventListener('click', () => {
      if (orchestrator && current) {
        orchestrator.resumeWorkflow(current);
        render();
      }
    });
    container.querySelector('#wf-rollback-last')?.addEventListener('click', async () => {
      if (orchestrator) {
        const restored = await orchestrator.undoLastWorkflow();
        ui.showToast('Rollback Complete', `Reverted ${restored} files modified by agent.`, 'success');
        render();
      }
    });
  }

  render();
};
