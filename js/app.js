// ==========================================
// Astra OS Core Application Entry Point
// ==========================================

import './security.js';
import { OSState } from './state.js';
import { Kernel } from './kernel.js';
import { UIController } from './ui.js';
import { AgentOrchestrator } from './agents.js';
import { EventBus, AppRuntime } from './runtime.js';
import './apps.js';
import './apps-system.js';
import './apps-tools.js';

function bootOS() {
  // 1. Initialize State, UI, and Agents
  const state = new OSState();
  const bus = new EventBus();
  window.AstraKernel = new Kernel(state);
  const ui = new UIController(state);
  ui.init();
  const orchestrator = new AgentOrchestrator(state, ui);
  window.AstraAgentOrchestrator = orchestrator;
  const runtime = new AppRuntime({ state, kernel: window.AstraKernel, ui, bus });
  window.AstraBus = bus;
  window.AstraRuntime = runtime;

  // Expose key hooks globally so simulated apps in js/apps.js can trigger them
  window.AstraUI = ui;
  window.AstraBus.emit('system.booted', { stateVersion: state.schemaVersion });
  window.AstraBus.on('workflow.created', () => {
    ui.updateNotifBadge?.();
    window.refreshTasksBoard?.();
    state.addNotification('info', 'Workflow Engine', 'A new agent workflow has been created.');
  });
  window.AstraBus.on('workflow.updated', () => {
    ui.updateNotifBadge?.();
    window.refreshTasksBoard?.();
    state.addNotification('info', 'Workflow Engine', 'An agent workflow was updated.');
  });
  window.AstraBus.on('fs.changed', () => {
    window.refreshExplorerGrid?.();
    window.drawMemoryGraphApp?.();
  });
  window.AstraBus.on('fs.deleted', () => {
    window.refreshExplorerGrid?.();
  });
  window.AstraBus.on('process.spawned', () => {
    window.refreshDashboardLogs?.();
  });
  window.AstraBus.on('process.killed', () => {
    window.refreshDashboardLogs?.();
  });
  window.editorOpenFile = (path) => {
    ui.openApp('editor');
    setTimeout(() => {
      if (window.AstraApps._editorOpen) {
        window.AstraApps._editorOpen(path);
      }
    }, 200);
  };
  window.refreshSidebarMemories = refreshSidebarMemories;
  window.triggerAgentWorkflow = triggerAgentWorkflow;
  window.refreshExplorerGrid = () => {
    const explorerBody = document.querySelector('.window[data-app="explorer"] .window-body');
    if (explorerBody && window.AstraApps.explorer) {
      window.AstraApps.explorer(explorerBody, ui);
    }
  };
  window.drawMemoryGraphApp = () => {
    const memoryBody = document.querySelector('.window[data-app="memory"] .window-body');
    if (memoryBody && window.AstraApps.memory) {
      window.AstraApps.memory(memoryBody, ui);
    }
  };
  window.refreshTasksBoard = () => {
    const tasksBody = document.querySelector('.window[data-app="tasks"] .window-body');
    if (tasksBody && window.AstraApps.tasks) {
      window.AstraApps.tasks(tasksBody, ui);
    }
  };
  window.refreshDashboardLogs = () => {
    const dashboardBody = document.querySelector('.window[data-app="dashboard"] .window-body');
    if (dashboardBody && window.AstraApps.dashboard) {
      window.AstraApps.dashboard(dashboardBody, ui);
    }
  };

  // ==========================================
  // 2. Open Pre-configured Windows on Startup
  // ==========================================
  
  // Start with Boot Screen sequence
  const bootScreen = document.getElementById('boot-screen');
  const bootConsole = document.getElementById('boot-console');
  const bootProgress = document.getElementById('boot-progress');

  const bootLogs = [
    { text: "Initializing Virtual File System (VFS)...", type: "info" },
    { text: "Mounting /dev/sda1 on / (ext4)...", type: "success" },
    { text: "Mounting /dev/sda2 on /boot (ext4)...", type: "success" },
    { text: "Initializing process table daemon (PID 1)...", type: "info" },
    { text: "Spawning kernel service manager...", type: "info" },
    { text: "Loading security policies and manifests...", type: "success" },
    { text: "Registering system call mappings (fs, proc, settings)...", type: "info" },
    { text: "Initializing Event Bus & runtime interfaces...", type: "success" },
    { text: "Connecting to safety verification agent (PID 102)...", type: "success" },
    { text: "Establishing secure system-wide clipboard bridge...", type: "info" },
    { text: "Boot sequence completed. Loading UI...", type: "success" }
  ];

  let logIndex = 0;
  const isTestMode = navigator.webdriver || window.location.search.includes('test');
  const delayTime = isTestMode ? 10 : 150;

  function printNextLog() {
    if (logIndex < bootLogs.length) {
      const log = Reflect.get(bootLogs, logIndex);
      const line = document.createElement('div');
      line.className = `boot-console-line ${log.type}`;
      line.textContent = `[  OK  ] ${log.text}`;
      if (bootConsole) {
        bootConsole.appendChild(line);
        bootConsole.scrollTop = bootConsole.scrollHeight;
      }

      // Update progress bar
      const pct = Math.min(((logIndex + 1) / bootLogs.length) * 100, 100);
      if (bootProgress) bootProgress.style.width = `${pct}%`;

      logIndex++;
      setTimeout(printNextLog, isTestMode ? delayTime : (delayTime + Math.random() * 100));
    } else {
      // Fade out boot screen, lock screen appears
      setTimeout(() => {
        if (bootScreen) bootScreen.classList.add('hidden');
        ui.lockScreen();

        // Re-open apps that were active before refresh
        let openedAny = false;
        Object.keys(state.processes).forEach(appId => {
          if (Reflect.get(state.processes, window.sanitizeKey(appId)).open) {
            ui.openApp(appId);
            openedAny = true;
          }
        });

        // Default welcome setup if first time
        if (!openedAny) {
          ui.openApp('editor');
          ui.openApp('tasks');
        }
      }, isTestMode ? 20 : 350);
    }
  }

  if (bootScreen && bootConsole) {
    printNextLog();
  } else {
    ui.lockScreen();
    let openedAny = false;
    Object.keys(state.processes).forEach(appId => {
      if (Reflect.get(state.processes, window.sanitizeKey(appId)).open) {
        ui.openApp(appId);
        openedAny = true;
      }
    });
    if (!openedAny) {
      ui.openApp('editor');
      ui.openApp('tasks');
    }
  }

  state.runIntegrityChecks();
  refreshSidebarMemories();

  // ==========================================
  // 3. Command Palette Event Routing
  // ==========================================
  
  const cmdPalette = document.getElementById('command-palette-dialog');
  const paletteInput = document.getElementById('palette-search-input');
  
  paletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = paletteInput.value.trim().toLowerCase();
      cmdPalette.close();
      
      if (val.includes('reset') || val.includes('factory')) {
        if (confirm('Are you sure you want to factory reset Astra OS? This will clear all files and databases.')) {
          state.resetAllState();
          location.reload();
        }
      } else if (val.includes('afk')) {
        toggleAFK(true);
      } else if (val.includes('compile') || val.includes('build') || val.includes('run')) {
        ui.openApp('terminal');
        if (window.printTerminalRow) window.printTerminalRow('divyanshu@astra:~$ npm run build');
        setTimeout(() => {
          if (window.printTerminalRow) {
            window.printTerminalRow('  [1/2] Parsing configurations...');
            window.printTerminalRow('  [2/2] Validating node AST structures...');
            window.printTerminalRow('  Build complete. Output bundle verified successfully.');
            ui.showToast('Build Completed', 'Astra Gateway build output successfully validated.', 'success');
          }
        }, 1000);
      } else if (val.includes('editor')) {
        ui.openApp('editor');
      } else if (val.includes('explorer') || val.includes('files')) {
        ui.openApp('explorer');
      } else if (val.includes('memory') || val.includes('graph')) {
        ui.openApp('memory');
      } else if (val.includes('tasks') || val.includes('board')) {
        ui.openApp('tasks');
      } else if (val.includes('workflow') || val.includes('approval')) {
        ui.openApp('workflow');
      } else if (val.includes('health') || val.includes('system check')) {
        ui.openApp('dashboard');
        ui.showToast('System Health', 'Open the dashboard or run `health` in terminal for detailed checks.', 'info');
      } else if (val.includes('clear')) {
        state.clearMemoryGraph();
        refreshSidebarMemories();
        window.drawMemoryGraphApp();
      } else if (val.includes('continue') || val.includes('develop')) {
        triggerAgentWorkflow();
      } else {
        // Fallback chat redirection
        triggerChatSearch(paletteInput.value.trim());
      }
      paletteInput.value = '';
    }
  });

  // Handle Palette click options
  document.querySelectorAll('.palette-option').forEach(option => {
    option.addEventListener('click', () => {
      const command = option.getAttribute('data-command');
      cmdPalette.close();
      
      if (command === 'open-explorer') ui.openApp('explorer');
      else if (command === 'open-editor') ui.openApp('editor');
      else if (command === 'open-memory') ui.openApp('memory');
      else if (command === 'open-tasks') ui.openApp('tasks');
      else if (command === 'open-workflow') ui.openApp('workflow');
      else if (command === 'open-terminal') ui.openApp('terminal');
      else if (command === 'go-afk') toggleAFK(true);
      else if (command === 'sys-reset') {
        if (confirm('Are you sure you want to factory reset Astra OS? This will clear all files and databases.')) {
          state.resetAllState();
          location.reload();
        }
      }
      else if (command === 'ai-continue') triggerAgentWorkflow();
      else if (command === 'ai-summarize') triggerChatSearch('Summarize my active workspace');
      else if (command === 'ai-organize') triggerChatSearch('Organize Project Directory');
      else if (command === 'health-check') {
        const issues = state.runIntegrityChecks();
        ui.openApp('dashboard');
        ui.showToast('System Health', issues.length === 0 ? 'No integrity issues found.' : `${issues.length} integrity issue(s) flagged.`, issues.length === 0 ? 'success' : 'warning');
      }
      else if (command === 'ai-clear-memory') {
        state.clearMemoryGraph();
        refreshSidebarMemories();
        window.drawMemoryGraphApp();
        ui.showToast('Memory Reset', 'Semantic memory graph has been flushed.', 'info');
      }
    });
  });

  // ==========================================
  // Global Keyboard Shortcuts
  // ==========================================
  
  document.addEventListener('keydown', (e) => {
    const isMod = e.metaKey || e.ctrlKey;
    
    // Cmd+K / Ctrl+K : Command Palette
    if (isMod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (cmdPalette.open) cmdPalette.close();
      else {
        cmdPalette.showModal();
        paletteInput.focus();
      }
    }
    
    // Cmd+L / Ctrl+L : Lock Screen
    if (isMod && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      ui.lockScreen();
    }
  });

  // ==========================================
  // 4. Voice Simulation Action
  // ==========================================
  
  const voiceBtn = document.getElementById('voice-trigger-btn');
  voiceBtn.addEventListener('click', () => {
    if (state.systemVars.voiceActive) return;

    // Check browser SpeechRecognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      ui.showToast('Speech Recognition', 'Not supported in this browser. Running simulation instead.', 'warning');
      runVoiceSimulation();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.systemVars.voiceActive = true;
      ui.showToast('Speech Recognition', 'Listening... Speak now.', 'info');
      voiceBtn.style.color = 'var(--color-red)';
      voiceBtn.style.animation = 'pulse-animation 1.2s infinite';
      
      const statusPill = document.getElementById('agent-status-pill');
      if (statusPill) {
        statusPill.querySelector('.status-text').textContent = 'Astra: Listening...';
        statusPill.querySelector('.status-pulse').className = 'status-pulse working';
      }
    };

    recognition.onerror = (e) => {
      console.error('Speech Recognition Error:', e);
      ui.showToast('Speech Error', `Error: ${e.error}`, 'error');
      stopVoice();
    };

    recognition.onend = () => {
      stopVoice();
    };

    recognition.onresult = (e) => {
      const speechText = e.results[0][0].transcript;
      const inputBox = document.getElementById('chat-input-box');
      if (inputBox && speechText) {
        inputBox.value = speechText;
        inputBox.focus();
        // Automatically submit speech
        sendChatMessage();
      }
    };

    function stopVoice() {
      voiceBtn.style.color = '';
      voiceBtn.style.animation = '';
      state.systemVars.voiceActive = false;
      const statusPill = document.getElementById('agent-status-pill');
      if (statusPill) {
        statusPill.querySelector('.status-text').textContent = 'Astra: Idle';
        statusPill.querySelector('.status-pulse').className = 'status-pulse';
      }
    }

    try {
      recognition.start();
    } catch (err) {
      console.error(err);
      stopVoice();
    }

    function runVoiceSimulation() {
      state.systemVars.voiceActive = true;
      voiceBtn.style.color = 'var(--color-red)';
      voiceBtn.style.animation = 'pulse-animation 1.2s infinite';
      setTimeout(() => {
        stopVoice();
        const speechText = 'Draft expressive endpoints and compile Project Astra';
        const inputBox = document.getElementById('chat-input-box');
        if (inputBox) {
          inputBox.value = speechText;
          inputBox.focus();
        }
      }, 2800);
    }
  });

  // ==========================================
  // 5. Active Chat panel
  // ==========================================
  
  const chatInput = document.getElementById('chat-input-box');
  const chatSendBtn = document.getElementById('send-chat-btn');
  const chatMessages = document.getElementById('chat-messages');

  const sendChatMessage = () => {
    const text = chatInput.value.trim();
    if (!text) return;
    
    // Add user bubble
    appendChatBubble(text, 'user');
    chatInput.value = '';
    
    // Context-aware chatbot processing
    setTimeout(() => {
      processAgentResponse(text);
    }, 800);
  };

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  chatSendBtn.addEventListener('click', sendChatMessage);

  function appendChatBubble(content, sender) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    window.renderSafeHTML(bubble, `
      <div class="bubble-content">${content}</div>
      <div class="bubble-time">Just now</div>
    `);
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (sender === 'assistant' && state.registry.ai.voiceEnabled) {
      orchestrator.speakText(content);
    }
  }

  function processAgentResponse(prompt) {
    const aiConfig = state.registry.ai;
    if (aiConfig && aiConfig.provider === 'gemini' && aiConfig.apiKey) {
      orchestrator.runGeminiAgent(prompt, (text, sender) => appendChatBubble(text, sender));
      return;
    }

    const lower = prompt.toLowerCase();
    
    // 1. "Continue my AI satellite defense project" / "Continue satellite defense"
    if (lower.includes('satellite defense') || lower.includes('satellite_defense')) {
      appendChatBubble("Reconstructing workspace context for <strong>AI Satellite Defense Project</strong>... Restoring active session capsule, switching to Deep Work focus mode, and opening satellite control files.", 'assistant');
      setTimeout(() => {
        const capsules = state.registry.system?.capsules || [];
        const satelliteCapsule = capsules.find(c => c.id === 'capsule-satellite');
        if (satelliteCapsule) {
          Object.keys(state.processes).forEach(appId => {
            ui.closeApp(appId);
          });
          ui.setFocusMode(satelliteCapsule.focusMode);
          satelliteCapsule.openApps.forEach(appId => {
            ui.openApp(appId);
          });
          if (satelliteCapsule.activeFile) {
            ui.openApp('editor');
            setTimeout(() => {
              if (window.editorOpenFile) window.editorOpenFile(satelliteCapsule.activeFile);
            }, 300);
          }
        }
      }, 1000);
      return;
    }

    // 2. "Resume the dashboard we worked on yesterday" / "Resume dashboard"
    if (lower.includes('resume the dashboard') || lower.includes('resume dashboard')) {
      appendChatBubble("Reconstructing workspace context for <strong>Project Astra Core Gateway</strong>... Loading active session capsule and focus settings.", 'assistant');
      setTimeout(() => {
        const capsules = state.registry.system?.capsules || [];
        const astraCapsule = capsules.find(c => c.id === 'capsule-astra');
        if (astraCapsule) {
          Object.keys(state.processes).forEach(appId => {
            ui.closeApp(appId);
          });
          ui.setFocusMode(astraCapsule.focusMode);
          astraCapsule.openApps.forEach(appId => {
            ui.openApp(appId);
          });
          if (astraCapsule.activeFile) {
            ui.openApp('editor');
            setTimeout(() => {
              if (window.editorOpenFile) window.editorOpenFile(astraCapsule.activeFile);
            }, 300);
          }
        }
      }, 1000);
      return;
    }

    // 3. "What changed since last session" / "What changed while I was away"
    if (lower.includes('what changed') || lower.includes('since last session') || lower.includes('while i was away')) {
      appendChatBubble("Opening <strong>Daily Briefing</strong> on your Evening Wrap-up accomplishments tab so you can audit recent changes, repository updates, and agent activities.", 'assistant');
      setTimeout(() => {
        ui.openApp('dailybriefing');
        setTimeout(() => {
          const eveningTabBtn = document.getElementById('db-tab-evening');
          if (eveningTabBtn) eveningTabBtn.click();
        }, 300);
      }, 800);
      return;
    }

    // 4. "Prepare a summary of unresolved tasks" / "unresolved tasks"
    if (lower.includes('unresolved tasks') || lower.includes('pending tasks')) {
      const pendingCount = state.agentTasks.filter(t => t.status !== 'completed').length;
      appendChatBubble(`I scanned your task board and found <strong>${pendingCount} unresolved tasks</strong> remaining. Opening the Tasks Board app.`, 'assistant');
      setTimeout(() => {
        ui.openApp('tasks');
      }, 500);
      return;
    }

    // 5. "Finish organizing the research notes" / "organize notes" / "meeting notes"
    if (lower.includes('organize') && lower.includes('notes') || lower.includes('meeting notes')) {
      const notesContent = `- Team Meeting Notes: Orbit trajectory adjustments resolved.\n- Collisions risk verified below 0.01%.\n- WatcherAgent verified Express endpoints compile smoothly.\n- Next milestone: WebSocket telemetry streams integration.\n`;
      state.writeFile('/home/divyanshu/Documents/meeting_notes.txt', notesContent);
      appendChatBubble("Organizing and compiling your recent research/meeting notes... I have saved the structured notes to <strong>/home/divyanshu/Documents/meeting_notes.txt</strong> in the VFS and opened it in the Code Editor.", 'assistant');
      setTimeout(() => {
        ui.openApp('editor');
        setTimeout(() => {
          if (window.editorOpenFile) window.editorOpenFile('/home/divyanshu/Documents/meeting_notes.txt');
        }, 300);
      }, 800);
      return;
    }

    // Check if it requests to execute/continue tasks
    if (lower.includes('continue') || lower.includes('build') || lower.includes('implement') || lower.includes('test') || lower.includes('run') || lower.includes('finish')) {
      appendChatBubble("I'll analyze the project workspace context, formulate a detailed task list, and begin executing. You can follow my progress in the Task Board and Terminal windows.", 'assistant');
      triggerAgentWorkflow();
      return;
    }

    if (lower.includes('summarize') || lower.includes('readme')) {
      const activeFile = document.getElementById('context-file').textContent;
      appendChatBubble(html`I scanned the active workspace directories. 
      Active project: <strong>Project Astra</strong>
      Currently viewing: <strong>${activeFile}</strong>.
      This project implements an Express API gateway. It has a TODO list for socket and route connections. I recommend we execute <code>agent run</code> in the terminal to solve the TODO endpoints.`, 'assistant');
      return;
    }

    if (lower.includes('memory') || lower.includes('context')) {
      appendChatBubble(html`My semantic index remembers:
      - You are working on <strong>Project Astra</strong>.
      - The gateway is built on Node.js/Express.
      - We have mapped <strong>${state.memoryGraph.nodes.length} context nodes</strong> in your local database.`, 'assistant');
      return;
    }

    // Generic fallback chatbot responses referring to context
    const activeFile = document.getElementById('context-file').textContent;
    appendChatBubble('I understand your context. We are active on <strong>' + window.escapeHTML(activeFile) + '</strong> in Project Astra. I can help automate files modifications or run testing verification scripts. Try asking: "Finish implementing index.js endpoints".', 'assistant');
  }

  function triggerChatSearch(text) {
    ui.openApp('editor'); // ensure app is active
    appendChatBubble(text, 'user');
    setTimeout(() => {
      processAgentResponse(text);
    }, 600);
  }

  // ==========================================
  // 6. AFK Mode Screensaver & Report Visuals
  // ==========================================
  
  const goAfkBtn = document.getElementById('go-afk-btn');
  const wakeUpBtn = document.getElementById('wake-up-btn');
  const afkOverlay = document.getElementById('afk-overlay');
  const afkPauseBtn = document.getElementById('afk-pause-btn');
  const afkUndoBtn = document.getElementById('afk-undo-btn');
  
  goAfkBtn.addEventListener('click', () => toggleAFK(true));
  wakeUpBtn.addEventListener('click', () => toggleAFK(false));
  
  if (afkPauseBtn) {
    afkPauseBtn.addEventListener('click', () => {
      orchestrator.togglePauseWorkflow();
    });
  }
  
  if (afkUndoBtn) {
    afkUndoBtn.addEventListener('click', () => {
      const restored = orchestrator.undoLastWorkflow();
      ui.showToast('Rollback Complete', `Reverted ${restored} files modified by agent.`, 'success');
      state.addNotification('success', 'System Rollback', `Successfully reverted ${restored} files modified during AFK mode.`);
      afkUndoBtn.style.display = 'none';
      
      const diffContainer = document.getElementById('summary-diff-container');
      if (diffContainer) {
        window.renderSafeHTML(diffContainer, '<span style="color: var(--text-muted)">All modifications successfully reverted.</span>');
      }
    });
  }

  function toggleAFK(enable) {
    if (enable) {
      state.systemVars.afkRunning = true;
      state.systemVars.afkStartTime = Date.now();
      state.saveState();
      
      afkOverlay.classList.remove('hidden');
      document.body.classList.add('afk-active');
      
      // Start dynamic screensaver particle canvas animation
      createScreensaverParticles();
      
      if (afkPauseBtn) {
        afkPauseBtn.textContent = '⏸ Pause Agent';
      }
      orchestrator.isPaused = false;
      
      // Seed initial afk logs
      const logsList = document.getElementById('afk-logs-list');
      window.renderSafeHTML(logsList, '<div class="log-row info">AFK Autonomous Mode Enabled. Bounded actions authorized.</div>');
      
      // Reset summary data tracker
      orchestrator.afkSummaryData = {
        duration: 0,
        tasksCompleted: 0,
        filesModified: [],
        memoriesCreated: 0,
        actionsList: []
      };

      // Trigger automatic agent task execution in background AFK mode!
      setTimeout(() => {
        if (!orchestrator.activeWorkflow) {
          orchestrator.startWorkflow('AFK autonomous review and file modifications.');
        }
      }, 1000);

    } else {
      state.systemVars.afkRunning = false;
      const elapsedMs = Date.now() - state.systemVars.afkStartTime;
      const minutes = Math.floor(elapsedMs / 60000);
      const seconds = Math.floor((elapsedMs % 60000) / 1000);
      const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      
      state.saveState();
      
      afkOverlay.classList.add('hidden');
      document.body.classList.remove('afk-active');
      
      // Show report dialog!
      showAFKSummaryReport(durationStr);
    }
  }

  function createScreensaverParticles() {
    const container = document.getElementById('afk-particles');
    window.renderSafeHTML(container, '');
    
    const count = 15;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'afk-particle';
      
      const size = 150 + Math.random() * 200;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${Math.random() * 100}vw`;
      
      // Distribute starting offset times
      particle.style.animationDelay = `${Math.random() * 15}s`;
      
      container.appendChild(particle);
    }
  }

  function showAFKSummaryReport(durationStr) {
    const summaryDialog = document.getElementById('afk-summary-dialog');
    
    // Fill duration, tasks counts, files modified
    document.getElementById('afk-duration-display').textContent = durationStr;
    document.getElementById('summary-tasks-completed').textContent = orchestrator.afkSummaryData.tasksCompleted;
    document.getElementById('summary-files-modified').textContent = orchestrator.afkSummaryData.filesModified.length;
    document.getElementById('summary-memories-created').textContent = orchestrator.afkSummaryData.memoriesCreated;
    
    // Fill actions list
    const actionList = document.getElementById('summary-action-list');
    window.renderSafeHTML(actionList, '');
    
    if (orchestrator.afkSummaryData.actionsList.length === 0) {
      window.renderSafeHTML(actionList, '<li class="summary-action-item" style="border-left-color: var(--text-muted)"><span>Astra monitored the workspace but did not execute active modifications.</span></li>');
    } else {
      orchestrator.afkSummaryData.actionsList.forEach(item => {
        const li = document.createElement('li');
        li.className = 'summary-action-item';
        window.renderSafeHTML(li, `
          <span>${item.action}</span>
          <span class="summary-action-time">${item.time}</span>
        `);
        actionList.appendChild(li);
      });
    }

    // Fill diff preview viewer!
    const diffContainer = document.getElementById('summary-diff-container');
    window.renderSafeHTML(diffContainer, '');
    
    if (orchestrator.afkSummaryData.filesModified.length > 0) {
      orchestrator.afkSummaryData.filesModified.forEach(filePath => {
        const fileNode = state.resolvePath(filePath);
        if (!fileNode) return;
        
        const fileName = filePath.split('/').pop();
        
        let diffText = '';
        if (fileName === 'index.js') {
          diffText = '<span class="diff-file">diff --git a/index.js b/index.js</span>' +
'<span class="diff-del">- // TODO: Implement the express endpoints for agent council communication</span>' +
'<span class="diff-add">+ // Implement the express endpoints for agent council communication</span>' +
'<span class="diff-add">+ app.post(\'/api/v1/council\', (req, res) => {</span>' +
'<span class="diff-add">+   const { command, payload } = req.body;</span>' +
'<span class="diff-add">+   console.log(`[Council] Received instruction: ${command}`);</span>' +
'<span class="diff-add">+   res.status(200).json({ success: true, message: \'Command queued\' });</span>' +
'<span class="diff-add">+ });</span>';
        } else if (fileName === 'README.md') {
          diffText = '<span class="diff-file">diff --git a/README.md b/README.md</span>' +
'<span class="diff-add">+ ### Council Endpoint</span>' +
'<span class="diff-add">+ - **URL:** `/api/v1/council`</span>' +
'<span class="diff-add">+ - **Method:** `POST`</span>' +
'<span class="diff-add">+ - **Payload:** `{ "command": String, "payload": Object }`</span>';
        }
        
        const fileDiff = document.createElement('div');
        fileDiff.style.marginBottom = '14px';
        window.renderSafeHTML(fileDiff, diffText);
        diffContainer.appendChild(fileDiff);
      });
    } else {
      window.renderSafeHTML(diffContainer, '<span style="color: var(--text-muted)">No files were modified during this session.</span>');
    }

    const undoBtn = document.getElementById('afk-undo-btn');
    if (undoBtn) {
      if (orchestrator.afkSummaryData.filesModified.length > 0) {
        undoBtn.style.display = 'block';
      } else {
        undoBtn.style.display = 'none';
      }
    }

    summaryDialog.showModal();

    // Tab bindings inside summary dialog
    const tabs = summaryDialog.querySelectorAll('.summary-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const targetTab = tab.getAttribute('data-tab');
        summaryDialog.querySelectorAll('.summary-tab-content').forEach(content => {
          content.classList.remove('active');
        });
        document.getElementById(`tab-${targetTab}`).classList.add('active');
      });
    });

    // Close button
    document.getElementById('close-summary-btn').addEventListener('click', () => {
      summaryDialog.close();
      const undoBtn = document.getElementById('afk-undo-btn');
      if (undoBtn) undoBtn.style.display = 'none';
    });
  }

  // ==========================================
  // 7. General Sidebar Memory Quick-list
  // ==========================================

  function refreshSidebarMemories() {
    const list = document.getElementById('memory-quick-list');
    if (!list) return;

    window.renderSafeHTML(list, '');
    // Pull last 4 nodes from State memory
    const nodes = state.memoryGraph.nodes.slice(-4).reverse();
    nodes.forEach(n => {
      const li = document.createElement('li');
      li.className = 'memory-tag-item';
      
      // Style color based on node type
      let border = '2px solid var(--color-purple)';
      if (n.type === 'file') border = '2px solid var(--color-amber)';
      else if (n.type === 'endpoint') border = '2px solid var(--color-green)';
      else if (n.type === 'tech') border = '2px solid var(--color-blue)';
      
      li.style.borderLeft = border;
      window.renderSafeHTML(li, html`<span>${n.label}</span>`);
      list.appendChild(li);
    });
  }

  const openMemAppBtn = document.getElementById('open-memory-app-btn');
  if (openMemAppBtn) {
    openMemAppBtn.addEventListener('click', () => {
      ui.openApp('memory');
    });
  }

  // Toggle voice output in the sidebar
  const voiceToggleBtn = document.getElementById('sidebar-voice-toggle-btn');
  const updateVoiceToggleButton = () => {
    if (!voiceToggleBtn) return;
    const isEnabled = state.registry.ai.voiceEnabled;
    voiceToggleBtn.textContent = isEnabled ? '🔊 Voice Output: On' : '🔇 Voice Output: Off';
    voiceToggleBtn.style.color = isEnabled ? 'var(--color-green)' : 'var(--text-muted)';
  };
  if (voiceToggleBtn) {
    updateVoiceToggleButton();
    voiceToggleBtn.addEventListener('click', () => {
      state.registry.ai.voiceEnabled = !state.registry.ai.voiceEnabled;
      state.saveState();
      updateVoiceToggleButton();
      ui.showToast('Voice Settings', `Voice response speaking ${state.registry.ai.voiceEnabled ? 'enabled' : 'disabled'}.`, 'info');
    });
  }

  // ==========================================
  // 8. Workflow Initiators
  // ==========================================
  
  function triggerAgentWorkflow() {
    const textInput = 'Implement routes check and build project gateway.';
    orchestrator.startWorkflow(textInput);
    
    // Automatically trigger app opens to show layout active
    setTimeout(() => ui.openApp('editor'), 400);
    setTimeout(() => ui.openApp('tasks'), 1000);
    setTimeout(() => ui.openApp('terminal'), 3200);
  }

  // Hook memory focus scraper into UI focus changes
  window.MemoryHook = function(appName) {
    // Add memory relation on node focus
    const nodeLabel = `App: ${appName.charAt(0).toUpperCase() + appName.slice(1)}`;
    const nodeId = `app-${appName}`;
    
    state.addMemoryNode(nodeId, nodeLabel, 'application');
    state.addMemoryLink('usr-divyanshu', nodeId, 'focused');
    
    refreshSidebarMemories();
    window.drawMemoryGraphApp();
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootOS);
} else {
  bootOS();
}
