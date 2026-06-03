// ==========================================
// Astra OS Runtime Primitives
// ==========================================

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, handler) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(handler);
    return () => this.off(eventName, handler);
  }

  once(eventName, handler) {
    const off = this.on(eventName, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(eventName, handler) {
    const set = this.listeners.get(eventName);
    if (set) set.delete(handler);
  }

  emit(eventName, payload = {}) {
    const set = this.listeners.get(eventName);
    if (!set || set.size === 0) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[AstraBus] Listener error for ${eventName}:`, err);
      }
    }
  }
}

export class AppRuntime {
  constructor({ state, kernel, ui, bus }) {
    this.state = state;
    this.kernel = kernel;
    this.ui = ui;
    this.bus = bus;
  }

  checkPermission(appId, permission) {
    if (this.state.registry?.security?.enforcePermissions === false) return true;
    
    // Default manifest permissions per application
    const manifests = this.state.registry?.appManifests || {
      'explorer': ['fs:read', 'fs:write'],
      'editor': ['fs:read', 'fs:write'],
      'terminal': ['fs:read', 'fs:write', 'proc:spawn', 'proc:kill'],
      'settings': ['settings:read', 'settings:write', 'fs:read', 'fs:write'],
      'dashboard': ['fs:read'],
      'workflow': ['fs:read'],
      'memory': ['fs:read'],
      'sysmonitor': ['proc:spawn', 'proc:kill']
    };
    
    const safeAppId = window.sanitizeKey(appId);
    const allowed = (safeAppId ? Reflect.get(manifests, safeAppId) : null) || [];
    return allowed.includes(permission);
  }

  getActiveCallerId() {
    let appName = 'user';
    if (this.ui && this.ui.state && this.ui.state.activeWindow) {
      appName = this.ui.state.activeWindow;
    } else if (window.AstraAgentOrchestrator && window.AstraAgentOrchestrator.activeWorkflow) {
      appName = window.AstraAgentOrchestrator.currentAgentId || 'AstraAgent';
    }
    
    const proc = this.state.processTable.find(p => p.name === appName && p.state === 'RUNNING');
    if (proc && proc.token) {
      return proc.token;
    }
    return 'sys_session';
  }

  getContext(appId, token = null) {
    if (!token) {
      const proc = this.state.processTable.find(p => p.name === appId && p.state === 'RUNNING');
      token = proc ? proc.token : null;
      if (!token) {
        const newProc = this.kernel.spawnProcess(appId, 5);
        token = newProc.token;
      }
    }

    const stateProxy = new Proxy(this.state, {
      get: (target, prop) => {
        const val = Reflect.get(target, prop);
        if (typeof val === 'function') {
          return val.bind(target);
        }
        if (typeof val === 'object' && val !== null) {
          return new Proxy(val, {
            set: () => {
              console.error(`[Security] Blocked direct mutation on state.${String(prop)}.`);
              throw new Error("Direct state mutations are blocked. Use system calls.");
            }
          });
        }
        return val;
      },
      set: () => {
        console.error("[Security] Blocked direct mutation on state.");
        throw new Error("Direct state mutations are blocked. Use system calls.");
      }
    });

    return {
      appId,
      token,
      state: stateProxy,
      
      fs: {
        read: (path) => this.kernel.syscall(token, 'fs:read', [path]),
        write: (path, content, append = false) => this.kernel.syscall(token, 'fs:write', [path, content, append]),
        lock: (path, type = 'shared') => this.kernel.syscall(token, 'fs:lock', [path, type]),
        unlock: (path) => this.kernel.syscall(token, 'fs:unlock', [path]),
        delete: (path) => this.kernel.syscall(token, 'fs:delete', [path]),
        mkdir: (path, createParents = false) => this.kernel.syscall(token, 'fs:mkdir', [path, createParents]),
        rename: (path, newName) => this.kernel.syscall(token, 'fs:rename', [path, newName]),
        copy: (path, dstPath) => this.kernel.syscall(token, 'fs:copy', [path, dstPath]),
        move: (path, dstPath) => this.kernel.syscall(token, 'fs:move', [path, dstPath])
      },
      process: {
        spawn: (name, parentPid) => this.kernel.syscall(token, 'proc:spawn', [name, parentPid]),
        kill: (pid) => this.kernel.syscall(token, 'proc:kill', [pid])
      },
      settings: {
        read: () => this.kernel.syscall(token, 'settings:read', []),
        write: (settings) => this.kernel.syscall(token, 'settings:write', [settings])
      },
      tasks: {
        add: (title, desc, status, assigned) => this.kernel.syscall(token, 'task:add', [title, desc, status, assigned]),
        updateStatus: (id, status) => this.kernel.syscall(token, 'task:updateStatus', [id, status])
      },
      
      showToast: (title, message, type) => this.ui.showToast(title, message, type),
      openApp: (id) => this.ui.openApp(id),
      closeApp: (id) => this.ui.closeApp(id),
      
      emit: (eventName, payload) => this.bus.emit(eventName, { appId, token, ...payload }),
      
      onSuspend: (cb) => this.ui.registerLifecycleHook(appId, 'suspend', cb),
      onResume: (cb) => this.ui.registerLifecycleHook(appId, 'resume', cb),
      onDestroy: (cb) => this.ui.registerLifecycleHook(appId, 'destroy', cb)
    };
  }
}
