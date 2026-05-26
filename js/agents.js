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
    this.state.addAuditLog(agent, action);
    
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
    }, 60000);
  }

  // ==========================================
  // Core Workflow Demo
  // ==========================================
  
  autoResumeWorkflows() {
    const activeWf = this.state.workflows?.find(w => w.status === 'observed' || w.status === 'progress' || w.status === 'approved');
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
    
    const completedCount = workflow.steps.filter(s => s.status === 'completed').length;
    this.logAgent('PlannerAgent', `Resumed workflow at step ${completedCount + 1} with goal: "${workflow.goal}"`);
    this.executeWorkflowSteps(completedCount);
  }

  async startWorkflow(userPrompt) {
    if (this.activeWorkflow) return;
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

    this.executeWorkflowSteps(0);
  }

  async executeWorkflowSteps(startStepIndex) {
    const workflow = this.currentWorkflow;

    try {
      if (startStepIndex <= 0) {
        this.logAgent('PlannerAgent', `Analyzing goal: "${workflow.goal}"`);
        await this.delay(1800);

        this.logAgent('PlannerAgent', 'Created orchestration checklist. Assigned tasks to specialized agents.');
        
        const lowerGoal = workflow.goal.toLowerCase();
        if (lowerGoal.includes('build') || lowerGoal.includes('implement') || lowerGoal.includes('route') || lowerGoal.includes('astra')) {
          this.state.agentTasks = [
            { id: 'task-1', title: 'Parse active workspace context', desc: 'Read README.md and index.js variables', status: 'pending', assigned: 'PlannerAgent', action: 'fs:read', path: '/Project_Astra/README.md' },
            { id: 'task-2', title: 'Implement Express API endpoints', desc: 'Inject routing and council endpoints inside index.js', status: 'pending', assigned: 'ExecutorAgent', action: 'fs:write', path: '/Project_Astra/index.js' },
            { id: 'task-3', title: 'Compile and build index.js', desc: 'Run verify test suite compiler', status: 'pending', assigned: 'WatcherAgent', action: 'npm run build' },
            { id: 'task-4', title: 'Link endpoints in README', desc: 'Document gateway routes in README.md', status: 'pending', assigned: 'MemoryAgent', action: 'fs:write', path: '/Project_Astra/README.md' }
          ];
        } else {
          this.state.agentTasks = [
            { id: 'task-1', title: 'Audit current filesystem structure', desc: 'Scan files inside active workspace root', status: 'pending', assigned: 'PlannerAgent', action: 'fs:read', path: '/Project_Astra/README.md' },
            { id: 'task-2', title: 'Verify settings and configuration', desc: 'Analyze system environment and keys settings', status: 'pending', assigned: 'ExecutorAgent', action: 'fs:read', path: '/Project_Astra/index.js' },
            { id: 'task-3', title: 'Run integrity and verification suite', desc: 'Confirm no path resolution locks or corruption', status: 'pending', assigned: 'WatcherAgent', action: 'npm run build' }
          ];
        }
        
        this.state.appendWorkflowStep(workflow.id, {
          title: 'Draft execution plan',
          assigned: 'PlannerAgent',
          status: 'completed',
          confidence: 98,
          reason: 'Formulate chronological checklist to fulfill target user goal',
          target: 'System Plan Board',
          outcome: `Assigned tasks to PlannerAgent, ExecutorAgent, WatcherAgent, and MemoryAgent`,
          verification: 'Orchestrator validated task array constraints'
        });
        this.state.saveState();
        if (window.refreshTasksBoard) window.refreshTasksBoard();
        this.ui.showToast('Plan Drafted', `PlannerAgent created ${this.state.agentTasks.length} tasks.`, 'info');
        await this.delay(2000);
      }

      let stepIndex = startStepIndex > 0 ? startStepIndex - 1 : 0;
      
      while (stepIndex < this.state.agentTasks.length) {
        const task = this.state.agentTasks[stepIndex];
        this.currentAgentId = task.assigned;
        
        this.logAgent(task.assigned, `Running task: ${task.title}`);
        this.state.updateTaskStatus(task.id, 'progress');
        if (window.refreshTasksBoard) window.refreshTasksBoard();
        
        await this.delay(1500);

        if (task.action === 'fs:read') {
          this.logAgent(task.assigned, `Reading content of ${task.path}`);
          const fileNode = this.state.resolvePath(task.path);
          const content = fileNode ? fileNode.content : '';
          
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
          
        } else if (task.action === 'fs:write') {
          this.logAgent(task.assigned, `Requesting safety clearance to modify ${task.path}`);
          
          let details = `Modify code inside ${task.path.split('/').pop()}`;
          let codeToInject = '';
          let replacedCode = '';
          
          const fileNode = this.state.resolvePath(task.path);
          const originalCode = fileNode ? (fileNode.content || '') : '';
          
          if (task.path.endsWith('index.js')) {
            details = 'Inject new routing endpoints for Astra Agent Council inside index.js.';
            const injectionTarget = `// TODO: Implement the express endpoints for agent council communication`;
            
            // If it is the recovery fix step, write clean code. Otherwise write syntax error first!
            if (task.recoveryFix) {
              codeToInject = `// Implement the express endpoints for agent council communication
app.post('/api/v1/council', (req, res) => {
  const { command, payload } = req.body;
  console.log(\`[Council] Received instruction: \${window.escapeHTML(command)}\`);
  res.status(200).json({ success: true, message: 'Command queued' });
});`;
            } else {
              // Intentionally inject syntax error: unbalanced brackets on line 20
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
          } else {
            replacedCode = originalCode + '\n// Astra Agent modification\n';
          }

          this.backupFileBeforeChange(task.path);

          try {
            await window.Astra.syscall('fs:write', task.path, replacedCode);
          } catch (err) {
            this.logAgent('SafetyLayer', 'Permission denied. Halting execution loop.', 'alert');
            this.state.updateWorkflow(workflow.id, { status: 'blocked' });
            this.ui.showToast('Orchestration Halted', 'Safety layer denied modification permissions.', 'error');
            this.state.appendWorkflowStep(workflow.id, {
              title: `Modify ${task.path.split('/').pop()}`,
              assigned: 'SafetyLayer',
              status: 'failed',
              error: 'PERMISSION_DENIED',
              confidence: 30,
              reason: `Request write clearance for ${task.path}`,
              target: task.path,
              outcome: 'Write clearance denied by PolicyEngine',
              verification: 'Security sandbox boundary check failed'
            });
            this.state.updateTaskStatus(task.id, 'pending');
            this.setAgentIdle();
            this.activeWorkflow = false;
            return;
          }
          
          this.logAgent('SafetyLayer', 'Permission approved. Resuming execution task.', 'success');
          await this.delay(1000);
          
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
          await this.delay(1000);
          
          this.logAgent(task.assigned, 'Running command inside terminal: npm run build');
          if (window.printTerminalRow) {
            window.printTerminalRow('divyanshu@astra:~$ npm run build');
          }
          
          const stepHistory = workflow.steps.filter(s => s.title.includes('Verify build'));
          const isRetry = stepHistory.length > 0;
          
          await this.delay(1500);
          
          if (!isRetry && task.id === 'task-3' && this.state.resolvePath('/Project_Astra/index.js')) {
            if (window.printTerminalRow) {
              window.printTerminalRow('  [1/2] Parsing configurations...');
              window.printTerminalRow('  [2/2] Validating node AST structures...');
              window.printTerminalRow('  Error: SyntaxError: Unexpected token ) in index.js on line 20');
              window.printTerminalRow('  Build failed.');
            }
            this.logAgent(task.assigned, 'Build compilation failed. Intercepted syntax error.', 'alert');
            this.ui.showToast('Build Failed', 'Compiler syntax error detected.', 'error');
            
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
            
            await this.delay(2000);
            
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
            await this.delay(2000);
            
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
        }
        
        this.state.saveState();
        if (window.refreshTasksBoard) window.refreshTasksBoard();
        
        stepIndex++;
        await this.delay(2000);
      }
      
      this.logAgent('MemoryAgent', 'Parsing index.js routing endpoints to update semantic index');
      this.state.addMemoryNode('endpoint-council', 'Route: /api/v1/council', 'endpoint');
      this.state.addMemoryLink('file-index', 'endpoint-council', 'defines');
      this.state.addMemoryLink('usr-divyanshu', 'endpoint-council', 'interacts_with');
      this.afkSummaryData.memoriesCreated += 2;
      
      this.state.appendWorkflowStep(workflow.id, {
        title: 'Update memory relationships',
        assigned: 'MemoryAgent',
        status: 'completed',
        confidence: 97,
        reason: 'Link definitions and user associations inside knowledge base',
        target: 'AI Memory Graph',
        outcome: 'Recorded semantic memory node for council endpoint',
        verification: 'Memory link relationships populated'
      });
      if (window.refreshSidebarMemories) window.refreshSidebarMemories();
      if (window.drawMemoryGraphApp) window.drawMemoryGraphApp();
      
      this.logAgent('System', 'Astra orchestration tasks completed successfully.', 'success');
      this.ui.showToast('Orchestration Succeeded', 'Astra finished all delegated tasks.', 'success');
      
      this.state.updateWorkflow(workflow.id, { status: 'completed' });
      this.setAgentIdle();
      this.activeWorkflow = false;

      const expGrid = document.querySelector('#explorer-main-grid');
      if (expGrid && window.refreshExplorerGrid) {
        window.refreshExplorerGrid();
      }
    } catch (err) {
      this.logAgent('System', `Workflow failed: ${err.message}`, 'alert');
      this.state.updateWorkflow(workflow.id, { status: 'failed' });
      this.setAgentIdle();
      this.activeWorkflow = false;
    }
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
    step.status = 'rolled_back';
    this.state.saveState();
    if (window.refreshExplorerGrid) window.refreshExplorerGrid();
    return true;
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

    const reg = this.state.registry;
    const apiKey = reg.ai.apiKey;
    const model = reg.ai.model || 'gemini-1.5-flash';
    const systemPrompt = reg.ai.systemPrompt || "You are Astra, the agentic copilot for Astra OS.";
    const temp = reg.ai.temperature || 0.7;

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
            try {
              result = await this.executeAgentTool(name, args);
            } catch (toolErr) {
              console.error(`Tool execution error for ${name}:`, toolErr);
              result = { error: toolErr.message };
            }

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
        appendChatBubble(`⚠️ Agent Error: ${err.message}. Please check your API key and connection settings.`, 'assistant');
        this.setAgentIdle();
        this.activeWorkflow = false;
        return;
      }
    }

    if (assistantResponseText) {
      appendChatBubble(assistantResponseText, 'assistant');
    }

    this.setAgentIdle();
    this.activeWorkflow = false;
  }

  async executeAgentTool(name, args) {
    switch (name) {
      case 'read_file': {
        const file = this.state.resolvePath(args.path);
        if (!file) return { error: `File not found: ${args.path}` };
        if (file.type !== 'file') return { error: `Path is a directory, not a file: ${args.path}` };
        return { content: file.content || '' };
      }

      case 'write_file': {
        this.backupFileBeforeChange(args.path);
        try {
          await window.Astra.syscall('fs:write', args.path, args.content);
          
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
            await window.Astra.syscall('fs:delete', args.path);
          } else {
            await window.Astra.syscall('fs:write', args.path, original);
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
        const dir = this.state.resolvePath(args.path);
        if (!dir) return { error: `Directory not found: ${args.path}` };
        if (dir.type !== 'dir') return { error: `Path is a file, not a directory: ${args.path}` };
        const items = Object.keys(dir.children || {}).map(k => ({
          name: k,
          type: Reflect.get(dir.children, window.sanitizeKey(k)).type
        }));
        return { items };
      }

      case 'run_terminal_command': {
        try {
          // Gate through spawn syscall
          await window.Astra.syscall('proc:spawn', args.command.split(' ')[0], 1);
          
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
        const id = `task-${Date.now()}`;
        const task = {
          id: id,
          title: args.title,
          desc: args.desc,
          status: 'pending',
          assigned: args.assigned
        };
        this.state.agentTasks.push(task);
        this.state.saveState();
        if (window.refreshTasksBoard) window.refreshTasksBoard();
        return { id, success: true };
      }

      case 'update_task': {
        this.state.updateTaskStatus(args.id, args.status);
        if (window.refreshTasksBoard) window.refreshTasksBoard();
        return { success: true };
      }

      case 'add_memory_node': {
        this.state.addMemoryNode(args.id, args.label, args.type);
        if (window.refreshSidebarMemories) window.refreshSidebarMemories();
        if (window.drawMemoryGraphApp) window.drawMemoryGraphApp();
        return { success: true };
      }

      case 'add_memory_link': {
        this.state.addMemoryLink(args.source, args.target, args.relation);
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
