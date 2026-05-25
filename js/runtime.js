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

  getContext(appId) {
    return {
      appId,
      state: this.state,
      kernel: this.kernel,
      ui: this.ui,
      bus: this.bus,
      fs: {
        read: (path) => this.kernel.syscall('fs:read', path),
        write: (path, content, append = false) => this.kernel.syscall('fs:write', path, content, append),
        lock: (path, type = 'shared') => this.kernel.syscall('fs:lock', path, type),
        unlock: (path) => this.kernel.syscall('fs:unlock', path)
      },
      process: {
        spawn: (name, parentPid) => this.kernel.syscall('proc:spawn', name, parentPid),
        kill: (pid) => this.kernel.syscall('proc:kill', pid)
      },
      emit: (eventName, payload) => this.bus.emit(eventName, { appId, ...payload })
    };
  }
}
