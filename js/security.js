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

window.PolicyEngine = class PolicyEngine {
  constructor(state) {
    this.state = state;
  }

  isPathInSandbox(targetPath, sandboxPaths) {
    if (!sandboxPaths) return false;
    if (sandboxPaths.includes('/')) return true;
    
    // Normalize path by removing duplicate slashes and trailing slashes
    const cleanPath = targetPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    
    return sandboxPaths.some(sb => {
      const cleanSb = sb.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      if (cleanSb === '/') return true;
      if (cleanPath === cleanSb) return true;
      return cleanPath.startsWith(cleanSb + '/');
    });
  }

  checkPermission(callerId, callName, args) {
    // If permissions are globally disabled in the registry, bypass check
    if (this.state.registry?.security?.enforcePermissions === false) return true;

    // Standard application and agent manifests
    const manifests = this.state.registry?.appManifests || {
      'explorer': { permissions: ['fs:read', 'fs:write'], sandbox: ['/home/divyanshu', '/tmp', '/Project_Astra', '/Satellite_Defense'] },
      'editor': { permissions: ['fs:read', 'fs:write'], sandbox: ['/home/divyanshu', '/tmp', '/Project_Astra', '/Satellite_Defense'] },
      'terminal': { permissions: ['fs:read', 'fs:write', 'proc:spawn', 'proc:kill'], sandbox: ['/'] },
      'settings': { permissions: ['settings:read', 'settings:write', 'fs:read', 'fs:write'], sandbox: ['/'] },
      'dashboard': { permissions: ['fs:read'], sandbox: ['/'] },
      'workflow': { permissions: ['fs:read'], sandbox: ['/'] },
      'memory': { permissions: ['fs:read'], sandbox: ['/'] },
      'sysmonitor': { permissions: ['proc:spawn', 'proc:kill'], sandbox: ['/'] },
      'AstraAgent': { permissions: ['fs:read', 'fs:write', 'proc:spawn', 'proc:kill'], sandbox: ['/home/divyanshu', '/tmp', '/Project_Astra', '/Satellite_Defense'] },
      'ExecutorAgent': { permissions: ['fs:read', 'fs:write'], sandbox: ['/Project_Astra', '/Satellite_Defense', '/tmp'] },
      'WatcherAgent': { permissions: ['fs:read', 'proc:spawn'], sandbox: ['/Project_Astra', '/Satellite_Defense', '/tmp'] },
      'PlannerAgent': { permissions: ['fs:read'], sandbox: ['/Project_Astra', '/Satellite_Defense', '/tmp'] },
      'MemoryAgent': { permissions: ['fs:read', 'fs:write'], sandbox: ['/Project_Astra', '/Satellite_Defense', '/tmp'] }
    };

    let baseCaller = callerId;
    if (typeof callerId === 'string' && callerId.startsWith('node:')) {
      baseCaller = 'terminal';
    }

    const manifest = manifests[baseCaller] || { permissions: [], sandbox: ['/'] };
    const allowed = manifest.permissions || [];
    const sandboxDirs = manifest.sandbox || ['/'];

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

    // Enforce VFS Sandbox Storage Scopes
    if (callName.startsWith('fs:') && args && args[0]) {
      const targetPath = args[0];
      if (!this.isPathInSandbox(targetPath, sandboxDirs)) {
        console.warn(`[PolicyEngine] Access Denied: Caller "${callerId}" attempted to access path "${targetPath}" which is outside its sandbox scope: [${sandboxDirs.join(', ')}]`);
        return false;
      }
    }

    // Directory Write Scope Verification (Sensitive system folders)
    if (callName.startsWith('fs:') && requiredPermission === 'fs:write' && args && args[0]) {
      const targetPath = args[0];
      
      const isSystemPath = targetPath.startsWith('/bin') || targetPath.startsWith('/sbin') || targetPath.startsWith('/etc') || targetPath.startsWith('/var');
      if (isSystemPath) {
        const isAdmin = this.state.currentSession?.role === 'admin';
        if (baseCaller !== 'settings' && baseCaller !== 'terminal' && !isAdmin) {
          console.warn(`[PolicyEngine] Access Denied: Caller "${callerId}" cannot write to system path "${targetPath}".`);
          return false;
        }
      }
    }

    // Evaluate Autonomy Safety Policies & Safe Mode for autonomous agents
    const isAgent = typeof callerId === 'string' && (callerId.toLowerCase().includes('agent') || callerId === 'AstraAgent');
    if (isAgent) {
      // Safe Mode Block
      if (this.state.registry?.security?.safeMode === true) {
        if (requiredPermission === 'fs:write' || callName.startsWith('proc:')) {
          console.warn(`[PolicyEngine] Access Denied: Caller "${callerId}" write/spawn blocked by active Safe Mode.`);
          return false;
        }
      }

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

