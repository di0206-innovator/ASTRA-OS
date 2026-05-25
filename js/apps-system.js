// ==========================================
// Astra OS System Applications
// ==========================================

// ==========================================
// 1. System Monitor (Task Manager)
// ==========================================
window.AstraApps.sysmonitor = function(container, ui) {
  let refreshInterval = null;
  let cpuHistory = Array(60).fill(0);
  let memHistory = Array(60).fill(0);
  let activeTab = 'processes';

  function render() {
    window.renderSafeHTML(container, `
      <div class="sysmonitor-app">
        <div class="sysmonitor-topbar">
          <div class="sysmonitor-stat"><span class="sysmonitor-stat-label">CPU</span><span class="sysmonitor-stat-val" id="sm-cpu">0%</span></div>
          <div class="sysmonitor-stat"><span class="sysmonitor-stat-label">RAM</span><span class="sysmonitor-stat-val" id="sm-ram">0 MB</span></div>
          <div class="sysmonitor-stat"><span class="sysmonitor-stat-label">Uptime</span><span class="sysmonitor-stat-val" id="sm-uptime">0s</span></div>
          <div class="sysmonitor-stat"><span class="sysmonitor-stat-label">Processes</span><span class="sysmonitor-stat-val" id="sm-procs">0</span></div>
        </div>
        <div class="sysmonitor-tabs">
          <button class="sm-tab active" data-tab="processes">Processes</button>
          <button class="sm-tab" data-tab="performance">Performance</button>
          <button class="sm-tab" data-tab="disk">Disk</button>
        </div>
        <div class="sysmonitor-content" id="sm-content"></div>
      </div>
    `);

    container.querySelectorAll('.sm-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.sm-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.getAttribute('data-tab');
        renderContent();
      });
    });

    refreshInterval = setInterval(updateStats, 1500);
    updateStats();
    renderContent();
  }

  function updateStats() {
    if (!document.body.contains(container)) { clearInterval(refreshInterval); return; }
    const kernel = window.AstraKernel;
    if (!kernel) return;
    const cpu = parseFloat(kernel.getTotalCpu());
    const mem = kernel.getTotalMem();
    cpuHistory.push(Math.min(cpu, 100));
    cpuHistory.shift();
    memHistory.push(mem);
    memHistory.shift();

    const cpuEl = container.querySelector('#sm-cpu');
    const ramEl = container.querySelector('#sm-ram');
    const uptimeEl = container.querySelector('#sm-uptime');
    const procsEl = container.querySelector('#sm-procs');
    if (cpuEl) cpuEl.textContent = cpu + '%';
    if (ramEl) ramEl.textContent = mem + ' MB';
    if (uptimeEl) uptimeEl.textContent = kernel.getUptime();
    if (procsEl) procsEl.textContent = kernel.listProcesses().length;

    if (activeTab === 'performance') renderPerformanceCharts();
    if (activeTab === 'processes') renderContent();
  }

  function renderContent() {
    const el = container.querySelector('#sm-content');
    if (!el) return;
    if (activeTab === 'processes') renderProcesses(el);
    else if (activeTab === 'performance') renderPerformance(el);
    else if (activeTab === 'disk') renderDisk(el);
  }

  function renderProcesses(el) {
    const kernel = window.AstraKernel;
    if (!kernel) return;
    const procs = kernel.listProcesses() || [];
    
    // Build tree
    const procMap = new Map();
    procs.forEach(p => {
      procMap.set(p.pid, { ...p, children: [] });
    });
    
    const roots = [];
    procMap.forEach(p => {
      if (p.parentPid && procMap.has(p.parentPid)) {
        procMap.get(p.parentPid).children.push(p);
      } else {
        roots.push(p);
      }
    });

    // Helper to generate tree rows recursively
    function generateTreeHTML(node, depth = 0) {
      const indent = '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(depth);
      const prefix = depth > 0 ? '└─ ' : '';
      const nameHTML = `${indent}${prefix}<strong>${window.escapeHTML(node.name)}</strong>`;
      
      const btn = node.pid > 8 ? `<button class="btn-kill" data-pid="${node.pid}" title="Kill Process" style="background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 10px;">✕ Kill</button>` : '';
      
      let rows = `
        <tr>
          <td class="font-mono">${node.pid}</td>
          <td>${nameHTML}</td>
          <td><span class="proc-state proc-${node.state.toLowerCase()}">${node.state}</span></td>
          <td class="font-mono">${node.cpuPercent}%</td>
          <td class="font-mono">${node.memMB} MB</td>
          <td>${btn}</td>
        </tr>
      `;
      
      // Sort children by PID
      node.children.sort((a, b) => a.pid - b.pid);
      node.children.forEach(child => {
        rows += generateTreeHTML(child, depth + 1);
      });
      
      return rows;
    }

    // Generate trees starting from root nodes
    const treeHTML = roots.map(r => generateTreeHTML(r, 0)).join('');
    
    window.renderSafeHTML(el, `
      <table class="process-table">
        <thead>
          <tr>
            <th>PID</th>
            <th>Process Name Tree</th>
            <th>State</th>
            <th>CPU%</th>
            <th>MEM</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${treeHTML || '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No active processes found.</td></tr>'}
        </tbody>
      </table>
    `);

    el.querySelectorAll('.btn-kill').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-pid');
        const result = kernel.killProcess(pid);
        if (result.success) {
          ui.showToast('Process Killed', window.escapeHTML(result.name) + ' (PID ' + pid + ') terminated.', 'info');
          renderContent();
        } else {
          ui.showToast('Kill Failed', result.error, 'error');
        }
      });
    });
  }

  function renderPerformance(el) {
    window.renderSafeHTML(el, `
      <div class="perf-charts">
        <div class="perf-chart-card"><div class="perf-chart-title">CPU Usage</div><canvas id="cpu-chart" width="300" height="120"></canvas></div>
        <div class="perf-chart-card"><div class="perf-chart-title">Memory Usage</div><canvas id="mem-chart" width="300" height="120"></canvas></div>
      </div>
    `);
    renderPerformanceCharts();
  }

  function renderPerformanceCharts() {
    drawChart('cpu-chart', cpuHistory, 100, '#a855f7');
    const maxMem = (ui.state.hardware.ram.totalGB || 32) * 1024;
    drawChart('mem-chart', memHistory, maxMem, '#3b82f6');
  }

  function drawChart(canvasId, data, maxVal, color) {
    const canvas = container.querySelector('#' + canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, (h / 5) * i); ctx.lineTo(w, (h / 5) * i); ctx.stroke(); }
    // Line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (val / maxVal) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Fill
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = color.replace(')', ', 0.1)').replace('rgb', 'rgba');
    ctx.fill();
  }

  function renderDisk(el) {
    const parts = ui.state.hardware.storage.partitions;
    const diskPartsHTML = parts.map(p => {
      const pct = Math.floor((p.usedGB / p.sizeGB) * 100);
      const name = p.label || p.device;
      const status = p.mounted ? '🟢 Mounted' : '⚪ Unmounted';
      const color = pct > 80 ? 'var(--color-red)' : 'var(--color-purple)';
      return `
        <div class="disk-part-card">
          <div class="disk-part-header">
            <span class="disk-part-name">${name}</span>
            <span class="disk-part-mount">${p.mountpoint} — ${p.fsType}</span>
          </div>
          <div class="disk-bar-bg"><div class="disk-bar-fill" style="width: ${pct}%; background: ${color}"></div></div>
          <div class="disk-part-info">${p.usedGB}GB / ${p.sizeGB}GB (${pct}%) — ${status}</div>
        </div>
      `;
    }).join('');

    window.renderSafeHTML(el, `
      <div class="disk-partitions">
        ${diskPartsHTML}
        <div class="disk-part-card" style="border-left: 2px solid var(--color-cyan)">
          <div class="disk-part-header">
            <span class="disk-part-name">🌐 IndexedDB Virtual Volume</span>
            <span class="disk-part-mount">/dev/vdb — IndexedDB</span>
          </div>
          <div class="disk-bar-bg"><div class="disk-bar-fill" id="idb-usage-fill" style="width: 0%; background: var(--color-cyan)"></div></div>
          <div class="disk-part-info" id="idb-usage-text">Loading IndexedDB storage stats...</div>
        </div>
      </div>
    `);

    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(est => {
        const fill = el.querySelector('#idb-usage-fill');
        const text = el.querySelector('#idb-usage-text');
        if (fill && text) {
          const pct = est.quota ? Math.max(1, Math.floor((est.usage / est.quota) * 100)) : 0;
          const usedMB = (est.usage / (1024 * 1024)).toFixed(1);
          const quotaMB = (est.quota / (1024 * 1024)).toFixed(1);
          fill.style.width = `${pct}%`;
          text.textContent = `${usedMB} MB / ${quotaMB} MB (${pct}%) — 🟢 Active (Astra Database)`;
        }
      }).catch(err => {
        const text = el.querySelector('#idb-usage-text');
        if (text) text.textContent = `Error: ${err.message}`;
      });
    } else {
      const text = el.querySelector('#idb-usage-text');
      if (text) text.textContent = `Estimation API not supported — 🟢 Connected`;
    }
  }

  const closeBtn = container.closest('.window')?.querySelector('.dot-close');
  if (closeBtn) closeBtn.addEventListener('click', () => { clearInterval(refreshInterval); });

  render();
};

// ==========================================
// 2. Calculator
// ==========================================
window.AstraApps.calculator = function(container, ui) {
  let display = '0';
  let prevValue = null;
  let operator = null;
  let waitingForOperand = false;
  let history = [];

  function render() {
    window.renderSafeHTML(container, `
      <div class="calc-app">
        <div class="calc-display">
          <div class="calc-expression" id="calc-expr"></div>
          <div class="calc-result" id="calc-result">0</div>
        </div>
        <div class="calc-buttons" id="calc-btns">
          ${['C','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','⌫','='].map(b => {
            let cls = 'calc-btn';
            if (['÷','×','−','+','='].includes(b)) cls += ' calc-op';
            if (['C','±','%','⌫'].includes(b)) cls += ' calc-fn';
            return '<button class="' + cls + '" data-val="' + b + '">' + b + '</button>';
          }).join('')}
        </div>
        <div class="calc-history" id="calc-history">
          <div class="calc-history-title">History</div>
          <div class="calc-history-list" id="calc-hist-list"></div>
        </div>
      </div>
    `);

    container.querySelector('#calc-btns').addEventListener('click', (e) => {
      const btn = e.target.closest('.calc-btn');
      if (!btn) return;
      handleInput(btn.getAttribute('data-val'));
    });

    // Keyboard support
    container.closest('.window')?.addEventListener('keydown', (e) => {
      const key = e.key;
      const map = { 'Enter': '=', 'Escape': 'C', 'Backspace': '⌫', '/': '÷', '*': '×', '-': '−' };
      const val = map[key] || key;
      if ('0123456789.+-×÷=C%⌫±'.includes(val) || val === '−') {
        e.preventDefault();
        handleInput(val);
      }
    });

    updateDisplay();
  }

  function handleInput(val) {
    if ('0123456789'.includes(val)) {
      if (waitingForOperand) { display = val; waitingForOperand = false; }
      else { display = display === '0' ? val : display + val; }
    } else if (val === '.') {
      if (waitingForOperand) { display = '0.'; waitingForOperand = false; }
      else if (!display.includes('.')) { display += '.'; }
    } else if (val === 'C') {
      display = '0'; prevValue = null; operator = null; waitingForOperand = false;
    } else if (val === '⌫') {
      display = display.length > 1 ? display.slice(0, -1) : '0';
    } else if (val === '±') {
      display = String(-parseFloat(display));
    } else if (val === '%') {
      display = String(parseFloat(display) / 100);
    } else if (['÷','×','−','+'].includes(val)) {
      const current = parseFloat(display);
      if (prevValue !== null && !waitingForOperand) {
        const result = calculate(prevValue, current, operator);
        display = String(result);
        prevValue = result;
      } else {
        prevValue = current;
      }
      operator = val;
      waitingForOperand = true;
    } else if (val === '=') {
      const current = parseFloat(display);
      if (prevValue !== null && operator) {
        const result = calculate(prevValue, current, operator);
        history.unshift(`${prevValue} ${operator} ${current} = ${result}`);
        if (history.length > 20) history.pop();
        display = String(result);
        prevValue = null;
        operator = null;
        waitingForOperand = true;
      }
    }
    updateDisplay();
  }

  function calculate(a, b, op) {
    if (op === '+') return a + b;
    if (op === '−') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b !== 0 ? a / b : 'Error';
    return b;
  }

  function updateDisplay() {
    const resultEl = container.querySelector('#calc-result');
    const exprEl = container.querySelector('#calc-expr');
    const histList = container.querySelector('#calc-hist-list');
    if (resultEl) {
      let d = display;
      if (d.length > 12) d = parseFloat(d).toExponential(6);
      resultEl.textContent = d;
    }
    if (exprEl) exprEl.textContent = prevValue !== null ? `${prevValue} ${operator || ''}` : '';
    if (histList) window.renderSafeHTML(histList, history.map(h => '<div class="calc-hist-item">' + window.escapeHTML(h) + '</div>').join(''));
  }

  render();
};

// ==========================================
// 3. Settings / Control Center
// ==========================================
window.AstraApps.settings = function(container, ui) {
  let activeSection = 'general';

  function render() {
    window.renderSafeHTML(container, `
      <div class="settings-app">
        <aside class="settings-sidebar">
          <div class="settings-sidebar-title">System Preferences</div>
          <ul class="settings-nav">
            ${['general','appearance','security','network','storage','ai','about'].map(s => {
              const activeClass = s === activeSection ? 'active' : '';
              const label = s === 'ai' ? 'AI & LLM' : s.charAt(0).toUpperCase() + s.slice(1);
              return '<li class="settings-nav-item ' + activeClass + '" data-section="' + s + '">' + label + '</li>';
            }).join('')}
          </ul>
        </aside>
        <main class="settings-main" id="settings-content"></main>
      </div>
    `);

    container.querySelectorAll('.settings-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        activeSection = item.getAttribute('data-section');
        container.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        renderSection();
      });
    });
    renderSection();
  }

  function renderSection() {
    const el = container.querySelector('#settings-content');
    if (!el) return;
    const reg = ui.state.registry;
    const hw = ui.state.hardware;

    if (activeSection === 'general') {
      window.renderSafeHTML(el, `
        <h3>General</h3>
        <div class="settings-group">
          <label>Username</label>
          <input class="settings-input" value="${ui.state.currentSession.currentUser}" disabled>
        </div>
        <div class="settings-group">
          <label>System Hostname</label>
          <input class="settings-input" value="${reg.system.hostname}" id="set-hostname">
        </div>
        <div class="settings-group">
          <label>Time Format</label>
          <select class="settings-select" id="set-timeformat">
            <option ${reg.system.timeFormat === '12h' ? 'selected' : ''}>12h</option>
            <option ${reg.system.timeFormat === '24h' ? 'selected' : ''}>24h</option>
          </select>
        </div>
        <div class="settings-group">
          <label>Startup Apps</label>
          <div class="settings-toggles">
            ${Object.keys(ui.state.processes).map(appId => {
              const checked = reg.system.startupApps.includes(appId) ? 'checked' : '';
              const escapedAppId = window.escapeHTML(appId);
              return '<label class="toggle-label"><input type="checkbox" data-app="' + escapedAppId + '" ' + checked + '> ' + escapedAppId + '</label>';
            }).join('')}
          </div>
        </div>
        <button class="btn btn-primary" id="save-general">Save Changes</button>
      `);
      el.querySelector('#save-general')?.addEventListener('click', () => {
        reg.system.hostname = el.querySelector('#set-hostname').value;
        reg.system.timeFormat = el.querySelector('#set-timeformat').value;
        const checkedApps = [];
        el.querySelectorAll('.settings-toggles input:checked').forEach(c => checkedApps.push(c.getAttribute('data-app')));
        reg.system.startupApps = checkedApps;
        ui.state.saveState();
        ui.showToast('Settings Saved', 'General settings updated.', 'success');
      });

    } else if (activeSection === 'appearance') {
      const colors = ['purple','blue','green','amber','red','cyan'];
      window.renderSafeHTML(el, `
        <h3>Appearance</h3>
        <div class="settings-group">
          <label>Accent Color</label>
          <div class="color-swatches">
            ${colors.map(c => {
              const activeClass = c === reg.appearance.accentColor ? 'active' : '';
              return '<button class="color-swatch ' + activeClass + '" data-color="' + c + '" style="background: var(--color-' + c + ')"></button>';
            }).join('')}
          </div>
        </div>
        <div class="settings-group">
          <label>Wallpaper</label>
          <div class="wallpaper-options">
            ${['default','aurora','ember'].map(w => {
              const activeClass = w === reg.appearance.wallpaper ? 'active' : '';
              const label = w.charAt(0).toUpperCase() + w.slice(1);
              return '<button class="wallpaper-btn ' + activeClass + '" data-wp="' + w + '">' + label + '</button>';
            }).join('')}
          </div>
        </div>
        <div class="settings-group">
          <label>Font Size: <span id="fs-val">${reg.appearance.fontSize}px</span></label>
          <input type="range" min="11" max="16" value="${reg.appearance.fontSize}" id="set-fontsize" class="settings-range">
        </div>
      `);
      el.querySelectorAll('.color-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
          const color = btn.getAttribute('data-color');
          reg.appearance.accentColor = color;
          el.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          applyAccentColor(color);
          ui.state.saveState();
          ui.showToast('Theme Updated', `Accent color set to ${color}.`, 'success');
        });
      });
      el.querySelectorAll('.wallpaper-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const wp = btn.getAttribute('data-wp');
          reg.appearance.wallpaper = wp;
          el.querySelectorAll('.wallpaper-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          applyWallpaper(wp);
          ui.state.saveState();
        });
      });
      el.querySelector('#set-fontsize')?.addEventListener('input', (e) => {
        reg.appearance.fontSize = parseInt(e.target.value);
        el.querySelector('#fs-val').textContent = e.target.value + 'px';
        document.documentElement.style.fontSize = e.target.value + 'px';
        ui.state.saveState();
      });

    } else if (activeSection === 'security') {
      window.renderSafeHTML(el, `
        <h3>Security & Privacy</h3>
        <div class="settings-group">
          <label>Change Password</label>
          <input type="password" class="settings-input" placeholder="Current password" id="sec-old-pass">
          <input type="password" class="settings-input" placeholder="New password" id="sec-new-pass" style="margin-top: 6px">
          <button class="btn btn-secondary" id="sec-change-pass" style="margin-top: 8px">Update Password</button>
        </div>
        <div class="settings-group">
          <label>Auto-Lock Timeout (seconds)</label>
          <input type="number" class="settings-input" value="${reg.security.autoLockTimeout}" id="sec-lock-timeout" min="30" max="3600">
        </div>
        <div class="settings-group">
          <label class="toggle-label"><input type="checkbox" id="sec-enforce-perms" ${reg.security.enforcePermissions ? 'checked' : ''}> Enforce file permissions</label>
        </div>
        <button class="btn btn-primary" id="save-security">Save</button>
      `);
      el.querySelector('#sec-change-pass')?.addEventListener('click', () => {
        const kernel = window.AstraKernel;
        if (!kernel) return;
        const oldP = el.querySelector('#sec-old-pass').value;
        const newP = el.querySelector('#sec-new-pass').value;
        if (kernel.changePassword(ui.state.currentSession.currentUser, oldP, newP)) {
          ui.showToast('Password Updated', 'Your password has been changed.', 'success');
        } else {
          ui.showToast('Error', 'Current password is incorrect.', 'error');
        }
      });
      el.querySelector('#save-security')?.addEventListener('click', () => {
        reg.security.autoLockTimeout = parseInt(el.querySelector('#sec-lock-timeout').value) || 300;
        reg.security.enforcePermissions = el.querySelector('#sec-enforce-perms').checked;
        ui.state.saveState();
        ui.showToast('Security Settings Saved', '', 'success');
      });

    } else if (activeSection === 'network') {
      const net = ui.state.network;
      const netListHTML = net.availableNetworks.map(n => {
        const connectedClass = n.connected ? 'connected' : '';
        const connectedText = n.connected ? '✓ Connected' : '';
        return `
          <div class="net-item ${connectedClass}">
            <span>${n.ssid} (${n.security})</span>
            <span>${n.signal}% ${connectedText}</span>
          </div>
        `;
      }).join('');

      window.renderSafeHTML(el, `
        <h3>Network</h3>
        <div class="settings-group">
          <label>Wi-Fi Status</label>
          <div class="net-card">${net.wlan0.ssid} — Signal ${net.wlan0.signal}% — IP: ${net.wlan0.ip}</div>
        </div>
        <div class="settings-group">
          <label>Available Networks</label>
          <div class="net-list">
            ${netListHTML}
          </div>
        </div>
        <div class="settings-group">
          <label>DNS Server</label>
          <input class="settings-input" value="${net.dns}" disabled>
        </div>
        <div class="settings-group">
          <label class="toggle-label"><input type="checkbox" id="net-airplane" ${net.airplaneMode ? 'checked' : ''}> Airplane Mode</label>
        </div>
      `);
      el.querySelector('#net-airplane')?.addEventListener('change', (e) => {
        net.airplaneMode = e.target.checked;
        ui.state.saveState();
        ui.showToast('Network', e.target.checked ? 'Airplane mode enabled.' : 'Airplane mode disabled.', 'info');
      });

    } else if (activeSection === 'storage') {
      const parts = hw.storage.partitions;
      const totalUsed = parts.reduce((s, p) => s + p.usedGB, 0);
      const totalSize = parts.reduce((s, p) => s + p.sizeGB, 0);
      window.renderSafeHTML(el, `
        <h3>Storage</h3>
        <div class="settings-group">
          <label>Total Usage: ${totalUsed}GB / ${totalSize}GB</label>
          <div class="disk-bar-bg"><div class="disk-bar-fill" style="width: ${Math.floor(totalUsed / totalSize * 100)}%"></div></div>
        </div>
        <div class="settings-group">
          <label>Trash: ${ui.state.trash.length} items</label>
          <button class="btn btn-secondary" id="btn-empty-trash">Empty Trash</button>
        </div>
        <div class="settings-group">
          <label>Export Virtual Filesystem</label>
          <button class="btn btn-secondary" id="btn-export-vfs">Download VFS as JSON</button>
        </div>
      `);
      el.querySelector('#btn-empty-trash')?.addEventListener('click', () => {
        const kernel = window.AstraKernel;
        if (kernel) { const c = kernel.emptyTrash(); ui.showToast('Trash Emptied', `${c} items permanently deleted.`, 'info'); renderSection(); }
      });
      el.querySelector('#btn-export-vfs')?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(ui.state.fs, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'astra_vfs_export.json';
        a.click();
        ui.showToast('Exported', 'VFS downloaded as JSON.', 'success');
      });

    } else if (activeSection === 'ai') {
      window.renderSafeHTML(el, `
        <h3>AI & LLM Orchestration</h3>
        <div class="settings-group">
          <label>Agent Mode / Provider</label>
          <select class="settings-select" id="ai-provider">
            <option value="simulated" ${reg.ai.provider === 'simulated' ? 'selected' : ''}>Simulated Multi-Agent (No Key Required)</option>
            <option value="gemini" ${reg.ai.provider === 'gemini' ? 'selected' : ''}>Real Gemini API Agent</option>
          </select>
        </div>
        <div class="settings-group">
          <label>Gemini API Key</label>
          <input type="password" class="settings-input" id="ai-apikey" value="${reg.ai.apiKey || ''}" placeholder="Enter Gemini API Key (AIzaSy...)">
          <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px; display: block;">Stored locally in your browser's localStorage.</span>
        </div>
        <div class="settings-group">
          <label>LLM Model</label>
          <select class="settings-select" id="ai-model">
            <option value="gemini-1.5-flash" ${reg.ai.model === 'gemini-1.5-flash' ? 'selected' : ''}>gemini-1.5-flash (Fast & Recommended)</option>
            <option value="gemini-1.5-pro" ${reg.ai.model === 'gemini-1.5-pro' ? 'selected' : ''}>gemini-1.5-pro (High intelligence)</option>
          </select>
        </div>
        <div class="settings-group">
          <label>Temperature: <span id="ai-temp-val">${reg.ai.temperature || 0.7}</span></label>
          <input type="range" min="0" max="1" step="0.1" value="${reg.ai.temperature || 0.7}" id="ai-temp" class="settings-range">
        </div>
        <div class="settings-group">
          <label>System Instructions Prompt</label>
          <textarea class="settings-textarea" id="ai-prompt" style="width: 100%; height: 80px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-glass); border-radius: 6px; padding: 8px; color: var(--text-primary); font-family: var(--font-sans); font-size: 12.5px;" rows="3">${reg.ai.systemPrompt || ''}</textarea>
        </div>
        <div class="settings-group">
          <label class="toggle-label"><input type="checkbox" id="ai-voice" ${reg.ai.voiceEnabled ? 'checked' : ''}> Voice Responses (Text-to-Speech)</label>
        </div>
        <div class="settings-actions" style="display: flex; gap: 10px; margin-top: 15px;">
          <button class="btn btn-primary" id="save-ai">Save AI Config</button>
          <button class="btn btn-secondary" id="test-ai">Test Connection</button>
        </div>
      `);

      el.querySelector('#ai-temp')?.addEventListener('input', (e) => {
        el.querySelector('#ai-temp-val').textContent = e.target.value;
      });

      el.querySelector('#save-ai')?.addEventListener('click', () => {
        reg.ai.provider = el.querySelector('#ai-provider').value;
        reg.ai.apiKey = el.querySelector('#ai-apikey').value.trim();
        reg.ai.model = el.querySelector('#ai-model').value;
        reg.ai.temperature = parseFloat(el.querySelector('#ai-temp').value) || 0.7;
        reg.ai.systemPrompt = el.querySelector('#ai-prompt').value;
        reg.ai.voiceEnabled = el.querySelector('#ai-voice').checked;
        ui.state.saveState();
        ui.showToast('AI Config Saved', 'AI Engine settings successfully updated.', 'success');
      });

      el.querySelector('#test-ai')?.addEventListener('click', async () => {
        const key = el.querySelector('#ai-apikey').value.trim();
        const model = el.querySelector('#ai-model').value;
        if (!key) {
          ui.showToast('Test Failed', 'Please enter a Gemini API Key to test.', 'error');
          return;
        }
        ui.showToast('Testing...', 'Verifying Gemini API connectivity...', 'info');
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello! Please return the word "Verified" only.' }] }] })
          });
          const json = await res.json();
          if (json.candidates && json.candidates[0].content.parts[0].text) {
            const resp = json.candidates[0].content.parts[0].text.trim();
            ui.showToast('Test Passed', `Gemini API connected successfully. Response: "${resp}"`, 'success');
          } else {
            console.error('API Error:', json);
            ui.showToast('Test Failed', json.error?.message || 'Unexpected API response.', 'error');
          }
        } catch (err) {
          console.error('Network Error:', err);
          ui.showToast('Test Failed', 'Network error or blocked request. Check console.', 'error');
        }
      });

    } else if (activeSection === 'about') {
      window.renderSafeHTML(el, `
        <h3>About Astra OS</h3>
        <div class="about-card">
          <div class="about-logo">△</div>
          <div class="about-title">Astra OS</div>
          <div class="about-version">Version 1.0 (Quantum)</div>
          <div class="about-detail">Kernel: astra-kernel 6.2.0</div>
          <div class="about-detail">Build: 2026.05.22</div>
          <div class="about-detail">Architecture: ${hw.cpu.architecture}</div>
          <div class="about-detail">CPU: ${hw.cpu.model}</div>
          <div class="about-detail">GPU: ${hw.gpu.model}</div>
          <div class="about-detail">RAM: ${hw.ram.totalGB}GB ${hw.ram.type}</div>
          <div class="about-detail">Display: ${hw.display.resolution} @ ${hw.display.refreshRate}</div>
          <div class="about-credit">Designed and built by Divyanshu Sinha</div>
        </div>
      `);
    }
  }

  function applyAccentColor(color) {
    const hueMap = { purple: 260, blue: 220, green: 140, amber: 35, red: 0, cyan: 180 };
    document.documentElement.style.setProperty('--hue-primary', Reflect.get(hueMap, color) || 260);
  }

  function applyWallpaper(name) {
    const wpFile = ui.state.resolvePath(`/usr/share/wallpapers/${name}.txt`);
    if (wpFile) {
      document.querySelector('.os-wallpaper').style.background = wpFile.content;
    }
  }

  render();
};

// ==========================================
// 4. Device Manager
// ==========================================
window.AstraApps.devicemgr = function(container, ui) {
  let expanded = {};

  function render() {
    const hw = ui.state.hardware;
    const categories = [
      { key: 'cpu', label: 'Processors', items: [`${hw.cpu.model}`, `${hw.cpu.cores} cores / ${hw.cpu.threads} threads`, `Cache: ${hw.cpu.cache}`, `Architecture: ${hw.cpu.architecture}`] },
      { key: 'ram', label: 'Memory', items: [`${hw.ram.totalGB}GB ${hw.ram.type}`, `Slots: ${hw.ram.modulesInstalled}/${hw.ram.slots} used`] },
      { key: 'gpu', label: 'Display Adapters', items: [`${hw.gpu.model}`, `VRAM: ${hw.gpu.vramGB}GB`, `Driver: ${hw.gpu.driver}`] },
      { key: 'storage', label: 'Disk Drives', items: hw.storage.partitions.map(p => `${p.device} — ${p.label} (${p.sizeGB}GB ${p.fsType})`) },
      { key: 'net', label: 'Network Adapters', items: [`${hw.network.adapter}`, `${hw.network.ethernet}`] },
      { key: 'audio', label: 'Audio', items: [`${hw.audio.device}`, `Driver: ${hw.audio.driver}`] },
      { key: 'display', label: 'Monitors', items: [`Resolution: ${hw.display.resolution}`, `Refresh Rate: ${hw.display.refreshRate}`, `Scaling: ${hw.display.scaling}`] },
      { key: 'usb', label: 'USB Devices', items: hw.usb.map(d => `${window.escapeHTML(d.name)} (${window.escapeHTML(d.type)}) — ${d.status}`) }
    ];

    window.renderSafeHTML(container, `
      <div class="devmgr-app">
        <div class="devmgr-header">
          <span>astra-desktop</span>
          <span style="color: var(--text-muted); font-size: 11px">Astra OS 1.0 (Quantum)</span>
        </div>
        <div class="devmgr-tree">
          ${categories.map(cat => `
            <div class="devmgr-category">
              <div class="devmgr-cat-header" data-key="${cat.key}">
                <span class="devmgr-arrow">${Reflect.get(expanded, cat.key) ? '▼' : '▶'}</span>
                <span>${cat.label}</span>
              </div>
              ${expanded[cat.key] ? '<div class="devmgr-items">' + cat.items.map(i => '<div class="devmgr-item">' + i + '</div>').join('') + '</div>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `);

    container.querySelectorAll('.devmgr-cat-header').forEach(h => {
      h.addEventListener('click', () => {
        const key = h.getAttribute('data-key');
        expanded[key] = !expanded[key];
        render();
      });
    });
  }

  render();
};

// ==========================================
// 5. Disk Utility
// ==========================================
window.AstraApps.diskutil = function(container, ui) {
  function render() {
    const parts = ui.state.hardware.storage.partitions;
    const kernel = window.AstraKernel;

    window.renderSafeHTML(container, `
      <div class="diskutil-app">
        <div class="diskutil-header">Disk Utility — Partition Map</div>
        <div class="diskutil-visual">
          <div class="diskutil-bar">
            ${parts.map((p, i) => {
              const pct = (p.sizeGB / parts.reduce((s, pp) => s + pp.sizeGB, 0)) * 100;
              const colors = ['#a855f7', '#3b82f6', '#f59e0b'];
              return '<div class="diskutil-segment" style="width: ' + pct + '%; background: ' + Reflect.get(colors, i % 3) + '" title="' + window.escapeHTML(p.label) + ': ' + p.sizeGB + 'GB"></div>';
            }).join('')}
          </div>
          <div class="diskutil-legend">
            ${parts.map((p, i) => {
              const colors = ['#a855f7', '#3b82f6', '#f59e0b'];
              return '<span class="diskutil-legend-item"><span class="legend-dot" style="background: ' + Reflect.get(colors, i % 3) + '"></span>' + window.escapeHTML(p.label) + ' (' + p.sizeGB + 'GB)</span>';
            }).join('')}
          </div>
        </div>
        <div class="diskutil-parts">
          ${parts.map(p => `
            <div class="diskutil-part-row">
              <div>
                <strong>${p.device}</strong> — ${p.label}
                <div style="font-size: 11px; color: var(--text-muted)">${p.fsType} • ${p.usedGB}GB / ${p.sizeGB}GB • ${p.mounted ? 'Mounted at ' + p.mountpoint : 'Unmounted'}</div>
              </div>
              <div class="diskutil-actions">
                ${p.mountpoint !== '/' && p.mountpoint !== '/boot' ? `
                  <button class="btn btn-secondary btn-sm" data-dev="${p.device}" data-action="${p.mounted ? 'unmount' : 'mount'}">${p.mounted ? 'Unmount' : 'Mount'}</button>
                  ${!p.mounted ? '<button class="btn btn-secondary btn-sm" data-dev="' + p.device + '" data-action="format" style="color: var(--color-red)">Format</button>' : ''}
                  ${p.device.includes('sdb') ? '<button class="btn btn-secondary btn-sm" data-dev="' + p.device + '" data-action="eject">⏏ Eject</button>' : ''}
                ` : '<span style="color: var(--text-muted); font-size: 11px">System Partition</span>'}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `);

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dev = btn.getAttribute('data-dev');
        const action = btn.getAttribute('data-action');
        if (!kernel) return;
        if (action === 'mount') { kernel.mountPartition(dev); ui.showToast('Mounted', `${dev} mounted successfully.`, 'success'); }
        else if (action === 'unmount') { kernel.unmountPartition(dev); ui.showToast('Unmounted', `${dev} unmounted.`, 'info'); }
        else if (action === 'format') {
          if (confirm(`Format ${dev}? This will erase all data.`)) { kernel.formatPartition(dev, 'ext4'); ui.showToast('Formatted', `${dev} formatted as ext4.`, 'info'); }
        }
        else if (action === 'eject') { kernel.unmountPartition(dev); ui.showToast('Ejected', `${dev} safely ejected.`, 'success'); }
        render();
      });
    });
  }

  render();
};
