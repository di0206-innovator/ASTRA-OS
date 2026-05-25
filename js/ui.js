// ==========================================
// Astra OS UI Controller (Expanded)
// ==========================================

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => (Reflect.get({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }, tag) || tag)
  );
}

export class UIController {
  constructor(state) {
    this.state = state;
    this.snapTarget = null;
    this.dragState = null;
    this.contextMenuVisible = false;
    this.inactivityTimer = null;
    this.lastActivity = Date.now();
    this.appTimers = {};
    this.setupTimerInterceptors();
  }

  setupTimerInterceptors() {
    const self = this;
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;
    const originalClearTimeout = window.clearTimeout;
    const originalClearInterval = window.clearInterval;

    window.setTimeout = function(callback, delay, ...args) {
      const activeApp = self.state.activeWindow;
      const id = originalSetTimeout(callback, delay, ...args);
      if (activeApp) {
        self.registerAppTimer(activeApp, id, 'timeout');
      }
      return id;
    };

    window.setInterval = function(callback, delay, ...args) {
      const activeApp = self.state.activeWindow;
      const id = originalSetInterval(callback, delay, ...args);
      if (activeApp) {
        self.registerAppTimer(activeApp, id, 'interval');
      }
      return id;
    };

    window.clearTimeout = function(id) {
      originalClearTimeout(id);
      self.unregisterAppTimer(id, 'timeout');
    };

    window.clearInterval = function(id) {
      originalClearInterval(id);
      self.unregisterAppTimer(id, 'interval');
    };
  }

  registerAppTimer(appId, id, type) {
    if (!this.appTimers[appId]) {
      this.appTimers[appId] = { timeouts: new Set(), intervals: new Set() };
    }
    if (type === 'timeout') {
      this.appTimers[appId].timeouts.add(id);
    } else {
      this.appTimers[appId].intervals.add(id);
    }
  }

  unregisterAppTimer(id, type) {
    for (const appId in this.appTimers) {
      const record = this.appTimers[appId];
      if (type === 'timeout' && record.timeouts.has(id)) {
        record.timeouts.delete(id);
        break;
      } else if (type === 'interval' && record.intervals.has(id)) {
        record.intervals.delete(id);
        break;
      }
    }
  }

  clearAppTimers(appId) {
    const record = this.appTimers[appId];
    if (record) {
      record.timeouts.forEach(id => window.clearTimeout(id));
      record.intervals.forEach(id => window.clearInterval(id));
      delete this.appTimers[appId];
    }
  }

  init() {
    this.setupMenuClock();
    this.setupWindowDragging();
    this.setupDesktopIcons();
    this.setupDock();
    // Add visual app shortcuts from App Store if they are installed
    const visualApps = [
      { id: 'astroid', title: 'Astro Defender Game', emoji: '🎮' },
      { id: 'pulsewave', title: 'PulseWave Ambient Player', emoji: '🎵' }
    ];
    visualApps.forEach(app => {
      const pkg = this.state.packages.find(p => p.name === app.id);
      if (pkg && pkg.installed) {
        this.addDockShortcut(app.id, app.title, app.emoji);
      }
    });
    this.setupLockScreen();
    this.setupContextMenu();
    this.setupNotificationCenter();
    this.setupCalendarWidget();
    this.setupWindowSnapping();
    this.setupKeyboardShortcuts();
    this.setupInactivityDetector();
    this.setupSidebar();
    this.setupControlCenter();
    this.setupDesktopWidgets();
    this.updateNotifBadge();
    this.applyTheme();
    this.initWorkspaces();

    // Show lock screen or desktop
    if (this.state.currentSession.isLocked) {
      this.showLockScreen();
    } else {
      this.hideLockScreen();
    }
  }

  // ==========================================
  // Lock Screen
  // ==========================================
  setupLockScreen() {
    const lockOverlay = document.getElementById('lock-screen');
    if (!lockOverlay) return;
    const form = lockOverlay.querySelector('#lock-form');
    const passInput = lockOverlay.querySelector('#lock-password');
    const errorEl = lockOverlay.querySelector('#lock-error');

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const pass = passInput?.value;
      const kernel = window.AstraKernel;
      if (kernel && kernel.unlockScreen(pass)) {
        this.hideLockScreen();
        passInput.value = '';
        if (errorEl) errorEl.textContent = '';
      } else {
        if (errorEl) errorEl.textContent = 'Incorrect password. Try again.';
        passInput.value = '';
        passInput?.focus();
        lockOverlay.classList.add('shake');
        setTimeout(() => lockOverlay.classList.remove('shake'), 500);
      }
    });

    // Update lock screen clock
    setInterval(() => {
      const timeEl = lockOverlay.querySelector('#lock-time');
      const dateEl = lockOverlay.querySelector('#lock-date');
      if (timeEl) timeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }, 1000);
  }

  showLockScreen() {
    const el = document.getElementById('lock-screen');
    if (el) {
      el.style.removeProperty('display');
      el.classList.remove('hidden');
    }
    this.state.currentSession.isLocked = true;
    this.state.saveState();
  }

  hideLockScreen() {
    const el = document.getElementById('lock-screen');
    if (el) el.classList.add('hidden');
    this.state.currentSession.isLocked = false;
    this.state.saveState();
  }

  lockScreen() {
    this.showLockScreen();
  }

  // ==========================================
  // Inactivity Detector (auto-lock)
  // ==========================================
  setupInactivityDetector() {
    const resetTimer = () => { this.lastActivity = Date.now(); };
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt =>
      document.addEventListener(evt, resetTimer, { passive: true })
    );
    setInterval(() => {
      const timeout = (this.state.registry.security?.autoLockTimeout || 300) * 1000;
      if (Date.now() - this.lastActivity > timeout && !this.state.currentSession.isLocked) {
        this.lockScreen();
      }
    }, 10000);
  }

  // ==========================================
  // Context Menu
  // ==========================================
  setupContextMenu() {
    const menu = document.getElementById('context-menu');
    if (!menu) return;

    // Desktop right-click
    document.getElementById('desktop')?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY, [
        { label: '📁 New Folder', action: () => { const n = prompt('Folder name:'); if (n) { this.state.createDir(`/home/divyanshu/Desktop/${n}`); this.showToast('Created', n, 'success'); } } },
        { label: '📄 New File', action: () => { const n = prompt('File name:'); if (n) { this.state.writeFile('/home/divyanshu/Desktop/' + n, ''); this.showToast('Created', n, 'success'); } } },
        { divider: true },
        { label: '🖥 Open Terminal', action: () => this.openApp('terminal') },
        { label: '⟳ Refresh Desktop', action: () => location.reload() },
        { divider: true },
        { label: '🎨 Change Wallpaper', action: () => this.openApp('settings') },
        { label: '⚙ Display Settings', action: () => this.openApp('settings') },
        { label: '🔒 Lock Screen', action: () => this.lockScreen() }
      ]);
    });

    // Close context menu on click
    document.addEventListener('click', () => this.hideContextMenu());
    document.addEventListener('contextmenu', (e) => {
      // Only handle on desktop area, not inside apps
      if (!e.target.closest('#desktop') && !e.target.closest('.desktop-icon')) {
        this.hideContextMenu();
      }
    });
  }

  showContextMenu(x, y, items) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    window.renderSafeHTML(menu, items.map(item => {
      if (item.divider) return '<div class="ctx-divider"></div>';
      return html`<div class="ctx-item" data-idx="${items.indexOf(item)}">${escapeHTML(item.label)}</div>`;
    }).join(''));
    // Position
    menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - menu.scrollHeight - 10)}px`;
    menu.classList.remove('hidden');
    this.contextMenuVisible = true;
    // Events
    menu.querySelectorAll('.ctx-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.getAttribute('data-idx'));
        if (items[idx] && items[idx].action) items[idx].action();
        this.hideContextMenu();
      });
    });
  }

  hideContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) menu.classList.add('hidden');
    this.contextMenuVisible = false;
  }

  // ==========================================
  // Window Snapping
  // ==========================================
  setupWindowSnapping() {
    const snapLeft = document.getElementById('snap-zone-left');
    const snapRight = document.getElementById('snap-zone-right');
    const snapTop = document.getElementById('snap-zone-top');
    if (!snapLeft || !snapRight || !snapTop) return;

    document.addEventListener('mousemove', (e) => {
      if (!this.dragState) return;
      if (e.clientX < 10) { snapLeft.classList.add('active'); this.snapTarget = 'left'; }
      else if (e.clientX > window.innerWidth - 10) { snapRight.classList.add('active'); this.snapTarget = 'right'; }
      else if (e.clientY < 40) { snapTop.classList.add('active'); this.snapTarget = 'maximize'; }
      else {
        [snapLeft, snapRight, snapTop].forEach(z => z.classList.remove('active'));
        this.snapTarget = null;
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.snapTarget && this.dragState) {
        const appId = this.dragState.appId;
        const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
        if (proc) {
          const menuH = 36;
          const dockH = 60;
          const areaW = window.innerWidth;
          const areaH = window.innerHeight - menuH - dockH;
          if (this.snapTarget === 'left') { proc.x = 0; proc.y = menuH; proc.w = areaW / 2; proc.h = areaH; }
          else if (this.snapTarget === 'right') { proc.x = areaW / 2; proc.y = menuH; proc.w = areaW / 2; proc.h = areaH; }
          else if (this.snapTarget === 'maximize') { proc.x = 0; proc.y = menuH; proc.w = areaW; proc.h = areaH; }
          this.state.saveState();
          this.applyWindowTransform(appId);
        }
      }
      [document.getElementById('snap-zone-left'), document.getElementById('snap-zone-right'), document.getElementById('snap-zone-top')].forEach(z => { if (z) z.classList.remove('active'); });
      this.snapTarget = null;
    });
  }

  // ==========================================
  // Notification Center
  // ==========================================
  setupNotificationCenter() {
    const bellBtn = document.getElementById('notif-bell');
    const panel = document.getElementById('notif-panel');
    if (!bellBtn || !panel) return;

    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        this.renderNotifPanel();
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#notif-panel') && !e.target.closest('#notif-bell')) {
        panel.classList.remove('open');
      }
    });
  }

  renderNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    const notifs = this.state.notifications.slice().reverse().slice(0, 20);
    window.renderSafeHTML(panel, `
      <div class="notif-panel-header">
        <span>Notifications</span>
        <button class="btn-text-action" id="notif-clear-all">Clear</button>
      </div>
      <div class="notif-panel-list">
        ${notifs.length === 0 ? '<div class="notif-empty">No notifications</div>' : notifs.map(n => `
          <div class="notif-panel-item ${n.read ? '' : 'unread'}">
            <span class="notif-panel-icon">${n.type === 'error' ? '🔴' : n.type === 'warning' ? '🟡' : n.type === 'success' ? '🟢' : '🔵'}</span>
            <div class="notif-panel-body">
              <div class="notif-panel-msg">${escapeHTML(n.message)}</div>
              <div class="notif-panel-time">${escapeHTML(n.source)} • ${escapeHTML(n.time)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `);
    panel.querySelector('#notif-clear-all')?.addEventListener('click', () => {
      this.state.notifications = [];
      this.state.saveState();
      this.updateNotifBadge();
      this.renderNotifPanel();
    });
    this.state.markAllNotificationsRead();
    this.updateNotifBadge();
  }

  updateNotifBadge() {
    const badge = document.getElementById('notif-badge');
    const count = this.state.getUnreadNotificationCount();
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  // ==========================================
  // Calendar Widget
  // ==========================================
  setupCalendarWidget() {
    const clockEl = document.getElementById('menu-clock');
    const calDropdown = document.getElementById('calendar-dropdown');
    if (!clockEl || !calDropdown) return;

    clockEl.addEventListener('click', (e) => {
      e.stopPropagation();
      calDropdown.classList.toggle('open');
      if (calDropdown.classList.contains('open')) this.renderCalendar();
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#calendar-dropdown') && !e.target.closest('#menu-clock')) {
        calDropdown.classList.remove('open');
      }
    });
  }

  renderCalendar() {
    const el = document.getElementById('calendar-dropdown');
    if (!el) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    let cells = '';
    for (let i = 0; i < firstDay; i++) cells += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) cells += html`<div class="cal-cell ${d === today ? 'today' : ''}">${d}</div>`;

    window.renderSafeHTML(el, `
      <div class="cal-header">${monthName} ${year}</div>
      <div class="cal-days">${dayNames.map(d => html`<div class="cal-dayname">${d}</div>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
    `);
  }

  // ==========================================
  // Theme Application
  // ==========================================
  applyTheme() {
    const reg = this.state.registry;
    if (!reg || !reg.appearance) return;
    const hueMap = { purple: 260, blue: 220, green: 140, amber: 35, red: 0, cyan: 180 };
    const hue = Object.prototype.hasOwnProperty.call(hueMap, reg.appearance.accentColor) ? Reflect.get(hueMap, reg.appearance.accentColor) : 260;
    document.documentElement.style.setProperty('--hue-primary', hue);
    if (reg.appearance.fontSize) {
      document.documentElement.style.fontSize = reg.appearance.fontSize + 'px';
    }
    // Apply wallpaper
    const wpName = reg.appearance.wallpaper || 'default';
    const wpFile = this.state.resolvePath(`/usr/share/wallpapers/${wpName}.txt`);
    if (wpFile) {
      const wp = document.querySelector('.os-wallpaper');
      if (wp) wp.style.background = wpFile.content;
    }
  }

  // ==========================================
  // Control Center
  // ==========================================
  setupControlCenter() {
    const ccBtn = document.getElementById('control-center-btn');
    const ccPanel = document.getElementById('control-center-panel');
    if (!ccBtn || !ccPanel) return;

    ccBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      ccPanel.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#control-center-panel') && !e.target.closest('#control-center-btn')) {
        ccPanel.classList.remove('open');
      }
    });

    // Connectivity toggles
    ccPanel.querySelectorAll('.cc-toggle').forEach(t => {
      t.addEventListener('click', () => {
        t.classList.toggle('active');
        const status = t.querySelector('.cc-toggle-status');
        if (status) {
          status.textContent = t.classList.contains('active') ? 'On' : 'Off';
        }
      });
    });

    // Sliders
    const brightSlider = document.getElementById('brightness-slider');
    if (brightSlider) {
      brightSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        document.body.style.filter = `brightness(${val}%)`;
      });
    }
  }

  // ==========================================
  // Desktop Widgets
  // ==========================================
  setupDesktopWidgets() {
    const clockEl = document.getElementById('w-clock-time');
    if (clockEl) {
      const updateWClock = () => {
        clockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      };
      updateWClock();
      setInterval(updateWClock, 1000);
    }

    const updateCalendarWidgets = () => {
      const now = new Date();
      const month = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const date = now.getDate();
      const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

      const calMonth = document.querySelector('.w-cal-month');
      const calDate = document.querySelector('.w-cal-date');
      if (calMonth) calMonth.textContent = month;
      if (calDate) calDate.textContent = date;

      const eventTitle = document.querySelector('.w-events-title');
      const eventDate = document.querySelector('.w-events-date');
      if (eventTitle) eventTitle.textContent = dayName;
      if (eventDate) eventDate.textContent = date;
    };
    updateCalendarWidgets();
    setInterval(updateCalendarWidgets, 60000);
  }

  // ==========================================
  // Menu Bar Clock
  // ==========================================
  setupMenuClock() {
    const clockEl = document.getElementById('menu-clock');
    if (!clockEl) return;
    const updateClock = () => {
      const format = this.state.registry?.system?.timeFormat || '12h';
      clockEl.textContent = new Date().toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit',
        hour12: format === '12h'
      }) + '  ' + new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  // ==========================================
  // Window Management
  // ==========================================
  setupWindowDragging() {
    const container = document.getElementById('windows-container');
    if (!container) return;

    container.addEventListener('mousedown', (e) => {
      const handle = e.target.closest('.window-header');
      if (!handle || e.target.closest('.dot-close') || e.target.closest('.dot-min') || e.target.closest('.dot-max')) return;
      const win = handle.closest('.window');
      if (!win) return;
      const appId = win.getAttribute('data-app');
      const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
      if (!proc) return;

      this.dragState = {
        appId,
        startX: e.clientX,
        startY: e.clientY,
        origX: proc.x,
        origY: proc.y
      };

      this.focusWindow(appId);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.dragState) return;
      const dx = e.clientX - this.dragState.startX;
      const dy = e.clientY - this.dragState.startY;
      const proc = Object.prototype.hasOwnProperty.call(this.state.processes, this.dragState.appId) ? Reflect.get(this.state.processes, this.dragState.appId) : null;
      if (!proc) return;
      proc.x = this.dragState.origX + dx;
      proc.y = this.dragState.origY + dy;
      this.applyWindowTransform(this.dragState.appId);
    });

    document.addEventListener('mouseup', () => {
      if (this.dragState) {
        this.state.saveState();
        this.dragState = null;
      }
    });
  }

  applyWindowTransform(appId) {
    const win = document.querySelector(`.window[data-app="${window.escapeHTML(appId)}"]`);
    const proc = Object.prototype.hasOwnProperty.call(this.state.processes, appId) ? Reflect.get(this.state.processes, window.sanitizeKey(appId)) : null;
    if (!win || !proc) return;
    win.style.left = `${proc.x}px`;
    win.style.top = `${proc.y}px`;
    win.style.width = `${proc.w}px`;
    win.style.height = `${proc.h}px`;
  }

  focusWindow(appId) {
    if (this.state.systemVars.missionControlActive) {
      this.toggleMissionControl();
    }
    const procs = this.state.processes;
    const allZ = Object.values(procs).map(p => p.zIndex || 0).filter(z => z > 0);
    const maxZ = allZ.length > 0 ? Math.max(...allZ) : 10;
    if (Object.prototype.hasOwnProperty.call(procs, appId)) Reflect.get(procs, appId).zIndex = maxZ + 1;
    this.state.activeWindow = appId;

    document.querySelectorAll('.window').forEach(win => {
      const id = win.getAttribute('data-app');
      const z = procs[id]?.zIndex || 1;
      win.style.zIndex = z;
      win.classList.toggle('active', id === appId);
    });

    // Update dock active indicators
    document.querySelectorAll('.dock-item').forEach(item => {
      const id = item.getAttribute('data-app');
      item.classList.toggle('active', procs[id]?.open);
    });

    if (window.MemoryHook) {
      window.MemoryHook(appId);
    }

    this.state.saveState();
  }

  createWindowDOM(appId) {
    const titles = {
      explorer: '📁 File Explorer',
      editor: '📝 Code Editor',
      memory: '🧠 Memory Graph',
      tasks: '📋 Tasks Board',
      terminal: '⚡ Terminal',
      browser: '🌐 Web Browser',
      appstore: '📦 App Store',
      settings: '⚙️ Settings',
      sysmonitor: '📈 System Monitor',
      dashboard: '🤖 AI Dashboard',
      devicemgr: '🛠️ Device Manager',
      diskutil: '💾 Disk Utility',
      calculator: '🧮 Calculator',
      dailybriefing: '📅 Daily Briefing',
      trust: '🛡️ Trust & Safety',
      timeline: '⏳ Cognitive Timeline',
      astroid: '🎮 Astro Defender Game',
      pulsewave: '🎵 PulseWave Ambient Player'
    };
    const title = Reflect.get(titles, appId) || (appId.charAt(0).toUpperCase() + appId.slice(1));
    const win = document.createElement('div');
    win.className = 'window hidden';
    win.setAttribute('data-app', appId);
    
    window.renderSafeHTML(win, `
      <div class="window-header">
        <div class="window-controls">
          <button class="control-dot dot-close" title="Close"></button>
          <button class="control-dot dot-min dot-minimize" title="Minimize"></button>
          <button class="control-dot dot-max dot-maximize" title="Maximize"></button>
        </div>
        <div class="window-title">${title}</div>
        <div class="window-actions"></div>
      </div>
      <div class="window-body"></div>
      <div class="window-resize-handle"></div>
    `);

    document.getElementById('windows-container')?.appendChild(win);

    // Wire window controls for this new window
    win.querySelector('.dot-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeApp(appId);
    });
    win.querySelector('.dot-min')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimizeApp(appId);
    });
    win.querySelector('.dot-max')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.maximizeApp(appId);
    });
    win.addEventListener('mousedown', () => this.focusWindow(appId));

    // Setup window resizing for this specific window
    this.setupWindowResizing(win, appId);

    return win;
  }

  setupWindowResizing(win, appId) {
    const handle = win.querySelector('.window-resize-handle');
    if (!handle) return;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
      if (!proc) return;

      const startW = proc.w;
      const startH = proc.h;
      const startX = e.clientX;
      const startY = e.clientY;

      const onMouseMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        proc.w = Math.max(320, startW + dx);
        proc.h = Math.max(200, startH + dy);

        this.applyWindowTransform(appId);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        this.state.saveState();
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  openApp(appId) {
    let proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
    if (!proc) {
      // Dynamic process state for newly installed App Store apps!
      proc = { open: false, minimized: false, x: 200, y: 150, w: 600, h: 420, zIndex: 25 };
      Reflect.set(this.state.processes, window.sanitizeKey(appId), proc);
    }
    let win = document.querySelector(`.window[data-app="${window.escapeHTML(appId)}"]`);
    if (!win) {
      win = this.createWindowDOM(appId);
    }

    if (proc.open && !proc.minimized) {
      if (proc.workspace !== undefined && proc.workspace !== (this.state.systemVars.currentWorkspace || 0)) {
        this.switchWorkspace(proc.workspace);
      }
      this.focusWindow(appId);
      return;
    }

    proc.open = true;
    proc.minimized = false;
    if (proc.workspace === undefined) {
      proc.workspace = this.state.systemVars.currentWorkspace || 0;
    }
    this.updateWorkspaceWindows();

    win.classList.remove('hidden');
    win.style.left = `${proc.x}px`;
    win.style.top = `${proc.y}px`;
    win.style.width = `${proc.w}px`;
    win.style.height = `${proc.h}px`;

    // Spawn process
    const kernel = window.AstraKernel;
    if (kernel) kernel.spawnProcess(appId, 5); // parent = windowserver

    this.focusWindow(appId);

    // Initialize app content
    const content = win.querySelector('.window-body');
    if (content && Reflect.get(window.AstraApps, window.sanitizeKey(appId))) {
      window.renderSafeHTML(content, '');
      Reflect.get(window.AstraApps, window.sanitizeKey(appId))(content, this);
    }

    this.state.saveState();
  }

  closeApp(appId) {
    const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
    if (!proc) return;
    const win = document.querySelector(`.window[data-app="${window.escapeHTML(appId)}"]`);
    if (win) {
      win.classList.add('hidden');
      const body = win.querySelector('.window-body');
      if (body) {
        window.renderSafeHTML(body, '');
      }
    }
    proc.open = false;
    proc.minimized = false;

    // Clear registered app timers
    this.clearAppTimers(appId);

    // Kill process
    const kernel = window.AstraKernel;
    if (kernel) {
      const kp = kernel.listProcesses().find(p => p.name === appId);
      if (kp) kernel.killProcess(kp.pid);
    }

    // Update dock
    document.querySelectorAll('.dock-item').forEach(item => {
      if (item.getAttribute('data-app') === appId) item.classList.remove('active');
    });

    this.state.saveState();
  }

  minimizeApp(appId) {
    const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
    if (!proc) return;
    const win = document.querySelector(`.window[data-app="${window.escapeHTML(appId)}"]`);
    if (win) win.classList.add('hidden');
    proc.minimized = true;
    this.state.saveState();
  }

  maximizeApp(appId) {
    const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
    if (!proc) return;
    const menuH = 36;
    const dockH = 60;
    if (proc.w >= window.innerWidth - 20 && proc.h >= window.innerHeight - menuH - dockH - 20) {
      // Restore
      proc.x = 100 + Math.random() * 200;
      proc.y = 60 + Math.random() * 100;
      proc.w = 700;
      proc.h = 480;
    } else {
      proc.x = 0;
      proc.y = menuH;
      proc.w = window.innerWidth;
      proc.h = window.innerHeight - menuH - dockH;
    }
    this.applyWindowTransform(appId);
    this.state.saveState();
  }

  // ==========================================
  // Desktop Icons
  // ==========================================
  setupDesktopIcons() {
    document.querySelectorAll('.desktop-icon').forEach(icon => {
      icon.addEventListener('dblclick', () => {
        const appId = icon.getAttribute('data-app');
        if (appId) this.openApp(appId);
      });
    });
  }

  // ==========================================
  // Dock
  // ==========================================
  setupDock() {
    document.querySelectorAll('.dock-item').forEach(item => {
      const appId = item.getAttribute('data-app');
      item.addEventListener('click', () => {
        if (appId === 'afk') { this.toggleAFK(); return; }
        const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
        if (proc?.open && !proc.minimized) this.minimizeApp(appId);
        else this.openApp(appId);
      });
    });
  }

  addDockShortcut(appId, title, emoji) {
    const dockCenter = document.querySelector('.dock-center');
    if (!dockCenter) return;
    
    // Check if it already exists
    if (document.getElementById(`dock-${appId}`)) return;
    
    const separator = dockCenter.querySelector('.dock-separator');
    
    const btn = document.createElement('button');
    btn.className = 'dock-item app-shortcut';
    btn.id = `dock-${appId}`;
    btn.setAttribute('data-app', appId);
    btn.setAttribute('title', title);
    
    window.renderSafeHTML(btn, `
      <span style="font-size: 20px; line-height: 1;">${emoji}</span>
      <span class="active-dot"></span>
    `);
    
    // Insert before the separator
    if (separator) {
      dockCenter.insertBefore(btn, separator);
    } else {
      dockCenter.appendChild(btn);
    }
    
    // Wire click event immediately!
    btn.addEventListener('click', () => {
      const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
      if (proc?.open && !proc.minimized) this.minimizeApp(appId);
      else this.openApp(appId);
    });
  }

  // ==========================================
  // Sidebar
  // ==========================================
  setupSidebar() {
    const sidebar = document.getElementById('ai-sidebar');
    if (!sidebar) return;

    // Toggle sidebar button in header
    const toggleBtn = document.getElementById('toggle-sidebar-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        this.state.systemVars.sidebarOpen = !sidebar.classList.contains('collapsed');
      });
    }

    // Dock sidebar toggle button
    const dockToggle = document.getElementById('dock-sidebar-toggle');
    if (dockToggle) {
      dockToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        this.state.systemVars.sidebarOpen = !sidebar.classList.contains('collapsed');
      });
    }

    // Sidebar chat input
    const chatInput = sidebar.querySelector('#sidebar-chat-input');
    const chatSend = sidebar.querySelector('#sidebar-chat-send');
    if (chatInput && chatSend) {
      const sendMsg = () => {
        const msg = chatInput.value.trim();
        if (!msg) return;
        this.addChatMessage('user', msg);
        chatInput.value = '';
        setTimeout(() => {
          this.addChatMessage('astra', `I've noted your request: "${msg}". Processing...`);
          this.state.addAuditLog('Astra', `User query: ${msg}`);
          this.state.saveState();
        }, 800);
      };
      chatSend.addEventListener('click', sendMsg);
      chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });
    }
  }

  addChatMessage(role, text) {
    const chatLog = document.getElementById('sidebar-chat-log');
    if (!chatLog) return;
    const div = document.createElement('div');
    div.className = `chat-msg chat-${role}`;
    window.renderSafeHTML(div, html`<div class="chat-bubble">${escapeHTML(text)}</div>`);
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // ==========================================
  // Keyboard Shortcuts
  // ==========================================
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const isMeta = e.metaKey || (e.ctrlKey && !['ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(e.key));

      // Cmd+K — Command Palette
      if (isMeta && e.key === 'k') {
        e.preventDefault();
        this.toggleCommandPalette();
      }
      // Cmd+L — Lock Screen
      if (isMeta && e.key === 'l') {
        e.preventDefault();
        this.lockScreen();
      }
      // Cmd+\ — Toggle Sidebar
      if (isMeta && e.key === '\\') {
        e.preventDefault();
        document.getElementById('ai-sidebar')?.classList.toggle('collapsed');
      }
      // Cmd+Left — Snap left
      if (isMeta && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.snapActiveWindow('left');
      }
      // Cmd+Right — Snap right
      if (isMeta && e.key === 'ArrowRight') {
        e.preventDefault();
        this.snapActiveWindow('right');
      }
      // Cmd+Up — Maximize
      if (isMeta && e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.state.activeWindow) this.maximizeApp(this.state.activeWindow);
      }

      // Ctrl+ArrowLeft — Switch Workspace Left
      if (e.ctrlKey && !e.metaKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        const current = this.state.systemVars.currentWorkspace || 0;
        if (current > 0) this.switchWorkspace(current - 1);
      }
      // Ctrl+ArrowRight — Switch Workspace Right
      if (e.ctrlKey && !e.metaKey && e.key === 'ArrowRight') {
        e.preventDefault();
        const current = this.state.systemVars.currentWorkspace || 0;
        if (current < 2) this.switchWorkspace(current + 1);
      }
      // F3 or Ctrl+ArrowUp — Toggle Mission Control
      if (e.key === 'F3' || (e.ctrlKey && !e.metaKey && e.key === 'ArrowUp')) {
        e.preventDefault();
        this.toggleMissionControl();
      }
    });
  }

  setFocusMode(mode) {
    if (!['coding', 'deepwork', 'research'].includes(mode)) return;
    if (this.state.registry.system === undefined) this.state.registry.system = {};
    this.state.registry.system.focusMode = mode;
    this.state.saveState();

    const hueColors = { coding: 'cyan', deepwork: 'amber', research: 'blue' };
    const accent = Reflect.get(hueColors, mode);
    this.state.registry.appearance.accentColor = accent;
    this.applyTheme();

    const notifBell = document.getElementById('notif-bell');
    
    if (mode === 'deepwork') {
      this.state.registry.system.notificationsSilenced = true;
      if (notifBell) {
        notifBell.setAttribute('title', 'Notifications Silenced (DND)');
        notifBell.style.color = 'var(--color-amber)';
      }
      this.showToast('Focus Mode', 'Deep Work Mode activated (DND on)', 'warning');

      const nonEssential = ['calculator', 'browser', 'appstore', 'sysmonitor', 'devicemgr', 'diskutil', 'dailybriefing', 'trust', 'timeline'];
      nonEssential.forEach(appId => {
        const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
        if (proc && proc.open && !proc.minimized) {
          this.minimizeApp(appId);
        }
      });
    } else {
      this.state.registry.system.notificationsSilenced = false;
      if (notifBell) {
        notifBell.setAttribute('title', 'Notifications');
        notifBell.style.color = '';
      }
      this.showToast('Focus Mode', `Focus set to ${mode.charAt(0).toUpperCase() + mode.slice(1)}`, 'success');
      
      if (mode === 'coding') {
        this.openApp('editor');
        this.openApp('terminal');
      } else if (mode === 'research') {
        this.openApp('browser');
        this.openApp('memory');
      }
    }

    const dbBody = document.querySelector('.window[data-app="dashboard"] .window-body');
    if (dbBody && window.AstraApps.dashboard) {
      window.AstraApps.dashboard(dbBody, this);
    }
    
    this.state.saveState();
  }

  initWorkspaces() {
    const currentWp = this.state.systemVars.currentWorkspace || 0;
    
    // Set active class on menu-bar workspace button
    const switcher = document.getElementById('workspace-switcher');
    if (switcher) {
      switcher.querySelectorAll('.ws-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === currentWp);
        btn.addEventListener('click', () => {
          this.switchWorkspace(idx);
        });
      });
    }

    this.updateWorkspaceWindows();
  }

  switchWorkspace(idx) {
    if (idx < 0 || idx > 2) return;
    this.state.systemVars.currentWorkspace = idx;
    this.state.saveState();

    // Exits Mission Control if active
    if (this.state.systemVars.missionControlActive) {
      this.toggleMissionControl();
    }

    // Update active class on buttons
    const switcher = document.getElementById('workspace-switcher');
    if (switcher) {
      switcher.querySelectorAll('.ws-btn').forEach((btn, bIdx) => {
        btn.classList.toggle('active', bIdx === idx);
      });
    }

    this.updateWorkspaceWindows();
    this.showToast('Workspace', `Switched to Desktop ${idx + 1}`, 'info');
  }

  updateWorkspaceWindows() {
    const currentWp = this.state.systemVars.currentWorkspace || 0;
    
    const container = document.getElementById('windows-container');
    if (container) {
      container.style.setProperty('--current-workspace', currentWp);
    }
    
    document.querySelectorAll('.window').forEach(win => {
      const appId = win.getAttribute('data-app');
      const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
      if (proc) {
        if (proc.workspace === undefined) proc.workspace = 0;
        win.style.setProperty('--window-workspace', proc.workspace);
        
        // Hide windows in other workspaces
        win.classList.toggle('hidden-workspace', proc.workspace !== currentWp);
      }
    });
  }

  toggleMissionControl() {
    const container = document.getElementById('windows-container');
    if (!container) return;

    const isActive = container.classList.toggle('mission-control-active');
    this.state.systemVars.missionControlActive = isActive;
    
    const windows = Array.from(document.querySelectorAll('.window:not(.hidden):not(.hidden-workspace)'));
    if (!isActive) {
      // Restore all windows: clear grid positions
      windows.forEach(win => {
        win.style.removeProperty('transform');
        win.classList.remove('mc-window');
        const titleEl = win.querySelector('.mc-title-label');
        if (titleEl) titleEl.remove();
      });
      return;
    }

    // Grid layout calculations for open active windows
    const count = windows.length;
    if (count === 0) return;

    const areaW = window.innerWidth;
    const areaH = window.innerHeight - 36 - 60; // Menu bar + dock area height
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    const cellW = areaW / cols;
    const cellH = areaH / rows;

    windows.forEach((win, idx) => {
      win.classList.add('mc-window');
      const r = Math.floor(idx / cols);
      const c = idx % cols;

      const appId = win.getAttribute('data-app');
      const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
      if (!proc) return;

      const winW = proc.w;
      const winH = proc.h;

      // Scale down and translate window to center of its cell
      const padding = 60;
      const scaleX = (cellW - padding) / winW;
      const scaleY = (cellH - padding) / winH;
      const scale = Math.min(0.45, scaleX, scaleY); // max scale 0.45

      const cellCenterX = c * cellW + cellW / 2;
      const cellCenterY = r * cellH + cellH / 2 + 36; // offset menu height

      const currentLeft = proc.x;
      const currentTop = proc.y;
      
      const targetX = cellCenterX - (winW * scale) / 2 - currentLeft;
      const targetY = cellCenterY - (winH * scale) / 2 - currentTop;

      win.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) scale(${scale})`;
      
      let titleLabel = win.querySelector('.mc-title-label');
      if (!titleLabel) {
        titleLabel = document.createElement('div');
        titleLabel.className = 'mc-title-label';
        titleLabel.textContent = win.querySelector('.window-title').textContent;
        win.appendChild(titleLabel);
      }
    });
  }

  restoreWorkspace() {
    let openedCount = 0;
    Object.keys(this.state.processes).forEach(appId => {
      const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
      if (proc && proc.open) {
        this.openApp(appId);
        if (proc.minimized) this.minimizeApp(appId);
        openedCount++;
      }
    });

    if (openedCount === 0) {
      this.openApp('editor');
      this.openApp('tasks');
      this.showToast('Workspace Restored', 'Opened default apps (Editor & Tasks).', 'success');
    } else {
      this.showToast('Workspace Restored', `Restored ${openedCount} applications.`, 'success');
    }
  }

  snapActiveWindow(direction) {
    const appId = this.state.activeWindow;
    if (!appId) return;
    const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
    if (!proc || !proc.open) return;
    const menuH = 36;
    const dockH = 60;
    const areaW = window.innerWidth;
    const areaH = window.innerHeight - menuH - dockH;
    if (direction === 'left') { proc.x = 0; proc.y = menuH; proc.w = areaW / 2; proc.h = areaH; }
    else if (direction === 'right') { proc.x = areaW / 2; proc.y = menuH; proc.w = areaW / 2; proc.h = areaH; }
    this.applyWindowTransform(appId);
    this.state.saveState();
  }

  // ==========================================
  // Command Palette
  // ==========================================
  toggleCommandPalette() {
    const dialog = document.getElementById('command-palette-dialog');
    if (!dialog) return;
    if (dialog.open) {
      dialog.close();
    } else {
      dialog.showModal();
      const input = dialog.querySelector('#palette-search-input');
      if (input) {
        input.value = '';
        input.focus();
        input.oninput = (e) => {
          this.renderCommandPalette(e.target.value.trim());
        };
      }
      this.renderCommandPalette('');
    }
  }

  getAllFiles(node = this.state.fs, path = '') {
    let files = [];
    if (!node) return files;
    if (node.type === 'file') {
      files.push({ path, name: path.split('/').pop() });
    } else if (node.type === 'dir' && node.children) {
      Object.keys(node.children).forEach(name => {
        const child = Reflect.get(node.children, window.sanitizeKey(name));
        files = files.concat(this.getAllFiles(child, path + '/' + name));
      });
    }
    return files;
  }

  renderCommandPalette(query) {
    const content = document.querySelector('.palette-content');
    if (!content) return;

    const commands = [
      { name: 'Open File Explorer', type: 'app', action: () => this.openApp('explorer') },
      { name: 'Open Code Editor', type: 'app', action: () => this.openApp('editor') },
      { name: 'Open Terminal', type: 'app', action: () => this.openApp('terminal') },
      { name: 'Open System Monitor', type: 'app', action: () => this.openApp('sysmonitor') },
      { name: 'Open Calculator', type: 'app', action: () => this.openApp('calculator') },
      { name: 'Open Browser', type: 'app', action: () => this.openApp('browser') },
      { name: 'Open Settings', type: 'app', action: () => this.openApp('settings') },
      { name: 'Open App Store', type: 'app', action: () => this.openApp('appstore') },
      { name: 'Open Memory Graph', type: 'app', action: () => this.openApp('memory') },
      { name: 'Open Task Board', type: 'app', action: () => this.openApp('tasks') },
      { name: 'Open AI Dashboard', type: 'app', action: () => this.openApp('dashboard') },
      { name: 'Open Device Manager', type: 'app', action: () => this.openApp('devicemgr') },
      { name: 'Open Disk Utility', type: 'app', action: () => this.openApp('diskutil') },
      { name: 'Open Daily Briefing', type: 'app', action: () => this.openApp('dailybriefing') },
      { name: 'Open Trust & Safety Dashboard', type: 'app', action: () => this.openApp('trust') },
      { name: 'Open Cognitive Timeline', type: 'app', action: () => this.openApp('timeline') },
      { name: 'Lock Screen', type: 'sys', shortcut: '⌘L', action: () => this.lockScreen() },
      { name: 'Toggle Sidebar', type: 'sys', shortcut: '⌘\\', action: () => document.getElementById('ai-sidebar')?.classList.toggle('collapsed') },
      { name: 'Toggle AFK Mode', type: 'sys', action: () => this.toggleAFK() },
      { name: 'Factory Reset', type: 'sys', action: () => { if (confirm('Factory reset Astra OS?')) { this.state.resetAllState(); location.reload(); } } }
    ];

    if (!query) {
      let listHTML = `
        <div class="palette-category">System Commands</div>
        <ul class="palette-list">
      `;
      commands.forEach((c, idx) => {
        const shortcut = c.shortcut ? `<span class="option-shortcut">${c.shortcut}</span>` : '';
        listHTML += `
          <li class="palette-option" data-type="command" data-idx="${idx}">
            <span class="option-name">⚡ ${window.escapeHTML(c.name)}</span>
            ${shortcut}
          </li>
        `;
      });
      listHTML += `
        </ul>
        <div class="palette-category">AI Orchestration Commands</div>
        <ul class="palette-list">
          <li class="palette-option" data-type="ai" data-command="ai-continue">
            <span class="option-name">🤖 Continue active project task...</span>
            <span class="option-desc">Auto-drafts, codes, and builds while tracking state</span>
          </li>
          <li class="palette-option" data-type="ai" data-command="ai-summarize">
            <span class="option-name">🤖 Summarize active workspace</span>
            <span class="option-desc">Generates workspace summary in Chat</span>
          </li>
          <li class="palette-option" data-type="ai" data-command="ai-organize">
            <span class="option-name">🤖 Organize Project Directory</span>
            <span class="option-desc">Cleans up files, links memories, and creates README</span>
          </li>
        </ul>
      `;
      window.renderSafeHTML(content, listHTML);

      content.querySelectorAll('.palette-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const type = opt.getAttribute('data-type');
          if (type === 'command') {
            const idx = parseInt(opt.getAttribute('data-idx'));
            if (commands[idx]?.action) commands[idx].action();
          } else if (type === 'ai') {
            const cmd = opt.getAttribute('data-command');
            const appInput = document.getElementById('chat-input-box');
            if (appInput) {
              if (cmd === 'ai-continue') appInput.value = 'Continue active tasks';
              else if (cmd === 'ai-summarize') appInput.value = 'Summarize active workspace';
              else if (cmd === 'ai-organize') appInput.value = 'Organize Project Directory';
              appInput.focus();
              const sendBtn = document.getElementById('send-chat-btn');
              if (sendBtn) sendBtn.click();
            }
          }
          const dialog = document.getElementById('command-palette-dialog');
          if (dialog) dialog.close();
        });
      });
      return;
    }

    let listHTML = '';

    const matchedCmds = commands.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
    if (matchedCmds.length > 0) {
      listHTML += `<div class="palette-category">Matching Commands</div><ul class="palette-list">`;
      matchedCmds.forEach(c => {
        const globalIdx = commands.indexOf(c);
        listHTML += `
          <li class="palette-option" data-type="command" data-idx="${globalIdx}">
            <span class="option-name">⚡ ${window.escapeHTML(c.name)}</span>
          </li>
        `;
      });
      listHTML += `</ul>`;
    }

    const matchedFiles = this.getAllFiles().filter(f => f.path.toLowerCase().includes(query.toLowerCase()));
    if (matchedFiles.length > 0) {
      listHTML += `<div class="palette-category">Virtual Files</div><ul class="palette-list">`;
      matchedFiles.forEach(f => {
        listHTML += `
          <li class="palette-option" data-type="file" data-path="${window.escapeHTML(f.path)}">
            <span class="option-name">📄 ${window.escapeHTML(f.name)}</span>
            <span class="option-desc">${window.escapeHTML(f.path)}</span>
          </li>
        `;
      });
      listHTML += `</ul>`;
    }

    const matchedTasks = this.state.agentTasks.filter(t => t.title.toLowerCase().includes(query.toLowerCase()) || t.desc.toLowerCase().includes(query.toLowerCase()));
    if (matchedTasks.length > 0) {
      listHTML += `<div class="palette-category">Agent Tasks</div><ul class="palette-list">`;
      matchedTasks.forEach(t => {
        listHTML += `
          <li class="palette-option" data-type="task">
            <span class="option-name">📋 ${window.escapeHTML(t.title)}</span>
            <span class="option-desc">${window.escapeHTML(t.desc)} [${window.escapeHTML(t.assigned)}]</span>
          </li>
        `;
      });
      listHTML += `</ul>`;
    }

    const matchedMemories = this.state.memoryGraph.nodes.filter(n => n.label.toLowerCase().includes(query.toLowerCase()) || n.type.toLowerCase().includes(query.toLowerCase()));
    if (matchedMemories.length > 0) {
      listHTML += `<div class="palette-category">Semantic Memories</div><ul class="palette-list">`;
      matchedMemories.forEach(n => {
        listHTML += `
          <li class="palette-option" data-type="memory">
            <span class="option-name">🧠 ${window.escapeHTML(n.label)}</span>
            <span class="option-desc">Type: ${window.escapeHTML(n.type)}</span>
          </li>
        `;
      });
      listHTML += `</ul>`;
    }

    if (listHTML === '') {
      listHTML = `<div class="palette-no-results">No matches found for "${window.escapeHTML(query)}". Press Enter to query Astra.</div>`;
    }

    window.renderSafeHTML(content, listHTML);

    content.querySelectorAll('.palette-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const type = opt.getAttribute('data-type');
        if (type === 'command') {
          const idx = parseInt(opt.getAttribute('data-idx'));
          if (commands[idx]?.action) commands[idx].action();
        } else if (type === 'file') {
          const path = opt.getAttribute('data-path');
          this.openApp('editor');
          setTimeout(() => {
            if (window.editorOpenFile) window.editorOpenFile(path);
          }, 250);
        } else if (type === 'task') {
          this.openApp('tasks');
        } else if (type === 'memory') {
          this.openApp('memory');
        }
        const dialog = document.getElementById('command-palette-dialog');
        if (dialog) dialog.close();
      });
    });
  }

  // ==========================================
  // AFK Mode
  // ==========================================
  toggleAFK() {
    // Delegate to the agent orchestrator if available
    if (window.AstraAgents && window.AstraAgents.toggleAFK) {
      window.AstraAgents.toggleAFK();
    }
  }

  // ==========================================
  // Toast Notifications
  // ==========================================
  showToast(title, message, type = 'info') {
    if (this.state.registry.system?.notificationsSilenced && type !== 'warning' && type !== 'error') {
      return;
    }
    const portal = document.getElementById('toast-portal');
    if (!portal) return;
    const iconMap = { info: '💠', success: '✅', error: '❌', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = 'toast';
    const resolvedIcon = Object.prototype.hasOwnProperty.call(iconMap, type) ? Reflect.get(iconMap, type) : '💠';
    window.renderSafeHTML(toast, `
      <div class="toast-icon">${resolvedIcon}</div>
      <div class="toast-content"><div class="toast-title">${escapeHTML(title)}</div><div class="toast-msg">${escapeHTML(message)}</div></div>
    `);
    portal.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(120%)'; setTimeout(() => toast.remove(), 400); }, 3500);
  }

  // ==========================================
  // Window Control Buttons Wiring
  // ==========================================
  wireWindowControls() {
    document.querySelectorAll('.window').forEach(win => {
      const appId = win.getAttribute('data-app');
      win.querySelector('.dot-close')?.addEventListener('click', () => this.closeApp(appId));
      win.querySelector('.dot-min')?.addEventListener('click', () => this.minimizeApp(appId));
      win.querySelector('.dot-max')?.addEventListener('click', () => this.maximizeApp(appId));
      win.addEventListener('mousedown', () => this.focusWindow(appId));
    });
  }
}
