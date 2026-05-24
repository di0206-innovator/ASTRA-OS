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
  }

  init() {
    this.setupMenuClock();
    this.setupWindowDragging();
    this.setupDesktopIcons();
    this.setupDock();
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
      calculator: '🧮 Calculator'
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
    const proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
    if (!proc) return;
    let win = document.querySelector(`.window[data-app="${window.escapeHTML(appId)}"]`);
    if (!win) {
      win = this.createWindowDOM(appId);
    }

    if (proc.open && !proc.minimized) {
      this.focusWindow(appId);
      return;
    }

    proc.open = true;
    proc.minimized = false;
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
    if (win) win.classList.add('hidden');
    proc.open = false;
    proc.minimized = false;

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
      const isMeta = e.metaKey || e.ctrlKey;

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
    });
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
    const palette = document.getElementById('command-palette');
    if (!palette) return;
    palette.classList.toggle('hidden');
    if (!palette.classList.contains('hidden')) {
      const input = palette.querySelector('#palette-search');
      if (input) { input.value = ''; input.focus(); }
      this.renderCommandPalette('');
    }
  }

  renderCommandPalette(query) {
    const content = document.getElementById('palette-content');
    if (!content) return;
    const commands = [
      { name: 'Open File Explorer', shortcut: '', action: () => this.openApp('explorer') },
      { name: 'Open Code Editor', shortcut: '', action: () => this.openApp('editor') },
      { name: 'Open Terminal', shortcut: '', action: () => this.openApp('terminal') },
      { name: 'Open System Monitor', shortcut: '', action: () => this.openApp('sysmonitor') },
      { name: 'Open Calculator', shortcut: '', action: () => this.openApp('calculator') },
      { name: 'Open Browser', shortcut: '', action: () => this.openApp('browser') },
      { name: 'Open Settings', shortcut: '', action: () => this.openApp('settings') },
      { name: 'Open App Store', shortcut: '', action: () => this.openApp('appstore') },
      { name: 'Open Memory Graph', shortcut: '', action: () => this.openApp('memory') },
      { name: 'Open Task Board', shortcut: '', action: () => this.openApp('tasks') },
      { name: 'Open AI Dashboard', shortcut: '', action: () => this.openApp('dashboard') },
      { name: 'Open Device Manager', shortcut: '', action: () => this.openApp('devicemgr') },
      { name: 'Open Disk Utility', shortcut: '', action: () => this.openApp('diskutil') },
      { divider: true, name: 'System' },
      { name: 'Lock Screen', shortcut: '⌘L', action: () => this.lockScreen() },
      { name: 'Toggle Sidebar', shortcut: '⌘\\', action: () => document.getElementById('ai-sidebar')?.classList.toggle('collapsed') },
      { name: 'Toggle AFK Mode', shortcut: '', action: () => this.toggleAFK() },
      { name: 'Factory Reset', shortcut: '', action: () => { this.state.resetAllState(); location.reload(); } },
    ];

    const filtered = query ? commands.filter(c => !c.divider && c.name.toLowerCase().includes(query.toLowerCase())) : commands;

    let listHTML = '';
    filtered.forEach((c, i) => {
      if (c.divider) {
        listHTML += `<div class="palette-category">${escapeHTML(c.name)}</div>`;
      } else {
        const shortcutHTML = c.shortcut ? `<span class="option-shortcut">${escapeHTML(c.shortcut)}</span>` : '';
        listHTML += `<li class="palette-option" data-idx="${i}"><span class="option-name">${escapeHTML(c.name)}</span>${shortcutHTML}</li>`;
      }
    });

    window.renderSafeHTML(content, `
      <ul class="palette-list">
        ${listHTML}
      </ul>
    `);

    content.querySelectorAll('.palette-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const idx = parseInt(opt.getAttribute('data-idx'));
        if (filtered[idx]?.action) filtered[idx].action();
        this.toggleCommandPalette();
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
