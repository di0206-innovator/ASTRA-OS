// ==========================================
// Astra OS Security Utilities
// ==========================================

/**
 * Escapes potentially dangerous characters in a string to prevent XSS.
 * @param {string} str - The string to escape.
 * @returns {string} - The escaped string.
 */
window.escapeHTML = function(str) {
  if (str === null || str === undefined) return '';
  if (typeof str !== 'string') str = String(str);
  return str.replace(/[&<>'"]/g, function(tag) {
    const charsToReplace = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    };
    return Reflect.get(charsToReplace, tag) || tag;
  });
};

/**
 * Sanitizes an object key to prevent Prototype Pollution.
 * Returns null if the key targets a dangerous prototype property.
 * @param {string} key - The object key to sanitize.
 * @returns {string|null} - The safe key, or null if dangerous.
 */
window.sanitizeKey = function(key) {
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    console.warn('[Security] Blocked prototype pollution attempt for key:', key);
    return null;
  }
  return key;
};

/**
 * Safely renders HTML into an element by parsing it, stripping scripts/events, 
 * and using replaceChildren() instead of innerHTML.
 * @param {HTMLElement} element - The target DOM element
 * @param {string} htmlString - The raw HTML string to render
 */
window.renderSafeHTML = function(element, htmlString) {
  if (!element) return;
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  
  // Basic Sanitization
  const nodes = doc.body.querySelectorAll('*');
  for (const node of nodes) {
    if (node.tagName === 'SCRIPT') {
      node.remove();
      continue;
    }
    // Remove inline event handlers (e.g. onclick, onerror)
    for (const attr of Array.from(node.attributes)) {
      if (attr.name.toLowerCase().startsWith('on')) {
        node.removeAttribute(attr.name);
      }
    }
  }
  
  // Append safely
  element.replaceChildren(...doc.body.childNodes);
};

/**
 * Tagged template literal function for HTML strings.
 * Automatically escapes any interpolated variables to prevent XSS.
 * This also acts as a secure sink marker for static analyzers.
 * @param {string[]} strings 
 * @param  {...any} values 
 * @returns {string} safely encoded HTML string
 */
window.html = function(strings, ...values) {
  return strings.reduce((acc, str, i) => {
    const val = Reflect.get(values, i);
    const encoded = (val !== undefined && val !== null) ? window.escapeHTML(String(val)) : '';
    return acc + str + encoded;
  }, '');
};

/**
 * PolicyEngine evaluates permission validation requests centrally.
 */
window.PolicyEngine = class PolicyEngine {
  constructor(state) {
    this.state = state;
  }

  /**
   * Validates if a caller is authorized to perform a syscall.
   * @param {string} callerId - The identifier of the calling app/process/agent.
   * @param {string} callName - The syscall identifier (e.g. 'fs:read', 'proc:spawn').
   * @param {any[]} args - The arguments passed to the syscall.
   * @returns {boolean} - True if allowed, false otherwise.
   */
  checkPermission(callerId, callName, args) {
    // If permissions are globally disabled in the registry, bypass check
    if (this.state.registry?.security?.enforcePermissions === false) return true;

    // Standard application and agent manifests
    const manifests = this.state.registry?.appManifests || {
      'explorer': ['fs:read', 'fs:write'],
      'editor': ['fs:read', 'fs:write'],
      'terminal': ['fs:read', 'fs:write', 'proc:spawn', 'proc:kill'],
      'settings': ['settings:read', 'settings:write', 'fs:read', 'fs:write'],
      'dashboard': ['fs:read'],
      'workflow': ['fs:read'],
      'memory': ['fs:read'],
      'sysmonitor': ['proc:spawn', 'proc:kill'],
      'AstraAgent': ['fs:read', 'fs:write', 'proc:spawn', 'proc:kill'],
      'ExecutorAgent': ['fs:read', 'fs:write'],
      'WatcherAgent': ['fs:read', 'proc:spawn'],
      'PlannerAgent': ['fs:read'],
      'MemoryAgent': ['fs:read', 'fs:write']
    };

    let baseCaller = callerId;
    if (typeof callerId === 'string' && callerId.startsWith('node:')) {
      baseCaller = 'terminal';
    }

    const allowed = manifests[baseCaller] || [];

    let requiredPermission = '';
    if (callName.startsWith('fs:')) {
      if (callName === 'fs:read' || callName === 'fs:lock' || callName === 'fs:unlock') {
        requiredPermission = 'fs:read';
      } else {
        requiredPermission = 'fs:write';
      }
    } else if (callName.startsWith('proc:')) {
      requiredPermission = callName;
    }

    if (!requiredPermission) return true;

    const hasPerm = allowed.includes(requiredPermission);
    if (!hasPerm) {
      console.warn(`[PolicyEngine] Access Denied: Caller "${callerId}" lacks "${requiredPermission}" permission for syscall "${callName}".`);
      return false;
    }

    // Directory Write Scope Verification
    if (callName.startsWith('fs:') && requiredPermission === 'fs:write' && args && args[0]) {
      const targetPath = args[0];
      
      // Restrict modifying sensitive system folders unless admin or privileged settings/terminal
      const isSystemPath = targetPath.startsWith('/bin') || targetPath.startsWith('/sbin') || targetPath.startsWith('/etc') || targetPath.startsWith('/var');
      if (isSystemPath) {
        const isAdmin = this.state.currentSession?.role === 'admin';
        if (baseCaller !== 'settings' && baseCaller !== 'terminal' && !isAdmin) {
          console.warn(`[PolicyEngine] Access Denied: Caller "${callerId}" cannot write to system path "${targetPath}".`);
          return false;
        }
      }
    }

    // Evaluate Autonomy Safety Policies for autonomous agents
    const isAgent = typeof callerId === 'string' && (callerId.toLowerCase().includes('agent') || callerId === 'AstraAgent');
    if (isAgent) {
      const safety = this.state.registry.safety || {
        writePolicy: 'ask',
        commandPolicy: 'ask',
        networkPolicy: 'approve',
        settingsPolicy: 'ask',
        confidenceThreshold: 85
      };

      let policy = 'ask';
      if (callName.startsWith('fs:')) {
        policy = safety.writePolicy;
      } else if (callName.startsWith('proc:')) {
        policy = safety.commandPolicy;
      }

      if (policy === 'deny') {
        console.warn(`[PolicyEngine] Access Denied: Caller "${callerId}" action "${callName}" blocked by policy (DENY).`);
        return false;
      }

      if (policy === 'ask') {
        return 'ask';
      }

      if (policy === 'approve') {
        // Evaluate simulated confidence score based on target path safety
        let confidence = 90;
        const targetPath = (args && args[0]) || '';
        if (targetPath.includes('control.js') || targetPath.includes('index.js')) {
          confidence = 88;
        } else if (targetPath.includes('README.md') || targetPath.includes('notes.txt') || targetPath.includes('daily_briefings.md')) {
          confidence = 96;
        } else if (targetPath.includes('/etc/') || targetPath.includes('/var/log/')) {
          confidence = 65;
        }

        if (confidence < safety.confidenceThreshold) {
          console.log(`[PolicyEngine] Confidence (${confidence}%) below threshold (${safety.confidenceThreshold}%). Escalating to ask approval.`);
          return 'ask';
        }
      }
    }

    return true;
  }
};

