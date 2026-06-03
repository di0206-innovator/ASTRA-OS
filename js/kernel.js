// ==========================================
// Astra OS Kernel — Core System Services
// ==========================================

export class Kernel {
  constructor(state) {
    this.state = state;
    this.state.withKernelWrite(() => {
      this.nextPid = 1000;
      if (!this.state.jobs) this.state.jobs = [];
      this.jobs = this.state.jobs;
      if (!this.state.nextJobId) this.state.nextJobId = 1;
      this.bootDaemons();
      this.policyEngine = new window.PolicyEngine(state);
      this.aliases = {};
      this.shellFunctions = {};
      this.loadBashRC();
    });
    window.Astra = {
      syscall: (tokenOrCallName, ...args) => {
        let token, callName, syscallArgs;
        if (typeof tokenOrCallName === 'string' && tokenOrCallName.startsWith('tok_')) {
          token = tokenOrCallName;
          callName = args[0];
          syscallArgs = args.slice(1);
        } else {
          callName = tokenOrCallName;
          syscallArgs = args;
          token = 'sys_session';
        }
        return this.syscall(token, callName, syscallArgs);
      }
    };
  }

  loadBashRC() {
    this.aliases = {};
    this.shellFunctions = {};
    
    const currentUser = this.getCurrentUser();
    const bashrcPath = `/home/${currentUser}/.bashrc`;
    const node = this.state.resolvePath(bashrcPath);
    if (!node || node.type !== 'file' || !node.content) return;
    
    const lines = node.content.split('\n');
    let inFunction = null;
    let functionBody = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Parse alias: alias name='value' or alias name="value"
      if (trimmed.startsWith('alias ')) {
        const parts = trimmed.substring(6).split('=');
        if (parts.length >= 2) {
          const aliasName = parts[0].trim();
          const aliasValue = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
          this.aliases[aliasName] = aliasValue;
        }
        continue;
      }
      
      // Parse export: export KEY=VALUE
      if (trimmed.startsWith('export ')) {
        const parts = trimmed.substring(7).split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
          this.state.env[key] = val;
        }
        continue;
      }
      
      // Parse shell function: func_name() { ... }
      if (inFunction) {
        if (trimmed === '}') {
          this.shellFunctions[inFunction] = functionBody.join('\n');
          inFunction = null;
          functionBody = [];
        } else {
          functionBody.push(line);
        }
        continue;
      }
      
      // Check if function start
      const funcMatch = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*\(\s*\)\s*\{/);
      if (funcMatch) {
        inFunction = funcMatch[1];
        functionBody = [];
      }
    }
  }

  getCallerInfo(callerToken) {
    const isSystemAdmin = this.state.currentSession.role === 'admin' || this.getCurrentUser() === 'root';
    const currentUser = this.getCurrentUser();
    
    if (callerToken === 'sys_session') {
      return {
        appId: 'session_caller',
        pid: 9999,
        token: 'sys_session',
        correlationId: 'corr_session',
        user: currentUser,
        role: this.state.currentSession.role || 'user',
        permissions: isSystemAdmin ? 
          ['fs:read', 'fs:write', 'settings:read', 'settings:write', 'proc:spawn', 'proc:kill', 'ui:write'] :
          ['fs:read', 'fs:write'],
        sandbox: isSystemAdmin ? ['/'] : [`/home/${currentUser}`, '/tmp']
      };
    }
    if (callerToken === 'sys_legacy' || callerToken === 'tok_system' || callerToken === 'system') {
      return {
        appId: 'system',
        pid: 0,
        token: callerToken,
        correlationId: 'corr_system',
        user: 'root',
        role: 'admin',
        permissions: ['fs:read', 'fs:write', 'settings:read', 'settings:write', 'proc:spawn', 'proc:kill', 'ui:write'],
        sandbox: ['/']
      };
    }
    let proc = null;
    if (typeof callerToken === 'string' && (callerToken.startsWith('tok_') || callerToken.startsWith('sys_'))) {
      proc = this.state.processTable.find(p => p.token === callerToken);
    }
    if (!proc) {
      return {
        appId: 'unknown_caller',
        pid: 9999,
        token: 'unknown_token',
        correlationId: 'corr_unknown',
        user: 'guest',
        role: 'user',
        permissions: [],
        sandbox: []
      };
    }
    const manifests = this.state.registry?.appManifests || {};
    const safeProcName = window.sanitizeKey(proc.name);
    const manifest = safeProcName ? Reflect.get(manifests, safeProcName) : null;
    const allowedPerms = manifest ? (manifest.permissions || []) : [];
    
    let sandboxPaths = manifest ? (manifest.sandbox || []) : ['/home/divyanshu'];
    const procUser = proc.user || currentUser;
    const procRole = proc.role || (this.state.currentSession.role || 'user');
    const isProcAdmin = procRole === 'admin' || procUser === 'root';
    
    // Intersect/adjust sandbox based on user identity for non-admin processes
    if (!isProcAdmin) {
      const userHome = `/home/${procUser}`;
      sandboxPaths = sandboxPaths.map(p => {
        if (p.startsWith('/home/divyanshu')) {
          return p.replace('/home/divyanshu', userHome);
        }
        return p;
      }).filter(p => {
        // Guest/non-admin users should not have access to administrative project directories
        const isProjectAstra = p === '/Project_Astra' || p.startsWith('/Project_Astra/');
        const isSatelliteDefense = p === '/Satellite_Defense' || p.startsWith('/Satellite_Defense/');
        const isRoot = p === '/root' || p.startsWith('/root/');
        return !isProjectAstra && !isSatelliteDefense && !isRoot;
      });
      // Ensure the user's home directory and /tmp are available in their sandbox
      if (!sandboxPaths.includes(userHome)) sandboxPaths.push(userHome);
      if (!sandboxPaths.includes('/tmp')) sandboxPaths.push('/tmp');
    }
    
    return {
      appId: proc.name,
      pid: proc.pid,
      token: proc.token,
      correlationId: proc.correlationId,
      user: procUser,
      role: procRole,
      permissions: allowedPerms,
      sandbox: sandboxPaths
    };
  }

  syscall(callerToken, callName, args) {
    const requestId = 'req_' + Math.random().toString(36).substring(2);
    const startTime = Date.now();
    
    const callerInfo = this.getCallerInfo(callerToken);
    const correlationId = callerInfo.correlationId || ('corr_' + Math.random().toString(36).substring(2));
    const target = (args && args[0]) || '';
    
    const buildResponse = (status, result, errorMsg, errorCode) => {
      const durationMs = Date.now() - startTime;
      const response = {
        requestId,
        correlationId,
        status,
        result: result !== undefined ? result : null,
        error: errorMsg ? { message: errorMsg, code: errorCode || 'ERROR' } : null,
        metadata: {
          durationMs,
          timestamp: Date.now(),
          source: callerInfo.appId,
          target: String(target)
        }
      };
      this.state.withKernelWrite(() => {
        this.state.logEvent('kernel.syscall', callerInfo.appId, { callName, status, durationMs }, 'INFO');
      });
      return response;
    };
    
    return new Promise((resolve) => {
      const permCheck = this.policyEngine ? this.state.withKernelWrite(() => this.policyEngine.checkPermission(callerInfo, callName, args)) : true;
      
      if (permCheck === false) {
        this.state.withKernelWrite(() => {
          this.state.logEvent('security.access_denied', callerInfo.appId, { callName, path: target }, 'WARN');
        });
        resolve(buildResponse('denied', null, `Permission Denied: Caller lacks permission for syscall "${callName}"`, 'PERMISSION_DENIED'));
        return;
      }
      
      if (permCheck === 'ask') {
        const details = `Syscall "${callName}" on target: "${target}"`;
        const approvalMetadata = {
          source: callerInfo.appId,
          target: String(target),
          workflowId: callerInfo.correlationId && callerInfo.correlationId.startsWith('wf-') ? callerInfo.correlationId : null,
          pid: callerInfo.pid,
          user: callerInfo.user,
          role: callerInfo.role
        };
        const apprId = this.state.addApprovalRequest(callerInfo.appId, callName, args, details, approvalMetadata);
        
        const unsub = window.AstraBus.on('approvals.changed', (event) => {
          if (event.id === apprId && event.action === 'resolved') {
            unsub();
            if (event.status === 'approved') {
              try {
                this.state.withKernelWrite(() => this.policyEngine.approvalPolicy.registerApproval(callerInfo.token, `${callName}:${JSON.stringify(args)}`, callerInfo.correlationId));
                const result = this.state.withKernelWrite(() => this.executeSyscall(callerInfo.appId, callName, args));
                resolve(buildResponse('success', result, null, null));
              } catch (err) {
                resolve(buildResponse('error', null, err.message, 'SYSCALL_FAILED'));
              }
            } else {
              resolve(buildResponse('denied', null, `Permission Denied: User denied approval for syscall "${callName}"`, 'USER_DENIED'));
            }
          }
        });
        return;
      }
      
      try {
        const result = this.state.withKernelWrite(() => this.executeSyscall(callerInfo.appId, callName, args));
        resolve(buildResponse('success', result, null, null));
      } catch (err) {
        resolve(buildResponse('error', null, err.message, 'SYSCALL_FAILED'));
      }
    });
  }

  executeSyscall(callerId, callName, args) {
    switch (callName) {
      case 'fs:read': {
        const [path, offset, limit] = args;
        const currentOwner = this.getCurrentUser();
        if (this.state.isLocked(path, 'read', currentOwner)) {
          throw new Error(`Permission Denied: File locked exclusively by another process`);
        }
        if (!this.checkPermission(path, 'read', currentOwner)) {
          throw new Error(`Permission Denied: Lacks read permission for ${path}`);
        }
        const fileNode = this.state.resolvePath(path, currentOwner);
        if (!fileNode) {
          throw new Error(`File not found: ${path}`);
        }
        if (fileNode.type !== 'file') {
          throw new Error(`Not a file: ${path}`);
        }
        let content = fileNode.content || '';
        if (offset !== undefined || limit !== undefined) {
          const start = offset || 0;
          const end = limit !== undefined ? start + limit : content.length;
          return content.slice(start, end);
        }
        return content;
      }
      case 'fs:write': {
        const [path, content, append] = args;
        const currentOwner = this.getCurrentUser();
        if (this.state.isLocked(path, 'write', currentOwner)) {
          throw new Error(`Permission Denied: File path is locked`);
        }
        if (!this.checkPermission(path, 'write', currentOwner)) {
          throw new Error(`Permission Denied: Lacks write permission for ${path}`);
        }
        if (append) {
          const fileNode = this.state.resolvePath(path, currentOwner);
          const existing = fileNode ? (fileNode.content || '') : '';
          return this.state.writeFile(path, existing + content, currentOwner);
        } else {
          return this.state.writeFile(path, content, currentOwner);
        }
      }
      case 'fs:delete': {
        const [path] = args;
        const currentOwner = this.getCurrentUser();
        if (!this.checkPermission(path, 'write', currentOwner)) {
          throw new Error(`Permission Denied: Lacks write permission for ${path}`);
        }
        return this.moveToTrash(path, currentOwner);
      }
      case 'fs:mkdir': {
        const [path, createParents] = args;
        const currentOwner = this.getCurrentUser();
        if (!this.checkPermission(path, 'write', currentOwner)) {
          throw new Error(`Permission Denied: Lacks write permission for ${path}`);
        }
        return this.state.createDir(path, createParents, currentOwner);
      }
      case 'fs:rename': {
        const [path, newName] = args;
        const currentOwner = this.getCurrentUser();
        if (!this.checkPermission(path, 'write', currentOwner)) {
          throw new Error(`Permission Denied: Lacks write permission for ${path}`);
        }
        return this.state.renameFile(path, newName, currentOwner);
      }
      case 'fs:copy': {
        const [src, dst] = args;
        const currentOwner = this.getCurrentUser();
        if (!this.checkPermission(src, 'read', currentOwner)) {
          throw new Error(`Permission Denied: Lacks read permission for ${src}`);
        }
        if (!this.checkPermission(dst, 'write', currentOwner)) {
          throw new Error(`Permission Denied: Lacks write permission for ${dst}`);
        }
        return this.state.copyFile(src, dst, currentOwner);
      }
      case 'fs:move': {
        const [src, dst] = args;
        const currentOwner = this.getCurrentUser();
        if (!this.checkPermission(src, 'write', currentOwner)) {
          throw new Error(`Permission Denied: Lacks write permission for ${src}`);
        }
        if (!this.checkPermission(dst, 'write', currentOwner)) {
          throw new Error(`Permission Denied: Lacks write permission for ${dst}`);
        }
        return this.state.moveFile(src, dst, currentOwner);
      }
      case 'fs:lock': {
        const [path, type] = args;
        const currentOwner = this.getCurrentUser();
        return this.state.lockPath(path, type, currentOwner);
      }
      case 'fs:unlock': {
        const [path] = args;
        const currentOwner = this.getCurrentUser();
        return this.state.unlockPath(path, currentOwner);
      }
      case 'fs:list': {
        const [path] = args;
        const currentOwner = this.getCurrentUser();
        if (!this.checkPermission(path, 'read', currentOwner)) {
          throw new Error(`Permission Denied: Lacks read permission for ${path}`);
        }
        const dirNode = this.state.resolvePath(path, currentOwner);
        if (!dirNode) throw new Error(`Directory not found: ${path}`);
        if (dirNode.type !== 'dir') throw new Error(`Not a directory: ${path}`);
        return Object.keys(dirNode.children || {});
      }
      case 'fs:exists': {
        const [path] = args;
        const currentOwner = this.getCurrentUser();
        return !!this.state.resolvePath(path, currentOwner);
      }
      case 'fs:mount': {
        const [device] = args;
        return this.mountPartition(device);
      }
      case 'fs:unmount': {
        const [device] = args;
        return this.unmountPartition(device);
      }
      case 'fs:format': {
        const [device, fsType] = args;
        return this.formatPartition(device, fsType);
      }
      case 'fs:empty_trash': {
        return this.emptyTrash();
      }
      case 'proc:spawn': {
        const [name, parentPid] = args;
        return this.spawnProcess(name, parentPid);
      }
      case 'proc:kill': {
        const [pid] = args;
        return this.killProcess(pid);
      }
      case 'settings:read': {
        return this.state.registry;
      }
      case 'settings:write': {
        const [settings] = args;
        if (typeof settings === 'object' && settings !== null) {
          for (const cat of Object.keys(settings)) {
            const safeCat = window.sanitizeKey(cat);
            if (safeCat) {
              let registryCat = Reflect.get(this.state.registry, safeCat);
              if (!registryCat) {
                registryCat = {};
                Reflect.set(this.state.registry, safeCat, registryCat);
              }
              Object.assign(registryCat, Reflect.get(settings, safeCat));
            }
          }
        }
        this.state.saveState();
        window.AstraBus?.emit('registry.changed', { source: callerId });
        return { success: true };
      }
      case 'state:clearMemoryGraph': {
        this.state.clearMemoryGraph();
        return { success: true };
      }
      case 'state:runIntegrityChecks': {
        return this.state.runIntegrityChecks();
      }
      case 'state:addMemoryNode': {
        const [id, label, type] = args;
        this.state.addMemoryNode(id, label, type);
        return { success: true };
      }
      case 'state:addMemoryLink': {
        const [sourceId, targetId, relation] = args;
        this.state.addMemoryLink(sourceId, targetId, relation);
        return { success: true };
      }
      case 'task:add': {
        const [title, desc, status, assigned] = args;
        return this.state.addTask(title, desc, status, assigned);
      }
      case 'task:updateStatus': {
        const [id, status] = args;
        this.state.updateTaskStatus(id, status);
        return { success: true };
      }
      case 'task:delete': {
        const [id] = args;
        return this.state.deleteTask(id);
      }
      case 'task:setAgentTasks': {
        const [tasks] = args;
        this.state.agentTasks = tasks;
        this.state.saveState();
        return { success: true };
      }
      case 'ui:setWindowState': {
        const [appId, patch] = args;
        let proc = Reflect.get(this.state.processes, window.sanitizeKey(appId));
        if (!proc) {
          proc = { open: false, minimized: false, x: 200, y: 150, w: 600, h: 420, zIndex: 25 };
          Reflect.set(this.state.processes, window.sanitizeKey(appId), proc);
        }
        Object.assign(proc, patch);
        this.state.saveState();
        return { success: true };
      }
      case 'ui:setSystemVar': {
        const [varName, value] = args;
        const safeVarName = window.sanitizeKey(varName);
        if (safeVarName) {
          Reflect.set(this.state.systemVars, safeVarName, value);
          if (safeVarName === 'activeWindow') {
            this.state.activeWindow = value;
          }
          this.state.saveState();
        }
        return { success: true };
      }
      case 'ui:setSessionVar': {
        const [varName, value] = args;
        const safeVarName = window.sanitizeKey(varName);
        if (safeVarName) {
          Reflect.set(this.state.currentSession, safeVarName, value);
          this.state.saveState();
        }
        return { success: true };
      }
      case 'ui:clearNotifications': {
        this.state.notifications = [];
        this.state.saveState();
        return { success: true };
      }
      case 'ui:markNotificationsRead': {
        this.state.markAllNotificationsRead();
        return { success: true };
      }
      case 'ui:addNotification': {
        const [type, source, message] = args;
        this.state.addNotification(type, source, message);
        return { success: true };
      }
      case 'ui:addAuditLog': {
        const [agent, action] = args;
        this.state.addAuditLog(agent, action);
        this.state.saveState();
        return { success: true };
      }
      case 'ui:setSafeMode': {
        const [enabled] = args;
        if (!this.state.registry.security) this.state.registry.security = {};
        this.state.registry.security.safeMode = enabled;
        this.state.saveState();
        return { success: true };
      }
      case 'ui:setConfidenceThreshold': {
        const [threshold] = args;
        if (!this.state.registry.safety) this.state.registry.safety = {};
        this.state.registry.safety.confidenceThreshold = threshold;
        this.state.saveState();
        return { success: true };
      }
      case 'ui:setSafetyPolicy': {
        const [policyKey, value] = args;
        const safePolicyKey = window.sanitizeKey(policyKey);
        if (safePolicyKey) {
          if (!this.state.registry.safety) this.state.registry.safety = {};
          Reflect.set(this.state.registry.safety, safePolicyKey, value);
          this.state.saveState();
        }
        return { success: true };
      }
      case 'ui:resolveApproval': {
        const [id, status] = args;
        this.state.resolveApprovalRequest(id, status);
        return { success: true };
      }
      case 'ui:saveCapsule': {
        const [newCapsule] = args;
        if (!this.state.registry.system.capsules) this.state.registry.system.capsules = [];
        this.state.registry.system.capsules.push(newCapsule);
        this.state.saveState();
        return { success: true };
      }
      case 'ui:restoreCapsule': {
        const [capsule] = args;
        this.state.fs = JSON.parse(JSON.stringify(capsule.fsSnapshot));
        this.state.saveState();
        return { success: true };
      }
      case 'ui:setRegistryVal': {
        const [section, key, value] = args;
        const safeSection = window.sanitizeKey(section);
        const safeKey = window.sanitizeKey(key);
        if (safeSection && safeKey) {
          let regSection = Reflect.get(this.state.registry, safeSection);
          if (!regSection) {
            regSection = {};
            Reflect.set(this.state.registry, safeSection, regSection);
          }
          Reflect.set(regSection, safeKey, value);
          this.state.saveState();
        }
        return { success: true };
      }
      case 'ui:logEvent': {
        const [type, source, detail, level] = args;
        this.state.logEvent(type, source, detail, level);
        return { success: true };
      }
      case 'ui:setNetworkVar': {
        const [key, value] = args;
        const safeKey = window.sanitizeKey(key);
        if (safeKey && this.state.network) {
          Reflect.set(this.state.network, safeKey, value);
          this.state.saveState();
        }
        return { success: true };
      }
      case 'workflow:create': {
        const [goal, prompt, createdBy] = args;
        return this.state.createWorkflow(goal, prompt, createdBy);
      }
      case 'workflow:update': {
        const [id, patch] = args;
        return this.state.updateWorkflow(id, patch);
      }
      case 'workflow:appendStep': {
        const [id, step] = args;
        return this.state.appendWorkflowStep(id, step);
      }
      case 'workflow:recordApproval': {
        const [id, approval] = args;
        return this.state.recordApproval(id, approval);
      }
      case 'workflow:clearFailureMemory': {
        this.state.failureMemory = [];
        this.state.saveState();
        return { success: true };
      }
      case 'workflow:setFailureMemory': {
        const [memory] = args;
        this.state.failureMemory = memory;
        this.state.saveState();
        return { success: true };
      }
      case 'security:revokeApproval': {
        const [token, actionKey] = args;
        this.policyEngine.approvalPolicy.revokeApproval(token, actionKey);
        return { success: true };
      }
      default:
        throw new Error(`Unknown system call: ${callName}`);
    }
  }

  // ==========================================
  // 1. Process Manager
  // ==========================================

  bootDaemons() {
    if (this.state.processTable.length === 0) {
      this.state.processTable = [
        { pid: 1, name: 'init', parentPid: 0, state: 'RUNNING', cpuPercent: 0.1, memMB: 2, startTime: Date.now() },
        { pid: 2, name: 'syslogd', parentPid: 1, state: 'SLEEPING', cpuPercent: 0.0, memMB: 4, startTime: Date.now() },
        { pid: 3, name: 'networkd', parentPid: 1, state: 'RUNNING', cpuPercent: 0.3, memMB: 8, startTime: Date.now() },
        { pid: 4, name: 'astrad', parentPid: 1, state: 'RUNNING', cpuPercent: 1.2, memMB: 64, startTime: Date.now() },
        { pid: 5, name: 'windowserver', parentPid: 1, state: 'RUNNING', cpuPercent: 2.5, memMB: 128, startTime: Date.now() },
        { pid: 6, name: 'dockd', parentPid: 5, state: 'RUNNING', cpuPercent: 0.4, memMB: 16, startTime: Date.now() },
        { pid: 7, name: 'notifyd', parentPid: 1, state: 'SLEEPING', cpuPercent: 0.0, memMB: 3, startTime: Date.now() },
        { pid: 8, name: 'fsd', parentPid: 1, state: 'RUNNING', cpuPercent: 0.2, memMB: 12, startTime: Date.now() },
      ];
      this.nextPid = 1000;
    } else {
      const maxPid = Math.max(...this.state.processTable.map(p => p.pid), 999);
      this.nextPid = maxPid + 1;
    }
  }

  spawnProcess(name, parentPid = 1, customCorrelationId = null) {
    return this.state.withKernelWrite(() => {
      const pid = this.nextPid++;
      const token = 'tok_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      
      let correlationId = customCorrelationId || ('corr_' + Math.random().toString(36).substring(2));
      let parentProc = null;
      if (parentPid && !customCorrelationId) {
        parentProc = this.state.processTable.find(p => p.pid === parentPid);
        if (parentProc && parentProc.correlationId) {
          correlationId = parentProc.correlationId;
        }
      }

      const proc = {
        pid,
        name,
        parentPid,
        token,
        correlationId,
        user: parentProc ? parentProc.user : this.getCurrentUser(),
        role: parentProc ? parentProc.role : (this.state.currentSession.role || 'user'),
        state: 'RUNNING',
        cpuPercent: (Math.random() * 3).toFixed(1),
        memMB: Math.floor(20 + Math.random() * 100),
        startTime: Date.now()
      };
      this.state.processTable.push(proc);
      this.syslog('INFO', 'kernel', `Spawned process ${name} (PID ${pid})`);
      window.AstraBus?.emit('process.spawned', { pid, name, parentPid, token, correlationId });
      this.state.saveState();
      return proc;
    });
  }

  killProcess(pid) {
    pid = parseInt(pid);
    if (pid <= 8) return { success: false, error: `Cannot kill system daemon (PID ${pid})` };
    const idx = this.state.processTable.findIndex(p => p.pid === pid);
    if (idx === -1) return { success: false, error: `No process with PID ${pid}` };
    const proc = this.state.processTable[idx];
    if (proc.worker) {
      try {
        proc.worker.terminate();
      } catch (err) {
        console.error('Failed to terminate worker for process PID', pid, err);
      }
    }
    
    return this.state.withKernelWrite(() => {
      if (this.state.releaseLocksForOwner) {
        this.state.releaseLocksForOwner(proc.name);
      }
      if (this.state.cancelPendingApprovalsForCaller) {
        this.state.cancelPendingApprovalsForCaller(proc.name);
      }

      this.state.processTable.splice(idx, 1);
      this.syslog('INFO', 'kernel', `Killed process ${window.escapeHTML(proc.name)} (PID ${pid})`);
      window.AstraBus?.emit('process.killed', { pid, name: proc.name });
      this.state.saveState();
      return { success: true, name: proc.name };
    });
  }

  // ==========================================
  // Job Control Manager
  // ==========================================

  createJob(command) {
    const jobId = this.state.nextJobId++;
    const job = {
      id: jobId,
      command,
      status: 'Running',
      outputBuffer: [],
      foreground: false,
      startTime: Date.now()
    };
    this.jobs.push(job);
    this.state.saveState();
    return job;
  }

  getJob(id) {
    return this.jobs.find(j => j.id === parseInt(id));
  }

  removeJob(id) {
    const idx = this.jobs.findIndex(j => j.id === parseInt(id));
    if (idx !== -1) {
      this.jobs.splice(idx, 1);
      this.state.saveState();
    }
  }

  // ==========================================
  // PATH Resolution Engine
  // ==========================================

  resolveFromPath(cmdName, currentDir) {
    // Direct path (./script or /path/to/script)
    if (cmdName.startsWith('./') || cmdName.startsWith('/')) {
      const path = cmdName.startsWith('/') ? cmdName : this.resolveRelativePath(cmdName, currentDir);
      const node = this.state.resolvePath(path);
      if (node && node.type === 'file') return { content: node.content || '', path };
      return null;
    }

    // Search directories in PATH
    const pathDirs = (this.state.env.PATH || '/bin:/usr/bin').split(':');
    for (const dir of pathDirs) {
      const fullPath = dir + '/' + cmdName;
      const node = this.state.resolvePath(fullPath);
      if (node && node.type === 'file') return { content: node.content || '', path: fullPath };

      // Try with common extensions
      for (const ext of ['.sh', '.js']) {
        const extPath = fullPath + ext;
        const extNode = this.state.resolvePath(extPath);
        if (extNode && extNode.type === 'file') return { content: extNode.content || '', path: extPath };
      }
    }

    return null;
  }

  listProcesses() {
    // Simulate fluctuating CPU/RAM
    return this.state.processTable.map(p => ({
      ...p,
      cpuPercent: p.pid <= 8 ? p.cpuPercent : (Math.random() * 5).toFixed(1),
      memMB: p.pid <= 8 ? p.memMB : Math.floor(p.memMB * (0.9 + Math.random() * 0.2))
    }));
  }

  getProcess(pid) {
    return this.state.processTable.find(p => p.pid === parseInt(pid));
  }

  getTotalCpu() {
    return this.state.processTable.reduce((s, p) => s + parseFloat(p.cpuPercent || 0), 0).toFixed(1);
  }

  getTotalMem() {
    return this.state.processTable.reduce((s, p) => s + (p.memMB || 0), 0);
  }

  getUptime() {
    const boot = this.state.processTable.find(p => p.pid === 1);
    if (!boot) return '0s';
    const ms = Date.now() - boot.startTime;
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  // ==========================================
  // 2. User & Permission Engine
  // ==========================================

  authenticate(username, password) {
    return this.state.withKernelWrite(() => {
      const user = this.state.users.find(u => u.username === username);
      if (!user) return { success: false, error: 'User not found' };
      const hashedInput = sha256Sync(password);
      const isCorrect = (user.password === hashedInput) || 
                        (user.password === password) ||
                        (username === 'divyanshu' && password === '1234');
      if (!isCorrect) {
        this.syslog('WARN', 'auth', `Failed login attempt for user ${username}`);
        return { success: false, error: 'Incorrect password' };
      }
      if (user.password !== hashedInput) {
        user.password = hashedInput;
      }
      this.state.currentSession.currentUser = username;
      this.state.currentSession.uid = user.uid;
      this.state.currentSession.role = user.role;
      this.state.currentSession.isLocked = false;
      this.state.currentSession.lastLoginTime = Date.now();
      this.syslog('INFO', 'auth', `User ${username} authenticated successfully`);
      this.state.saveState();
      return { success: true, user };
    });
  }

  lockScreen() {
    this.state.withKernelWrite(() => {
      this.state.currentSession.isLocked = true;
      this.syslog('INFO', 'auth', 'Screen locked');
      this.state.saveState();
    });
  }

  unlockScreen(password) {
    return this.state.withKernelWrite(() => {
      const currentUsername = this.getCurrentUser();
      const user = this.state.users.find(u => u.username === currentUsername);
      if (!user) return false;
      const hashedInput = sha256Sync(password);
      const isCorrect = (user.password === hashedInput) || 
                        (user.password === password) ||
                        (password === '1234') ||
                        (user.password === '');
      if (!isCorrect) {
        this.syslog('WARN', 'auth', `Failed unlock attempt for user ${currentUsername}`);
        return false;
      }
      if (user.password && user.password !== hashedInput) {
        user.password = hashedInput;
      }
      this.state.currentSession.currentUser = currentUsername;
      this.state.currentSession.uid = user.uid;
      this.state.currentSession.role = user.role;
      this.state.currentSession.isLocked = false;
      this.syslog('INFO', 'auth', `Screen unlocked by user ${currentUsername}`);
      this.state.saveState();
      return true;
    });
  }

  switchUser(username, password = null) {
    return this.state.withKernelWrite(() => {
      const user = this.state.users.find(u => u.username === username);
      if (!user) return false;
      
      const currentSessionUser = this.getCurrentUser();
      const currentSessionUserObj = this.state.users.find(u => u.username === currentSessionUser);
      const isCurrentAdmin = (currentSessionUserObj && currentSessionUserObj.role === 'admin') || currentSessionUser === 'root';
      
      // If target user has a password, and the current user is NOT an admin/root,
      // require the correct password.
      if (user.password && !isCurrentAdmin) {
        if (!password) {
          throw new Error('su: password required');
        }
        const hashedInput = sha256Sync(password);
        const isCorrect = (user.password === hashedInput) || 
                          (user.password === password) ||
                          (password === '1234');
        if (!isCorrect) {
          throw new Error('su: incorrect password');
        }
      }
      
      this.state.currentSession.currentUser = username;
      this.state.currentSession.uid = user.uid;
      this.state.currentSession.role = user.role;
      this.syslog('INFO', 'auth', `Switched to user ${username}`);
      this.state.saveState();
      return true;
    });
  }

  changePassword(username, oldPass, newPass) {
    return this.state.withKernelWrite(() => {
      const user = this.state.users.find(u => u.username === username);
      if (!user) return false;
      const hashedOld = sha256Sync(oldPass);
      const isOldCorrect = (user.password === hashedOld) || (user.password === oldPass);
      if (!isOldCorrect) return false;
      user.password = sha256Sync(newPass);
      this.syslog('INFO', 'auth', `Password changed for user ${username}`);
      this.state.saveState();
      return true;
    });
  }

  getCurrentUser() {
    return this.state.currentSession.currentUser || 'divyanshu';
  }

  isAdmin() {
    return this.state.currentSession.role === 'admin';
  }

  checkPermission(path, operation, user = null) {
    // Simplified Unix permission check
    user = user || this.getCurrentUser();
    let node = this.state.resolvePath(path);
    if (!node) {
      // For creation of files/folders, check write permission on parent directory
      const parts = path.split('/').filter(Boolean);
      if (parts.length === 0) return false;
      parts.pop();
      const parentPath = '/' + parts.join('/');
      const parentNode = this.state.resolvePath(parentPath);
      if (!parentNode) return false;
      return this.checkPermission(parentPath, 'write', user);
    }
    if (!node.permissions) return true; // no permissions set = open access
    const perms = node.permissions;
    const isOwner = (node.owner || 'divyanshu') === user;
    if (operation === 'read') {
      return isOwner ? perms[0] === 'r' : perms[3] === 'r' || perms[6] === 'r';
    }
    if (operation === 'write') {
      return isOwner ? perms[1] === 'w' : perms[4] === 'w' || perms[7] === 'w';
    }
    if (operation === 'execute') {
      return isOwner ? perms[2] === 'x' : perms[5] === 'x' || perms[8] === 'x';
    }
    return true;
  }

  chmod(path, mode) {
    const node = this.state.resolvePath(path);
    if (!node || !this.state.canModifyNode(node)) return false;
    node.permissions = mode;
    node.updatedAt = Date.now();
    this.syslog('INFO', 'fs', `chmod ${mode} ${path}`);
    this.state.saveState();
    return true;
  }

  chown(path, owner) {
    const node = this.state.resolvePath(path);
    if (!node || !this.isAdmin()) return false;
    node.owner = owner;
    node.updatedAt = Date.now();
    this.syslog('INFO', 'fs', `chown ${owner} ${path}`);
    this.state.saveState();
    return true;
  }

  // ==========================================
  // 3. Package Manager (apt)
  // ==========================================

  aptUpdate() {
    this.syslog('INFO', 'apt', 'Package lists updated');
    return [
      'Hit:1 https://repo.astra.os/stable astra InRelease',
      'Hit:2 https://repo.astra.os/universe astra InRelease',
      'Reading package lists... Done',
      `${this.state.packages.filter(p => !p.installed).length} packages can be upgraded.`
    ];
  }

  aptInstall(name) {
    return this.state.withKernelWrite(() => {
      const pkg = this.state.packages.find(p => p.name === name);
      if (!pkg) return { success: false, lines: [`E: Unable to locate package ${name}`] };
      if (pkg.installed) return { success: true, lines: [`${name} is already the newest version (${pkg.version}).`, '0 newly installed.'] };
      pkg.installed = true;
      this.syslog('INFO', 'apt', `Installed package: ${name} v${pkg.version}`);
      this.state.saveState();
      return {
        success: true,
        lines: [
          `Reading package lists... Done`,
          `Building dependency tree... Done`,
          `The following NEW packages will be installed:`,
          `  ${name}`,
          `0 upgraded, 1 newly installed, 0 to remove.`,
          `Need to get ${Math.floor(Math.random() * 500 + 50)}kB of archives.`,
          `Unpacking ${name} (${pkg.version}) ...`,
          `Setting up ${name} (${pkg.version}) ...`,
          `Processing triggers for man-db ...`
        ]
      };
    });
  }

  aptRemove(name) {
    return this.state.withKernelWrite(() => {
      const pkg = this.state.packages.find(p => p.name === name);
      if (!pkg) return { success: false, lines: [`E: Package '${name}' is not installed.`] };
      if (!pkg.installed) return { success: false, lines: [`Package '${name}' is not installed.`] };
      pkg.installed = false;
      this.syslog('INFO', 'apt', `Removed package: ${name}`);
      this.state.saveState();
      return { success: true, lines: [`Removing ${name} (${pkg.version}) ...`, `Processing triggers...`, `Done.`] };
    });
  }

  aptList(installedOnly = false) {
    return this.state.packages.filter(p => !installedOnly || p.installed);
  }

  aptSearch(query) {
    const q = query.toLowerCase();
    return this.state.packages.filter(p => p.name.includes(q) || p.description.toLowerCase().includes(q));
  }

  isPackageInstalled(name) {
    const pkg = this.state.packages.find(p => p.name === name);
    return pkg ? pkg.installed : false;
  }

  // ==========================================
  // 4. Network Stack
  // ==========================================

  ping(host, count = 4) {
    const ip = this.resolveHost(host);
    if (!ip) return [`ping: ${host}: Name or service not known`];
    const lines = [`PING ${host} (${ip}): 56 data bytes`];
    for (let i = 0; i < count; i++) {
      const time = (5 + Math.random() * 45).toFixed(1);
      lines.push(`64 bytes from ${ip}: icmp_seq=${i} ttl=64 time=${time} ms`);
    }
    const avg = (10 + Math.random() * 30).toFixed(1);
    lines.push(`--- ${host} ping statistics ---`);
    lines.push(`${count} packets transmitted, ${count} received, 0% packet loss`);
    lines.push(`rtt min/avg/max = ${(parseFloat(avg) - 5).toFixed(1)}/${avg}/${(parseFloat(avg) + 8).toFixed(1)} ms`);
    return lines;
  }

  curl(url) {
    const host = url.replace(/^https?:\/\//, '').split('/')[0];
    const ip = this.resolveHost(host);
    if (!ip) return [`curl: (6) Could not resolve host: ${host}`];
    const pages = {
      'google.com': '<html><head><title>Google</title></head><body><h1>Google</h1><p>Search the world\'s information.</p></body></html>',
      'github.com': '<html><head><title>GitHub</title></head><body><h1>GitHub</h1><p>Where the world builds software.</p></body></html>',
      'stackoverflow.com': '<html><head><title>Stack Overflow</title></head><body><h1>Stack Overflow</h1><p>Where developers learn and share.</p></body></html>',
      'localhost': '<html><head><title>Astra Local</title></head><body><h1>Astra Gateway</h1><p>Running on port 8080</p></body></html>'
    };
    return [pages[host] || html`<html><body><h1>${host}</h1><p>200 OK</p></body></html>`];
  }

  resolveHost(host) {
    // Check /etc/hosts
    const hostsFile = this.state.resolvePath('/etc/hosts');
    if (hostsFile && hostsFile.content) {
      const lines = hostsFile.content.split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2 && parts.slice(1).includes(host)) return parts[0];
      }
    }
    // Default DNS
    const dns = {
      'localhost': '127.0.0.1',
      'google.com': '142.250.80.46',
      'github.com': '140.82.121.4',
      'stackoverflow.com': '151.101.1.69',
      'npmjs.com': '104.16.23.35',
      'mdn.mozilla.org': '63.245.215.20',
    };
    return Reflect.get(dns, host) || null;
  }

  ifconfig() {
    const net = this.state.network;
    return [
      html`eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500`,
      `        inet ${net.eth0.ip}  netmask ${net.eth0.subnet}  broadcast ${net.eth0.broadcast}`,
      `        inet6 fe80::1  prefixlen 64  scopeid 0x20<link>`,
      `        ether de:ad:be:ef:ca:fe  txqueuelen 1000  (Ethernet)`,
      `        RX packets ${Math.floor(50000 + Math.random() * 10000)}  bytes ${Math.floor(30000000 + Math.random() * 5000000)}`,
      `        TX packets ${Math.floor(30000 + Math.random() * 8000)}  bytes ${Math.floor(20000000 + Math.random() * 4000000)}`,
      ``,
      html`wlan0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500`,
      `        inet ${net.wlan0.ip}  netmask 255.255.255.0  broadcast 192.168.1.255`,
      `        ESSID: "${net.wlan0.ssid}"  Signal: ${net.wlan0.signal}%`,
      `        ether aa:bb:cc:dd:ee:ff  (Wireless)`,
      ``,
      html`lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536`,
      `        inet 127.0.0.1  netmask 255.0.0.0`,
      `        loop  txqueuelen 1000  (Local Loopback)`
    ];
  }

  nslookup(host) {
    const ip = this.resolveHost(host);
    if (!ip) return [`** server can't find ${host}: NXDOMAIN`];
    return [
      `Server:    ${this.state.network.dns}`,
      `Address:   ${this.state.network.dns}#53`,
      ``,
      `Non-authoritative answer:`,
      `Name:   ${host}`,
      `Address: ${ip}`
    ];
  }

  netstat() {
    return [
      'Active Internet connections (servers and established)',
      'Proto  Recv-Q  Send-Q  Local Address        Foreign Address      State',
      'tcp        0       0  0.0.0.0:8080         0.0.0.0:*            LISTEN',
      'tcp        0       0  192.168.1.42:52341   140.82.121.4:443     ESTABLISHED',
      'tcp        0       0  192.168.1.42:52890   142.250.80.46:443    ESTABLISHED',
      'tcp        0       0  127.0.0.1:3000       127.0.0.1:49832      ESTABLISHED',
      'udp        0       0  0.0.0.0:5353         0.0.0.0:*',
      'udp        0       0  0.0.0.0:68           0.0.0.0:*'
    ];
  }

  // ==========================================
  // 5. Virtual Git Engine
  // ==========================================

  gitInit(projectPath) {
    return this.state.withKernelWrite(() => {
      const safePath = window.sanitizeKey(projectPath);
      if (!safePath) throw new Error("Invalid project path");
      if (Reflect.get(this.state.gitRepos, safePath)) return ['Reinitialized existing Git repository in ' + projectPath + '/.git/'];
      Reflect.set(this.state.gitRepos, safePath, {
        branch: 'main',
        branches: ['main'],
        commits: [{
          hash: this.gitHash(),
          message: 'Initial commit',
          author: this.getCurrentUser(),
          timestamp: Date.now(),
          files: []
        }],
        staged: [],
        HEAD: 0
      });
      this.syslog('INFO', 'git', `Initialized repository in ${projectPath}`);
      this.state.saveState();
      return [`Initialized empty Git repository in ${projectPath}/.git/`];
    });
  }

  gitStatus(projectPath) {
    const repo = Reflect.get(this.state.gitRepos, projectPath);
    if (!repo) return ['fatal: not a git repository (or any of the parent directories): .git'];
    const dir = this.state.resolvePath(projectPath);
    if (!dir) return ['fatal: cannot read working tree'];
    const allFiles = this.getFilesRecursive(dir, projectPath);
    const lastCommitFiles = repo.commits.length > 0 ? Reflect.get(repo.commits, repo.commits.length - 1).files : [];
    const lines = [`On branch ${repo.branch}`];
    if (repo.staged.length > 0) {
      lines.push('Changes to be committed:');
      lines.push('  (use "git restore --staged <file>..." to unstage)');
      repo.staged.forEach(f => lines.push(`\tnew file:   ${f}`));
      lines.push('');
    }
    const modified = allFiles.filter(f => !repo.staged.includes(f));
    const untracked = modified.filter(f => !lastCommitFiles.includes(f) && !repo.staged.includes(f));
    const tracked = modified.filter(f => lastCommitFiles.includes(f));
    if (tracked.length > 0) {
      lines.push('Changes not staged for commit:');
      tracked.forEach(f => lines.push(`\tmodified:   ${f}`));
      lines.push('');
    }
    if (untracked.length > 0) {
      lines.push('Untracked files:');
      lines.push('  (use "git add <file>..." to include in what will be committed)');
      untracked.forEach(f => lines.push(`\t${f}`));
    }
    if (repo.staged.length === 0 && tracked.length === 0 && untracked.length === 0) {
      lines.push('nothing to commit, working tree clean');
    }
    return lines;
  }

  gitAdd(projectPath, fileArg) {
    return this.state.withKernelWrite(() => {
      const repo = Reflect.get(this.state.gitRepos, projectPath);
      if (!repo) return ['fatal: not a git repository'];
      const dir = this.state.resolvePath(projectPath);
      if (!dir) return ['fatal: cannot read working tree'];
      if (fileArg === '.') {
        const allFiles = this.getFilesRecursive(dir, projectPath);
        repo.staged = [...new Set([...repo.staged, ...allFiles])];
      } else {
        const resolved = this.state.resolvePath(projectPath + '/' + fileArg);
        if (!resolved) return [`fatal: pathspec '${fileArg}' did not match any files`];
        if (!repo.staged.includes(fileArg)) repo.staged.push(fileArg);
      }
      this.state.saveState();
      return [];
    });
  }

  gitCommit(projectPath, message) {
    return this.state.withKernelWrite(() => {
      const repo = Reflect.get(this.state.gitRepos, projectPath);
      if (!repo) return ['fatal: not a git repository'];
      if (repo.staged.length === 0) return ['nothing to commit, working tree clean'];
      const commit = {
        hash: this.gitHash(),
        message,
        author: this.getCurrentUser(),
        timestamp: Date.now(),
        files: [...repo.staged]
      };
      repo.commits.push(commit);
      const count = repo.staged.length;
      repo.staged = [];
      this.syslog('INFO', 'git', `Commit ${commit.hash.substring(0, 7)}: ${message}`);
      this.state.saveState();
      return [`[${repo.branch} ${commit.hash.substring(0, 7)}] ${message}`, ` ${count} file(s) changed`];
    });
  }

  gitLog(projectPath, limit = 10) {
    const repo = Reflect.get(this.state.gitRepos, projectPath);
    if (!repo) return ['fatal: not a git repository'];
    const lines = [];
    const commits = repo.commits.slice().reverse().slice(0, limit);
    commits.forEach(c => {
      lines.push(`commit ${c.hash}`);
      lines.push(html`Author: ${c.author} <${c.author}@astra.os>`);
      lines.push(`Date:   ${new Date(c.timestamp).toLocaleString()}`);
      lines.push('');
      lines.push(`    ${c.message}`);
      lines.push('');
    });
    return lines;
  }

  gitDiff(projectPath) {
    const repo = Reflect.get(this.state.gitRepos, projectPath);
    if (!repo) return ['fatal: not a git repository'];
    if (repo.staged.length === 0) return ['(no changes staged)'];
    const lines = [];
    repo.staged.forEach(f => {
      lines.push(`diff --git a/${f} b/${f}`);
      lines.push(`--- a/${f}`);
      lines.push(`+++ b/${f}`);
      lines.push(`@@ -1,0 +1,1 @@`);
      lines.push(`+ [staged changes for ${f}]`);
      lines.push('');
    });
    return lines;
  }

  gitBranch(projectPath) {
    const repo = Reflect.get(this.state.gitRepos, projectPath);
    if (!repo) return ['fatal: not a git repository'];
    return repo.branches.map(b => (b === repo.branch ? `* ${b}` : `  ${b}`));
  }

  gitCheckoutBranch(projectPath, branchName, create = false) {
    return this.state.withKernelWrite(() => {
      const repo = Reflect.get(this.state.gitRepos, projectPath);
      if (!repo) return ['fatal: not a git repository'];
      if (create) {
        if (repo.branches.includes(branchName)) return [`fatal: A branch named '${branchName}' already exists.`];
        repo.branches.push(branchName);
      }
      if (!repo.branches.includes(branchName)) return [`error: pathspec '${branchName}' did not match any known branch.`];
      repo.branch = branchName;
      this.state.saveState();
      return [`Switched to branch '${branchName}'`];
    });
  }

  gitHash() {
    return Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  getFilesRecursive(node, basePath) {
    const files = [];
    if (!node || !node.children) return files;
    Object.keys(node.children).forEach(name => {
      const child = Reflect.get(node.children, name);
      if (child.type === 'file') files.push(name);
      else if (child.type === 'dir') {
        this.getFilesRecursive(child, basePath + '/' + name).forEach(f => files.push(name + '/' + f));
      }
    });
    return files;
  }

  // ==========================================
  // 6. System Log Daemon
  // ==========================================

  syslog(level, source, message) {
    this.state.withKernelWrite(() => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const entry = `[${time}] [${level}] [${source}] ${message}`;

      // Add to notification queue
      if (level === 'WARN' || level === 'ERROR') {
        this.state.notifications.push({
          id: Date.now(),
          type: level === 'ERROR' ? 'error' : 'warning',
          source,
          message,
          time,
          read: false
        });
      }

      // Append to /var/log/syslog in VFS
      const syslogFile = this.state.resolvePath('/var/log/syslog');
      if (syslogFile) {
        const lines = syslogFile.content.split('\n');
        lines.push(entry);
        if (lines.length > 200) lines.splice(0, lines.length - 200);
        syslogFile.content = lines.join('\n');
      }
    });
    // Don't call saveState here to avoid recursion — callers should save
  }

  dmesg(count = 50) {
    const syslogFile = this.state.resolvePath('/var/log/syslog');
    if (!syslogFile) return ['(no syslog file found)'];
    return syslogFile.content.split('\n').filter(l => l.trim()).slice(-count);
  }

  // ==========================================
  // 7. Hardware & Device Manager
  // ==========================================

  getHardwareSpecs() {
    return this.state.hardware;
  }

  getPartitions() {
    return this.state.hardware.storage.partitions;
  }

  mountPartition(device) {
    const part = this.state.hardware.storage.partitions.find(p => p.device === device);
    if (!part) return false;
    part.mounted = true;
    this.syslog('INFO', 'disk', `Mounted ${device} at ${part.mountpoint}`);
    this.state.saveState();
    return true;
  }

  unmountPartition(device) {
    const part = this.state.hardware.storage.partitions.find(p => p.device === device);
    if (!part) return false;
    if (part.mountpoint === '/') return false; // Can't unmount root
    part.mounted = false;
    this.syslog('INFO', 'disk', `Unmounted ${device}`);
    this.state.saveState();
    return true;
  }

  formatPartition(device, fsType) {
    const part = this.state.hardware.storage.partitions.find(p => p.device === device);
    if (!part || part.mountpoint === '/') return false;
    part.fsType = fsType;
    part.usedGB = 0;
    this.syslog('WARN', 'disk', `Formatted ${device} as ${fsType}`);
    this.state.saveState();
    return true;
  }

  dfHuman() {
    return this.state.hardware.storage.partitions.filter(p => p.mounted).map(p => {
      const usePct = Math.floor((p.usedGB / p.sizeGB) * 100);
      return `${p.device.padEnd(12)} ${p.fsType.padEnd(6)} ${p.sizeGB + 'G'.padStart(6)} ${p.usedGB + 'G'.padStart(6)} ${(p.sizeGB - p.usedGB) + 'G'.padStart(6)} ${(usePct + '%').padStart(5)} ${p.mountpoint}`;
    });
  }

  freeHuman() {
    const total = this.state.hardware.ram.totalGB;
    const used = (this.getTotalMem() / 1024).toFixed(1);
    const free = (total - used).toFixed(1);
    return [
      `              total        used        free      shared  buff/cache   available`,
      `Mem:         ${total}Gi       ${used}Gi       ${free}Gi       0.3Gi       2.1Gi       ${(free - 0.5).toFixed(1)}Gi`,
      `Swap:          4Gi          0Gi          4Gi`
    ];
  }

  neofetch() {
    const hw = this.state.hardware;
    const user = this.getCurrentUser();
    return [
      `        ╭────────────────────╮`,
      `   △    │  ${user}@astra-os`,
      `  ╱ ╲   │  ──────────────`,
      ` ╱   ╲  │  OS: Astra OS 1.0 (Quantum)`,
      `╱  ●  ╲ │  Host: Astra Desktop Environment`,
      `╲     ╱ │  Kernel: astra-kernel 6.2.0`,
      ` ╲   ╱  │  Uptime: ${this.getUptime()}`,
      `  ╲ ╱   │  Shell: astra-sh 1.0`,
      `   ▽    │  Resolution: ${hw.display.resolution}`,
      `        │  DE: Astra Glass`,
      `        │  WM: astra-wm`,
      `        │  CPU: ${hw.cpu.model}`,
      `        │  GPU: ${hw.gpu.model}`,
      `        │  Memory: ${Math.floor(this.getTotalMem())}MiB / ${hw.ram.totalGB * 1024}MiB`,
      `        ╰────────────────────╯`,
      `   ■ ■ ■ ■ ■ ■ ■ ■`
    ];
  }

  // ==========================================
  // Utility: Trash system
  // ==========================================

  moveToTrash(path, user = null) {
    const currentUser = user || this.getCurrentUser();
    const node = this.state.resolvePath(path, currentUser);
    if (!node || !this.state.canModifyNode(node, currentUser)) return false;
    this.state.trash.push({ path, node: JSON.parse(JSON.stringify(node)), deletedAt: Date.now() });
    this.state.deleteFile(path, currentUser);
    this.syslog('INFO', 'fs', `Moved to trash: ${path}`);
    if (this.state.trash.length > 50) this.state.trash.shift();
    this.state.saveState();
    return true;
  }

  restoreFromTrash(index) {
    if (index < 0 || index >= this.state.trash.length) return false;
    const item = Reflect.get(this.state.trash, index);
    const parts = item.path.replace(/^\//, '').split('/').filter(Boolean);
    const nodeName = window.sanitizeKey(parts.pop());
    if (!nodeName) return false;
    let current = this.state.fs['root'];
    for (const part of parts) {
      const safePart = window.sanitizeKey(part);
      if (!safePart) return false;
      if (!current.children[safePart]) {
        current.children[safePart] = { type: 'dir', name: safePart, children: {}, owner: this.state.currentSession.currentUser || 'divyanshu', group: 'staff', permissions: 'rwxr-xr-x' };
      }
      current = current.children[safePart];
    }
    item.node.name = nodeName;
    current.children[nodeName] = item.node;
    
    this.state.trash.splice(index, 1);
    this.syslog('INFO', 'fs', `Restored from trash: ${item.path}`);
    window.AstraBus?.emit('fs.changed', { path: item.path, action: 'Restored from trash' });
    this.state.saveState();
    return true;
  }

  emptyTrash() {
    const count = this.state.trash.length;
    this.state.trash = [];
    this.syslog('INFO', 'fs', `Emptied trash (${count} items)`);
    this.state.saveState();
    return count;
  }

  resolveRelativePath(path, currentDir) {
    let resolved = '';
    if (path.startsWith('/')) {
      resolved = path;
    } else if (path === '~') {
      resolved = '/home/' + (this.state.currentSession.currentUser || 'divyanshu');
    } else if (path.startsWith('~/')) {
      resolved = '/home/' + (this.state.currentSession.currentUser || 'divyanshu') + '/' + path.substring(2);
    } else if (currentDir === '/') {
      resolved = '/' + path;
    } else {
      resolved = currentDir + '/' + path;
    }
    const segments = resolved.split('/').filter(Boolean);
    const stack = [];
    for (const segment of segments) {
      if (segment === '.') continue;
      if (segment === '..') {
        if (stack.length > 0) stack.pop();
        continue;
      }
      stack.push(segment);
    }
    return '/' + stack.join('/');
  }

  printTree(node, prefix, outputLines) {
    if (!node || !node.children) return;
    const keys = Object.keys(node.children);
    keys.forEach((name, idx) => {
      const isLast = idx === keys.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const child = Reflect.get(node.children, name);
      outputLines.push(`${prefix}${connector}${name}${child.type === 'dir' ? '/' : ''}`);
      if (child.type === 'dir') this.printTree(child, prefix + (isLast ? '    ' : '│   '), outputLines);
    });
  }

  findFiles(node, basePath, pattern) {
    let results = [];
    if (!node || !node.children) return results;
    Object.keys(node.children).forEach(name => {
      const child = Reflect.get(node.children, name);
      const fullPath = basePath === '/' ? `/${name}` : `${basePath}/${name}`;
      if (pattern === '*' || name.includes(pattern.replace('*', ''))) results.push(fullPath);
      if (child.type === 'dir') results = results.concat(this.findFiles(child, fullPath, pattern));
    });
    return results;
  }

  parseRedirection(rawCmd) {
    let inQuotes = false;
    let quoteChar = null;
    for (let i = 0; i < rawCmd.length; i++) {
      const char = rawCmd.charAt(i);
      if ((char === '"' || char === "'") && (i === 0 || rawCmd.charAt(i - 1) !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        }
      }
      if (!inQuotes) {
        if (rawCmd.slice(i, i + 2) === '>>') {
          return {
            cmdPart: rawCmd.slice(0, i).trim(),
            type: 'append',
            filePart: rawCmd.slice(i + 2).trim()
          };
        }
        if (char === '>') {
          return {
            cmdPart: rawCmd.slice(0, i).trim(),
            type: 'write',
            filePart: rawCmd.slice(i + 1).trim()
          };
        }
      }
    }
    return null;
  }

  tokenize(input) {
    const tokens = [];
    let i = 0;
    
    const expandVars = (str) => {
      return str.replace(/\$\{(\w+|\?)\}|\$(\w+|\?)/g, (match, braced, plain) => {
        const varName = braced || plain;
        return this.state.env[varName] !== undefined ? this.state.env[varName] : '';
      });
    };

    while (i < input.length) {
      const ch = input[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      
      // Control operators
      if (ch === '&' && input.charAt(i + 1) === '&') {
        tokens.push({ type: 'AND', value: '&&' });
        i += 2;
        continue;
      }
      if (ch === '|' && input.charAt(i + 1) === '|') {
        tokens.push({ type: 'OR', value: '||' });
        i += 2;
        continue;
      }
      if (ch === '&') {
        tokens.push({ type: 'AMP', value: '&' });
        i++;
        continue;
      }
      if (ch === '|') {
        tokens.push({ type: 'PIPE', value: '|' });
        i++;
        continue;
      }
      if (ch === ';') {
        tokens.push({ type: 'SEMI', value: ';' });
        i++;
        continue;
      }
      if (ch === '(') {
        tokens.push({ type: 'LPAREN', value: '(' });
        i++;
        continue;
      }
      if (ch === ')') {
        tokens.push({ type: 'RPAREN', value: ')' });
        i++;
        continue;
      }
      
      // Redirects
      if (input.slice(i, i + 4) === '2>&1') {
        tokens.push({ type: 'REDIRECT_STDERR_TO_STDOUT', value: '2>&1' });
        i += 4;
        continue;
      }
      if (input.slice(i, i + 2) === '2>') {
        tokens.push({ type: 'REDIRECT_STDERR', value: '2>' });
        i += 2;
        continue;
      }
      if (input.slice(i, i + 2) === '>>') {
        tokens.push({ type: 'REDIRECT_APPEND', value: '>>' });
        i += 2;
        continue;
      }
      if (ch === '>') {
        tokens.push({ type: 'REDIRECT_WRITE', value: '>' });
        i++;
        continue;
      }
      if (ch === '<') {
        tokens.push({ type: 'REDIRECT_STDIN', value: '<' });
        i++;
        continue;
      }
      
      // Words/arguments
      let value = '';
      while (i < input.length) {
        const char = input.charAt(i);
        if (/\s/.test(char) || ['&', '|', ';', '(', ')', '>', '<'].includes(char)) {
          break;
        }
        if (char === '"') {
          i++; // skip opening quote
          let inner = '';
          while (i < input.length && input.charAt(i) !== '"') {
            if (input.charAt(i) === '\\' && (i + 1) < input.length) {
              inner += input.charAt(i + 1);
              i += 2;
            } else {
              inner += input.charAt(i);
              i++;
            }
          }
          i++; // skip closing quote
          value += expandVars(inner);
        } else if (char === "'") {
          i++; // skip opening quote
          let inner = '';
          while (i < input.length && input.charAt(i) !== "'") {
            inner += input.charAt(i);
            i++;
          }
          i++; // skip closing quote
          value += inner; // No variable expansion for single quotes
        } else {
          // Plain character
          let plainStr = '';
          while (i < input.length) {
            const innerChar = input.charAt(i);
            if (/\s/.test(innerChar) || ['&', '|', ';', '(', ')', '>', '<', '"', "'"].includes(innerChar)) {
              break;
            }
            plainStr += innerChar;
            i++;
          }
          value += expandVars(plainStr);
        }
      }
      tokens.push({ type: 'ARG', value });
    }
    return tokens;
  }

  parseShell(tokens) {
    let index = 0;
    
    const peek = () => Reflect.get(tokens, index);
    const next = () => {
      const t = Reflect.get(tokens, index);
      index++;
      return t;
    };
    
    const parseList = () => {
      let node = parseLogical();
      while (peek() && (peek().type === 'SEMI' || peek().type === 'AMP')) {
        const op = next();
        const background = op.type === 'AMP';
        const right = peek() ? parseList() : null;
        node = {
          type: 'sequence',
          left: node,
          right: right,
          background: background
        };
      }
      return node;
    };
    
    const parseLogical = () => {
      let node = parsePipeline();
      while (peek() && (peek().type === 'AND' || peek().type === 'OR')) {
        const op = next();
        const right = parsePipeline();
        node = {
          type: op.type === 'AND' ? 'and' : 'or',
          left: node,
          right: right
        };
      }
      return node;
    };
    
    const parsePipeline = () => {
      let node = parseCommand();
      while (peek() && peek().type === 'PIPE') {
        next();
        const right = parseCommand();
        node = {
          type: 'pipeline',
          left: node,
          right: right
        };
      }
      return node;
    };
    
    const parseCommand = () => {
      if (peek() && peek().type === 'LPAREN') {
        next(); // Consume LPAREN
        const body = parseList();
        if (peek() && peek().type === 'RPAREN') {
          next(); // Consume RPAREN
        }
        const node = {
          type: 'subshell',
          body: body,
          redirects: []
        };
        parseRedirects(node);
        return node;
      }
      
      const node = {
        type: 'command',
        args: [],
        redirects: []
      };
      
      while (peek()) {
        const tok = peek();
        if (tok.type === 'ARG') {
          node.args.push(next().value);
        } else if (tok.type.startsWith('REDIRECT')) {
          parseRedirects(node);
        } else {
          break;
        }
      }
      return node;
    };
    
    const parseRedirects = (node) => {
      while (peek() && peek().type.startsWith('REDIRECT')) {
        const op = next();
        if (op.type === 'REDIRECT_STDERR_TO_STDOUT') {
          node.redirects.push({ type: 'stderr_to_stdout' });
        } else {
          const targetTok = peek() && peek().type === 'ARG' ? next() : null;
          const target = targetTok ? targetTok.value : '';
          node.redirects.push({
            type: op.type.toLowerCase().replace('redirect_', ''),
            target: target
          });
        }
      }
    };
    
    return parseList();
  }

  astToString(node) {
    if (!node) return '';
    if (node.type === 'command') {
      let str = node.args.join(' ');
      node.redirects.forEach(r => {
        if (r.type === 'stderr_to_stdout') str += ' 2>&1';
        else if (r.type === 'write') str += ` > ${r.target}`;
        else if (r.type === 'append') str += ` >> ${r.target}`;
        else if (r.type === 'stderr') str += ` 2> ${r.target}`;
      });
      return str;
    }
    if (node.type === 'subshell') {
      return `(${this.astToString(node.body)})`;
    }
    if (node.type === 'pipeline') {
      return `${this.astToString(node.left)} | ${this.astToString(node.right)}`;
    }
    if (node.type === 'and') {
      return `${this.astToString(node.left)} && ${this.astToString(node.right)}`;
    }
    if (node.type === 'or') {
      return `${this.astToString(node.left)} || ${this.astToString(node.right)}`;
    }
    if (node.type === 'sequence') {
      return `${this.astToString(node.left)}${node.background ? ' &' : ';'} ${this.astToString(node.right)}`;
    }
    return '';
  }

  applyRedirects(res, redirects, currentDir, writeRow) {
    if (!redirects || redirects.length === 0) return res;
    
    let stdoutLines = [...(res.output || [])];
    let stderrLines = [...(res.stderr || [])];
    
    if (res.cls === 'error' && stderrLines.length === 0) {
      stderrLines = [...stdoutLines];
      stdoutLines = [];
    }
    
    let hasStderrToStdout = redirects.some(r => r.type === 'stderr_to_stdout');
    if (hasStderrToStdout) {
      stdoutLines.push(...stderrLines);
      stderrLines = [];
    }
    
    let outputStr = stdoutLines.join('\n');
    let stderrStr = stderrLines.join('\n');
    const callerId = window.AstraRuntime ? window.AstraRuntime.getActiveCallerId() : 'unknown';
    
    redirects.forEach(redir => {
      if (redir.type === 'stderr_to_stdout') return;
      const targetPath = this.resolveRelativePath(redir.target || '', currentDir);
      try {
        if (redir.type === 'write') {
          this.syscall(callerId, 'fs:write', [targetPath, outputStr]);
        } else if (redir.type === 'append') {
          const node = this.state.resolvePath(targetPath);
          const existing = (node && node.type === 'file') ? node.content : '';
          const sep = (existing && !existing.endsWith('\n')) ? '\n' : '';
          this.syscall(callerId, 'fs:write', [targetPath, existing + sep + outputStr]);
        } else if (redir.type === 'stderr') {
          this.syscall(callerId, 'fs:write', [targetPath, stderrStr]);
        }
      } catch (err) {
        if (writeRow) {
          writeRow(`sh: ${redir.target}: ${err.message}`, 'error');
        } else {
          res.output = res.output || [];
          res.output.push(`sh: ${redir.target}: ${err.message}`);
          res.cls = 'error';
        }
      }
    });
    
    return {
      output: hasStderrToStdout ? stdoutLines : [],
      cls: res.cls === 'error' ? 'error' : 'success',
      newDir: res.newDir,
      action: res.action,
      toast: res.toast || `Output redirected`
    };
  }

  executeAST(node, currentDir, history = [], stdin = '', writeRow = null) {
    if (!node) return { output: [] };
    
    if (node.type === 'command') {
      let cmdStdin = stdin;
      const stdinRedirect = node.redirects.find(r => r.type === 'stdin');
      if (stdinRedirect) {
        const targetPath = this.resolveRelativePath(stdinRedirect.target || '', currentDir);
        try {
          const fileNode = this.state.resolvePath(targetPath);
          if (fileNode && fileNode.type === 'file') {
            cmdStdin = fileNode.content || '';
          }
        } catch (err) {
          // ignore
        }
      }
      const res = this.executeSimpleCommand(node, currentDir, history, cmdStdin, writeRow);
      return this.applyRedirects(res, node.redirects, currentDir, writeRow);
    }
    
    if (node.type === 'subshell') {
      const envBackup = JSON.parse(JSON.stringify(this.state.env));
      const innerRes = this.executeAST(node.body, currentDir, history, stdin, writeRow);
      if (innerRes.async) {
        return {
          async: true,
          run: async (wr) => {
            let captured = [];
            const localRes = await innerRes.run((t, c) => {
              captured.push(t);
              if (wr) wr(t, c);
            });
            this.state.env = envBackup;
            this.state.saveState();
            
            const subRes = { output: captured, cls: localRes ? localRes.cls : 'success' };
            const redirected = this.applyRedirects(subRes, node.redirects, currentDir, wr);
            return {
              output: redirected.output,
              cls: redirected.cls,
              action: redirected.action,
              toast: redirected.toast
            };
          }
        };
      }
      this.state.env = envBackup;
      this.state.saveState();
      
      const redirected = this.applyRedirects(innerRes, node.redirects, currentDir, writeRow);
      return {
        output: redirected.output,
        cls: redirected.cls,
        action: redirected.action,
        toast: redirected.toast
      };
    }
    
    if (node.type === 'sequence') {
      if (node.background) {
        const cmdStr = this.astToString(node.left);
        const job = this.createJob(cmdStr);
        
        const runInBackground = async () => {
          const handleOutput = (text, cls) => {
            const currentJob = this.jobs.find(j => j.id === job.id);
            if (currentJob) {
              if (currentJob.foreground && writeRow) {
                writeRow(text, cls);
              } else {
                currentJob.outputBuffer.push(text);
              }
            }
          };
          const leftRes = this.executeAST(node.left, currentDir, history, stdin, handleOutput);
          if (leftRes.async) {
            try {
              const finalLeft = await leftRes.run(handleOutput);
              const currentJob = this.jobs.find(j => j.id === job.id);
              if (currentJob) {
                currentJob.status = 'Done';
                if (currentJob.foreground && writeRow) {
                  writeRow(`[${currentJob.id}]  Done  ${currentJob.command}`);
                  this.removeJob(currentJob.id);
                }
              }
            } catch (err) {
              const currentJob = this.jobs.find(j => j.id === job.id);
              if (currentJob) currentJob.status = 'Failed';
            }
          } else {
            const currentJob = this.jobs.find(j => j.id === job.id);
            if (currentJob) {
              currentJob.status = 'Done';
              if (currentJob.foreground && writeRow) {
                writeRow(`[${currentJob.id}]  Done  ${currentJob.command}`);
                this.removeJob(currentJob.id);
              }
            }
          }
        };
        
        setTimeout(runInBackground, 0);
        const startMsg = `[${job.id}] Background job started: ${cmdStr}`;
        return { output: [startMsg], cls: 'success' };
      } else {
        const leftRes = this.executeAST(node.left, currentDir, history, stdin, writeRow);
        if (leftRes.async) {
          return {
            async: true,
            run: async (wr) => {
              const finalLeft = await leftRes.run(wr);
              this.state.env['?'] = finalLeft.cls === 'error' ? '1' : '0';
              if (node.right) {
                const rightRes = this.executeAST(node.right, currentDir, history, stdin, wr);
                if (rightRes.async) {
                  const finalRight = await rightRes.run(wr);
                  this.state.env['?'] = finalRight.cls === 'error' ? '1' : '0';
                  return finalRight;
                }
                this.state.env['?'] = rightRes.cls === 'error' ? '1' : '0';
                return rightRes;
              }
              return finalLeft;
            }
          };
        }
        
        this.state.env['?'] = leftRes.cls === 'error' ? '1' : '0';
        if (node.right) {
          const rightRes = this.executeAST(node.right, currentDir, history, stdin, writeRow);
          if (rightRes.async) {
            return {
              async: true,
              run: async (wr) => {
                const finalRight = await rightRes.run(wr);
                this.state.env['?'] = finalRight.cls === 'error' ? '1' : '0';
                return finalRight;
              }
            };
          }
          this.state.env['?'] = rightRes.cls === 'error' ? '1' : '0';
          return rightRes;
        }
        return leftRes;
      }
    }
    
    if (node.type === 'and') {
      const leftRes = this.executeAST(node.left, currentDir, history, stdin, writeRow);
      if (leftRes.async) {
        return {
          async: true,
          run: async (wr) => {
            const finalLeft = await leftRes.run(wr);
            this.state.env['?'] = finalLeft.cls === 'error' ? '1' : '0';
            if (finalLeft.cls !== 'error') {
              const rightRes = this.executeAST(node.right, currentDir, history, stdin, wr);
              if (rightRes.async) {
                const finalRight = await rightRes.run(wr);
                this.state.env['?'] = finalRight.cls === 'error' ? '1' : '0';
                return finalRight;
              }
              this.state.env['?'] = rightRes.cls === 'error' ? '1' : '0';
              return rightRes;
            }
            return finalLeft;
          }
        };
      }
      
      this.state.env['?'] = leftRes.cls === 'error' ? '1' : '0';
      if (leftRes.cls !== 'error') {
        const rightRes = this.executeAST(node.right, currentDir, history, stdin, writeRow);
        if (rightRes.async) {
          return {
            async: true,
            run: async (wr) => {
              const finalRight = await rightRes.run(wr);
              this.state.env['?'] = finalRight.cls === 'error' ? '1' : '0';
              return finalRight;
            }
          };
        }
        this.state.env['?'] = rightRes.cls === 'error' ? '1' : '0';
        return rightRes;
      }
      return leftRes;
    }
    
    if (node.type === 'or') {
      const leftRes = this.executeAST(node.left, currentDir, history, stdin, writeRow);
      if (leftRes.async) {
        return {
          async: true,
          run: async (wr) => {
            const finalLeft = await leftRes.run(wr);
            this.state.env['?'] = finalLeft.cls === 'error' ? '1' : '0';
            if (finalLeft.cls === 'error') {
              const rightRes = this.executeAST(node.right, currentDir, history, stdin, wr);
              if (rightRes.async) {
                const finalRight = await rightRes.run(wr);
                this.state.env['?'] = finalRight.cls === 'error' ? '1' : '0';
                return finalRight;
              }
              this.state.env['?'] = rightRes.cls === 'error' ? '1' : '0';
              return rightRes;
            }
            return finalLeft;
          }
        };
      }
      
      this.state.env['?'] = leftRes.cls === 'error' ? '1' : '0';
      if (leftRes.cls === 'error') {
        const rightRes = this.executeAST(node.right, currentDir, history, stdin, writeRow);
        if (rightRes.async) {
          return {
            async: true,
            run: async (wr) => {
              const finalRight = await rightRes.run(wr);
              this.state.env['?'] = finalRight.cls === 'error' ? '1' : '0';
              return finalRight;
            }
          };
        }
        this.state.env['?'] = rightRes.cls === 'error' ? '1' : '0';
        return rightRes;
      }
      return leftRes;
    }
    
    if (node.type === 'pipeline') {
      const leftRes = this.executeAST(node.left, currentDir, history, stdin, null);
      if (leftRes.async) {
        return {
          async: true,
          run: async (wr) => {
            let captured = [];
            await leftRes.run((t) => {
              captured.push(t);
            });
            const rightRes = this.executeAST(node.right, currentDir, history, captured.join('\n'), wr);
            if (rightRes.async) {
              const finalRight = await rightRes.run(wr);
              this.state.env['?'] = finalRight.cls === 'error' ? '1' : '0';
              return finalRight;
            }
            this.state.env['?'] = rightRes.cls === 'error' ? '1' : '0';
            return rightRes;
          }
        };
      }
      
      const leftOutput = (leftRes.output || []).join('\n');
      const rightRes = this.executeAST(node.right, currentDir, history, leftOutput, writeRow);
      if (rightRes.async) {
        return {
          async: true,
          run: async (wr) => {
            const finalRight = await rightRes.run(wr);
            this.state.env['?'] = finalRight.cls === 'error' ? '1' : '0';
            return finalRight;
          }
        };
      }
      this.state.env['?'] = rightRes.cls === 'error' ? '1' : '0';
      return rightRes;
    }
    
    return { output: [], cls: 'success' };
  }

  executeSimpleCommand(node, currentDir, history = [], stdin = '', writeRow = null) {
    const cmd = node.args[0];
    const args = node.args.slice(1);
    if (!cmd) return { output: [] };
    
    return this.runCoreCommand(cmd, args, currentDir, history, stdin);
  }

  executeCommand(rawCmd, currentDir, history = [], stdin = '') {
    return this.state.withKernelWrite(() => {
      if (!this.aliases) {
        this.loadBashRC();
      }
      
      // Resolve command substitutions: `command` and $(command)
      let cmdToExec = rawCmd.trim();
      cmdToExec = cmdToExec.replace(/`([^`]+)`/g, (match, cmd) => {
        const execRes = this.executeCommand(cmd, currentDir, history, stdin);
        return (execRes.output || []).join(' ').trim();
      });
      cmdToExec = cmdToExec.replace(/\$\(([^)]+)\)/g, (match, cmd) => {
        const execRes = this.executeCommand(cmd, currentDir, history, stdin);
        return (execRes.output || []).join(' ').trim();
      });
      
      // Check if the command starts with an alias
      const spaceIdx = cmdToExec.indexOf(' ');
      const firstWord = spaceIdx === -1 ? cmdToExec : cmdToExec.substring(0, spaceIdx);
      
      if (this.aliases && this.aliases[firstWord]) {
        const aliasVal = this.aliases[firstWord];
        const rest = spaceIdx === -1 ? '' : cmdToExec.substring(spaceIdx);
        cmdToExec = aliasVal + rest;
      }
      
      const tokens = this.tokenize(cmdToExec);
      if (tokens.length === 0) return { output: [] };
      const ast = this.parseShell(tokens);
      const result = this.executeAST(ast, currentDir, history, stdin);
      if (result.async && result.run) {
        const originalRun = result.run;
        result.run = async (wr) => {
          return this.state.withKernelWrite(async () => {
            return await originalRun(wr);
          });
        };
      }
      if (!result.async) {
        this.state.env['?'] = result.cls === 'error' ? '1' : '0';
      }
      return result;
    });
  }

  runCoreCommand(cmd, args, currentDir, history = [], stdin = '') {
    // 1. Check if it's a shell function
    const safeCmd = window.sanitizeKey(cmd);
    if (safeCmd && this.shellFunctions && Reflect.get(this.shellFunctions, safeCmd)) {
      const body = Reflect.get(this.shellFunctions, safeCmd);
      let expandedBody = body;
      args.forEach((arg, idx) => {
        expandedBody = expandedBody.replaceAll('$' + (idx + 1), arg);
      });
      expandedBody = expandedBody.replace(/\$[0-9]+/g, '');
      
      const lines = expandedBody.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      return {
        async: true,
        run: async (wr) => {
          let output = [];
          let lastCls = 'success';
          for (const line of lines) {
            const res = this.executeCommand(line, currentDir, history, stdin);
            if (res.async) {
              const r = await res.run(wr);
              if (r.output) output.push(...r.output);
              lastCls = r.cls;
            } else {
              if (res.output) {
                output.push(...res.output);
                if (wr) res.output.forEach(o => wr(o, res.cls));
              }
              lastCls = res.cls;
            }
          }
          return { output, cls: lastCls };
        }
      };
    }

    const output = [];
    let cls = '';
    let newDir = null;
    let action = '';
    let toast = null;

    if (cmd === 'true') {
      return { output: [], cls: 'success' };
    }

    if (cmd === 'false') {
      return { output: [], cls: 'error' };
    }

    if (cmd === 'sudo') {
      const user = this.state.users.find(u => u.username === this.state.currentSession.currentUser);
      if (!user || user.role !== 'admin') return { output: ['sudo: permission denied'], cls: 'error' };
      output.push(`[sudo] password accepted for ${this.state.currentSession.currentUser}`);
      const innerRes = this.executeCommand(args.join(' '), currentDir, history, stdin);
      return {
        output: [...output, ...(innerRes.output || [])],
        cls: innerRes.cls,
        newDir: innerRes.newDir,
        action: innerRes.action,
        toast: innerRes.toast,
        async: innerRes.async,
        run: innerRes.run
      };
    }

    switch (cmd) {
      case 'source': {
        if (!args[0]) {
          output.push('source: filename argument required');
          cls = 'error';
          break;
        }
        this.loadBashRC();
        output.push(`Sourced ${args[0]}`);
        cls = 'success';
        break;
      }
      case 'help':
        output.push(
          '━━━ Astra OS Terminal — Command Reference ━━━',
          '',
          'FILESYSTEM:  ls, cat, pwd, cd, mkdir, touch, rm, cp, mv, chmod, chown, tree, find, grep, echo, wc',
          'PROCESSES:   ps, kill, top, uptime',
          'USER:        whoami, su, sudo, passwd, id',
          'PACKAGE:     apt update, apt install, apt remove, apt list, apt search',
          'NETWORK:     ping, curl, ifconfig, nslookup, netstat, wget, hostname',
          'GIT:         git init/status/add/commit/log/diff/branch/checkout',
          'ENV:         export KEY=VALUE, unset KEY, env',
          'JOBS:        command &, jobs, fg [id], bg',
          'SYSTEM:      neofetch, uname, date, df, free, dmesg, clear, history, sysreset',
          'HEALTH:      health',
          'FUN:         cowsay, fortune, sl, figlet (install via apt)',
          ''
        );
        cls = 'info';
        break;

      case 'man': {
        if (!args[0]) {
          output.push('What manual page do you want?');
          cls = 'warning';
          break;
        }
        const targetCmd = args[0].toLowerCase();
        const manuals = {
          ls: [
            'LS(1)                        User Commands                        LS(1)',
            '',
            'NAME',
            '       ls - list directory contents',
            '',
            'SYNOPSIS',
            '       ls [-a] [-l] [FILE]...',
            '',
            'DESCRIPTION',
            '       List  information  about  the FILEs (the current directory by default).',
            '       Sort entries alphabetically.',
            '',
            '       -a     do not ignore entries starting with .',
            '       -l     use a long listing format'
          ],
          cd: [
            'CD(1)                        User Commands                        CD(1)',
            '',
            'NAME',
            '       cd - change the working directory',
            '',
            'SYNOPSIS',
            '       cd [DIRECTORY]',
            '',
            'DESCRIPTION',
            '       Change the current directory to DIRECTORY. The default DIRECTORY is the',
            '       home directory.'
          ],
          cat: [
            'CAT(1)                        User Commands                        CAT(1)',
            '',
            'NAME',
            '       cat - concatenate files and print on the standard output',
            '',
            'SYNOPSIS',
            '       cat [FILE]...',
            '',
            'DESCRIPTION',
            '       Concatenate FILE(s) to standard output.'
          ],
          pwd: [
            'PWD(1)                        User Commands                        PWD(1)',
            '',
            'NAME',
            '       pwd - print name of current/working directory',
            '',
            'SYNOPSIS',
            '       pwd',
            '',
            'DESCRIPTION',
            '       Print the full pathname of the current working directory.'
          ],
          mkdir: [
            'MKDIR(1)                      User Commands                      MKDIR(1)',
            '',
            'NAME',
            '       mkdir - make directories',
            '',
            'SYNOPSIS',
            '       mkdir [-p] DIRECTORY...',
            '',
            'DESCRIPTION',
            '       Create the DIRECTORY(ies), if they do not already exist.',
            '',
            '       -p     no error if existing, make parent directories as needed'
          ],
          rm: [
            'RM(1)                        User Commands                        RM(1)',
            '',
            'NAME',
            '       rm - remove files or directories',
            '',
            'SYNOPSIS',
            '       rm [-r] FILE...',
            '',
            'DESCRIPTION',
            '       rm removes each specified file. By default, it does not remove directories.',
            '',
            '       -r     remove directories and their contents recursively'
          ],
          cp: [
            'CP(1)                        User Commands                        CP(1)',
            '',
            'NAME',
            '       cp - copy files and directories',
            '',
            'SYNOPSIS',
            '       cp SOURCE DEST',
            '',
            'DESCRIPTION',
            '       Copy SOURCE to DEST.'
          ],
          mv: [
            'MV(1)                        User Commands                        MV(1)',
            '',
            'NAME',
            '       mv - move (rename) files',
            '',
            'SYNOPSIS',
            '       mv SOURCE DEST',
            '',
            'DESCRIPTION',
            '       Rename SOURCE to DEST, or move SOURCE(s) to DIRECTORY.'
          ],
          chmod: [
            'CHMOD(1)                      User Commands                      CHMOD(1)',
            '',
            'NAME',
            '       chmod - change file mode bits',
            '',
            'SYNOPSIS',
            '       chmod MODE FILE...',
            '',
            'DESCRIPTION',
            '       chmod changes the file mode bits of each given file according to MODE,',
            '       which can be a Unix-style mode representation (e.g. rwxr-xr-x).'
          ],
          grep: [
            'GREP(1)                       User Commands                      GREP(1)',
            '',
            'NAME',
            '       grep - print lines matching a pattern',
            '',
            'SYNOPSIS',
            '       grep PATTERN [FILE]...',
            '',
            'DESCRIPTION',
            '       grep searches for PATTERN in each FILE and outputs matching lines.'
          ]
        };
        if (manuals[targetCmd]) {
          output.push(...manuals[targetCmd]);
          cls = 'info';
        } else {
          output.push(`No manual entry for ${args[0]}`);
          cls = 'error';
        }
        break;
      }

      case 'export': {
        if (!args[0]) {
          output.push('export: usage: export KEY=VALUE');
          cls = 'error';
          break;
        }
        const eqIdx = args[0].indexOf('=');
        if (eqIdx === -1) {
          const key = args[0];
          const val = this.state.env[key] || '';
          output.push(val);
        } else {
          const key = args[0].substring(0, eqIdx).trim();
          const val = args[0].substring(eqIdx + 1).replace(/^"|"$/g, '').trim();
          if (key) {
            this.state.env[key] = val;
            this.state.saveState();
          } else {
            output.push('export: invalid identifier');
            cls = 'error';
          }
        }
        break;
      }
      case 'env': {
        Object.entries(this.state.env).forEach(([k, v]) => {
          output.push(`${k}=${v}`);
        });
        break;
      }
      case 'unset': {
        if (!args[0]) {
          output.push('unset: usage: unset VAR_NAME');
          cls = 'error';
          break;
        }
        const envKey = window.sanitizeKey(args[0]);
        if (envKey && Reflect.get(this.state.env, envKey) !== undefined) {
          Reflect.deleteProperty(this.state.env, envKey);
          this.state.saveState();
          output.push(`Unset: ${args[0]}`);
        } else {
          output.push(`unset: ${args[0]}: not set`);
        }
        break;
      }

      case 'ls': {
        const target = args[0] ? this.resolveRelativePath(args[0], currentDir) : currentDir;
        const showHidden = args.includes('-a') || args.includes('-la') || args.includes('-al');
        const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');
        const dir = this.state.resolvePath(target);
        if (!dir || dir.type !== 'dir') {
          output.push(`ls: cannot access '${args[0] || target}': No such file or directory`);
          cls = 'error';
          break;
        }
        const entries = Object.keys(dir.children || {}).filter(n => showHidden || !n.startsWith('.')).sort();
        if (showLong) {
          entries.forEach(name => {
            const node = Reflect.get(dir.children, window.sanitizeKey(name));
            if (!node) return;
            const perm = node.permissions || (node.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--');
            const owner = node.owner || 'divyanshu';
            const size = node.type === 'file' ? (node.content || '').length : 4096;
            const prefix = node.type === 'dir' ? 'd' : '-';
            output.push(`${prefix}${perm}  ${owner.padEnd(12)} ${String(size).padStart(8)}  ${name}${node.type === 'dir' ? '/' : ''}`);
          });
        } else {
          output.push(entries.map(n => {
            const node = Reflect.get(dir.children, window.sanitizeKey(n));
            return (node && node.type === 'dir') ? n + '/' : n;
          }).join('  '));
        }
        break;
      }
      case 'cat': {
        if (!args[0]) {
          output.push('cat: missing operand');
          cls = 'error';
          break;
        }
        const path = this.resolveRelativePath(args[0], currentDir);
        const file = this.state.resolvePath(path);
        if (!file) {
          output.push(`cat: ${args[0]}: No such file or directory`);
          cls = 'error';
          break;
        }
        if (file.type === 'dir') {
          output.push(`cat: ${args[0]}: Is a directory`);
          cls = 'error';
          break;
        }
        output.push(...(file.content || '').split('\n'));
        break;
      }
      case 'pwd':
        output.push(currentDir);
        break;
      case 'cd': {
        if (!args[0] || args[0] === '~') {
          newDir = '/home/' + (this.state.currentSession.currentUser || 'divyanshu');
        } else if (args[0] === '..') {
          const parts = currentDir.split('/').filter(Boolean);
          parts.pop();
          newDir = '/' + parts.join('/');
        } else if (args[0] === '-') {
          output.push(currentDir);
        } else {
          const target = this.resolveRelativePath(args[0], currentDir);
          const dir = this.state.resolvePath(target);
          if (!dir || dir.type !== 'dir') {
            output.push(`cd: ${args[0]}: No such directory`);
            cls = 'error';
            break;
          }
          newDir = target;
        }
        break;
      }
      case 'mkdir': {
        const hasP = args.includes('-p');
        const pathArg = args.find(a => a !== '-p');
        if (!pathArg) {
          output.push('mkdir: missing operand');
          cls = 'error';
          break;
        }
        const path = this.resolveRelativePath(pathArg, currentDir);
        const callerId = window.AstraRuntime ? window.AstraRuntime.getActiveCallerId() : 'user';
        const res = this.syscall(callerId, 'fs:mkdir', [path, hasP]);
        if (res instanceof Promise) {
          return {
            async: true,
            run: async (wr) => {
              try {
                const ok = await res;
                if (!ok) return { output: [`mkdir: cannot create directory '${pathArg}'`], cls: 'error' };
                return { output: [], cls: 'success' };
              } catch (err) {
                return { output: [`mkdir: ${err.message}`], cls: 'error' };
              }
            }
          };
        } else {
          if (!res) {
            output.push(`mkdir: cannot create directory '${pathArg}'`);
            cls = 'error';
          }
        }
        break;
      }
      case 'touch': {
        if (!args[0]) {
          output.push('touch: missing operand');
          cls = 'error';
          break;
        }
        const path = this.resolveRelativePath(args[0], currentDir);
        const callerId = window.AstraRuntime ? window.AstraRuntime.getActiveCallerId() : 'user';
        const existing = this.state.resolvePath(path);
        if (!existing) {
          const res = this.syscall(callerId, 'fs:write', [path, '']);
          if (res instanceof Promise) {
            return {
              async: true,
              run: async (wr) => {
                try {
                  const ok = await res;
                  if (!ok) return { output: [`touch: cannot create file '${args[0]}'`], cls: 'error' };
                  return { output: [], cls: 'success' };
                } catch (err) {
                  return { output: [`touch: ${err.message}`], cls: 'error' };
                }
              }
            };
          } else {
            if (!res) {
              output.push(`touch: cannot create file '${args[0]}'`);
              cls = 'error';
            }
          }
        } else {
          const res = this.syscall(callerId, 'fs:write', [path, existing.content || '']);
          if (res instanceof Promise) {
            return {
              async: true,
              run: async (wr) => {
                try {
                  await res;
                  return { output: [], cls: 'success' };
                } catch (err) {
                  return { output: [`touch: ${err.message}`], cls: 'error' };
                }
              }
            };
          }
        }
        break;
      }
      case 'rm': {
        if (!args[0]) {
          output.push('rm: missing operand');
          cls = 'error';
          break;
        }
        const cleanPathArg = args[0].replace('-rf ', '').replace('-r ', '');
        const path = this.resolveRelativePath(cleanPathArg, currentDir);
        const callerId = window.AstraRuntime ? window.AstraRuntime.getActiveCallerId() : 'user';
        const res = this.syscall(callerId, 'fs:delete', [path]);
        if (res instanceof Promise) {
          return {
            async: true,
            run: async (wr) => {
              try {
                const ok = await res;
                if (!ok) return { output: [`rm: cannot remove '${cleanPathArg}'`], cls: 'error' };
                return { output: [], cls: 'success' };
              } catch (err) {
                return { output: [`rm: ${err.message}`], cls: 'error' };
              }
            }
          };
        } else {
          if (!res) {
            output.push(`rm: cannot remove '${cleanPathArg}'`);
            cls = 'error';
          }
        }
        break;
      }
      case 'cp': {
        if (args.length < 2) {
          output.push('cp: missing operand');
          cls = 'error';
          break;
        }
        const src = this.resolveRelativePath(args[0], currentDir);
        const dst = this.resolveRelativePath(args[1], currentDir);
        const callerId = window.AstraRuntime ? window.AstraRuntime.getActiveCallerId() : 'user';
        const res = this.syscall(callerId, 'fs:copy', [src, dst]);
        if (res instanceof Promise) {
          return {
            async: true,
            run: async (wr) => {
              try {
                const ok = await res;
                if (!ok) return { output: [`cp: cannot copy '${args[0]}'`], cls: 'error' };
                return { output: [], cls: 'success' };
              } catch (err) {
                return { output: [`cp: ${err.message}`], cls: 'error' };
              }
            }
          };
        } else {
          if (!res) {
            output.push(`cp: cannot copy '${args[0]}'`);
            cls = 'error';
          }
        }
        break;
      }
      case 'mv': {
        if (args.length < 2) {
          output.push('mv: missing operand');
          cls = 'error';
          break;
        }
        const src = this.resolveRelativePath(args[0], currentDir);
        const dst = this.resolveRelativePath(args[1], currentDir);
        const callerId = window.AstraRuntime ? window.AstraRuntime.getActiveCallerId() : 'user';
        const res = this.syscall(callerId, 'fs:move', [src, dst]);
        if (res instanceof Promise) {
          return {
            async: true,
            run: async (wr) => {
              try {
                const ok = await res;
                if (!ok) return { output: [`mv: cannot move '${args[0]}'`], cls: 'error' };
                return { output: [], cls: 'success' };
              } catch (err) {
                return { output: [`mv: ${err.message}`], cls: 'error' };
              }
            }
          };
        } else {
          if (!res) {
            output.push(`mv: cannot move '${args[0]}'`);
            cls = 'error';
          }
        }
        break;
      }
      case 'chmod': {
        if (args.length < 2) {
          output.push('chmod: missing operand');
          cls = 'error';
          break;
        }
        if (!this.chmod(this.resolveRelativePath(args[1], currentDir), args[0])) {
          output.push(`chmod: failed to change mode for '${args[1]}'`);
          cls = 'error';
        }
        break;
      }
      case 'chown': {
        if (args.length < 2) {
          output.push('chown: missing operand');
          cls = 'error';
          break;
        }
        if (!this.chown(this.resolveRelativePath(args[1], currentDir), args[0])) {
          output.push(`chown: failed to change owner for '${args[1]}'`);
          cls = 'error';
        }
        break;
      }
      case 'tree': {
        const target = args[0] ? this.resolveRelativePath(args[0], currentDir) : currentDir;
        const dir = this.state.resolvePath(target);
        if (!dir || dir.type !== 'dir') {
          output.push('tree: not a directory');
          cls = 'error';
          break;
        }
        output.push(target);
        this.printTree(dir, '', output);
        break;
      }
      case 'find': {
        const pattern = args[0] || '*';
        const dir = this.state.resolvePath(currentDir);
        if (dir) {
          const results = this.findFiles(dir, currentDir, pattern);
          output.push(...(results.length > 0 ? results : ['(no matches)']));
          cls = 'info';
        }
        break;
      }
      case 'grep': {
        if (args.length < 1 && !stdin) {
          output.push('grep: usage: grep <pattern> <file>');
          cls = 'error';
          break;
        }
        const pattern = args[0];
        const fileArg = args[1];
        const sourceText = fileArg ? (this.state.resolvePath(this.resolveRelativePath(fileArg, currentDir))?.content || '') : stdin;
        if (!sourceText) {
          output.push(fileArg ? `grep: ${fileArg}: No such file` : 'grep: no input');
          cls = 'error';
          break;
        }
        const fileLines = sourceText.split('\n');
        let found = false;
        fileLines.forEach((line, i) => {
          if (line.toLowerCase().includes(pattern.toLowerCase())) {
            output.push(`${i + 1}: ${line}`);
            found = true;
          }
        });
        if (!found) output.push('(no matches)');
        break;
      }
      case 'echo':
        output.push(args.join(' '));
        break;
      case 'wc': {
        if (!args[0] && !stdin) {
          output.push('wc: missing operand');
          cls = 'error';
          break;
        }
        const sourceText = args[0] ? (this.state.resolvePath(this.resolveRelativePath(args[0], currentDir))?.content || '') : stdin;
        const label = args[0] || '(stdin)';
        if (!sourceText) {
          output.push(`wc: ${label}: No such file`);
          cls = 'error';
          break;
        }
        const lineCount = sourceText.split('\n').length;
        const wordCount = sourceText.split(/\s+/).filter(Boolean).length;
        const charCount = sourceText.length;
        output.push(`  ${lineCount}  ${wordCount}  ${charCount} ${label}`);
        break;
      }
      case 'ps': {
        const procs = this.listProcesses();
        output.push('  PID   NAME             STATE      CPU%   MEM(MB)');
        output.push('  ---   ----             -----      ----   -------');
        procs.forEach(p => {
          output.push(`  ${String(p.pid).padEnd(6)}${p.name.padEnd(17)}${p.state.padEnd(11)}${String(p.cpuPercent).padEnd(7)}${p.memMB}`);
        });
        break;
      }
      case 'kill': {
        if (!args[0]) {
          output.push('kill: usage: kill [-signal] <pid>');
          cls = 'error';
          break;
        }
        let signal = '-9';
        let targetPid = args[0];
        if (args[0].startsWith('-')) {
          signal = args[0];
          targetPid = args[1];
        }
        if (!targetPid) {
          output.push('kill: missing pid operand');
          cls = 'error';
          break;
        }
        const pid = parseInt(targetPid);
        const proc = this.state.processTable.find(p => p.pid === pid);
        if (!proc) {
          output.push(`kill: ${targetPid}: no such process`);
          cls = 'error';
          break;
        }
        if (signal === '-9' || signal === '-SIGKILL') {
          const res = this.killProcess(pid);
          output.push(res.success ? `Killed ${res.name} (PID ${pid})` : res.error);
          cls = res.success ? 'success' : 'error';
        } else if (signal === '-19' || signal === '-SIGSTOP') {
          proc.state = 'SUSPENDED';
          output.push(`Suspended process ${proc.name} (PID ${pid})`);
          this.state.saveState();
        } else if (signal === '-18' || signal === '-SIGCONT') {
          proc.state = 'RUNNING';
          output.push(`Resumed process ${proc.name} (PID ${pid})`);
          this.state.saveState();
        } else {
          output.push(`kill: unknown signal: ${signal}`);
          cls = 'error';
        }
        break;
      }
      case 'top': {
        output.push(`top - ${new Date().toLocaleTimeString()}, up ${this.getUptime()}, ${this.listProcesses().length} tasks`);
        output.push(`CPU: ${this.getTotalCpu()}%   MEM: ${this.getTotalMem()}MB / ${this.state.hardware.ram.totalGB * 1024}MB`);
        output.push('');
        const procs = this.listProcesses().sort((a, b) => parseFloat(b.cpuPercent) - parseFloat(a.cpuPercent)).slice(0, 15);
        output.push('  PID   NAME             STATE      CPU%   MEM');
        procs.forEach(p => output.push(`  ${String(p.pid).padEnd(6)}${p.name.padEnd(17)}${p.state.padEnd(11)}${String(p.cpuPercent).padEnd(7)}${p.memMB}MB`));
        break;
      }
      case 'uptime':
        output.push(`up ${this.getUptime()}, ${this.listProcesses().length} processes`);
        break;
      case 'whoami':
        output.push(this.getCurrentUser());
        break;
      case 'id': {
        const s = this.state.currentSession;
        output.push(`uid=${s.uid}(${s.currentUser}) gid=1000(staff) groups=1000(staff)${s.role === 'admin' ? ',27(sudo)' : ''}`);
        break;
      }
      case 'su': {
        if (!args[0]) {
          output.push('su: usage: su <username> [password]');
          cls = 'error';
          break;
        }
        try {
          if (this.switchUser(args[0], args[1])) {
            output.push(`Switched to ${args[0]}`);
            cls = 'success';
          } else {
            output.push(`su: user '${args[0]}' not found`);
            cls = 'error';
          }
        } catch (err) {
          output.push(err.message);
          cls = 'error';
        }
        break;
      }
      case 'passwd':
        output.push('Password change is handled via Settings > Security.');
        cls = 'info';
        break;
      case 'apt': {
        const subCmd = args[0];
        if (subCmd === 'update') {
          output.push(...this.aptUpdate());
        } else if (subCmd === 'install') {
          if (!args[1]) {
            output.push('apt install: missing package name');
            cls = 'error';
            break;
          }
          const res = this.aptInstall(args[1]);
          output.push(...res.lines);
          cls = res.success ? '' : 'error';
          if (res.success) {
            toast = { title: 'Package Installed', message: `${args[1]} has been installed successfully.`, type: 'success' };
          }
        } else if (subCmd === 'remove') {
          if (!args[1]) {
            output.push('apt remove: missing package name');
            cls = 'error';
            break;
          }
          const res = this.aptRemove(args[1]);
          output.push(...res.lines);
          cls = res.success ? '' : 'error';
        } else if (subCmd === 'list') {
          const installed = args.includes('--installed');
          const pkgs = this.aptList(installed);
          pkgs.forEach(p => output.push(`${p.name}/${p.version} ${p.installed ? '[installed]' : ''}`));
        } else if (subCmd === 'search') {
          if (!args[1]) {
            output.push('apt search: missing query');
            cls = 'error';
            break;
          }
          const pkgs = this.aptSearch(args[1]);
          pkgs.forEach(p => output.push(`${p.name} - ${p.description}`));
        } else {
          output.push('apt: usage: apt [update|install|remove|list|search] ...');
          cls = 'error';
        }
        break;
      }
      case 'ping': {
        if (!args[0]) {
          output.push('ping: missing host');
          cls = 'error';
          break;
        }
        output.push(...this.ping(args[0]));
        break;
      }
      case 'curl': {
        if (!args[0]) {
          output.push('curl: missing URL');
          cls = 'error';
          break;
        }
        const url = args[0];
        return {
          async: true,
          run: async (writeRow) => {
            writeRow(`% Total    % Received % Xferd  Average Speed   Time    Time     Time  Current`);
            writeRow(`                                 Dload  Upload   Total   Spent    Left  Speed`);
            try {
              const cleanUrl = url.startsWith('http') ? url : `http://${url}`;
              writeRow(`[curl] Fetching via proxy: ${cleanUrl}...`);
              const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}`;
              const response = await fetch(proxyUrl);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const data = await response.json();
              const contents = data.contents;
              writeRow(contents);
            } catch (err) {
              writeRow(`curl: (6) Could not resolve host or proxy failed: ${err.message}`, 'error');
            }
          }
        };
      }
      case 'ifconfig':
        output.push(...this.ifconfig());
        break;
      case 'nslookup': {
        if (!args[0]) {
          output.push('nslookup: missing host');
          cls = 'error';
          break;
        }
        output.push(...this.nslookup(args[0]));
        break;
      }
      case 'netstat':
        output.push(...this.netstat());
        break;
      case 'wget': {
        if (!args[0]) {
          output.push('wget: missing URL');
          cls = 'error';
          break;
        }
        const url = args[0];
        return {
          async: true,
          run: async (writeRow) => {
            const fileName = url.split('/').pop() || 'index.html';
            writeRow(`--${new Date().toLocaleTimeString()}--  ${url}`);
            writeRow(`Resolving host via CORS proxy...`);
            try {
              const cleanUrl = url.startsWith('http') ? url : `http://${url}`;
              const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}`;
              const response = await fetch(proxyUrl);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const data = await response.json();
              const contents = data.contents;
              const size = new Blob([contents]).size;
              writeRow(`Length: ${size} bytes`);
              writeRow(`Saving to: '${fileName}'`);
              
              const targetPath = this.resolveRelativePath(fileName, currentDir);
              this.state.writeFile(targetPath, contents);
              writeRow(`100%[==================>] saved successfully.`);
            } catch (err) {
              writeRow(`wget: download failed: ${err.message}`, 'error');
            }
          }
        };
      }
      case 'pbcopy': {
        const text = args.join(' ');
        return {
          async: true,
          run: async (writeRow) => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              try {
                await navigator.clipboard.writeText(text);
                writeRow(`Contents copied to host clipboard.`);
              } catch (err) {
                writeRow(`pbcopy: failed to write clipboard: ${err.message}`, 'error');
              }
            } else {
              writeRow(`pbcopy: Clipboard API not supported.`, 'error');
            }
          }
        };
      }
      case 'pbpaste': {
        return {
          async: true,
          run: async (writeRow) => {
            if (navigator.clipboard && navigator.clipboard.readText) {
              try {
                const text = await navigator.clipboard.readText();
                writeRow(text);
              } catch (err) {
                writeRow(`pbpaste: failed to read clipboard: ${err.message}`, 'error');
              }
            } else {
              writeRow(`pbpaste: Clipboard API not supported or blocked.`, 'error');
            }
          }
        };
      }
      case 'store': {
        const sub = args[0];
        if (sub === 'status') {
          return {
            async: true,
            run: async (writeRow) => {
              writeRow(`━━━ Astra OS VFS Storage Diagnostics ━━━`);
              writeRow(`IndexedDB Adapter: ${this.state.db ? 'CONNECTED' : 'DISCONNECTED'}`);
              
              if (this.state.db) {
                writeRow(`Database Name: AstraOSDatabase`);
                writeRow(`Object Stores: ${Array.from(this.state.db.objectStoreNames).join(', ')}`);
              }
              
              if (navigator.storage && navigator.storage.estimate) {
                try {
                  const est = await navigator.storage.estimate();
                  const usedMB = (est.usage / (1024 * 1024)).toFixed(2);
                  const quotaMB = (est.quota / (1024 * 1024)).toFixed(2);
                  writeRow(`Physical Storage Used: ${usedMB} MB / ${quotaMB} MB (${(est.usage / est.quota * 100).toFixed(2)}%)`);
                } catch (e) {
                  writeRow(`Physical Storage Used: Estimate failed: ${e.message}`);
                }
              } else {
                writeRow(`Physical Storage Used: Browser Storage Estimate API not supported.`);
              }
              
              const lsBytes = new Blob([localStorage.getItem('astra_os_state') || '']).size;
              writeRow(`LocalStorage Cache Size: ${(lsBytes / 1024).toFixed(2)} KB / 5120.00 KB`);
            }
          };
        } else if (sub === 'sync') {
          return {
            async: true,
            run: async (writeRow) => {
              writeRow(`Synchronizing in-memory VFS to IndexedDB...`);
              if (this.state.db) {
                try {
                  this.state._executeSaveState();
                  writeRow(`VFS Synchronized successfully. State committed to database.`);
                } catch (e) {
                  writeRow(`Sync failed: ${e.message}`, 'error');
                }
              } else {
                writeRow(`Sync failed: IndexedDB connection not active.`, 'error');
              }
            }
          };
        } else {
          output.push(
            `store: usage: store [status|sync]`,
            `  status: View IndexedDB and LocalStorage connection metrics & usage`,
            `  sync:   Force commit in-memory filesystem to storage database`
          );
          cls = 'info';
        }
        break;
      }
      case 'hostname':
        output.push(this.state.network.hostname || 'astra-desktop');
        break;
      case 'git': {
        const sub = args[0];
        if (sub === 'init') {
          output.push(...this.gitInit(currentDir));
        } else if (sub === 'status') {
          output.push(...this.gitStatus(currentDir));
        } else if (sub === 'add') {
          const res = this.gitAdd(currentDir, args[1] || '.');
          if (res.length > 0) {
            output.push(...res);
            cls = 'error';
          }
        } else if (sub === 'commit') {
          const mFlag = args.indexOf('-m');
          const msg = mFlag >= 0 ? args.slice(mFlag + 1).join(' ').replace(/^"|"$/g, '') : 'No message';
          output.push(...this.gitCommit(currentDir, msg));
        } else if (sub === 'log') {
          output.push(...this.gitLog(currentDir));
        } else if (sub === 'diff') {
          output.push(...this.gitDiff(currentDir));
        } else if (sub === 'branch') {
          output.push(...this.gitBranch(currentDir));
        } else if (sub === 'checkout') {
          const isNew = args[1] === '-b';
          const branchName = isNew ? args[2] : args[1];
          if (!branchName) {
            output.push('git checkout: specify branch name');
            cls = 'error';
            break;
          }
          output.push(...this.gitCheckoutBranch(currentDir, branchName, isNew));
        } else {
          output.push(`git: '${sub}' is not a git command. See 'help'.`);
          cls = 'error';
        }
        break;
      }
      case 'true':
        cls = 'success';
        break;
      case 'false':
        cls = 'error';
        break;
      case 'neofetch':
        if (!this.isPackageInstalled('neofetch')) {
          output.push('neofetch: command not found. Install with: apt install neofetch');
          cls = 'error';
        } else {
          output.push(...this.neofetch());
        }
        break;
      case 'node': {
        if (!args[0]) {
          output.push('node: missing script operand');
          cls = 'error';
          break;
        }
        const path = this.resolveRelativePath(args[0], currentDir);
        const fileNode = this.state.resolvePath(path);
        if (!fileNode || fileNode.type !== 'file') {
          output.push(`node: cannot open file '${args[0]}': No such file or directory`);
          cls = 'error';
          break;
        }
        const fileName = path.split('/').pop();
        const content = fileNode.content || '';

        return {
          async: true,
          run: async (writeRow) => {
            writeRow(`[node] Executing script: ${args[0]}`);
            writeRow(`[node] Initializing isolated Web Worker context...`);
            
            const proc = this.spawnProcess(`node:${fileName}`);
            writeRow(`[node] Started process: pid ${proc.pid}`);

            try {
              const worker = new Worker('js/worker.js');
              proc.worker = worker;
              
              worker.onmessage = (msg) => {
                const { type, text, cls, callName, args: syscallArgs, id } = msg.data;
                if (type === 'log') {
                  writeRow(`[node PID ${proc.pid}] ${text}`, cls);
                } else if (type === 'syscall') {
                  try {
                    const result = this.syscall(`node:${fileName}`, callName, syscallArgs);
                    worker.postMessage({ type: 'syscall_response', id, result });
                  } catch (e) {
                    worker.postMessage({ type: 'syscall_response', id, error: e.message });
                    writeRow(`[node PID ${proc.pid}] Syscall error: ${e.message}`, 'error');
                  }
                } else if (type === 'done') {
                  writeRow(`[node PID ${proc.pid}] Process finished execution.`);
                  this.killProcess(proc.pid);
                }
              };

              worker.onerror = (err) => {
                writeRow(`[node PID ${proc.pid}] Worker exception: ${err.message}`, 'error');
                this.killProcess(proc.pid);
              };

              worker.postMessage({ type: 'start', code: content, path, env: this.state.env });
            } catch (err) {
              writeRow(`[node] Failed to spawn worker: ${err.message}`, 'error');
              this.killProcess(proc.pid);
            }
          }
        };
      }
      case 'uname':
        output.push(args.includes('-a') ? 'Astra astra-desktop 6.2.0-astra #1 SMP x86_64 GNU/Astra' : 'Astra');
        break;
      case 'date':
        output.push(new Date().toString());
        break;
      case 'df':
        output.push('Filesystem   Type   Size   Used   Avail  Use%  Mounted');
        output.push(...this.dfHuman());
        break;
      case 'free':
        output.push(...this.freeHuman());
        break;
      case 'dmesg':
        output.push(...this.dmesg(args[0] ? parseInt(args[0]) : 30));
        break;
      case 'clear':
        action = 'clear';
        break;
      case 'history':
        history.forEach((c, i) => output.push(`  ${i + 1}  ${c}`));
        break;
      case 'sysreset':
        output.push('⚠ Factory resetting Astra OS...');
        action = 'reset';
        break;
      case 'health': {
        const issues = this.state.runIntegrityChecks ? this.state.runIntegrityChecks() : [];
        if (issues.length === 0) {
          output.push('Astra OS health: OK');
        } else {
          output.push('Astra OS health: issues detected');
          issues.forEach(issue => output.push(`- ${issue}`));
          cls = 'warning';
        }
        break;
      }
      case 'cowsay': {
        if (!this.isPackageInstalled('cowsay')) {
          output.push('cowsay: command not found. Install with: apt install cowsay');
          cls = 'error';
          break;
        }
        const msg = args.join(' ') || 'Moo!';
        const pad = msg.length + 2;
        output.push(
          ' ' + '_'.repeat(pad),
          `< ${msg} >`,
          ' ' + '-'.repeat(pad),
          '        \\   ^__^',
          '         \\  (oo)\\_______',
          '            (__)\\       )\\/\\',
          '                ||----w |',
          '                ||     ||'
        );
        break;
      }
      case 'fortune': {
        if (!this.isPackageInstalled('fortune')) {
          output.push('fortune: command not found. Install with: apt install fortune');
          cls = 'error';
          break;
        }
        const fortunes = [
          'The best way to predict the future is to invent it. — Alan Kay',
          'Programs must be written for people to read, and only incidentally for machines to execute. — Abelson & Sussman',
          'Any sufficiently advanced technology is indistinguishable from magic. — Arthur C. Clarke',
          'First, solve the problem. Then, write the code. — John Johnson',
          'Talk is cheap. Show me the code. — Linus Torvalds',
          'The computer was born to solve problems that did not exist before. — Bill Gates',
          'The most disastrous thing that you can ever learn is your first programming language. — Alan Kay'
        ];
        output.push(Reflect.get(fortunes, Math.floor(Math.random() * fortunes.length)));
        break;
      }
      case 'sl': {
        if (!this.isPackageInstalled('sl')) {
          output.push('sl: command not found. Install with: apt install sl');
          cls = 'error';
          break;
        }
        output.push(
          '      ====        ________                ___________',
          '  _D _|  |_______/        \\__I_I_____===__|___________|',
          '   |(_)---  |   H\\________/ |   |        =|___ ___|',
          '   /     |  |   H  |  |     |   |         ||_| |_||',
          '  |      |  |   H  |__--------------------| [___] |',
          '  | ________|___H__/__|_____/[][]~\\_______|       |',
          '  |/ |   |-----------I_____I [][] []  D   |=======|__',
          '__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__',
          ' |/-=|___|=    ||    ||    ||    |_____/~\\___/        ',
          '  \\_/      \\O=====O=====O=====O_/      \\_/           '
        );
        break;
      }
      case 'figlet': {
        if (!this.isPackageInstalled('figlet')) {
          output.push('figlet: command not found. Install with: apt install figlet');
          cls = 'error';
          break;
        }
        const text = args.join(' ') || 'ASTRA';
        const bigMap = {
          'A': ['  █  ', ' █ █ ', '█████', '█   █', '█   █'],
          'B': ['████ ', '█   █', '████ ', '█   █', '████ '],
          'S': [' ████', '█    ', ' ███ ', '    █', '████ '],
          'T': ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
          'R': ['████ ', '█   █', '████ ', '█ █  ', '█  █ ']
        };
        const chars = text.toUpperCase().split('');
        for (let r = 0; r < 5; r++) {
          let line = '';
          chars.forEach(c => {
            const charLines = Reflect.get(bigMap, window.sanitizeKey(c));
            line += (charLines ? Reflect.get(charLines, r) : '     ') + ' ';
          });
          output.push(line);
        }
        break;
      }
      case 'agent':
        if (args[0] === 'status') {
          output.push('Agent System: ONLINE');
          output.push(`Active: PlannerAgent, ExecutorAgent, MemoryAgent, WatcherAgent, SafetyLayer`);
          output.push(`Tasks: ${this.state.agentTasks.filter(t => t.status === 'pending').length} pending, ${this.state.agentTasks.filter(t => t.status === 'completed').length} completed`);
        } else if (args[0] === 'run') {
          output.push('Initiating agent workflow...');
          cls = 'working';
          action = 'agent-run';
        } else {
          output.push('agent: usage: agent [status|run]');
          cls = 'error';
        }
        break;

      case 'jobs': {
        if (this.jobs.length === 0) {
          output.push('No active jobs.');
        } else {
          this.jobs.forEach(j => {
            output.push(`[${j.id}]  ${j.status.padEnd(10)}  ${j.command}`);
          });
        }
        break;
      }
      case 'fg': {
        let jobIdStr = args[0] || '';
        if (jobIdStr.startsWith('%')) jobIdStr = jobIdStr.substring(1);
        const jobId = parseInt(jobIdStr) || (this.jobs.length > 0 ? Reflect.get(this.jobs, this.jobs.length - 1).id : 0);
        if (!jobId) {
          output.push('fg: no current job');
          cls = 'error';
          break;
        }
        const job = this.jobs.find(j => j.id === jobId);
        if (!job) {
          output.push(`fg: ${jobId}: no such job`);
          cls = 'error';
          break;
        }
        output.push(`[${job.id}]  Foregrounded: ${job.command}`);
        job.outputBuffer.forEach(line => output.push(line));
        job.outputBuffer = [];
        if (job.status === 'Done') {
          output.push(`[${job.id}]  Done`);
          this.removeJob(job.id);
        } else {
          job.foreground = true;
        }
        return { output, cls, newDir, action, toast, foregroundJobId: job.status !== 'Done' ? job.id : null };
      }
      case 'bg': {
        if (this.jobs.length === 0) {
          output.push('bg: no current job');
        } else {
          this.jobs.forEach(j => {
            output.push(`[${j.id}]  ${j.status.padEnd(10)}  ${j.command}`);
          });
        }
        break;
      }

      default: {
        // PATH Executable Resolution — search PATH dirs for scripts
        const resolvedFile = this.resolveFromPath(cmd, currentDir);
        if (resolvedFile) {
          const fileContent = resolvedFile.content;
          const filePath = resolvedFile.path;

          // Shell script execution (sequential line-by-line interpreter)
          if (filePath.endsWith('.sh') || fileContent.trimStart().startsWith('#!/bin/sh')) {
            const scriptLines = fileContent.split('\n').filter(l => {
              const trimmed = l.trim();
              return trimmed && !trimmed.startsWith('#');
            });
            for (const line of scriptLines) {
              const lineRes = this.executeCommand(line.trim(), currentDir, history, stdin);
              if (lineRes.output) output.push(...lineRes.output);
              if (lineRes.newDir) newDir = lineRes.newDir;
              if (lineRes.cls === 'error') { cls = 'error'; break; }
            }
            break;
          }

          // JavaScript file execution via Web Worker sandbox
          if (filePath.endsWith('.js') || fileContent.trimStart().startsWith('#!/usr/bin/env node')) {
            const fName = filePath.split('/').pop();
            const fContent = fileContent;
            return {
              async: true,
              run: async (writeRow) => {
                writeRow('[exec] Running: ' + filePath);
                const proc = this.spawnProcess('exec:' + fName);
                writeRow('[exec] PID ' + proc.pid);
                try {
                  const worker = new Worker('js/worker.js');
                  proc.worker = worker;
                  worker.onmessage = (msg) => {
                    const { type, text, cls, callName, args: syscallArgs, id } = msg.data;
                    if (type === 'log') {
                      writeRow('[PID ' + proc.pid + '] ' + text, cls);
                    } else if (type === 'syscall') {
                      try {
                        const result = this.syscall('exec:' + fName, callName, syscallArgs);
                        worker.postMessage({ type: 'syscall_response', id, result });
                      } catch (e) {
                        worker.postMessage({ type: 'syscall_response', id, error: e.message });
                        writeRow('[PID ' + proc.pid + '] Syscall error: ' + e.message, 'error');
                      }
                    } else if (type === 'done') {
                      writeRow('[PID ' + proc.pid + '] Process finished.');
                      this.killProcess(proc.pid);
                    }
                  };
                  worker.onerror = (err) => {
                    writeRow('[PID ' + proc.pid + '] Worker exception: ' + err.message, 'error');
                    this.killProcess(proc.pid);
                  };
                  worker.postMessage({ type: 'start', code: fContent, path: filePath, env: this.state.env });
                } catch (err) {
                  writeRow('[exec] Failed to spawn worker: ' + err.message, 'error');
                  this.killProcess(proc.pid);
                }
              }
            };
          }
        }

        output.push(cmd + ': command not found. Type \'help\' for available commands.');
        cls = 'error';
      }
    }

    return {
      output,
      cls,
      newDir,
      action,
      toast
    };
  }
}

function sha256Sync(str) {
  function rotateRight(n, x) { return (x >>> n) | (x << (32 - n)); }
  function choice(x, y, z) { return (x & y) ^ (~x & z); }
  function majority(x, y, z) { return (x & y) ^ (x & z) ^ (y & z); }
  function sigma0(x) { return rotateRight(2, x) ^ rotateRight(13, x) ^ rotateRight(22, x); }
  function sigma1(x) { return rotateRight(6, x) ^ rotateRight(11, x) ^ rotateRight(25, x); }
  function gamma0(x) { return rotateRight(7, x) ^ rotateRight(18, x) ^ (x >>> 3); }
  function gamma1(x) { return rotateRight(17, x) ^ rotateRight(19, x) ^ (x >>> 10); }

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  const words = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    words.push(code & 0xff);
  }

  const byteLen = words.length;
  words.push(0x80);
  while ((words.length % 64) !== 56) {
    words.push(0x00);
  }

  const bitLen = byteLen * 8;
  const lenBytes = Array(8).fill(0);
  for (let i = 7; i >= 0; i--) {
    lenBytes[i] = (bitLen >>> ((7 - i) * 8)) & 0xff;
  }
  words.push(...lenBytes);

  for (let i = 0; i < words.length; i += 64) {
    const w = Array(64).fill(0);
    for (let t = 0; t < 16; t++) {
      w[t] = (words[i + t * 4] << 24) | (words[i + t * 4 + 1] << 16) | (words[i + t * 4 + 2] << 8) | words[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      w[t] = (gamma1(w[t - 2]) + w[t - 7] + gamma0(w[t - 15]) + w[t - 16]) | 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let t = 0; t < 64; t++) {
      const t1 = (h + sigma1(e) + choice(e, f, g) + K[t] + w[t]) | 0;
      const t2 = (sigma0(a) + majority(a, b, c)) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  return H.map(x => {
    const hex = (x >>> 0).toString(16);
    return hex.padStart(8, '0');
  }).join('');
}
