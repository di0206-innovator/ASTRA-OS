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

  getActiveCallerId() {
    // Identify the active caller based on the focused UI window
    if (this.ui && this.ui.state && this.ui.state.activeWindow) {
      return this.ui.state.activeWindow;
    }
    // If the agent orchestrator is executing an active workflow, attribute to it
    if (window.AstraAgentOrchestrator && window.AstraAgentOrchestrator.activeWorkflow) {
      return window.AstraAgentOrchestrator.currentAgentId || 'AstraAgent';
    }
    return 'user';
  }

  getContext(appId) {
    return {
      appId,
      fs: {
        read: (path) => this.kernel.syscall(appId, 'fs:read', [path]),
        write: (path, content, append = false) => this.kernel.syscall(appId, 'fs:write', [path, content, append]),
        lock: (path, type = 'shared') => this.kernel.syscall(appId, 'fs:lock', [path, type]),
        unlock: (path) => this.kernel.syscall(appId, 'fs:unlock', [path])
      },
      process: {
        spawn: (name, parentPid) => this.kernel.syscall(appId, 'proc:spawn', [name, parentPid]),
        kill: (pid) => this.kernel.syscall(appId, 'proc:kill', [pid])
      },
      emit: (eventName, payload) => this.bus.emit(eventName, { appId, ...payload }),
      
      // Lifecycle hook registration bindings
      onSuspend: (cb) => this.ui.registerLifecycleHook(appId, 'suspend', cb),
      onResume: (cb) => this.ui.registerLifecycleHook(appId, 'resume', cb),
      onDestroy: (cb) => this.ui.registerLifecycleHook(appId, 'destroy', cb)
    };
  }
}
