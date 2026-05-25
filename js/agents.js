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
        
        this.state.agentTasks = [
          { id: 'task-1', title: 'Parse active workspace context', desc: 'Read README.md and index.js variables', status: 'completed', assigned: 'PlannerAgent' },
          { id: 'task-2', title: 'Implement Express API endpoints', desc: 'Inject routing and council endpoints inside index.js', status: 'pending', assigned: 'ExecutorAgent' },
          { id: 'task-3', title: 'Compile and build index.js', desc: 'Run verify test suite compiler', status: 'pending', assigned: 'WatcherAgent' },
          { id: 'task-4', title: 'Link endpoints in README', desc: 'Document gateway routes in README.md', status: 'pending', assigned: 'MemoryAgent' }
        ];
        
        this.state.appendWorkflowStep(workflow.id, {
          title: 'Draft execution plan',
          assigned: 'PlannerAgent',
          status: 'completed',
          confidence: 98
        });
        this.state.saveState();
        if (window.refreshTasksBoard) window.refreshTasksBoard();
        this.ui.showToast('Plan Drafted', 'PlannerAgent created 4 tasks.', 'info');
        await this.delay(2000);
      }

      if (startStepIndex <= 1) {
        this.logAgent('ExecutorAgent', 'Opening Code Editor to file /Project_Astra/index.js');
        this.ui.openApp('editor');
        if (window.editorOpenFile) {
          window.editorOpenFile('/Project_Astra/index.js');
        }
        
        this.state.appendWorkflowStep(workflow.id, {
          title: 'Open editor index.js',
          assigned: 'ExecutorAgent',
          status: 'completed',
          confidence: 95
        });
        await this.delay(2000);
      }

      if (startStepIndex <= 2) {
        this.logAgent('SafetyLayer', 'Intercepted file modification task: [Implement Express API endpoints]. Checking bounds...');
        await this.delay(1200);

        const approved = await this.checkSafetyPolicy(
          'edit_file',
          '/Project_Astra/index.js',
          `Inject new routing endpoints for Astra Agent Council inside index.js.`
        );

        if (!approved) {
          this.logAgent('SafetyLayer', 'Permission denied by user. Halting execution loop.', 'alert');
          this.state.updateWorkflow(workflow.id, { status: 'blocked' });
          this.ui.showToast('Orchestration Halted', 'Safety layer denied modification permissions.', 'error');
          this.state.appendWorkflowStep(workflow.id, {
            title: 'Verify safety policies',
            assigned: 'SafetyLayer',
            status: 'failed',
            error: 'PERMISSION_DENIED',
            confidence: 30
          });
          this.setAgentIdle();
          this.activeWorkflow = false;
          return;
        }

        this.logAgent('SafetyLayer', 'Permission approved. Resuming execution task.', 'success');
        await this.delay(1000);

        this.logAgent('ExecutorAgent', 'Writing code inside index.js');
        const textarea = document.getElementById('editor-text-area') || document.getElementById('editor-content');
        if (textarea) {
          this.state.updateTaskStatus('task-2', 'progress');
          if (window.refreshTasksBoard) window.refreshTasksBoard();
          
          const originalCode = textarea.value;
          const injectionTarget = `// TODO: Implement the express endpoints for agent council communication`;
          const codeToInject = `// Implement the express endpoints for agent council communication
app.post('/api/v1/council', (req, res) => {
  const { command, payload } = req.body;
  console.log(\`[Council] Received instruction: \${window.escapeHTML(command)}\`);
  res.status(200).json({ success: true, message: 'Command queued' });
});`;

          const replacedCode = originalCode.replace(injectionTarget, codeToInject);
          
          if (textarea.id === 'editor-text-area') {
            await this.animateEditorTyping(textarea, originalCode, injectionTarget, codeToInject);
          } else {
            textarea.value = replacedCode;
          }
          
          this.backupFileBeforeChange('/Project_Astra/index.js');
          this.state.writeFile('/Project_Astra/index.js', replacedCode);
          this.ui.showToast('Task Completed', 'ExecutorAgent implemented routing endpoints.', 'success');
          this.state.updateTaskStatus('task-2', 'completed');
          this.state.appendWorkflowStep(workflow.id, {
            title: 'Modify /Project_Astra/index.js',
            assigned: 'ExecutorAgent',
            status: 'completed',
            confidence: 92
          });
          if (window.refreshTasksBoard) window.refreshTasksBoard();

          this.afkSummaryData.filesModified.push('/Project_Astra/index.js');
          this.afkSummaryData.tasksCompleted++;
        }
        await this.delay(2000);
      }

      if (startStepIndex <= 3) {
        this.logAgent('WatcherAgent', 'Verifying compile health of Project Astra...');
        this.ui.openApp('terminal');
        await this.delay(1000);
        
        this.logAgent('WatcherAgent', 'Running command inside terminal: npm run build');
        if (window.printTerminalRow) {
          window.printTerminalRow('divyanshu@astra:~$ npm run build');
        }
        
        this.state.updateTaskStatus('task-3', 'progress');
        if (window.refreshTasksBoard) window.refreshTasksBoard();
        
        await this.delay(1500);

        if (window.printTerminalRow) {
          window.printTerminalRow('  [1/2] Parsing configurations...');
          window.printTerminalRow('  [2/2] Validating node AST structures...');
          window.printTerminalRow('  Error: SyntaxError: Unexpected token ) in index.js on line 20');
          window.printTerminalRow('  Build failed.');
        }
        this.logAgent('WatcherAgent', 'Build compilation failed. Intercepted syntax error.', 'alert');
        this.ui.showToast('Build Failed', 'Compiler syntax error detected.', 'error');
        
        this.state.appendWorkflowStep(workflow.id, {
          title: 'Verify build compilation',
          assigned: 'WatcherAgent',
          status: 'failed',
          error: 'SYNTAX_ERROR',
          confidence: 45
        });
        
        await this.delay(2000);

        this.logAgent('PlannerAgent', 'Adapting plan: Created dynamic task to solve compilation syntax error.', 'alert');
        this.state.agentTasks.splice(3, 0, {
          id: 'task-fix',
          title: 'Fix compiler syntax error',
          desc: 'Verify and resolve double parenthesis syntax error inside index.js',
          status: 'pending',
          assigned: 'ExecutorAgent'
        });
        this.state.saveState();
        if (window.refreshTasksBoard) window.refreshTasksBoard();
        await this.delay(2000);

        this.logAgent('ExecutorAgent', 'Fixing parenthesis mismatch on line 20 of index.js');
        const freshCode = this.state.resolvePath('/Project_Astra/index.js').content;
        const fixedCode = freshCode.replace('console.log(`[Council] Received instruction: ${window.escapeHTML(command)}`);', 'console.log(`[Council] Received instruction: ${window.escapeHTML(command)}`);'); 
        
        const textarea = document.getElementById('editor-text-area') || document.getElementById('editor-content');
        if (textarea) {
          this.state.updateTaskStatus('task-fix', 'progress');
          if (window.refreshTasksBoard) window.refreshTasksBoard();
          
          textarea.value = fixedCode;
          this.backupFileBeforeChange('/Project_Astra/index.js');
          this.state.writeFile('/Project_Astra/index.js', fixedCode);
          await this.delay(1000);
          
          this.state.updateTaskStatus('task-fix', 'completed');
          this.state.appendWorkflowStep(workflow.id, {
            title: 'Fix syntax mismatch',
            assigned: 'ExecutorAgent',
            status: 'completed',
            confidence: 96
          });
          if (window.refreshTasksBoard) window.refreshTasksBoard();
          this.logAgent('ExecutorAgent', 'Syntax error successfully resolved.', 'success');
          
          this.afkSummaryData.tasksCompleted++;
        }
        await this.delay(2000);

        this.logAgent('WatcherAgent', 'Re-compiling gateway structures: npm run build');
        if (window.printTerminalRow) {
          window.printTerminalRow('divyanshu@astra:~$ npm run build');
          window.printTerminalRow('  [1/2] Parsing configurations...');
          window.printTerminalRow('  [2/2] Validating node AST structures...');
          window.printTerminalRow('  Build complete. Output bundle verified successfully.');
        }
        await this.delay(1000);
        this.logAgent('WatcherAgent', 'Build compiled successfully without errors.', 'success');
        this.ui.showToast('Build Passed', 'Gateway compiled cleanly.', 'success');
        this.state.updateWorkflow(workflow.id, { status: 'completed' });
        
        this.state.updateTaskStatus('task-3', 'completed');
        this.state.appendWorkflowStep(workflow.id, {
          title: 'Verify build compilation retry',
          assigned: 'WatcherAgent',
          status: 'completed',
          confidence: 99
        });
        if (window.refreshTasksBoard) window.refreshTasksBoard();
        this.afkSummaryData.tasksCompleted++;
        await this.delay(2000);
      }

      if (startStepIndex <= 4) {
        this.logAgent('MemoryAgent', 'Parsing index.js routing endpoints to update semantic index');
        this.state.addMemoryNode('endpoint-council', 'Route: /api/v1/council', 'endpoint');
        this.state.addMemoryLink('file-index', 'endpoint-council', 'defines');
        this.state.addMemoryLink('usr-divyanshu', 'endpoint-council', 'interacts_with');
        
        this.afkSummaryData.memoriesCreated += 2;
        this.state.appendWorkflowStep(workflow.id, {
          title: 'Update memory relationships',
          assigned: 'MemoryAgent',
          status: 'completed',
          confidence: 97
        });
        if (window.refreshSidebarMemories) window.refreshSidebarMemories();
        if (window.drawMemoryGraphApp) window.drawMemoryGraphApp();
        await this.delay(2000);
      }

      if (startStepIndex <= 5) {
        this.logAgent('ExecutorAgent', 'Modifying README.md file to document endpoint');
        const readmeFile = this.state.resolvePath('/Project_Astra/README.md');
        if (readmeFile) {
          this.state.updateTaskStatus('task-4', 'progress');
          if (window.refreshTasksBoard) window.refreshTasksBoard();

          const newReadme = readmeFile.content + '\n### Council Endpoint\n- **URL:** `/api/v1/council`\n- **Method:** `POST`\n- **Payload:** `{ "command": String, "payload": Object }`\n';
          this.backupFileBeforeChange('/Project_Astra/README.md');
          this.state.writeFile('/Project_Astra/README.md', newReadme);
          
          const textarea = document.getElementById('editor-text-area') || document.getElementById('editor-content');
          const activeFile = document.getElementById('context-file')?.textContent;
          if (activeFile === 'README.md' && textarea) {
            textarea.value = newReadme;
          }
          
          this.state.updateTaskStatus('task-4', 'completed');
          this.state.appendWorkflowStep(workflow.id, {
            title: 'Document API endpoints',
            assigned: 'ExecutorAgent',
            status: 'completed',
            confidence: 94
          });
          if (window.refreshTasksBoard) window.refreshTasksBoard();
          this.ui.showToast('Documentation Updated', 'README.md file rewritten.', 'success');

          this.afkSummaryData.filesModified.push('/Project_Astra/README.md');
          this.afkSummaryData.tasksCompleted++;
        }
        await this.delay(1800);
      }

      this.logAgent('System', 'Astra orchestration tasks completed successfully.', 'success');
      this.ui.showToast('Orchestration Succeeded', 'Astra finished all delegated tasks.', 'success');
      
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

  rollbackWorkflowStep(workflowId, stepId) {
    const wf = this.state.workflows.find(w => w.id === workflowId);
    if (!wf) return false;
    const step = wf.steps.find(s => s.id === stepId);
    if (!step || !step.backups) return false;
    
    for (const [path, content] of Object.entries(step.backups)) {
      if (content === null) {
        this.state.deleteFile(path);
      } else {
        this.state.writeFile(path, content);
      }
    }
    step.status = 'rolled_back';
    this.state.saveState();
    if (window.refreshExplorerGrid) window.refreshExplorerGrid();
    return true;
  }

  undoLastWorkflow() {
    let restoredCount = 0;
    for (const [path, content] of Object.entries(this.vfsSnapshots)) {
      if (content === null) {
        this.state.deleteFile(path);
      } else {
        this.state.writeFile(path, content);
      }
      restoredCount++;
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
        // Check safety policy
        const approved = await this.checkSafetyPolicy(
          'write_file',
          args.path,
          args.content.length > 250 ? args.content.substring(0, 250) + '...' : args.content
        );

        if (!approved) {
          return { error: 'Permission denied by safety policy' };
        }

        this.backupFileBeforeChange(args.path);
        this.state.writeFile(args.path, args.content);
        
        // Auto update active editor text area if it matches the edited file path
        const editorTextarea = document.getElementById('editor-content');
        if (editorTextarea) {
          const activeFile = document.querySelector('.editor-tab.active span')?.textContent;
          if (activeFile && args.path.endsWith(activeFile)) {
            editorTextarea.value = args.content;
          }
        }

        // Refresh Explorer if visible
        if (window.refreshExplorerGrid) window.refreshExplorerGrid();
        
        return { success: true };
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
        // Check safety policy
        const approved = await this.checkSafetyPolicy(
          'run_command',
          args.command.split(' ')[0],
          `Execute command inside terminal: ${args.command}`
        );

        if (!approved) {
          return { error: 'Permission denied by safety policy' };
        }

        if (window.printTerminalRow) {
          window.printTerminalRow(`divyanshu@astra:~$ ${args.command}`);
        }
        
        const output = await this.executeVirtualCommand(args.command);
        
        if (window.printTerminalRow && output) {
          output.split('\n').forEach(line => window.printTerminalRow(line));
        }
        
        return { output };
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
