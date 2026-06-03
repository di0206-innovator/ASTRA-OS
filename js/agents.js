// ==========================================
// Astra OS Multi-Agent Simulation Engine
// ==========================================

export class AgentOrchestrator {
  constructor(state, ui) {
    this.state = state;
    this.ui = ui;
    this.activeWorkflow = false;
    this.currentStepIndex = 0;
    this.afkLogs = [];
    this.afkSummaryData = {
      duration: 0,
      tasksCompleted: 0,
      filesModified: [],
      memoriesCreated: 0,
      actionsList: []
    };
    this.isPaused = false;
    this.vfsSnapshots = {};
    this.autonomyTimer = null;
    this.startAutonomyLoop();
  }

  // ==========================================
  // Orchestration Hooks
  // ==========================================

  logAgent(agent, action, type = 'working') {
    const text = `[${agent}] ${action}`;
    this.state.withKernelWrite(() => {
      this.state.addAuditLog(agent, action);
    });
    
    // Print in Terminal if open
    if (window.printTerminalRow) {
      window.printTerminalRow(text);
    }
    
    // Print in AFK screensaver if open
    const afkLogsList = document.getElementById('afk-logs-list');
    const afkPhase = document.getElementById('afk-agent-phase');
    if (afkLogsList) {
      const row = document.createElement('div');
      row.className = `log-row ${type}`;
      row.textContent = text;
      afkLogsList.appendChild(row);
      afkLogsList.scrollTop = afkLogsList.scrollHeight;
    }
    if (afkPhase) {
      afkPhase.textContent = `${agent}: ${action}`;
    }

    // Keep history for AFK report
    if (this.state.systemVars.afkRunning) {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      this.afkSummaryData.actionsList.push({
        action: text,
        time: time
      });
    }

    // Refresh Dashboard logs and main sidebar status
    const statusPill = document.getElementById('agent-status-pill');
    if (statusPill) {
      const textSpan = statusPill.querySelector('.status-text');
      const pulseSpan = statusPill.querySelector('.status-pulse');
      textSpan.textContent = `Astra: ${agent} (${action.substring(0,18)}...)`;
      pulseSpan.className = 'status-pulse working';
    }

    if (window.refreshDashboardLogs) window.refreshDashboardLogs();
  }

  setAgentIdle() {
    const statusPill = document.getElementById('agent-status-pill');
    if (statusPill) {
      statusPill.querySelector('.status-text').textContent = 'Astra: Idle';
      statusPill.querySelector('.status-pulse').className = 'status-pulse';
    }
  }

  startAutonomyLoop() {
    if (this.autonomyTimer) return;
    this.autonomyTimer = setInterval(() => {
      this.state.withKernelWrite(() => {
        const latest = this.state.workflows?.[0];
        if (!latest) return;
        if (latest.status === 'queued') {
          this.state.recordApproval(latest.id, {
            actor: 'System',
            decision: 'monitor',
            note: 'Autonomy loop observed queued workflow'
          });
          this.state.updateWorkflow(latest.id, { status: 'observed' });
          this.state.addNotification('info', 'Agent Monitor', `Observed workflow: ${latest.goal}`);
        }
        if (this.state.runIntegrityChecks) {
          const issues = this.state.runIntegrityChecks();
          if (issues.length > 0) {
            this.state.addNotification('warning', 'Agent Monitor', `Integrity issues detected: ${issues.length}`);
          }
        }
      });
    }, 60000);
  }

  getWorkspaceForGoal(goalText = '') {
    const lowerGoal = goalText.toLowerCase();
    if (lowerGoal.includes('satellite')) return '/Satellite_Defense';
    return '/Project_Astra';
  }

  inspectWorkspace(workspacePath) {
    const dir = this.state.resolvePath(workspacePath);
    const children = dir?.children || {};
    const fileNames = Object.keys(children);
    const readFile = (name) => {
      const node = Reflect.get(children, window.sanitizeKey(name));
      return node?.type === 'file' ? (node.content || '') : '';
    };

    const packageContent = readFile('package.json');
    let packageJson = null;
    if (packageContent) {
      try {
        packageJson = JSON.parse(packageContent);
      } catch (err) {
        packageJson = null;
      }
    }

    const readme = readFile('README.md');
    const indexJs = readFile('index.js');
    const controlJs = readFile('control.js');
    const primarySource = indexJs || controlJs;
    const todoMatches = primarySource.match(/TODO:.*/g) || [];
    const endpointMatches = [...primarySource.matchAll(/app\.(get|post|put|delete)\(['"`]([^'"`]+)['"`]/g)]
      .map(match => ({ method: match[1].toUpperCase(), path: match[2] }));

    return {
      workspacePath,
      workspaceName: workspacePath.split('/').pop(),
      fileNames,
      readme,
      primarySource,
      packageJson,
      todoMatches,
      endpointMatches,
      hasHealthEndpoint: endpointMatches.some(endpoint => endpoint.path === '/health'),
      hasCouncilTodo: primarySource.includes('agent council communication'),
      hasExpressDependency: !!packageJson?.dependencies?.express
    };
  }

  buildWorkflowTasks(goalText, workspace) {
    const lowerGoal = goalText.toLowerCase();
    if (lowerGoal.includes('report')) {
      return [
        { id: 'task-report-1', title: 'Inspect active workspace', desc: 'Read workspace metadata and operating state before producing the report', status: 'pending', assigned: 'PlannerAgent', action: 'fs:read', path: `${workspace.workspacePath}/package.json` },
        { id: 'task-report-2', title: 'Compile system report', desc: 'Write a system report derived from live hardware and workspace diagnostics', status: 'pending', assigned: 'ExecutorAgent', action: 'fs:write', path: '/home/divyanshu/system_report.md' },
        { id: 'task-report-3', title: 'Verify system report formatting', desc: 'Verify the written report details, metrics, and workspace summary', status: 'pending', assigned: 'WatcherAgent', action: 'verify:report', path: '/home/divyanshu/system_report.md' },
        { id: 'task-report-4', title: 'Open system report in editor', desc: 'Ensure the generated report is visible to the user in the file editor', status: 'pending', assigned: 'MemoryAgent', action: 'editor:open', path: '/home/divyanshu/system_report.md' }
      ];
    }

    if (lowerGoal.includes('audit')) {
      return [
        { id: 'task-audit-1', title: 'Inspect package and scripts', desc: 'Read dependency and build metadata from the workspace package definition', status: 'pending', assigned: 'PlannerAgent', action: 'fs:read', path: `${workspace.workspacePath}/package.json` },
        { id: 'task-audit-2', title: 'Inspect architecture notes', desc: 'Read the workspace documentation to compare intended and implemented behavior', status: 'pending', assigned: 'PlannerAgent', action: 'fs:read', path: `${workspace.workspacePath}/README.md` },
        { id: 'task-audit-3', title: 'Write workspace audit report', desc: 'Write an audit report grounded in the current workspace contents and TODOs', status: 'pending', assigned: 'ExecutorAgent', action: 'fs:write', path: `${workspace.workspacePath}/audit_report.md` },
        { id: 'task-audit-4', title: 'Verify project build status', desc: 'Run a simulated build verification pass tied to the workspace build script and source state', status: 'pending', assigned: 'WatcherAgent', action: 'npm run build' },
        { id: 'task-audit-5', title: 'Seed actionable improvement tasks', desc: 'Convert audit recommendations into task board items', status: 'pending', assigned: 'ExecutorAgent', action: 'task:add', path: `${workspace.workspacePath}/audit_report.md` },
        { id: 'task-audit-6', title: 'Update semantic memory graph', desc: 'Link the audit artifact back into persistent memory', status: 'pending', assigned: 'MemoryAgent', action: 'state:addMemoryNode', path: `${workspace.workspacePath}/audit_report.md` }
      ];
    }

    if (lowerGoal.includes('build') || lowerGoal.includes('implement') || lowerGoal.includes('route') || lowerGoal.includes('astra')) {
      return [
        { id: 'task-1', title: 'Parse active workspace context', desc: 'Read the active workspace documentation and source to identify missing implementation boundaries', status: 'pending', assigned: 'PlannerAgent', action: 'fs:read', path: `${workspace.workspacePath}/README.md` },
        { id: 'task-2', title: 'Implement workspace source change', desc: 'Modify the primary source file to satisfy the requested build goal', status: 'pending', assigned: 'ExecutorAgent', action: 'fs:write', path: `${workspace.workspacePath}/index.js` },
        { id: 'task-3', title: 'Compile and build workspace source', desc: 'Run build verification against the workspace build entrypoint', status: 'pending', assigned: 'WatcherAgent', action: 'npm run build' },
        { id: 'task-4', title: 'Link implementation notes in README', desc: 'Document the implemented behavior inside the workspace README', status: 'pending', assigned: 'MemoryAgent', action: 'fs:write', path: `${workspace.workspacePath}/README.md` }
      ];
    }

    return [
      { id: 'task-1', title: 'Inspect current workspace', desc: 'Read the active workspace documentation to establish context', status: 'pending', assigned: 'PlannerAgent', action: 'fs:read', path: `${workspace.workspacePath}/README.md` },
      { id: 'task-2', title: 'Inspect primary source file', desc: 'Read the main source file to identify the next actionable change', status: 'pending', assigned: 'ExecutorAgent', action: 'fs:read', path: `${workspace.workspacePath}/index.js` },
      { id: 'task-3', title: 'Run integrity and verification suite', desc: 'Confirm the active workspace remains internally consistent after inspection', status: 'pending', assigned: 'WatcherAgent', action: 'npm run build' }
    ];
  }

  generateSystemReport(workspace) {
    const cpu = window.AstraKernel ? window.AstraKernel.getTotalCpu() : '1.5';
    const mem = window.AstraKernel ? window.AstraKernel.getTotalMem() : '120';
    const uptime = window.AstraKernel ? window.AstraKernel.getUptime() : '42s';
    const totalRam = (window.AstraKernel && window.AstraKernel.state.hardware?.ram?.totalGB) || '32';
    const buildScript = workspace.packageJson?.scripts?.build || 'Unavailable';
    const dependencies = workspace.packageJson?.dependencies ? Object.keys(workspace.packageJson.dependencies) : [];

    return `# Astra OS System Performance Report
Date: ${new Date().toLocaleString()}
Host: astra-desktop
Uptime: ${uptime}

## Hardware Utilization
- **CPU Usage:** ${cpu}%
- **Memory Usage:** ${mem}MB / ${parseInt(totalRam, 10) * 1024}MB
- **Active Processes:** ${window.AstraKernel ? window.AstraKernel.listProcesses().length : 8} processes

## Active Workspace Snapshot
- **Workspace:** ${workspace.workspaceName}
- **Files Indexed:** ${workspace.fileNames.length}
- **Build Script:** \`${buildScript}\`
- **Dependencies:** ${dependencies.length > 0 ? dependencies.join(', ') : 'None declared'}
- **Discovered Endpoints:** ${workspace.endpointMatches.length > 0 ? workspace.endpointMatches.map(endpoint => `${endpoint.method} ${endpoint.path}`).join(', ') : 'No explicit routes found'}

## Agent Diagnostics
- **Sandbox Status:** Scoped to workspace and user home
- **Syscall Audit Trail:** Active
- **IndexedDB State Status:** Verified & Healthy
- **Open TODO Count:** ${workspace.todoMatches.length}
`;
  }

  generateAuditReport(workspace) {
    const deps = workspace.packageJson?.dependencies ? Object.entries(workspace.packageJson.dependencies) : [];
    const recommendations = [];

    if (workspace.hasCouncilTodo) {
      recommendations.push('Implement the pending agent council route instead of leaving a TODO in the primary source.');
    }
    if (!workspace.hasHealthEndpoint) {
      recommendations.push('Add an explicit health endpoint so runtime checks have a stable probe target.');
    }
    if (!workspace.packageJson?.scripts?.test) {
      recommendations.push('Add at least one runnable workspace test command to make verification less theatrical.');
    }
    if (workspace.todoMatches.length === 0) {
      recommendations.push('Introduce a next-step TODO or roadmap marker so the agent can surface concrete unfinished work.');
    }

    const recommendationLines = recommendations.length > 0
      ? recommendations.map((item, index) => `${index + 1}. [ ] ${item}`).join('\n')
      : '1. [ ] No critical gaps detected in the seeded workspace sample.';

    return `# Astra OS Workspace Audit Report
Date: ${new Date().toLocaleString()}
Project: ${workspace.workspaceName}
Path: ${workspace.workspacePath}

## Workspace Inventory
- **Files:** ${workspace.fileNames.join(', ')}
- **Dependencies:** ${deps.length > 0 ? deps.map(([name, version]) => `${name}@${version}`).join(', ') : 'None declared'}
- **Documented Endpoints:** ${workspace.endpointMatches.length > 0 ? workspace.endpointMatches.map(endpoint => `${endpoint.method} ${endpoint.path}`).join(', ') : 'None'}
- **Outstanding TODOs:** ${workspace.todoMatches.length}

## Security and Reliability Findings
- **Sandbox Boundaries:** Agent-accessible workspace remains scoped and project paths outside user space are still policy-controlled.
- **Build Entrypoint:** ${workspace.packageJson?.scripts?.build ? `Present (\`${workspace.packageJson.scripts.build}\`)` : 'Missing build script'}
- **Health Probe:** ${workspace.hasHealthEndpoint ? 'Implemented' : 'Missing'}
- **Agent Council Route:** ${workspace.hasCouncilTodo ? 'Still unimplemented and represented as a TODO' : 'Present or not applicable'}

## Recommended Next Actions
${recommendationLines}
`;
  }

  // ==========================================
  // Core Workflow Demo
  // ==========================================
  
  autoResumeWorkflows() {
    const activeWf = this.state.workflows?.find(w => w.status === 'observed' || w.status === 'progress' || w.status === 'approved' || w.status === 'waiting_approval' || w.status === 'running');
    if (activeWf) {
      this.logAgent('System', `Detected unfinished workflow: "${activeWf.goal}". Auto-resuming...`);
      this.resumeWorkflow(activeWf);
    }
  }

  async resumeWorkflow(workflow) {
    if (this.activeWorkflow) return;
    this.activeWorkflow = true;
    this.currentWorkflow = workflow;
    this.vfsSnapshots = {};
    this.isPaused = false;
    
    if (workflow.status === 'observed') {
      this.logAgent('System', `Workflow pending plan approval. Please approve from the console.`);
      this.activeWorkflow = false;
      this.setAgentIdle();
      if (window.refreshWorkflowApp) window.refreshWorkflowApp();
      return;
    }
    
    const completedCount = workflow.steps.filter(s => s.status === 'completed' && s.title !== 'Draft execution plan').length;
    this.logAgent('PlannerAgent', `Resumed workflow at step ${completedCount + 1} with goal: "${workflow.goal}"`);
    this.executeWorkflowSteps(completedCount);
  }

  async startWorkflow(userPrompt) {
    if (this.activeWorkflow) return;
    this.state.withKernelWrite(() => {
      this.activeWorkflow = true;
      this.vfsSnapshots = {};
      this.isPaused = false;
      this.currentWorkflow = this.state.createWorkflow(
        userPrompt,
        userPrompt,
        this.state.currentSession.currentUser || 'User'
      );
      this.state.systemVars.tokensConsumed += 1240;
      this.state.saveState();
    });

    this.executeWorkflowSteps(0);
  }

  async executeWorkflowSteps(startStepIndex) {
    return this.state.withKernelWrite(async () => {
      const workflow = this.currentWorkflow;
      if (!workflow) return;
      const lowerGoal = workflow.goal.toLowerCase();
      const workspace = this.inspectWorkspace(this.getWorkspaceForGoal(workflow.goal));

      try {
        if (startStepIndex <= 0 && workflow.steps.length === 0) {
          this.logAgent('PlannerAgent', `Analyzing goal: "${workflow.goal}"`);
          await this.delay(1000);

          const failures = this.state.failureMemory || [];
          if (failures.length > 0) {
            this.logAgent('PlannerAgent', `Retrieved ${failures.length} historical failure events from memory. Applying avoidance strategies.`);
            await this.delay(500);
          }

          this.logAgent('PlannerAgent', 'Created orchestration checklist. Assigned tasks to specialized agents.');
          this.state.agentTasks = this.buildWorkflowTasks(workflow.goal, workspace);
          
          this.state.appendWorkflowStep(workflow.id, {
            title: 'Draft execution plan',
            assigned: 'PlannerAgent',
            status: 'completed',
            confidence: 98,
            reason: 'Formulate chronological checklist to fulfill target user goal',
            target: 'System Plan Board',
            outcome: `Assigned ${this.state.agentTasks.length} tasks using live workspace inspection of ${workspace.workspacePath}`,
            verification: `Workspace files indexed: ${workspace.fileNames.join(', ')}`
          });
          
          this.state.updateWorkflow(workflow.id, { status: 'observed' });
          this.state.saveState();
          if (window.refreshTasksBoard) window.refreshTasksBoard();
          if (window.refreshWorkflowApp) window.refreshWorkflowApp();
          this.ui.showToast('Plan Drafted', `PlannerAgent created tasks. Waiting for plan approval.`, 'info');
          this.activeWorkflow = false;
          this.setAgentIdle();
          return;
        }

        if (workflow.status === 'observed') {
          this.logAgent('System', `Workflow plan pending user approval. Halting.`);
          this.activeWorkflow = false;
          this.setAgentIdle();
          return;
        }

        this.state.updateWorkflow(workflow.id, { status: 'progress' });

        let stepIndex = startStepIndex;
        
        while (stepIndex < this.state.agentTasks.length) {
          const task = this.state.agentTasks[stepIndex];
          this.currentAgentId = task.assigned;
          
          this.saveCheckpoint(workflow.id, stepIndex);
          
          this.logAgent(task.assigned, `Running task: ${task.title}`);
          this.state.updateTaskStatus(task.id, 'progress');
          if (window.refreshTasksBoard) window.refreshTasksBoard();
          
          await this.delay(1000);

          const agentProc = window.AstraKernel.spawnProcess(task.assigned, 1, workflow.id);
          const agentToken = agentProc.token;

          if (task.action === 'fs:read') {
            this.logAgent(task.assigned, `Reading content of ${task.path}`);
            
            const syscallRes = await window.Astra.syscall(agentToken, 'fs:read', task.path);
            
            if (syscallRes.status === 'success') {
              this.state.appendWorkflowStep(workflow.id, {
                title: `Read ${task.path.split('/').pop()}`,
                assigned: task.assigned,
                status: 'completed',
                confidence: 95,
                reason: task.desc,
                target: task.path,
                outcome: `Read file contents of ${task.path}`,
                verification: 'File exists and permission checks passed'
              });
              this.state.updateTaskStatus(task.id, 'completed');
            } else {
              throw new Error(`fs:read failed: ${syscallRes.error?.message || 'unknown error'}`);
            }
            
          } else if (task.action === 'fs:write') {
            this.logAgent(task.assigned, `Requesting safety clearance to modify ${task.path}`);
            
            let details = `Modify code inside ${task.path.split('/').pop()}`;
            let codeToInject = '';
            let replacedCode = '';
            
            const readRes = await window.Astra.syscall(agentToken, 'fs:read', task.path);
            const originalCode = readRes.status === 'success' ? readRes.result : '';
            
            if (task.path.endsWith('index.js')) {
              details = 'Inject new routing endpoints for Astra Agent Council inside index.js.';
              const injectionTarget = `// TODO: Implement the express endpoints for agent council communication`;
              
              if (task.recoveryFix) {
                codeToInject = `// Implement the express endpoints for agent council communication
app.post('/api/v1/council', (req, res) => {
  const { command, payload } = req.body;
  console.log(\`[Council] Received instruction: \${window.escapeHTML(command)}\`);
  res.status(200).json({ success: true, message: 'Command queued' });
});`;
              } else {
                codeToInject = `// Implement the express endpoints for agent council communication
app.post('/api/v1/council', (req, res) => {
  const { command, payload } = req.body;
  console.log(\`[Council] Received instruction: \${window.escapeHTML(command)})\`);
  res.status(200).json({ success: true, message: 'Command queued' });
});`;
              }
              replacedCode = originalCode.replace(injectionTarget, codeToInject);
            } else if (task.path.endsWith('README.md')) {
              details = 'Document gateway routes in README.md';
              codeToInject = '\n### Council Endpoint\n- **URL:** `/api/v1/council`\n- **Method:** `POST`\n- **Payload:** `{ "command": String, "payload": Object }`\n';
              replacedCode = originalCode + codeToInject;
            } else if (task.path.endsWith('system_report.md')) {
              details = `Compile system report using live diagnostics and ${workspace.workspaceName} workspace data`;
              codeToInject = this.generateSystemReport(workspace);
              replacedCode = codeToInject;
            } else if (task.path.endsWith('audit_report.md')) {
              details = `Write workspace audit report derived from ${workspace.workspacePath}`;
              codeToInject = this.generateAuditReport(workspace);
              replacedCode = codeToInject;
            } else {
              replacedCode = originalCode + '\n// Astra Agent modification\n';
            }

            this.backupFileBeforeChange(task.path);

            const writeRes = await window.Astra.syscall(agentToken, 'fs:write', task.path, replacedCode);
            
            if (writeRes.status === 'denied') {
              this.logAgent('SafetyLayer', 'Permission denied. Halting execution loop.', 'alert');
              this.state.updateWorkflow(workflow.id, { status: 'waiting_approval' });
              this.ui.showToast('Orchestration Suspended', 'Safety layer requires verification or approval.', 'warning');
              
              if (!this.state.failureMemory) this.state.failureMemory = [];
              this.state.failureMemory.push({
                id: `fail-${Date.now()}`,
                workflowGoal: workflow.goal,
                taskTitle: task.title,
                errorType: 'PERMISSION_DENIED',
                details: 'Safety layer policy verification required',
                timestamp: Date.now()
              });
              
              this.state.saveState();
              this.activeWorkflow = false;
              this.setAgentIdle();
              if (window.refreshWorkflowApp) window.refreshWorkflowApp();
              return;
            } else if (writeRes.status === 'error') {
              throw new Error(`fs:write failed: ${writeRes.error?.message || 'unknown error'}`);
            }
            
            this.logAgent('SafetyLayer', 'Permission approved. Resuming execution task.', 'success');
            await this.delay(500);
            
            this.logAgent(task.assigned, `Writing modifications inside ${task.path}`);
            
            this.ui.openApp('editor');
            const textarea = document.getElementById('editor-text-area') || document.getElementById('editor-content');
            if (textarea) {
              if (window.editorOpenFile) {
                window.editorOpenFile(task.path);
              }
              if (textarea.id === 'editor-text-area' && task.path.endsWith('index.js')) {
                await this.animateEditorTyping(textarea, originalCode, `// TODO: Implement the express endpoints for agent council communication`, codeToInject);
              } else {
                textarea.value = replacedCode;
              }
            }
            
            this.ui.showToast('Task Completed', `${task.assigned} modified ${task.path.split('/').pop()}.`, 'success');
            
            this.state.appendWorkflowStep(workflow.id, {
              title: task.recoveryFix ? 'Fix syntax mismatch' : `Modify ${task.path.split('/').pop()}`,
              assigned: task.assigned,
              status: 'completed',
              confidence: 93,
              reason: task.desc,
              target: task.path,
              outcome: `Injected code patch into ${task.path}`,
              verification: task.recoveryFix ? 'Resolved double parenthesis' : 'Syntax validation pending build compilation'
            });
            this.state.updateTaskStatus(task.id, 'completed');
            this.afkSummaryData.filesModified.push(task.path);
            this.afkSummaryData.tasksCompleted++;
            
          } else if (task.action === 'npm run build') {
            this.logAgent(task.assigned, 'Verifying compilation and build integrity...');
            this.ui.openApp('terminal');
            await this.delay(500);
            
            this.logAgent(task.assigned, 'Running command inside terminal: npm run build');
            if (window.printTerminalRow) {
              window.printTerminalRow('divyanshu@astra:~$ npm run build');
            }
            
            const stepHistory = workflow.steps.filter(s => s.title.includes('Verify build'));
            const isRetry = stepHistory.length > 0;
            
            await this.delay(1000);
            
            const spawnRes = await window.Astra.syscall(agentToken, 'proc:spawn', 'npm', 1);
            
            if (spawnRes.status === 'success') {
              if (!isRetry && task.id === 'task-3') {
                if (window.printTerminalRow) {
                  window.printTerminalRow('  [1/2] Parsing configurations...');
                  window.printTerminalRow('  [2/2] Validating node AST structures...');
                  window.printTerminalRow('  Error: SyntaxError: Unexpected token ) in index.js on line 20');
                  window.printTerminalRow('  Build failed.');
                }
                this.logAgent(task.assigned, 'Build compilation failed. Intercepted syntax error.', 'alert');
                this.ui.showToast('Build Failed', 'Compiler syntax error detected.', 'error');
                
                if (!this.state.failureMemory) this.state.failureMemory = [];
                this.state.failureMemory.push({
                  id: `fail-${Date.now()}`,
                  workflowGoal: workflow.goal,
                  taskTitle: task.title,
                  errorType: 'SYNTAX_ERROR',
                  details: 'Unexpected token ) in index.js on line 20',
                  timestamp: Date.now()
                });
                this.state.saveState();
                
                this.state.appendWorkflowStep(workflow.id, {
                  title: 'Verify build compilation',
                  assigned: task.assigned,
                  status: 'failed',
                  error: 'SYNTAX_ERROR',
                  confidence: 45,
                  reason: 'Run validation build on Project Astra gateway index file',
                  target: 'npm run build',
                  outcome: 'Build compilation failed due to syntax error',
                  verification: 'Unexpected token ) in index.js on line 20'
                });
                
                await this.delay(1000);
                
                this.logAgent('PlannerAgent', 'Adapting plan: Created dynamic task to solve compilation syntax error.', 'alert');
                this.state.agentTasks.splice(stepIndex + 1, 0, {
                  id: 'task-fix',
                  title: 'Fix compiler syntax error',
                  desc: 'Verify and resolve double parenthesis syntax error inside index.js',
                  status: 'pending',
                  assigned: 'ExecutorAgent',
                  action: 'fs:write',
                  path: '/Project_Astra/index.js',
                  recoveryFix: true
                });
                this.state.saveState();
                if (window.refreshTasksBoard) window.refreshTasksBoard();
                
                this.state.updateTaskStatus(task.id, 'pending');
                await this.delay(1000);
                
              } else {
                if (window.printTerminalRow) {
                  window.printTerminalRow('  [1/2] Parsing configurations...');
                  window.printTerminalRow('  [2/2] Validating node AST structures...');
                  window.printTerminalRow('  Build complete. Output bundle verified successfully.');
                }
                this.logAgent(task.assigned, 'Build compiled successfully without errors.', 'success');
                this.ui.showToast('Build Passed', 'Gateway compiled cleanly.', 'success');
                
                this.state.appendWorkflowStep(workflow.id, {
                  title: isRetry ? 'Verify build compilation retry' : 'Verify build compilation',
                  assigned: task.assigned,
                  status: 'completed',
                  confidence: 99,
                  reason: 'Run validation build on Project Astra gateway index file',
                  target: 'npm run build',
                  outcome: 'Build compiled successfully without errors',
                  verification: 'Output bundle verified successfully'
                });
                this.state.updateTaskStatus(task.id, 'completed');
                this.afkSummaryData.tasksCompleted++;
              }
            } else {
              throw new Error(`proc:spawn build failed: ${spawnRes.error?.message || 'unknown error'}`);
            }
          } else if (task.action === 'verify:report') {
            this.logAgent(task.assigned, 'Validating report syntax and resource stats metrics...');
            await this.delay(1000);
            
            const fileNode = this.state.resolvePath(task.path);
            const content = fileNode ? fileNode.content : '';
            const hasMetrics = content.includes('Uptime:') && content.includes('CPU Usage:') && content.includes('Memory Usage:');
            const hasWorkspaceSummary = content.includes('## Active Workspace Snapshot') || content.includes('## Workspace Inventory');
            if (hasMetrics && hasWorkspaceSummary) {
              this.logAgent(task.assigned, 'Report verification succeeded. All hardware metric lines present.', 'success');
              this.state.appendWorkflowStep(workflow.id, {
                title: 'Verify system report metrics',
                assigned: task.assigned,
                status: 'completed',
                confidence: 99,
                reason: task.desc,
                target: task.path,
                outcome: 'Metrics and markdown structure validated successfully',
                verification: 'Metrics block and workspace summary block are present'
              });
              this.state.updateTaskStatus(task.id, 'completed');
              this.afkSummaryData.tasksCompleted++;
            } else {
              throw new Error('Verification failed: Report is missing metric or workspace summary fields.');
            }
          } else if (task.action === 'editor:open') {
            this.logAgent(task.assigned, `Opening ${task.path} inside Code Editor...`);
            this.ui.openApp('editor');
            if (window.editorOpenFile) {
              await window.editorOpenFile(task.path);
            }
            await this.delay(500);
            this.state.appendWorkflowStep(workflow.id, {
              title: `Open ${task.path.split('/').pop()} in Editor`,
              assigned: task.assigned,
              status: 'completed',
              confidence: 98,
              reason: task.desc,
              target: task.path,
              outcome: `Opened file in editor viewport`,
              verification: 'Editor process rendered file successfully'
            });
            this.state.updateTaskStatus(task.id, 'completed');
            this.afkSummaryData.tasksCompleted++;
          } else if (task.action === 'task:add') {
            this.logAgent(task.assigned, 'Seeding actionable improvement tasks from audit recommendations...');
            await this.delay(1000);
            
            const recommendations = this.generateAuditReport(workspace)
              .split('## Recommended Next Actions\n')[1]
              ?.split('\n')
              .map(line => line.trim())
              .filter(line => /^\d+\.\s+\[\s\]/.test(line))
              .map(line => line.replace(/^\d+\.\s+\[\s\]\s+/, '')) || [];

            for (const recommendation of recommendations.slice(0, 3)) {
              await window.Astra.syscall(agentToken, 'task:add', recommendation, `Generated from workspace audit for ${workspace.workspaceName}`, 'pending', 'User');
            }
            
            this.state.appendWorkflowStep(workflow.id, {
              title: 'Seed actionable tasks',
              assigned: task.assigned,
              status: 'completed',
              confidence: 97,
              reason: task.desc,
              target: 'Task Board',
              outcome: `Added ${Math.min(recommendations.length, 3)} audit-derived tasks for the user to address`,
              verification: 'Created task records on database'
            });
            this.state.updateTaskStatus(task.id, 'completed');
            this.afkSummaryData.tasksCompleted++;
            if (window.refreshTasksBoard) window.refreshTasksBoard();
          } else if (task.action === 'state:addMemoryNode') {
            this.logAgent(task.assigned, 'Linking audit results to persistent semantic memory graph...');
            await this.delay(1000);
            
            await window.Astra.syscall(agentToken, 'state:addMemoryNode', 'report-audit', 'File: audit_report.md', 'document');
            await window.Astra.syscall(agentToken, 'state:addMemoryLink', 'usr-divyanshu', 'report-audit', 'audited');
            
            this.state.appendWorkflowStep(workflow.id, {
              title: 'Link semantic memory',
              assigned: task.assigned,
              status: 'completed',
              confidence: 99,
              reason: task.desc,
              target: 'AI Memory Graph',
              outcome: 'Added audit report memory nodes and user link associations',
              verification: 'Memory graph updated'
            });
            this.state.updateTaskStatus(task.id, 'completed');
            this.afkSummaryData.tasksCompleted++;
            if (window.refreshSidebarMemories) window.refreshSidebarMemories();
            if (window.drawMemoryGraphApp) window.drawMemoryGraphApp();
          }
          
          this.state.saveState();
          if (window.refreshTasksBoard) window.refreshTasksBoard();
          
          stepIndex++;
          await this.delay(1000);
        }
        
        const finalAgentProc = window.AstraKernel.spawnProcess('MemoryAgent', 1, workflow.id);
        const finalAgentToken = finalAgentProc.token;
        
        if (lowerGoal.includes('report')) {
          this.logAgent('MemoryAgent', 'Recording system report node inside semantic index');
          await window.Astra.syscall(finalAgentToken, 'state:addMemoryNode', 'report-system', 'File: system_report.md', 'document');
          await window.Astra.syscall(finalAgentToken, 'state:addMemoryLink', 'usr-divyanshu', 'report-system', 'generated');
          this.afkSummaryData.memoriesCreated += 1;
        } else if (lowerGoal.includes('audit')) {
          this.logAgent('MemoryAgent', 'Updating workspace audit associations in knowledge graph');
          await window.Astra.syscall(finalAgentToken, 'state:addMemoryNode', 'report-audit', 'File: audit_report.md', 'document');
          await window.Astra.syscall(finalAgentToken, 'state:addMemoryLink', 'usr-divyanshu', 'report-audit', 'audited');
          await window.Astra.syscall(finalAgentToken, 'state:addMemoryLink', 'report-audit', 'app-editor', 'references');
          this.afkSummaryData.memoriesCreated += 2;
        } else {
          this.logAgent('MemoryAgent', 'Parsing index.js routing endpoints to update semantic index');
          await window.Astra.syscall(finalAgentToken, 'state:addMemoryNode', 'endpoint-council', 'Route: /api/v1/council', 'endpoint');
          await window.Astra.syscall(finalAgentToken, 'state:addMemoryLink', 'file-index', 'endpoint-council', 'defines');
          await window.Astra.syscall(finalAgentToken, 'state:addMemoryLink', 'usr-divyanshu', 'endpoint-council', 'interacts_with');
          this.afkSummaryData.memoriesCreated += 2;
        }
        
        this.state.appendWorkflowStep(workflow.id, {
          title: 'Update memory relationships',
          assigned: 'MemoryAgent',
          status: 'completed',
          confidence: 97,
          reason: 'Link definitions and user associations inside knowledge base',
          target: 'AI Memory Graph',
          outcome: lowerGoal.includes('report') ? 'Recorded system report node' : (lowerGoal.includes('audit') ? 'Recorded workspace audit node' : 'Recorded semantic memory node for council endpoint'),
          verification: 'Memory link relationships populated'
        });
        if (window.refreshSidebarMemories) window.refreshSidebarMemories();
        if (window.drawMemoryGraphApp) window.drawMemoryGraphApp();
        
        this.logAgent('System', 'Astra orchestration tasks completed successfully.', 'success');
        this.ui.showToast('Orchestration Succeeded', 'Astra finished all delegated tasks.', 'success');
        
        this.state.updateWorkflow(workflow.id, { status: 'completed' });
        this.setAgentIdle();
        this.activeWorkflow = false;

        if (window.refreshExplorerGrid) window.refreshExplorerGrid();
        if (window.refreshWorkflowApp) window.refreshWorkflowApp();
      } catch (err) {
        this.logAgent('System', `Workflow failed: ${err.message}`, 'alert');
        this.state.updateWorkflow(workflow.id, { status: 'failed' });
        this.setAgentIdle();
        this.activeWorkflow = false;
        if (window.refreshWorkflowApp) window.refreshWorkflowApp();
      }
    });
  }

  // ==========================================
  // Helper Delay
  // ==========================================
  
  async delay(ms) {
    let elapsed = 0;
    const interval = 100;
    while (elapsed < ms) {
      if (this.isPaused) {
        await new Promise(resolve => setTimeout(resolve, interval));
      } else {
        await new Promise(resolve => setTimeout(resolve, interval));
        elapsed += interval;
      }
    }
  }

  togglePauseWorkflow() {
    this.isPaused = !this.isPaused;
    this.logAgent('System', this.isPaused ? 'Agent execution paused.' : 'Agent execution resumed.', 'info');
    const pauseBtn = document.getElementById('afk-pause-btn');
    if (pauseBtn) {
      pauseBtn.textContent = this.isPaused ? '▶ Resume Agent' : '⏸ Pause Agent';
    }
    const spinner = document.querySelector('.afk-spinner');
    if (spinner) {
      if (this.isPaused) {
        spinner.style.animationPlayState = 'paused';
      } else {
        spinner.style.animationPlayState = 'running';
      }
    }
  }

  backupFileBeforeChange(path) {
    this.state.withKernelWrite(() => {
      const currentWf = this.currentWorkflow;
      if (currentWf) {
        const step = currentWf.steps[currentWf.steps.length - 1];
        if (step) {
          step.backups = step.backups || {};
          if (step.backups[path] === undefined) {
            const fileNode = this.state.resolvePath(path);
            step.backups[path] = fileNode ? fileNode.content : null;
            this.state.saveState();
          }
        }
      }
    });
    if (Reflect.get(this.vfsSnapshots, path) === undefined) {
      const fileNode = this.state.resolvePath(path);
      Reflect.set(this.vfsSnapshots, path, fileNode ? fileNode.content : null);
    }
  }

  async rollbackWorkflowStep(workflowId, stepId) {
    const wf = this.state.workflows.find(w => w.id === workflowId);
    if (!wf) return false;
    const step = wf.steps.find(s => s.id === stepId);
    if (!step || !step.backups) return false;
    
    for (const [path, content] of Object.entries(step.backups)) {
      try {
        if (content === null) {
          await window.Astra.syscall('fs:delete', path);
        } else {
          await window.Astra.syscall('fs:write', path, content);
        }
      } catch (err) {
        console.error("Failed syscall in rollbackWorkflowStep", err);
      }
    }
    this.state.withKernelWrite(() => {
      step.status = 'rolled_back';
      this.state.saveState();
    });
    if (window.refreshExplorerGrid) window.refreshExplorerGrid();
    return true;
  }

  /**
   * Save a checkpoint (snapshot) of the current workflow state at a specific step.
   * This captures the task list, VFS snapshots, and step index for point-in-time recovery.
   */
  saveCheckpoint(workflowId, stepIndex) {
    if (!this.checkpoints) this.checkpoints = {};
    if (!this.checkpoints[workflowId]) this.checkpoints[workflowId] = [];

    const checkpoint = {
      id: `ckpt_${Date.now()}_${stepIndex}`,
      stepIndex,
      timestamp: Date.now(),
      tasks: JSON.parse(JSON.stringify(this.state.agentTasks || [])),
      vfsSnapshots: JSON.parse(JSON.stringify(this.vfsSnapshots)),
      failureMemory: JSON.parse(JSON.stringify(this.state.failureMemory || []))
    };

    this.checkpoints[workflowId].push(checkpoint);
    
    // Keep max 20 checkpoints per workflow to limit memory
    if (this.checkpoints[workflowId].length > 20) {
      this.checkpoints[workflowId].shift();
    }

    this.logAgent('System', `Checkpoint saved at step ${stepIndex + 1} (${checkpoint.id})`);
    return checkpoint.id;
  }

  /**
   * Restore a checkpoint — rewind the workflow state to a previous snapshot.
   */
  restoreCheckpoint(workflowId, checkpointId) {
    if (!this.checkpoints || !this.checkpoints[workflowId]) return false;
    const ckpt = this.checkpoints[workflowId].find(c => c.id === checkpointId);
    if (!ckpt) return false;

    // Restore VFS snapshots
    this.vfsSnapshots = JSON.parse(JSON.stringify(ckpt.vfsSnapshots));
    
    this.state.withKernelWrite(() => {
      // Restore task list
      this.state.agentTasks = JSON.parse(JSON.stringify(ckpt.tasks));
      
      // Restore failure memory
      this.state.failureMemory = JSON.parse(JSON.stringify(ckpt.failureMemory));
    });

    // Roll back any file changes to their snapshot state
    for (const [path, content] of Object.entries(this.vfsSnapshots)) {
      try {
        if (content === null) {
          // File didn't exist at checkpoint time, try to remove it
          const node = this.state.resolvePath(path);
          if (node) {
            window.Astra?.syscall('fs:delete', path);
          }
        } else {
          window.Astra?.syscall('fs:write', path, content);
        }
      } catch (err) {
        console.error(`[Checkpoint] Failed to restore ${path}:`, err);
      }
    }

    this.state.withKernelWrite(() => {
      this.state.saveState();
    });
    this.logAgent('System', `Restored checkpoint ${checkpointId} at step ${ckpt.stepIndex + 1}`);
    if (window.refreshExplorerGrid) window.refreshExplorerGrid();
    if (window.refreshTasksBoard) window.refreshTasksBoard();
    return true;
  }

  /**
   * List available checkpoints for a workflow
   */
  listCheckpoints(workflowId) {
    if (!this.checkpoints || !this.checkpoints[workflowId]) return [];
    return this.checkpoints[workflowId].map(c => ({
      id: c.id,
      stepIndex: c.stepIndex,
      timestamp: c.timestamp,
      taskCount: c.tasks.length
    }));
  }

  async undoLastWorkflow() {
    let restoredCount = 0;
    for (const [path, content] of Object.entries(this.vfsSnapshots)) {
      try {
        if (content === null) {
          await window.Astra.syscall('fs:delete', path);
        } else {
          await window.Astra.syscall('fs:write', path, content);
        }
        restoredCount++;
      } catch (err) {
        console.error("Failed syscall in undoLastWorkflow", err);
      }
    }
    this.vfsSnapshots = {};
    
    // Update active editor text area if it matches
    const textarea = document.getElementById('editor-text-area');
    const activeFile = document.getElementById('context-file')?.textContent;
    if (activeFile && textarea) {
      const currentFileNode = this.state.resolvePath(activeFile);
      if (currentFileNode) {
        textarea.value = currentFileNode.content;
      }
    }
    
    // Update active editor-content
    const editorContent = document.getElementById('editor-content');
    if (editorContent) {
      const tabActive = document.querySelector('.editor-tab.active span')?.textContent;
      if (tabActive) {
        const fileNode = this.state.resolvePath(`/home/divyanshu/Project_Astra/${tabActive}`) || this.state.resolvePath(tabActive);
        if (fileNode) {
          editorContent.value = fileNode.content;
        }
      }
    }

    if (window.refreshExplorerGrid) window.refreshExplorerGrid();
    return restoredCount;
  }

  // ==========================================
  // Safety Modal Promise Wrapper
  // ==========================================

  async checkSafetyPolicy(opName, targetPath, details) {
    const safety = this.state.registry.safety || {
      writePolicy: 'ask',
      commandPolicy: 'ask',
      networkPolicy: 'approve',
      settingsPolicy: 'ask',
      confidenceThreshold: 85
    };

    let policy = 'ask';
    if (opName === 'write_file' || opName === 'edit_file') {
      policy = safety.writePolicy;
    } else if (opName === 'run_terminal_command' || opName === 'run_command') {
      policy = safety.commandPolicy;
    } else if (opName === 'network') {
      policy = safety.networkPolicy;
    } else if (opName === 'settings' || opName === 'modify_settings') {
      policy = safety.settingsPolicy;
    }

    if (policy === 'deny') {
      this.logAgent('SafetyLayer', `Blocked ${opName} on ${targetPath} (Policy: DENY)`, 'alert');
      this.ui.showToast('Security Alert', `Blocked action ${opName} due to active safety policy.`, 'error');
      return false;
    }

    // Generate simulated confidence score based on target path safety
    let confidence = 90;
    if (targetPath.includes('control.js') || targetPath.includes('index.js')) {
      confidence = 88;
    } else if (targetPath.includes('README.md') || targetPath.includes('notes.txt') || targetPath.includes('daily_briefings.md')) {
      confidence = 96;
    } else if (targetPath.includes('/etc/') || targetPath.includes('/var/log/')) {
      confidence = 65; // lower confidence for system file operations
    }

    if (policy === 'approve') {
      if (confidence >= safety.confidenceThreshold) {
        this.logAgent('SafetyLayer', `Auto-Approved ${opName} on ${targetPath} (Confidence: ${confidence}%, Policy: AUTO-APPROVE)`, 'success');
        return true;
      } else {
        this.logAgent('SafetyLayer', `Uncertainty Escalation: Confidence (${confidence}%) below threshold (${safety.confidenceThreshold}%). Requesting approval...`, 'warning');
      }
    }

    const approved = await this.requestSafetyApproval('ExecutorAgent', opName, targetPath, details);
    if (approved) {
      this.logAgent('SafetyLayer', `User Approved ${opName} on ${targetPath} (Confidence: ${confidence}%)`, 'success');
    } else {
      this.logAgent('SafetyLayer', `User Denied ${opName} on ${targetPath} (Confidence: ${confidence}%)`, 'alert');
    }
    return approved;
  }

  requestSafetyApproval(agentName, opName, targetPath, codePreview) {
    return new Promise((resolve) => {
      const dialog = document.getElementById('safety-approval-dialog');
      
      document.getElementById('safety-agent-name').textContent = agentName;
      document.getElementById('safety-op-name').textContent = opName;
      document.getElementById('safety-target-path').textContent = targetPath;
      document.getElementById('safety-code-preview').textContent = codePreview;

      dialog.showModal();

      const approveBtn = document.getElementById('safety-approve-btn');
      const denyBtn = document.getElementById('safety-deny-btn');

      const cleanUp = () => {
        dialog.close();
        approveBtn.removeEventListener('click', onApprove);
        denyBtn.removeEventListener('click', onDeny);
      };

      const onApprove = () => {
        cleanUp();
        resolve(true);
      };

      const onDeny = () => {
        cleanUp();
        resolve(false);
      };

      approveBtn.addEventListener('click', onApprove);
      denyBtn.addEventListener('click', onDeny);
    });
  }

  // ==========================================
  // Typing Animation Simulation
  // ==========================================

  async animateEditorTyping(textarea, originalText, targetText, replacementText) {
    const startIndex = originalText.indexOf(targetText);
    if (startIndex === -1) return;

    // Focus editor
    textarea.focus();
    
    // We will simulate deleting characters, then typing the replacement text in chunks
    const chunkLength = 5;
    let currentText = originalText;
    
    // Simple replacement transition simulation
    for (let i = 0; i <= replacementText.length; i += chunkLength) {
      const partial = replacementText.substring(0, i);
      textarea.value = originalText.substring(0, startIndex) + partial + originalText.substring(startIndex + targetText.length);
      
      // Scroll cursor into view
      textarea.scrollTop = textarea.scrollHeight;
      
      await this.delay(60);
    }
    textarea.value = originalText.replace(targetText, replacementText);
  }

  // ==========================================
  // Real LLM (Gemini API) Agent Execution Loop
  // ==========================================

  async runGeminiAgent(userPrompt, appendChatBubble) {
    if (this.activeWorkflow) return;
    this.activeWorkflow = true;
    this.vfsSnapshots = {};

    const reg = this.state.registry;
    const apiKey = reg.ai.apiKey;
    const model = reg.ai.model || 'gemini-1.5-flash';
    const systemPrompt = reg.ai.systemPrompt || "You are Astra, the agentic copilot for Astra OS.";
    const temp = reg.ai.temperature || 0.7;
    const workflow = this.state.withKernelWrite(() => {
      const wf = this.state.createWorkflow(
        userPrompt,
        userPrompt,
        this.state.currentSession.currentUser || 'User'
      );
      this.state.updateWorkflow(wf.id, { status: 'running' });
      this.state.appendWorkflowStep(wf.id, {
        title: 'Analyze user intent',
        assigned: 'AstraAgent',
        status: 'completed',
        confidence: 92,
        reason: 'Interpret the user request and decide whether tool execution is required.',
        target: userPrompt,
        outcome: 'Started Gemini-guided tool workflow',
        verification: `Model selected: ${model}`
      });
      return wf;
    });
    this.currentWorkflow = workflow;
    const geminiProc = window.AstraKernel.spawnProcess('AstraAgent', 1, workflow.id);
    this.currentAgentId = 'AstraAgent';
    this.geminiProcessToken = geminiProc.token;
    this.geminiProcessPid = geminiProc.pid;
    if (window.refreshWorkflowApp) window.refreshWorkflowApp();

    // Load or initialize history
    if (!this.geminiHistory) {
      this.geminiHistory = [];
    }

    // Append user input to history
    this.geminiHistory.push({
      role: 'user',
      parts: [{ text: userPrompt }]
    });

    this.logAgent('AstraAgent', 'Initiating agentic goal planning...');
    this.ui.showToast('AI Planning', 'Contacting Gemini API...', 'info');

    // Change status pill to thinking
    const statusPill = document.getElementById('agent-status-pill');
    if (statusPill) {
      statusPill.querySelector('.status-text').textContent = 'Astra: Thinking...';
      statusPill.querySelector('.status-pulse').className = 'status-pulse working';
    }

    let loopCount = 0;
    const maxLoops = 15; // prevent infinite loops
    let assistantResponseText = '';

    while (loopCount < maxLoops) {
      loopCount++;
      try {
        const payload = {
          contents: this.geminiHistory,
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: "read_file",
                  description: "Reads the content of a file from the virtual filesystem. Returns the file content.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      path: { type: "STRING", description: "The absolute path of the file to read (e.g. '/Project_Astra/index.js')" }
                    },
                    required: ["path"]
                  }
                },
                {
                  name: "write_file",
                  description: "Creates or overwrites a file with new content in the virtual filesystem.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      path: { type: "STRING", description: "The absolute path of the file to write (e.g. '/Project_Astra/index.js')" },
                      content: { type: "STRING", description: "The exact file contents to write." }
                    },
                    required: ["path", "content"]
                  }
                },
                {
                  name: "list_dir",
                  description: "Lists all files and subdirectories in the specified virtual filesystem folder.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      path: { type: "STRING", description: "The absolute directory path to list (e.g. '/Project_Astra')" }
                    },
                    required: ["path"]
                  }
                },
                {
                  name: "run_terminal_command",
                  description: "Runs a command in the Astra OS virtual terminal (e.g. 'npm run build', 'ls', 'git status', etc.) and returns the command output.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      command: { type: "STRING", description: "The exact shell command line string to run." }
                    },
                    required: ["command"]
                  }
                },
                {
                  name: "rollback_file",
                  description: "Rolls back the specified file to its snapshot version prior to agent modifications.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      path: { type: "STRING", description: "The absolute path of the file to rollback (e.g. '/Project_Astra/index.js')" }
                    },
                    required: ["path"]
                  }
                },
                {
                  name: "add_task",
                  description: "Creates and adds a new task to the agent task board.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      title: { type: "STRING", description: "Short title of the task." },
                      desc: { type: "STRING", description: "Detailed description of the task." },
                      assigned: { type: "STRING", description: "Agent name to assign (e.g. 'ExecutorAgent', 'WatcherAgent')." }
                    },
                    required: ["title", "desc", "assigned"]
                  }
                },
                {
                  name: "update_task",
                  description: "Updates the status of an existing task on the agent task board.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING", description: "The unique task ID (e.g. 'task-1')." },
                      status: { type: "STRING", description: "The new status: 'pending', 'progress', or 'completed'." }
                    },
                    required: ["id", "status"]
                  }
                },
                {
                  name: "add_memory_node",
                  description: "Adds a new knowledge node to the AI persistent memory graph.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING", description: "Unique identifier for the node (e.g. 'endpoint-council')." },
                      label: { type: "STRING", description: "Friendly text label for the node." },
                      type: { type: "STRING", description: "The type of node: 'user', 'project', 'tech', 'preference', 'file', 'endpoint'." }
                    },
                    required: ["id", "label", "type"]
                  }
                },
                {
                  name: "add_memory_link",
                  description: "Creates an edge (relationship link) between two persistent memory graph nodes.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      source: { type: "STRING", description: "The ID of the source node." },
                      target: { type: "STRING", description: "The ID of the target node." },
                      relation: { type: "STRING", description: "The verb describing relationship (e.g. 'works_on', 'defines', 'prefers')." }
                    },
                    required: ["source", "target", "relation"]
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: temp
          }
        };

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error?.message || `HTTP error ${res.status}`);
        }

        const data = await res.json();
        const candidate = data.candidates && data.candidates[0];
        const content = candidate && candidate.content;

        if (!content) {
          throw new Error("Empty response from Gemini API");
        }

        // Push Gemini's response to history
        this.geminiHistory.push(content);

        const parts = content.parts || [];
        const functionCalls = parts.filter(p => p.functionCall);
        const textPart = parts.find(p => p.text);

        if (textPart) {
          assistantResponseText = textPart.text;
        }

        if (functionCalls.length > 0) {
          // Process function calls
          const responseParts = [];

          for (const call of functionCalls) {
            const { name, args } = call.functionCall;
            this.logAgent('AstraAgent', `Executing tool: ${name}`);

            let result;
            const stepTitle = `Tool: ${name}`;
            const toolTarget = args?.path || args?.command || args?.id || args?.title || 'tool invocation';
            this.state.withKernelWrite(() => {
              this.state.appendWorkflowStep(workflow.id, {
                title: stepTitle,
                assigned: 'AstraAgent',
                status: 'pending',
                confidence: 88,
                reason: 'Gemini selected a tool call to advance the active workflow.',
                target: String(toolTarget),
                outcome: 'Tool execution started',
                verification: 'Awaiting tool result'
              });
            });
            try {
              result = await this.executeAgentTool(name, args);
            } catch (toolErr) {
              console.error(`Tool execution error for ${name}:`, toolErr);
              result = { error: toolErr.message };
            }

            this.state.withKernelWrite(() => {
              const step = workflow.steps[workflow.steps.length - 1];
              if (step && step.title === stepTitle && step.target === String(toolTarget)) {
                step.status = result?.error ? 'failed' : 'completed';
                step.updatedAt = Date.now();
                step.outcome = result?.error ? `Tool failed: ${result.error}` : 'Tool execution completed';
                step.verification = result?.error
                  ? 'Tool returned an error payload'
                  : `Tool response keys: ${Object.keys(result || {}).join(', ') || 'none'}`;
                workflow.updatedAt = Date.now();
                this.state.saveState();
              }
            });
            if (window.refreshWorkflowApp) window.refreshWorkflowApp();

            responseParts.push({
              functionResponse: {
                name: name,
                response: result
              }
            });
          }

          // Push tool response to history
          this.geminiHistory.push({
            role: 'user',
            parts: responseParts
          });

          // Wait a bit to simulate thinking
          await this.delay(1000);
        } else {
          // No more function calls, we are done
          break;
        }
      } catch (err) {
        console.error("Gemini Agent Loop Error:", err);
        this.logAgent('System', `Agent error: ${err.message}`, 'alert');
        this.state.withKernelWrite(() => {
          this.state.updateWorkflow(workflow.id, { status: 'failed' });
          this.state.appendWorkflowStep(workflow.id, {
            title: 'Gemini agent error',
            assigned: 'System',
            status: 'failed',
            confidence: 0,
            reason: 'The model or tool execution loop exited unexpectedly.',
            target: userPrompt,
            outcome: err.message,
            verification: 'See error message'
          });
        });
        appendChatBubble(`⚠️ Agent Error: ${err.message}. Please check your API key and connection settings.`, 'assistant');
        this.setAgentIdle();
        this.activeWorkflow = false;
        if (this.geminiProcessPid) {
          window.AstraKernel.killProcess(this.geminiProcessPid);
        }
        this.geminiProcessPid = null;
        this.geminiProcessToken = null;
        if (window.refreshWorkflowApp) window.refreshWorkflowApp();
        return;
      }
    }

    if (assistantResponseText) {
      appendChatBubble(assistantResponseText, 'assistant');
    }

    this.state.withKernelWrite(() => {
      this.state.updateWorkflow(workflow.id, { status: 'completed' });
      this.state.appendWorkflowStep(workflow.id, {
        title: 'Return final response',
        assigned: 'AstraAgent',
        status: 'completed',
        confidence: 95,
        reason: 'The model finished its tool loop and returned a user-facing answer.',
        target: userPrompt,
        outcome: assistantResponseText || 'Workflow completed without a final natural-language summary.',
        verification: 'Assistant response appended to chat'
      });
    });
    if (window.refreshWorkflowApp) window.refreshWorkflowApp();

    this.setAgentIdle();
    this.activeWorkflow = false;
    if (this.geminiProcessPid) {
      window.AstraKernel.killProcess(this.geminiProcessPid);
    }
    this.geminiProcessPid = null;
    this.geminiProcessToken = null;
  }

  async executeAgentTool(name, args) {
    const toolToken = this.geminiProcessToken || 'sys_session';
    switch (name) {
      case 'read_file': {
        const res = await window.Astra.syscall(toolToken, 'fs:read', args.path);
        if (res.status !== 'success') return { error: res.error?.message || `Failed to read ${args.path}` };
        return { content: res.result || '' };
      }

      case 'write_file': {
        this.backupFileBeforeChange(args.path);
        try {
          const writeRes = await window.Astra.syscall(toolToken, 'fs:write', args.path, args.content);
          if (writeRes.status !== 'success') {
            return { error: writeRes.error?.message || `Failed to write ${args.path}` };
          }
          
          // Auto update active editor text area if it matches the edited file path
          const editorTextarea = document.getElementById('editor-content');
          if (editorTextarea) {
            const activeFile = document.querySelector('.editor-tab.active span')?.textContent;
            if (activeFile && args.path.endsWith(activeFile)) {
              editorTextarea.value = args.content;
            }
          }
          if (window.refreshExplorerGrid) window.refreshExplorerGrid();
          return { success: true };
        } catch (err) {
          return { error: err.message };
        }
      }

      case 'rollback_file': {
        const snapshots = this.vfsSnapshots;
        if (snapshots[args.path] === undefined) {
          return { error: `No snapshot available for path: ${args.path}` };
        }
        const original = snapshots[args.path];
        try {
          if (original === null) {
            const delRes = await window.Astra.syscall(toolToken, 'fs:delete', args.path);
            if (delRes.status !== 'success') return { error: delRes.error?.message || `Failed to delete ${args.path}` };
          } else {
            const writeRes = await window.Astra.syscall(toolToken, 'fs:write', args.path, original);
            if (writeRes.status !== 'success') return { error: writeRes.error?.message || `Failed to restore ${args.path}` };
          }
          delete snapshots[args.path];
          
          const textarea = document.getElementById('editor-text-area') || document.getElementById('editor-content');
          const activeFile = document.getElementById('context-file')?.textContent;
          if (activeFile && args.path.endsWith(activeFile) && textarea) {
            textarea.value = original || '';
          }
          const editorContent = document.getElementById('editor-content');
          if (editorContent) {
            const tabActive = document.querySelector('.editor-tab.active span')?.textContent;
            if (tabActive && args.path.endsWith(tabActive)) {
              editorContent.value = original || '';
            }
          }
          if (window.refreshExplorerGrid) window.refreshExplorerGrid();
          return { success: true };
        } catch (err) {
          return { error: err.message };
        }
      }

      case 'list_dir': {
        const listRes = await window.Astra.syscall(toolToken, 'fs:list', args.path);
        if (listRes.status !== 'success') return { error: listRes.error?.message || `Failed to list ${args.path}` };
        const dir = this.state.resolvePath(args.path);
        const items = (listRes.result || []).map(k => ({
          name: k,
          type: Reflect.get(dir?.children || {}, window.sanitizeKey(k))?.type || 'unknown'
        }));
        return { items };
      }

      case 'run_terminal_command': {
        try {
          // Gate through spawn syscall
          const spawnRes = await window.Astra.syscall(toolToken, 'proc:spawn', args.command.split(' ')[0], 1);
          if (spawnRes.status !== 'success') return { error: spawnRes.error?.message || `Failed to spawn ${args.command}` };
          
          if (window.printTerminalRow) {
            window.printTerminalRow(`divyanshu@astra:~$ ${args.command}`);
          }
          
          const output = await this.executeVirtualCommand(args.command);
          
          if (window.printTerminalRow && output) {
            output.split('\n').forEach(line => window.printTerminalRow(line));
          }
          
          return { output };
        } catch (err) {
          return { error: err.message };
        }
      }

      case 'add_task': {
        const taskRes = await window.Astra.syscall(toolToken, 'task:add', args.title, args.desc, 'pending', args.assigned);
        if (taskRes.status !== 'success') return { error: taskRes.error?.message || 'Failed to add task' };
        if (window.refreshTasksBoard) window.refreshTasksBoard();
        return { id: taskRes.result?.id || null, success: true };
      }

      case 'update_task': {
        const res = await window.Astra.syscall(toolToken, 'task:updateStatus', args.id, args.status);
        if (res.status !== 'success') return { error: res.error?.message || `Failed to update task ${args.id}` };
        if (window.refreshTasksBoard) window.refreshTasksBoard();
        return { success: true };
      }

      case 'add_memory_node': {
        const res = await window.Astra.syscall(toolToken, 'state:addMemoryNode', args.id, args.label, args.type);
        if (res.status !== 'success') return { error: res.error?.message || `Failed to add memory node ${args.id}` };
        if (window.refreshSidebarMemories) window.refreshSidebarMemories();
        if (window.drawMemoryGraphApp) window.drawMemoryGraphApp();
        return { success: true };
      }

      case 'add_memory_link': {
        const res = await window.Astra.syscall(toolToken, 'state:addMemoryLink', args.source, args.target, args.relation);
        if (res.status !== 'success') return { error: res.error?.message || 'Failed to add memory link' };
        if (window.drawMemoryGraphApp) window.drawMemoryGraphApp();
        return { success: true };
      }

      default:
        return { error: `Unknown tool name: ${name}` };
    }
  }

  async executeVirtualCommand(command) {
    const cleanCmd = command.trim();
    const res = window.AstraKernel.executeCommand(cleanCmd, '/Project_Astra', []);
    return res.output ? res.output.join('\n') : '';
  }

  speakText(text) {
    if (!window.speechSynthesis) return;
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Strip HTML tags for clean speech
    const cleanText = text.replace(/<\/?[^>]+(>|$)/g, "");
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Choose a female English voice if available, otherwise fallback
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.includes('en') && (v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('samantha'))) || voices[0];
    if (voice) {
      utterance.voice = voice;
    }
    
    window.speechSynthesis.speak(utterance);
  }
}
