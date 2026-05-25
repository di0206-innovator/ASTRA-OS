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
    
    const allowed = manifests[appId] || [];
    return allowed.includes(permission);
  }

  getContext(appId) {
    const enforce = (perm, cb) => {
      if (!this.checkPermission(appId, perm)) {
        throw new Error(`Permission Denied: App "${appId}" does not have "${perm}" permission.`);
      }
      return cb();
    };

    return {
      appId,
      state: this.state,
      kernel: this.kernel,
      ui: this.ui,
      bus: this.bus,
      fs: {
        read: (path) => enforce('fs:read', () => this.kernel.syscall('fs:read', path)),
        write: (path, content, append = false) => enforce('fs:write', () => this.kernel.syscall('fs:write', path, content, append)),
        lock: (path, type = 'shared') => enforce('fs:read', () => this.kernel.syscall('fs:lock', path, type)),
        unlock: (path) => enforce('fs:read', () => this.kernel.syscall('fs:unlock', path))
      },
      process: {
        spawn: (name, parentPid) => enforce('proc:spawn', () => this.kernel.syscall('proc:spawn', name, parentPid)),
        kill: (pid) => enforce('proc:kill', () => this.kernel.syscall('proc:kill', pid))
      },
      emit: (eventName, payload) => this.bus.emit(eventName, { appId, ...payload }),
      
      // Lifecycle hook registration bindings
      onSuspend: (cb) => this.ui.registerLifecycleHook(appId, 'suspend', cb),
      onResume: (cb) => this.ui.registerLifecycleHook(appId, 'resume', cb),
      onDestroy: (cb) => this.ui.registerLifecycleHook(appId, 'destroy', cb)
    };
  }
}
