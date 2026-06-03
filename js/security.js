// ==========================================
// Astra OS Security Utilities & Policy Engine
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
 * Wrapper class representing HTML content that is already safe and should not be escaped.
 */
window.SafeHTML = class SafeHTML {
  constructor(value) {
    this.value = String(value);
  }
  toString() {
    return this.value;
  }
};

/**
 * Creates a SafeHTML instance.
 * @param {string} value
 * @returns {SafeHTML}
 */
window.safeHTML = function(value) {
  return new window.SafeHTML(value);
};

/**
 * Tagged template literal function for HTML strings.
 * Automatically escapes any interpolated variables to prevent XSS, unless they are SafeHTML.
 * This also acts as a secure sink marker for static analyzers.
 * @param {string[]} strings 
 * @param  {...any} values 
 * @returns {string} safely encoded HTML string
 */
window.html = function(strings, ...values) {
  return strings.reduce((acc, str, i) => {
    const val = Reflect.get(values, i);
    let encoded = '';
    if (val !== undefined && val !== null) {
      if (val instanceof window.SafeHTML) {
        encoded = val.toString();
      } else {
        encoded = window.escapeHTML(String(val));
      }
    }
    return acc + str + encoded;
  }, '');
};


// ==========================================
// Central Policy Engine Split Concerns
// ==========================================

class PermissionPolicy {
  constructor(state) {
    this.state = state;
  }

  evaluate(callerInfo, callName) {
    if (this.state.registry?.security?.enforcePermissions === false) return true;
    if (callerInfo.role === 'admin' || callerInfo.user === 'root') return true;

    let requiredPermission = '';
    if (callName.startsWith('fs:')) {
      if (callName === 'fs:read' || callName === 'fs:lock' || callName === 'fs:unlock' || callName === 'fs:list' || callName === 'fs:exists' || callName === 'fs:metadata') {
        requiredPermission = 'fs:read';
      } else {
        requiredPermission = 'fs:write';
      }
    } else if (callName.startsWith('proc:')) {
      requiredPermission = callName;
    } else if (callName.startsWith('settings:')) {
      requiredPermission = callName;
    } else if (callName.startsWith('task:')) {
      requiredPermission = 'fs:write';
    }

    if (!requiredPermission) return true;
    const allowed = callerInfo.permissions || [];
    return allowed.includes(requiredPermission);
  }
}

class SandboxPolicy {
  constructor(state) {
    this.state = state;
  }

  isPathInSandbox(targetPath, sandboxPaths) {
    if (!sandboxPaths) return false;
    if (sandboxPaths.includes('/')) return true;
    
    // Resolve path to make sure it contains no relative segments (prevent directory traversal)
    const rawParts = targetPath.split('/').filter(Boolean);
    const stack = [];
    for (const part of rawParts) {
      if (part === '.') continue;
      if (part === '..') {
        stack.pop();
      } else {
        stack.push(part);
      }
    }
    const cleanPath = '/' + stack.join('/');
    
    return sandboxPaths.some(sb => {
      const cleanSb = sb.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      if (cleanSb === '/') return true;
      if (cleanPath === cleanSb) return true;
      return cleanPath.startsWith(cleanSb + '/');
    });
  }

  evaluate(callerInfo, callName, args) {
    if (callerInfo.role === 'admin' || callerInfo.user === 'root') return true;

    // Sandbox check on filesystem target
    if (callName.startsWith('fs:') && args && args[0]) {
      const targetPath = args[0];
      const sandboxDirs = callerInfo.sandbox || ['/'];
      if (!this.isPathInSandbox(targetPath, sandboxDirs)) {
        return false;
      }
    }
    return true;
  }
}

class SafeModePolicy {
  constructor(state) {
    this.state = state;
  }

  evaluate(callerInfo, callName) {
    const isSafeMode = this.state.registry?.security?.safeMode === true;
    if (!isSafeMode) return true;

    // Safe mode overrides: blocks writes, settings modifications, and process spawns for non-admin/non-root processes
    const isWriteOrSpawn = callName.startsWith('fs:write') || 
                           callName.startsWith('fs:delete') || 
                           callName.startsWith('fs:mkdir') || 
                           callName.startsWith('fs:rename') || 
                           callName.startsWith('fs:copy') || 
                           callName.startsWith('fs:move') || 
                           callName.startsWith('proc:spawn') || 
                           callName.startsWith('settings:write');
                           
    if (isWriteOrSpawn && callerInfo.role !== 'admin' && callerInfo.user !== 'root') {
      return false;
    }
    return true;
  }
}

class ApprovalPolicy {
  constructor(state) {
    this.state = state;
    this.TIMEOUT_MS = 30000; // 30s timeout for approvals
  }

  registerApproval(token, actionKey, correlationId = null) {
    const key = correlationId && correlationId.startsWith('wf-') ? correlationId : token;
    const safeKey = window.sanitizeKey(key);
    if (!safeKey) return;
    if (!this.state.approvedActions) {
      this.state.approvedActions = {};
    }
    let list = Reflect.get(this.state.approvedActions, safeKey);
    if (!list) {
      list = [];
      Reflect.set(this.state.approvedActions, safeKey, list);
    }
    if (!list.includes(actionKey)) {
      list.push(actionKey);
      this.state.saveState();
    }
  }

  hasPriorApproval(token, actionKey, correlationId = null) {
    const key = correlationId && correlationId.startsWith('wf-') ? correlationId : token;
    const safeKey = window.sanitizeKey(key);
    if (!safeKey) return false;
    const list = this.state.approvedActions && Reflect.get(this.state.approvedActions, safeKey);
    return !!(list && list.includes(actionKey));
  }

  revokeApproval(token, actionKey, correlationId = null) {
    const key = correlationId && correlationId.startsWith('wf-') ? correlationId : token;
    const safeKey = window.sanitizeKey(key);
    if (!safeKey) return false;
    const list = this.state.approvedActions && Reflect.get(this.state.approvedActions, safeKey);
    if (list) {
      const idx = list.indexOf(actionKey);
      if (idx !== -1) {
        list.splice(idx, 1);
        this.state.saveState();
        return true;
      }
    }
    return false;
  }

  cleanupStaleApprovals() {
    const now = Date.now();
    const beforeCount = this.state.approvalsQueue.length;
    this.state.approvalsQueue = this.state.approvalsQueue.filter(req => {
      const isStale = (now - req.timestamp) > this.TIMEOUT_MS;
      if (isStale) {
        this.state.logEvent('security.approval_timeout', req.callerId, { id: req.id, callName: req.callName }, 'WARN');
        window.AstraBus?.emit('approvals.changed', { action: 'resolved', id: req.id, status: 'timed_out', request: req });
      }
      return !isStale;
    });
    if (this.state.approvalsQueue.length !== beforeCount) {
      this.state.saveState();
    }
  }
}

class AgentAutonomyPolicy {
  constructor(state) {
    this.state = state;
  }

  evaluate(callerInfo, callName, args) {
    const isAgent = callerInfo.appId === 'AstraAgent' || 
                    callerInfo.appId === 'ExecutorAgent' || 
                    callerInfo.appId === 'PlannerAgent' || 
                    callerInfo.appId === 'MemoryAgent';
    if (!isAgent) return 'allow';

    // Check if there is an active, user-approved workflow
    const activeWorkflow = this.state.workflows && this.state.workflows.find(w => 
      w.status === 'approved' || w.status === 'progress' || w.status === 'running'
    );
    if (activeWorkflow) {
      // Find a matching task in the approved plan (agentTasks)
      const matchTask = this.state.agentTasks && this.state.agentTasks.find(t => {
        // Must be assigned to this agent
        if (t.assigned !== callerInfo.appId) return false;
        // Must match operation and target path
        if (callName === 'fs:write' && t.action === 'fs:write' && args[0] === t.path) return true;
        if (callName === 'fs:read' && t.action === 'fs:read' && args[0] === t.path) return true;
        if (callName === 'proc:spawn' && t.action === 'run_command' && args[0] === t.path) return true;
        return false;
      });
      if (matchTask) {
        // Automatically allow tasks already reviewed and approved in the plan
        return 'allow';
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
    if (callName.startsWith('state:') || callName.startsWith('task:')) {
      policy = 'allow';
    } else if (callName.startsWith('fs:')) {
      if (callName === 'fs:read' || callName === 'fs:list' || callName === 'fs:exists') {
        policy = 'allow'; // Reads are generally allowed
      } else {
        policy = safety.writePolicy;
      }
    } else if (callName.startsWith('proc:')) {
      policy = safety.commandPolicy;
    } else if (callName.startsWith('settings:')) {
      policy = safety.settingsPolicy;
    }

    if (policy === 'deny') return 'deny';
    if (policy === 'allow') return 'allow';

    if (policy === 'approve') {
      // Evaluate confidence
      let confidence = 90;
      const targetPath = (args && args[0]) || '';
      if (targetPath.includes('control.js') || targetPath.includes('index.js')) {
        confidence = 88;
      } else if (targetPath.includes('README.md') || targetPath.includes('notes.txt')) {
        confidence = 96;
      } else if (targetPath.includes('/etc/') || targetPath.includes('/bin/')) {
        confidence = 60;
      }

      if (confidence >= safety.confidenceThreshold) {
        return 'allow';
      }
    }

    return 'ask';
  }
}

window.PolicyEngine = class PolicyEngine {
  constructor(state) {
    this.state = state;
    this.permissionPolicy = new PermissionPolicy(state);
    this.sandboxPolicy = new SandboxPolicy(state);
    this.safeModePolicy = new SafeModePolicy(state);
    this.approvalPolicy = new ApprovalPolicy(state);
    this.autonomyPolicy = new AgentAutonomyPolicy(state);
    
    // Periodically sweep stale pending approvals
    setInterval(() => this.state.withKernelWrite(() => this.approvalPolicy.cleanupStaleApprovals()), 5000);
  }

  checkPermission(callerInfo, callName, args) {
    const logDecision = (allowed, reason) => {
      if (!this.state.policyHistory) this.state.policyHistory = [];
      this.state.policyHistory.push({
        timestamp: Date.now(),
        caller: callerInfo.appId,
        user: callerInfo.user,
        role: callerInfo.role,
        callName,
        args,
        allowed,
        reason
      });
      if (this.state.policyHistory.length > 500) this.state.policyHistory.shift();
      this.state.saveState();
    };

    // 1. Verify basic permissions
    if (!this.permissionPolicy.evaluate(callerInfo, callName)) {
      console.warn(`[PolicyEngine] Access Denied: Caller "${callerInfo.appId}" lacks privilege for syscall "${callName}".`);
      logDecision(false, `Lacks permission: ${callName}`);
      return false;
    }

    // 2. Verify sandbox constraints
    if (!this.sandboxPolicy.evaluate(callerInfo, callName, args)) {
      console.warn(`[PolicyEngine] Access Denied: Path access outside sandbox for "${callerInfo.appId}". Target: "${args && args[0]}".`);
      logDecision(false, `Outside sandbox: ${args && args[0]}`);
      return false;
    }

    // 3. Verify Safe Mode blocks
    if (!this.safeModePolicy.evaluate(callerInfo, callName)) {
      console.warn(`[PolicyEngine] Access Denied: Call "${callName}" blocked by active Safe Mode for "${callerInfo.appId}".`);
      logDecision(false, `Blocked by Safe Mode`);
      return false;
    }

    // 4. Verify system file modification policies (Elevated privileges requirement)
    if (callName.startsWith('fs:') && !callName.startsWith('fs:read')) {
      const targetPath = args && args[0];
      if (targetPath) {
        const rawParts = targetPath.split('/').filter(Boolean);
        const stack = [];
        for (const part of rawParts) {
          if (part === '.') continue;
          if (part === '..') {
            stack.pop();
          } else {
            stack.push(part);
          }
        }
        const normTarget = '/' + stack.join('/');
        const isSystemPath = normTarget === '/' || 
                             normTarget === '/bin' || normTarget.startsWith('/bin/') ||
                             normTarget === '/etc' || normTarget.startsWith('/etc/') ||
                             normTarget === '/usr' || normTarget.startsWith('/usr/') ||
                             normTarget === '/var' || normTarget.startsWith('/var/') ||
                             normTarget === '/boot' || normTarget.startsWith('/boot/') ||
                             normTarget === '/sbin' || normTarget.startsWith('/sbin/');
        
        if (isSystemPath && callerInfo.user !== 'root' && callerInfo.role !== 'admin') {
          console.warn(`[PolicyEngine] Access Denied: Writing to system path "${targetPath}" requires elevated privileges.`);
          logDecision(false, `Destructive system path write: ${targetPath}`);
          return false;
        }
      }
    }

    // 5. Evaluate Autonomy clearances for agent processes
    const autonomyDecision = this.autonomyPolicy.evaluate(callerInfo, callName, args);
    if (autonomyDecision === 'deny') {
      console.warn(`[PolicyEngine] Access Denied: Autonomous agent blocked by safety policy.`);
      logDecision(false, `Agent blocked by safety policy`);
      return false;
    }
    if (autonomyDecision === 'ask') {
      const actionKey = `${callName}:${JSON.stringify(args)}`;
       if (this.approvalPolicy.hasPriorApproval(callerInfo.token, actionKey, callerInfo.correlationId)) {
        logDecision(true, `Allowed via prior approval cache`);
        return true;
      }
      logDecision('ask', `Requires user approval`);
      return 'ask';
    }

    logDecision(true, `Allowed by policy engine`);
    return true;
  }
};
