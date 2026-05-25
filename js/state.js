// ==========================================
// Astra OS State Management Module (Expanded)
// ==========================================

export class OSState {
  constructor() {
    this.schemaVersion = 2;
    this.fs = {};
    this.memoryGraph = { nodes: [], links: [] };
    this.processes = {};
    this.agentTasks = [];
    this.auditLogs = [];
    this.activeWindow = null;

    // --- New kernel-level state ---
    this.processTable = [];
    this.users = [];
    this.currentSession = {};
    this.packages = [];
    this.network = {};
    this.gitRepos = {};
    this.hardware = {};
    this.registry = {};
    this.notifications = [];
    this.trash = [];
    this.locks = [];
    this.workflows = [];
    this.eventLog = [];
    this.env = { PATH: '/bin:/usr/bin', USER: 'divyanshu', HOME: '/home/divyanshu', SHELL: '/bin/sh' };

    this.systemVars = {
      user: 'Divyanshu',
      activeProject: 'Project Astra',
      localModel: 'Llama 3.2 3B (Local)',
      cloudModel: 'Gemini 3.5 Flash',
      currentModelMode: 'Cloud (Gemini)',
      tokensConsumed: 4820,
      afkRunning: false,
      afkStartTime: null,
      voiceActive: false,
      sidebarOpen: false,
      currentWorkspace: 0
    };

    this.initializeState();
    this.initIndexedDB();
  }

  initIndexedDB() {
    return new Promise((resolve) => {
      const request = indexedDB.open('AstraOSDatabase', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('state')) {
          db.createObjectStore('state');
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        const transaction = this.db.transaction(['state'], 'readonly');
        const store = transaction.objectStore('state');
        const getRequest = store.get('current_state');
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            const parsed = getRequest.result;
            if (parsed.fs) this.fs = parsed.fs;
            if (parsed.memoryGraph) this.memoryGraph = parsed.memoryGraph;
            if (parsed.agentTasks) this.agentTasks = parsed.agentTasks;
            if (parsed.registry) this.registry = parsed.registry;
            if (parsed.processTable) this.processTable = parsed.processTable;
            if (parsed.env) this.env = parsed.env;
            if (parsed.workflows) this.workflows = parsed.workflows;
            if (parsed.eventLog) this.eventLog = parsed.eventLog;
            console.log('[IndexedDB] Successfully loaded state.');
            if (window.refreshExplorerGrid) window.refreshExplorerGrid();
            if (window.refreshTasksBoard) window.refreshTasksBoard();
            if (window.drawMemoryGraphApp) window.drawMemoryGraphApp();
            if (window.refreshSidebarMemories) window.refreshSidebarMemories();
          }
          resolve(true);
        };
        getRequest.onerror = () => resolve(false);
      };
      request.onerror = () => resolve(false);
    });
  }

  initializeState() {
    if (localStorage.getItem('astra_os_state')) {
      try {
        const parsed = JSON.parse(localStorage.getItem('astra_os_state'));
        this.fs = parsed.fs || {};
        this.memoryGraph = parsed.memoryGraph || { nodes: [], links: [] };
        this.processes = parsed.processes || {};
        this.agentTasks = parsed.agentTasks || [];
        this.auditLogs = parsed.auditLogs || [];
        this.activeWindow = parsed.activeWindow || null;
        this.systemVars = parsed.systemVars || this.systemVars;
        this.processTable = parsed.processTable || [];
        this.users = Array.isArray(parsed.users) ? parsed.users : [];
        this.currentSession = parsed.currentSession || {};
        this.packages = parsed.packages || [];
        this.network = parsed.network || {};
        this.gitRepos = parsed.gitRepos || {};
        this.hardware = parsed.hardware || {};
        this.registry = parsed.registry || {};
        this.workflows = parsed.workflows || [];
        this.eventLog = parsed.eventLog || [];
        if (!this.registry.ai) {
          this.registry.ai = {
            provider: 'gemini',
            apiKey: '',
            model: 'gemini-1.5-flash',
            systemPrompt: 'You are Astra OS Copilot, an advanced agentic AI built into Astra OS. You help the user manage files, run terminal commands, and organize tasks.',
            temperature: 0.7,
            voiceEnabled: true
          };
        } else if (this.registry.ai.voiceEnabled === undefined) {
          this.registry.ai.voiceEnabled = true;
        }
        this.notifications = parsed.notifications || [];
        this.trash = parsed.trash || [];
        this.locks = parsed.locks || [];
        this.env = parsed.env || { PATH: '/bin:/usr/bin', USER: 'divyanshu', HOME: '/home/divyanshu', SHELL: '/bin/sh' };
        // Ensure users structure exists and is populated
        if (this.users.length === 0) {
          this.seedUsers();
        }

        // Migrate divyanshu password from 'astra' or empty/undefined to '1234' while preserving custom passwords
        let divy = this.users.find(u => u.username === 'divyanshu');
        if (!divy) {
          divy = { uid: 1000, username: 'divyanshu', displayName: 'Divyanshu', password: '1234', role: 'admin', homeDir: '/home/divyanshu', shell: '/bin/sh' };
          this.users.push(divy);
          this.saveState();
        } else if (divy.password === 'astra' || !divy.password) {
          divy.password = '1234';
          this.saveState();
        }

        // Enforce active session to default to divyanshu and unlocked, preventing lockout
        this.currentSession.isLocked = false;
        if (!this.currentSession.currentUser || this.currentSession.currentUser === 'guest' || this.currentSession.currentUser === 'root') {
          this.currentSession.currentUser = 'divyanshu';
          this.currentSession.uid = 1000;
          this.currentSession.role = 'admin';
          this.saveState();
        }

        if (!this.processes.dailybriefing) {
          this.processes.dailybriefing = { open: false, minimized: false, x: 220, y: 120, w: 680, h: 480, zIndex: 23 };
          this.saveState();
        }
        if (!this.processes.trust) {
          this.processes.trust = { open: false, minimized: false, x: 140, y: 90, w: 720, h: 500, zIndex: 24 };
          this.saveState();
        }
        if (!this.processes.timeline) {
          this.processes.timeline = { open: false, minimized: false, x: 260, y: 130, w: 700, h: 480, zIndex: 25 };
          this.saveState();
        }
        if (!this.registry.safety) {
          this.registry.safety = {
            writePolicy: 'ask',
            commandPolicy: 'ask',
            networkPolicy: 'approve',
            settingsPolicy: 'ask',
            confidenceThreshold: 85
          };
          this.saveState();
        }
        if (!this.registry.system.capsules) {
          this.registry.system.capsules = [
            {
              id: 'capsule-satellite',
              name: 'AI Satellite Defense Project',
              focusMode: 'deepwork',
              activeFile: '/Satellite_Defense/control.js',
              openApps: ['editor', 'terminal', 'trust'],
              description: 'Satellite telemetry feeds, collision avoidance algorithms, active warning grid.'
            },
            {
              id: 'capsule-astra',
              name: 'Project Astra Core Gateway',
              focusMode: 'coding',
              activeFile: '/Project_Astra/index.js',
              openApps: ['editor', 'tasks', 'dashboard'],
              description: 'Gateway route initializer for Express, websocket interfaces.'
            },
            {
              id: 'capsule-research',
              name: 'Research Mode: Agent Architectures',
              focusMode: 'research',
              activeFile: '/Project_Astra/README.md',
              openApps: ['browser', 'memory', 'timeline'],
              description: 'Comparing multi-agent routing engines and vector memory strategies.'
            }
          ];
          this.saveState();
        }

        if (Object.keys(this.fs).length > 0) {
          return;
        }
      } catch (err) {
        console.error('Failed to load OS State. Re-seeding.', err);
        this.seedDefaults();
        return;
      }
    }
    this.seedDefaults();
  }

  seedDefaults() {
    this.seedFilesystem();
    this.seedUsers();
    this.seedPackages();
    this.seedNetwork();
    this.seedHardware();
    this.seedRegistry();
    this.seedProcesses();
    this.seedMemoryGraph();
    this.seedAgentTasks();
    this.seedAuditLogs();
    this.processTable = [];
    this.gitRepos = {};
    this.notifications = [];
    this.trash = [];
    this.env = { PATH: '/bin:/usr/bin', USER: 'divyanshu', HOME: '/home/divyanshu', SHELL: '/bin/sh' };
    this.workflows = [];
    this.eventLog = [];
    this.currentSession = {
      currentUser: 'divyanshu',
      uid: 1000,
      role: 'admin',
      isLocked: false,
      lastLoginTime: Date.now()
    };
    this.saveState();
  }

  // ==========================================
  // Seed: Full Unix-Style Virtual Filesystem
  // ==========================================
  seedFilesystem() {
    const mkDir = (name, children = {}, opts = {}) => ({ type: 'dir', name, children, ...opts });
    const mkFile = (name, content, opts = {}) => ({ type: 'file', name, content, owner: 'divyanshu', group: 'staff', permissions: 'rw-r--r--', ...opts });

    this.fs = {
      'root': mkDir('root', {
        'bin': mkDir('bin', {
          'ls': mkFile('ls', '#!/bin/sh\n# list directory contents', { permissions: 'rwxr-xr-x', owner: 'root' }),
          'cat': mkFile('cat', '#!/bin/sh\n# concatenate and print files', { permissions: 'rwxr-xr-x', owner: 'root' }),
          'echo': mkFile('echo', '#!/bin/sh\n# display a line of text', { permissions: 'rwxr-xr-x', owner: 'root' }),
          'mkdir': mkFile('mkdir', '#!/bin/sh\n# make directories', { permissions: 'rwxr-xr-x', owner: 'root' }),
          'rm': mkFile('rm', '#!/bin/sh\n# remove files or directories', { permissions: 'rwxr-xr-x', owner: 'root' }),
          'cp': mkFile('cp', '#!/bin/sh\n# copy files', { permissions: 'rwxr-xr-x', owner: 'root' }),
          'mv': mkFile('mv', '#!/bin/sh\n# move/rename files', { permissions: 'rwxr-xr-x', owner: 'root' }),
          'chmod': mkFile('chmod', '#!/bin/sh\n# change file permissions', { permissions: 'rwxr-xr-x', owner: 'root' }),
          'sh': mkFile('sh', '#!/bin/sh\n# astra shell', { permissions: 'rwxr-xr-x', owner: 'root' })
        }),
        'etc': mkDir('etc', {
          'hosts': mkFile('hosts', `127.0.0.1   localhost\n192.168.1.42  astra-desktop\n142.250.80.46 google.com\n140.82.121.4  github.com\n151.101.1.69  stackoverflow.com`, { permissions: 'rw-r--r--', owner: 'root' }),
          'passwd': mkFile('passwd', `root:x:0:0:root:/root:/bin/sh\ndivyanshu:x:1000:1000:Divyanshu:/home/divyanshu:/bin/sh\nguest:x:1001:1001:Guest:/home/guest:/bin/sh`, { permissions: 'rw-r--r--', owner: 'root' }),
          'fstab': mkFile('fstab', html`# <device>    <mount>   <type>  <options>  <dump>  <pass>\n/dev/sda1     /         ext4    defaults   0       1\n/dev/sda2     /boot     ext4    defaults   0       2\n/dev/sdb1     /mnt/usb  fat32   noauto     0       0`, { permissions: 'rw-r--r--', owner: 'root' }),
          'hostname': mkFile('hostname', 'astra-desktop', { permissions: 'rw-r--r--', owner: 'root' }),
          'os-release': mkFile('os-release', `NAME="Astra OS"\nVERSION="1.0 (Quantum)"\nID=astra\nVERSION_ID=1.0\nPRETTY_NAME="Astra OS 1.0 (Quantum)"\nHOME_URL="https://astra.os"\nBUG_REPORT_URL="https://astra.os/issues"`, { permissions: 'rw-r--r--', owner: 'root' })
        }),
        'home': mkDir('home', {
          'divyanshu': mkDir('divyanshu', {
            '.bashrc': mkFile('.bashrc', `# ~/.bashrc\nexport PS1='\\u@astra:\\w$ '\nexport PATH=/usr/bin:/bin\nalias ll='ls -la'\nalias gs='git status'`),
            '.bash_history': mkFile('.bash_history', `ls\ncat README.md\nnpm run build\ngit status`),
            'Desktop': mkDir('Desktop', {}),
            'Documents': mkDir('Documents', {
              'system_preferences.txt': mkFile('system_preferences.txt', `USER: Divyanshu\nTHEME: Dark Glassmorphic\nDEFAULT_AI_MODE: Cloud-First\nAUTO_SAVE: Enabled\nBOUNDED_AUTONOMY: Verified Only\n`),
              'notes.txt': mkFile('notes.txt', `- Design: Keep UI very compact, use Outfit font.\n- AFK mode: Display floating bubbles and a live terminal output trace.\n- Memory: Let the system auto-generate connections whenever we edit files.\n`)
            }),
            'Downloads': mkDir('Downloads', {}),
            'Pictures': mkDir('Pictures', {})
          }),
          'guest': mkDir('guest', {})
        }),
        'var': mkDir('var', {
          'log': mkDir('log', {
            'syslog': mkFile('syslog', `[${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}] [INFO] [kernel] Astra OS booted successfully\n`, { owner: 'root' }),
            'auth.log': mkFile('auth.log', '', { owner: 'root' }),
            'apt.log': mkFile('apt.log', '', { owner: 'root' })
          })
        }),
        'usr': mkDir('usr', {
          'bin': mkDir('bin', {}),
          'share': mkDir('share', {
            'wallpapers': mkDir('wallpapers', {
              'default.txt': mkFile('default.txt', 'radial-gradient(circle at 10% 20%, hsla(260, 60%, 12%, 0.6) 0%, transparent 40%), radial-gradient(circle at 85% 80%, hsla(220, 50%, 10%, 0.6) 0%, transparent 45%), linear-gradient(135deg, hsl(230, 20%, 4%) 0%, hsl(240, 25%, 7%) 100%)'),
              'aurora.txt': mkFile('aurora.txt', 'radial-gradient(circle at 30% 50%, hsla(180, 60%, 15%, 0.6) 0%, transparent 40%), radial-gradient(circle at 70% 30%, hsla(140, 50%, 12%, 0.5) 0%, transparent 45%), linear-gradient(135deg, hsl(200, 25%, 5%) 0%, hsl(180, 20%, 3%) 100%)'),
              'ember.txt': mkFile('ember.txt', 'radial-gradient(circle at 20% 80%, hsla(20, 70%, 15%, 0.6) 0%, transparent 40%), radial-gradient(circle at 80% 20%, hsla(350, 60%, 12%, 0.5) 0%, transparent 45%), linear-gradient(135deg, hsl(15, 25%, 5%) 0%, hsl(350, 20%, 4%) 100%)')
            })
          })
        }),
        'dev': mkDir('dev', {
          'null': mkFile('null', '', { permissions: 'rw-rw-rw-', owner: 'root' }),
          'zero': mkFile('zero', '', { permissions: 'rw-rw-rw-', owner: 'root' }),
          'random': mkFile('random', '', { permissions: 'rw-rw-rw-', owner: 'root' }),
          'sda': mkFile('sda', '[block device: 512GB NVMe SSD]', { permissions: 'rw-r-----', owner: 'root' }),
          'sda1': mkFile('sda1', '[partition: / ext4 450GB]', { permissions: 'rw-r-----', owner: 'root' }),
          'sda2': mkFile('sda2', '[partition: /boot ext4 2GB]', { permissions: 'rw-r-----', owner: 'root' }),
          'sdb1': mkFile('sdb1', '[partition: /mnt/usb fat32 64GB USB]', { permissions: 'rw-r-----', owner: 'root' })
        }),
        'tmp': mkDir('tmp', {}),
        'mnt': mkDir('mnt', {
          'usb': mkDir('usb', {
            'photos_backup': mkDir('photos_backup', {}),
            'transfer.zip': mkFile('transfer.zip', '[binary: 24.5MB zip archive]')
          })
        }),
        'Project_Astra': mkDir('Project_Astra', {
          'README.md': mkFile('README.md', `# Project Astra\n\nAstra is an experimental autonomous agent gateway built with a micro-agent architecture.\n\n## Architecture\n- PlannerAgent: Breaks user prompt into subtasks.\n- ExecutorAgent: Modifies file contents and runs builds.\n- WatcherAgent: Catches runtime execution failures.\n- MemoryAgent: Relates active state to the database.\n\n## Quickstart\nRun \`npm install\` to install dependencies.\nRun \`npm run build\` to verify correct assembly.\n`),
          'index.js': mkFile('index.js', `// ==========================================\n// Project Astra Gateway Route Initializer\n// ==========================================\nconst express = require('express');\nconst app = express();\nconst PORT = process.env.PORT || 8080;\n\napp.use(express.json());\n\n// Base Health Check\napp.get('/health', (req, res) => {\n  res.status(200).json({ status: 'healthy', timestamp: Date.now() });\n});\n\n// TODO: Implement the express endpoints for agent council communication\n// The Planner agent must be able to POST steps to this route.\n// Executor agent will hook into the WebSocket server.\n\napp.listen(PORT, () => {\n  console.log(\`[Astra] Gateway listening on port \${PORT}\`);\n});\n`),
          'package.json': mkFile('package.json', `{\n  "name": "project-astra-gateway",\n  "version": "1.0.0",\n  "description": "Gateway route initializer for Astra",\n  "main": "index.js",\n  "scripts": {\n    "start": "node index.js",\n    "build": "node -c index.js",\n    "test": "echo \\"Error: no test specified\\" && exit 0"\n  },\n  "dependencies": {\n    "express": "^4.19.2"\n  }\n}`)
        }),
        'Satellite_Defense': mkDir('Satellite_Defense', {
          'README.md': mkFile('README.md', `# AI Satellite Defense Project\n\nSimulating orbital telemetry streams, hazard avoidance collision maneuvers, and communication links.\n\n## Operations\n- Telemetry ingestion from constellation.\n- Threat/Debris detection logic.\n- Thruster ignition sequences.\n`),
          'control.js': mkFile('control.js', `// ==========================================\n// Satellite Telemetry Avoidance Control\n// ==========================================\nconst Telemetry = {\n  status: "nominal",\n  altitude: 540.2, // km\n  velocity: 7.8, // km/s\n  heading: 182.4, // deg\n  debrisAlert: false\n};\n\nfunction verifyCollisionPath(objectTrack) {\n  console.log(\`[Defense] Checking trajectory against tracks...\`);\n  // TODO: Implement proximity calculations\n  return false;\n}\n\nfunction initiateEvasiveManeuver() {\n  console.log("[Defense] WARNING: Threat detected. Initiating thrust cycle.");\n  Telemetry.status = "maneuver";\n  Telemetry.altitude += 2.5; // elevate orbit\n}\n\n// Monitoring loop\nsetInterval(() => {\n  console.log(\`[Defense] Status: \${Telemetry.status} | Altitude: \${Telemetry.altitude} km\`);\n}, 5000);\n`)
        })
      })
    };
  }

  // ==========================================
  // Seed: User Accounts
  // ==========================================
  seedUsers() {
    this.users = [
      { uid: 0, username: 'root', displayName: 'System Administrator', password: 'root', role: 'admin', homeDir: '/root', shell: '/bin/sh' },
      { uid: 1000, username: 'divyanshu', displayName: 'Divyanshu', password: '1234', role: 'admin', homeDir: '/home/divyanshu', shell: '/bin/sh' },
      { uid: 1001, username: 'guest', displayName: 'Guest', password: '', role: 'guest', homeDir: '/home/guest', shell: '/bin/sh' }
    ];
  }

  // ==========================================
  // Seed: Package Registry
  // ==========================================
  seedPackages() {
    this.packages = [
      { name: 'neofetch', version: '7.1.0', description: 'System information tool with ASCII art', installed: false, category: 'system' },
      { name: 'cowsay', version: '3.04', description: 'Talking ASCII cow that says your message', installed: false, category: 'fun' },
      { name: 'fortune', version: '1.99', description: 'Random quotations and aphorisms', installed: false, category: 'fun' },
      { name: 'htop', version: '3.3.0', description: 'Interactive process viewer', installed: false, category: 'system' },
      { name: 'git', version: '2.44.0', description: 'Distributed version control system', installed: true, category: 'dev' },
      { name: 'python', version: '3.12.1', description: 'Python programming language interpreter', installed: false, category: 'dev' },
      { name: 'gcc', version: '13.2.0', description: 'GNU Compiler Collection', installed: false, category: 'dev' },
      { name: 'vim', version: '9.1', description: 'Improved vi text editor', installed: false, category: 'editor' },
      { name: 'nano', version: '7.2', description: 'Simple terminal text editor', installed: false, category: 'editor' },
      { name: 'wget', version: '1.21', description: 'Network downloader', installed: false, category: 'network' },
      { name: 'tree', version: '2.1.1', description: 'Directory tree listing', installed: false, category: 'system' },
      { name: 'sl', version: '5.02', description: 'Steam Locomotive runs across terminal', installed: false, category: 'fun' },
      { name: 'figlet', version: '2.2.5', description: 'Display large ASCII art text banners', installed: false, category: 'fun' },
      { name: 'lolcat', version: '100.0.1', description: 'Rainbow colorize text output', installed: false, category: 'fun' },
      { name: 'bat', version: '0.24.0', description: 'Cat clone with syntax highlighting', installed: false, category: 'system' },
      { name: 'jq', version: '1.7', description: 'Command-line JSON processor', installed: false, category: 'dev' },
      { name: 'fzf', version: '0.46', description: 'Fuzzy finder for terminal', installed: false, category: 'system' },
      { name: 'tmux', version: '3.4', description: 'Terminal multiplexer', installed: false, category: 'system' },
      { name: 'nmap', version: '7.94', description: 'Network exploration and audit tool', installed: false, category: 'network' },
      { name: 'whois', version: '5.5.20', description: 'Domain name lookup tool', installed: false, category: 'network' },
      { name: 'curl', version: '8.5.0', description: 'Transfer data from URLs', installed: true, category: 'network' },
      { name: 'nodejs', version: '20.10.0', description: 'JavaScript runtime environment', installed: true, category: 'dev' },
      { name: 'npm', version: '10.2.3', description: 'Node.js package manager', installed: true, category: 'dev' },
      { name: 'astroid', version: '1.0.0', description: 'Retro Astro-Defense arcade shooter desktop app', installed: false, category: 'fun' },
      { name: 'pulsewave', version: '1.0.0', description: 'Realtime audio visualizer and ambient soundscapes desktop app', installed: false, category: 'fun' }
    ];
  }

  // ==========================================
  // Seed: Network Configuration
  // ==========================================
  seedNetwork() {
    this.network = {
      eth0: { ip: '10.0.2.15', subnet: '255.255.255.0', broadcast: '10.0.2.255', gateway: '10.0.2.1', active: true },
      wlan0: { ip: '192.168.1.42', subnet: '255.255.255.0', ssid: 'AstraNet-5G', signal: 92, active: true },
      dns: '8.8.8.8',
      hostname: 'astra-desktop',
      airplaneMode: false,
      availableNetworks: [
        { ssid: 'AstraNet-5G', signal: 92, security: 'WPA3', connected: true },
        { ssid: 'Neighbors-WiFi', signal: 45, security: 'WPA2', connected: false },
        { ssid: 'CoffeeShop-Free', signal: 30, security: 'Open', connected: false },
        { ssid: 'Office-Secure', signal: 78, security: 'WPA3-Enterprise', connected: false }
      ]
    };
  }

  // ==========================================
  // Seed: Hardware Specifications
  // ==========================================
  seedHardware() {
    this.hardware = {
      cpu: { model: 'Astra Quantum AP-16 @ 4.2GHz', cores: 16, threads: 32, architecture: 'x86_64', cache: '32 MB L3' },
      ram: { totalGB: 32, type: 'DDR5-5600', slots: 2, modulesInstalled: 2 },
      gpu: { model: 'Astra Iris Pro 780', vramGB: 8, driver: 'astra-gpu 535.129.03' },
      storage: {
        partitions: [
          { device: '/dev/sda1', mountpoint: '/', fsType: 'ext4', sizeGB: 450, usedGB: 128, mounted: true, label: 'Astra System' },
          { device: '/dev/sda2', mountpoint: '/boot', fsType: 'ext4', sizeGB: 2, usedGB: 0.3, mounted: true, label: 'Boot' },
          { device: '/dev/sdb1', mountpoint: '/mnt/usb', fsType: 'fat32', sizeGB: 64, usedGB: 24, mounted: true, label: 'USB Drive' }
        ]
      },
      network: { adapter: 'Intel AX211 Wi-Fi 6E', ethernet: 'Realtek RTL8125 2.5GbE' },
      audio: { device: 'Astra HD Audio', driver: 'snd_astra 6.2.0' },
      display: { resolution: '2560x1440', refreshRate: '144Hz', scaling: '100%' },
      usb: [
        { name: 'USB Flash Drive 64GB', type: 'USB 3.0', status: 'Connected' },
        { name: 'Logitech MX Master 3', type: 'USB Receiver', status: 'Connected' },
        { name: 'Blue Yeti Microphone', type: 'USB 2.0', status: 'Connected' }
      ]
    };
  }

  // ==========================================
  // Seed: System Registry
  // ==========================================
  seedRegistry() {
    this.registry = {
      appearance: {
        accentColor: 'purple',
        wallpaper: 'default',
        fontSize: 13,
        dockPosition: 'bottom',
        dockSize: 'medium'
      },
      security: {
        autoLockTimeout: 300,
        requirePasswordOnWake: true,
        enforcePermissions: true
      },
      safety: {
        writePolicy: 'ask',
        commandPolicy: 'ask',
        networkPolicy: 'approve',
        settingsPolicy: 'ask',
        confidenceThreshold: 85
      },
      system: {
        hostname: 'astra-desktop',
        startupApps: ['editor', 'tasks'],
        defaultShell: '/bin/sh',
        timeFormat: '12h',
        soundEnabled: true,
        focusMode: 'coding',
        capsules: [
          {
            id: 'capsule-satellite',
            name: 'AI Satellite Defense Project',
            focusMode: 'deepwork',
            activeFile: '/Satellite_Defense/control.js',
            openApps: ['editor', 'terminal', 'trust'],
            description: 'Satellite telemetry feeds, collision avoidance algorithms, active warning grid.'
          },
          {
            id: 'capsule-astra',
            name: 'Project Astra Core Gateway',
            focusMode: 'coding',
            activeFile: '/Project_Astra/index.js',
            openApps: ['editor', 'tasks', 'dashboard'],
            description: 'Gateway route initializer for Express, websocket interfaces.'
          },
          {
            id: 'capsule-research',
            name: 'Research Mode: Agent Architectures',
            focusMode: 'research',
            activeFile: '/Project_Astra/README.md',
            openApps: ['browser', 'memory', 'timeline'],
            description: 'Comparing multi-agent routing engines and vector memory strategies.'
          }
        ]
      },
      keybindings: {
        commandPalette: 'Cmd+K',
        lockScreen: 'Cmd+L',
        toggleSidebar: 'Cmd+\\',
        snapLeft: 'Cmd+Left',
        snapRight: 'Cmd+Right',
        maximize: 'Cmd+Up'
      },
      ai: {
        provider: 'gemini',
        apiKey: '',
        model: 'gemini-1.5-flash',
        systemPrompt: 'You are Astra OS Copilot, an advanced agentic AI built into Astra OS. You help the user manage files, run terminal commands, and organize tasks.',
        temperature: 0.7,
        voiceEnabled: true
      }
    };
  }

  // ==========================================
  // Seed: Window Processes
  // ==========================================
  seedProcesses() {
    this.processes = {
      'explorer': { open: false, minimized: false, x: 80, y: 60, w: 620, h: 420, zIndex: 10 },
      'editor': { open: false, minimized: false, x: 280, y: 100, w: 700, h: 480, zIndex: 11 },
      'memory': { open: false, minimized: false, x: 180, y: 120, w: 600, h: 460, zIndex: 12 },
      'tasks': { open: false, minimized: false, x: 350, y: 150, w: 680, h: 440, zIndex: 13 },
      'terminal': { open: false, minimized: false, x: 480, y: 220, w: 580, h: 360, zIndex: 14 },
      'dashboard': { open: false, minimized: false, x: 120, y: 80, w: 720, h: 460, zIndex: 15 },
      'sysmonitor': { open: false, minimized: false, x: 200, y: 100, w: 680, h: 480, zIndex: 16 },
      'calculator': { open: false, minimized: false, x: 500, y: 200, w: 320, h: 460, zIndex: 17 },
      'settings': { open: false, minimized: false, x: 150, y: 60, w: 740, h: 520, zIndex: 18 },
      'browser': { open: false, minimized: false, x: 100, y: 50, w: 800, h: 540, zIndex: 19 },
      'appstore': { open: false, minimized: false, x: 160, y: 80, w: 720, h: 500, zIndex: 20 },
      'devicemgr': { open: false, minimized: false, x: 250, y: 120, w: 600, h: 440, zIndex: 21 },
      'diskutil': { open: false, minimized: false, x: 300, y: 140, w: 640, h: 420, zIndex: 22 },
      'dailybriefing': { open: false, minimized: false, x: 220, y: 120, w: 680, h: 480, zIndex: 23 },
      'trust': { open: false, minimized: false, x: 140, y: 90, w: 720, h: 500, zIndex: 24 },
      'timeline': { open: false, minimized: false, x: 260, y: 130, w: 700, h: 480, zIndex: 25 },
      'workflow': { open: false, minimized: false, x: 180, y: 100, w: 760, h: 520, zIndex: 26 }
    };
  }

  // ==========================================
  // Seed: Memory Graph
  // ==========================================
  seedMemoryGraph() {
    this.memoryGraph = {
      nodes: [
        { id: 'usr-divyanshu', label: 'User: Divyanshu', type: 'user', x: 200, y: 150 },
        { id: 'proj-astra', label: 'Active: Project Astra', type: 'project', x: 400, y: 150 },
        { id: 'tech-node-js', label: 'Stack: Node.js (Express)', type: 'tech', x: 550, y: 80 },
        { id: 'pref-theme', label: 'Pref: Dark Glassmorphic', type: 'preference', x: 100, y: 250 },
        { id: 'file-readme', label: 'File: README.md', type: 'file', x: 300, y: 270 },
        { id: 'file-index', label: 'File: index.js', type: 'file', x: 500, y: 250 }
      ],
      links: [
        { source: 'usr-divyanshu', target: 'proj-astra', relation: 'works_on' },
        { source: 'usr-divyanshu', target: 'pref-theme', relation: 'prefers' },
        { source: 'proj-astra', target: 'tech-node-js', relation: 'built_with' },
        { source: 'proj-astra', target: 'file-readme', relation: 'contains' },
        { source: 'proj-astra', target: 'file-index', relation: 'contains' },
        { source: 'file-index', target: 'tech-node-js', relation: 'requires' }
      ]
    };
  }

  // ==========================================
  // Seed: Agent Tasks
  // ==========================================
  seedAgentTasks() {
    this.agentTasks = [
      { id: 'task-1', title: 'Analyze index.js', desc: 'Read code structure and extract TODO checklist items', status: 'completed', assigned: 'PlannerAgent' },
      { id: 'task-2', title: 'Implement council POST endpoint', desc: 'Write POST handler code inside index.js', status: 'pending', assigned: 'ExecutorAgent' },
      { id: 'task-3', title: 'Initialize WebSockets', desc: 'Establish client-agent websocket connection', status: 'pending', assigned: 'ExecutorAgent' },
      { id: 'task-4', title: 'Verify compile and build', desc: 'Run node -c index.js to ensure no syntax errors', status: 'pending', assigned: 'WatcherAgent' },
      { id: 'task-5', title: 'Update README reference', desc: 'Add api specifications to README.md file', status: 'pending', assigned: 'MemoryAgent' }
    ];
  }

  // ==========================================
  // Seed: Audit Logs
  // ==========================================
  seedAuditLogs() {
    this.auditLogs = [
      { timestamp: '17:30:12', agent: 'System', action: 'Astra OS Shell successfully initialized.' },
      { timestamp: '17:31:05', agent: 'MemoryAgent', action: 'Scraped environment. Found Project_Astra.' },
      { timestamp: '17:33:45', agent: 'User', action: 'Opened Code Editor: index.js.' },
      { timestamp: '17:35:02', agent: 'PlannerAgent', action: 'Scanned file TODOs. Formulated task list.' }
    ];
  }

  // ==========================================
  // Persistence
  // ==========================================
  saveState() {
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
    }
    this._saveTimeout = setTimeout(() => {
      this._executeSaveState();
    }, 100);
  }

  _executeSaveState() {
    const raw = {
      schemaVersion: this.schemaVersion,
      fs: this.fs,
      memoryGraph: this.memoryGraph,
      processes: this.processes,
      agentTasks: this.agentTasks,
      auditLogs: this.auditLogs,
      activeWindow: this.activeWindow,
      systemVars: this.systemVars,
      processTable: this.processTable,
      users: this.users,
      currentSession: this.currentSession,
      packages: this.packages,
      network: this.network,
      gitRepos: this.gitRepos,
      hardware: this.hardware,
      registry: this.registry,
      notifications: this.notifications,
      trash: this.trash,
      locks: this.locks,
      workflows: this.workflows,
      eventLog: this.eventLog.slice(-500),
      env: this.env
    };

    if (this.db) {
      try {
        const transaction = this.db.transaction(['state'], 'readwrite');
        const store = transaction.objectStore('state');
        store.put(raw, 'current_state');
      } catch (err) {
        console.error('[IndexedDB] Save state error', err);
      }
    }

    try {
      localStorage.setItem('astra_os_state', JSON.stringify(raw));
    } catch (e) {
      console.warn('localStorage quota exceeded, saving minimally to localStorage and relying on IndexedDB');
      try {
        localStorage.setItem('astra_os_state', JSON.stringify({ ...raw, fs: {}, auditLogs: [] }));
      } catch (e2) { /* give up */ }
    }
  }

  logEvent(type, source, detail = {}) {
    this.eventLog.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      source,
      detail,
      timestamp: Date.now()
    });
    if (this.eventLog.length > 1000) this.eventLog.shift();
  }

  createWorkflow(goal, prompt, createdBy = 'User') {
    const workflow = {
      id: `wf-${Date.now()}`,
      goal,
      prompt,
      createdBy,
      status: 'queued',
      steps: [],
      approvals: [],
      results: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.workflows.unshift(workflow);
    this.logEvent('workflow.created', createdBy, { workflowId: workflow.id, goal });
    this.saveState();
    return workflow;
  }

  updateWorkflow(id, patch = {}) {
    const workflow = this.workflows.find(w => w.id === id);
    if (!workflow) return null;
    Object.assign(workflow, patch, { updatedAt: Date.now() });
    this.logEvent('workflow.updated', 'System', { workflowId: id, patch });
    this.saveState();
    return workflow;
  }

  appendWorkflowStep(id, step) {
    const workflow = this.workflows.find(w => w.id === id);
    if (!workflow) return null;
    workflow.steps.push({
      id: `step-${workflow.steps.length + 1}`,
      status: 'pending',
      ...step,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    workflow.updatedAt = Date.now();
    this.logEvent('workflow.step', 'System', { workflowId: id, step: step.title || step.name || step.id });
    this.saveState();
    return workflow;
  }

  recordApproval(id, approval) {
    const workflow = this.workflows.find(w => w.id === id);
    if (!workflow) return null;
    workflow.approvals.push({ ...approval, timestamp: Date.now() });
    workflow.updatedAt = Date.now();
    this.logEvent('workflow.approval', approval.actor || 'User', { workflowId: id, approval });
    this.saveState();
    return workflow;
  }

  runIntegrityChecks() {
    const issues = [];

    const requiredApps = ['explorer', 'editor', 'terminal', 'settings', 'dashboard', 'workflow'];
    requiredApps.forEach(appId => {
      if (!this.processes[appId]) {
        issues.push(`Missing app process record: ${appId}`);
      }
    });

    if (!this.registry?.system?.hostname) {
      issues.push('Missing system hostname');
    }

    if (!this.registry?.ai) {
      issues.push('Missing AI registry configuration');
    }

    if (!this.currentSession?.currentUser) {
      issues.push('Missing active user session');
    }

    if (!Array.isArray(this.workflows)) {
      issues.push('Workflow store is corrupted');
    }

    if (!this.fs?.root) {
      issues.push('Root filesystem is unavailable');
    }

    if (issues.length > 0) {
      issues.forEach(issue => this.addNotification('warning', 'Integrity Check', issue));
      this.addAuditLog('System', `Integrity check found ${issues.length} issue(s).`);
    } else {
      this.addAuditLog('System', 'Integrity check passed with no issues.');
    }

    this.logEvent('system.integrity', 'System', { issues });
    this.saveState();
    return issues;
  }

  // ==========================================
  // File System Path Locking Helper Methods
  // ==========================================
  lockPath(path, type, owner) {
    const existing = this.locks.filter(l => l.path === path);
    if (type === 'exclusive') {
      if (existing.length > 0) {
        if (existing.some(l => l.owner !== owner)) {
          return false;
        }
      }
    } else {
      if (existing.some(l => l.type === 'exclusive' && l.owner !== owner)) {
        return false;
      }
    }
    const alreadyHeld = this.locks.find(l => l.path === path && l.owner === owner);
    if (alreadyHeld) {
      alreadyHeld.type = type;
    } else {
      this.locks.push({ path, type, owner, timestamp: Date.now() });
    }
    this.saveState();
    return true;
  }

  getNodeMetadata(node) {
    if (!node) return null;
    if (!node.createdAt) node.createdAt = Date.now();
    if (!node.updatedAt) node.updatedAt = node.createdAt;
    if (!node.accessedAt) node.accessedAt = node.updatedAt;
    return node;
  }

  touchNode(node) {
    if (!node) return node;
    node.accessedAt = Date.now();
    return node;
  }

  canModifyNode(node, user = null) {
    if (!node) return false;
    if (!this.registry?.security?.enforcePermissions) return true;
    const current = user || this.currentSession.currentUser || 'divyanshu';
    const owner = node.owner || 'divyanshu';
    if (current === owner || this.currentSession.role === 'admin') return true;
    const perms = node.permissions || (node.type === 'dir' ? 'rwxr-xr-x' : 'rw-r--r--');
    return perms[1] === 'w' || perms[4] === 'w' || perms[7] === 'w';
  }

  canReadNode(node, user = null) {
    if (!node) return false;
    if (!this.registry?.security?.enforcePermissions) return true;
    const current = user || this.currentSession.currentUser || 'divyanshu';
    const owner = node.owner || 'divyanshu';
    if (current === owner || this.currentSession.role === 'admin') return true;
    const perms = node.permissions || (node.type === 'dir' ? 'rwxr-xr-x' : 'rw-r--r--');
    return perms[0] === 'r' || perms[3] === 'r' || perms[6] === 'r';
  }

  unlockPath(path, owner) {
    const idx = this.locks.findIndex(l => l.path === path && l.owner === owner);
    if (idx !== -1) {
      this.locks.splice(idx, 1);
      this.saveState();
      return true;
    }
    return false;
  }

  isLocked(path, checkType, owner) {
    const existing = this.locks.filter(l => l.path === path);
    if (existing.length === 0) return false;
    if (checkType === 'write') {
      return existing.some(l => l.owner !== owner && (l.type === 'exclusive' || l.type === 'shared'));
    } else if (checkType === 'read') {
      return existing.some(l => l.type === 'exclusive' && l.owner !== owner);
    }
    return false;
  }

  // ==========================================
  // Virtual Filesystem Accessors
  // ==========================================
  resolvePath(pathStr) {
    if (!pathStr || pathStr === '/' || pathStr === 'root') return this.fs['root'];
    const parts = pathStr.replace(/^\//, '').split('/').filter(Boolean);
    let current = this.fs['root'];
    for (const part of parts) {
      const safePart = window.sanitizeKey(part);
      if (!current || current.type !== 'dir' || !safePart) return null;
      current = current.children[safePart];
    }
    return this.touchNode(current);
  }

  writeFile(pathStr, content) {
    const parts = pathStr.replace(/^\//, '').split('/').filter(Boolean);
    const fileName = window.sanitizeKey(parts.pop());
    if (!fileName) return false;
    let current = this.fs['root'];
    for (const part of parts) {
      const safePart = window.sanitizeKey(part);
      if (!safePart) return false;
      if (!current.children[safePart]) {
        current.children[safePart] = { type: 'dir', name: safePart, children: {}, owner: this.currentSession.currentUser || 'divyanshu', group: 'staff', permissions: 'rwxr-xr-x' };
      }
      current = current.children[safePart];
    }
    this.getNodeMetadata(current);
    const targetFile = current.children[fileName];
    if (targetFile && !this.canModifyNode(targetFile)) {
      return false;
    }
    
    // Atomic write safeguard via a temporary swap simulation
    const tempFileKey = `.tmp_${fileName}_${Date.now()}`;
    try {
      current.children[tempFileKey] = {
        type: 'file',
        name: tempFileKey,
        content: content,
        owner: (targetFile && targetFile.owner) || this.currentSession.currentUser || 'divyanshu',
        group: 'staff',
        permissions: (targetFile && targetFile.permissions) || 'rw-r--r--',
        createdAt: (targetFile && targetFile.createdAt) || Date.now(),
        updatedAt: Date.now(),
        accessedAt: Date.now(),
        versionHistory: (targetFile && targetFile.versionHistory) || []
      };
      
      // Store history checkpoint
      if (targetFile) {
        current.children[tempFileKey].versionHistory.unshift({
          content: targetFile.content,
          updatedAt: targetFile.updatedAt || Date.now()
        });
        if (current.children[tempFileKey].versionHistory.length > 5) {
          current.children[tempFileKey].versionHistory.pop();
        }
      }
      
      // Atomic commit
      current.children[tempFileKey].name = fileName;
      current.children[fileName] = current.children[tempFileKey];
      delete current.children[tempFileKey];
    } catch (err) {
      delete current.children[tempFileKey];
      console.error("Atomic write failed", err);
      return false;
    }

    const isNew = !targetFile;
    const actionText = isNew ? `Created file: ${pathStr}` : `Modified file: ${pathStr}`;
    this.addAuditLog('System', actionText);
    window.AstraBus?.emit('fs.changed', { path: pathStr, action: actionText });
    this.saveState();
    return true;
  }

  createDir(pathStr) {
    const parts = pathStr.replace(/^\//, '').split('/').filter(Boolean);
    let current = this.fs['root'];
    for (const part of parts) {
      const safePart = window.sanitizeKey(part);
      if (!safePart) return false;
      if (!current.children[safePart]) {
        current.children[safePart] = { type: 'dir', name: safePart, children: {}, owner: this.currentSession.currentUser || 'divyanshu', group: 'staff', permissions: 'rwxr-xr-x' };
      }
      current = current.children[safePart];
    }
    this.getNodeMetadata(current);
    this.saveState();
    return true;
  }

  deleteFile(pathStr) {
    const parts = pathStr.replace(/^\//, '').split('/').filter(Boolean);
    const fileName = window.sanitizeKey(parts.pop());
    if (!fileName) return false;
    let current = this.fs['root'];
    for (const part of parts) {
      const safePart = window.sanitizeKey(part);
      if (!current || !safePart || !current.children[safePart]) return false;
      current = current.children[safePart];
    }
    if (current.children[fileName]) {
      if (!this.canModifyNode(current.children[fileName])) return false;
      delete current.children[fileName];
      this.addAuditLog('System', `Deleted: ${pathStr}`);
      window.AstraBus?.emit('fs.deleted', { path: pathStr });
      this.saveState();
      return true;
    }
    return false;
  }

  renameFile(pathStr, newName) {
    const parts = pathStr.replace(/^\//, '').split('/').filter(Boolean);
    const oldName = window.sanitizeKey(parts.pop());
    const safeNewName = window.sanitizeKey(newName);
    if (!oldName || !safeNewName) return false;
    let current = this.fs['root'];
    for (const part of parts) {
      const safePart = window.sanitizeKey(part);
      if (!current || !safePart || !current.children[safePart]) return false;
      current = current.children[safePart];
    }
    if (current.children[oldName]) {
      if (!this.canModifyNode(current.children[oldName])) return false;
      const node = current.children[oldName];
      node.name = safeNewName;
      node.updatedAt = Date.now();
      current.children[safeNewName] = node;
      delete current.children[oldName];
      this.addAuditLog('System', `Renamed ${oldName} → ${safeNewName}`);
      window.AstraBus?.emit('fs.renamed', { from: pathStr, to: safeNewName });
      this.saveState();
      return true;
    }
    return false;
  }

  copyFile(srcPath, dstPath) {
    const srcNode = this.resolvePath(srcPath);
    if (!srcNode || srcNode.type !== 'file') return false;
    const dstParts = dstPath.replace(/^\//, '').split('/').filter(Boolean);
    const dstParentPath = dstParts.length > 1 ? `/${dstParts.slice(0, -1).join('/')}` : '/';
    const dstParent = this.resolvePath(dstParentPath);
    if (!this.canReadNode(srcNode) || !this.canModifyNode(dstParent || srcNode)) return false;
    this.writeFile(dstPath, srcNode.content);
    return true;
  }

  moveFile(srcPath, dstPath) {
    if (this.copyFile(srcPath, dstPath)) {
      this.deleteFile(srcPath);
      return true;
    }
    return false;
  }

  // ==========================================
  // Memory Graph Accessors
  // ==========================================
  addMemoryNode(id, label, type) {
    if (this.memoryGraph.nodes.some(n => n.id === id)) return;
    const x = 300 + (Math.random() - 0.5) * 200;
    const y = 220 + (Math.random() - 0.5) * 150;
    this.memoryGraph.nodes.push({ id, label, type, x, y });
    this.addAuditLog('MemoryAgent', `Recorded semantic memory node: [${label}]`);
    this.saveState();
  }

  addMemoryLink(sourceId, targetId, relation) {
    const exists = this.memoryGraph.links.some(l =>
      (l.source === sourceId && l.target === targetId) ||
      (l.source === targetId && l.target === sourceId)
    );
    if (exists) return;
    this.memoryGraph.links.push({ source: sourceId, target: targetId, relation });
    this.saveState();
  }

  clearMemoryGraph() {
    this.memoryGraph = {
      nodes: [{ id: 'usr-divyanshu', label: 'User: Divyanshu', type: 'user', x: 300, y: 220 }],
      links: []
    };
    this.addAuditLog('MemoryAgent', 'Flushed all system memory nodes.');
    this.saveState();
  }

  // ==========================================
  // System Loggers & Context
  // ==========================================
  addAuditLog(agentName, actionText) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    this.auditLogs.unshift({ timestamp: time, agent: agentName, action: actionText });
    if (this.auditLogs.length > 100) this.auditLogs.pop();
    // Don't call saveState here to prevent recursion when called from writeFile
  }

  updateTaskStatus(taskId, status) {
    const task = this.agentTasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      this.addAuditLog('PlannerAgent', `Updated task [${window.escapeHTML(task.title)}] status to: ${status}`);
      this.saveState();
    }
  }

  addTask(title, desc, status = 'pending', assigned = 'User') {
    const id = 'task-' + Date.now();
    const task = { id, title, desc, status, assigned };
    this.agentTasks.push(task);
    this.addAuditLog('User', `Added task: [${window.escapeHTML(title)}]`);
    this.saveState();
    return task;
  }

  deleteTask(taskId) {
    const idx = this.agentTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      const task = this.agentTasks[idx];
      this.agentTasks.splice(idx, 1);
      this.addAuditLog('User', `Deleted task: [${window.escapeHTML(task.title)}]`);
      this.saveState();
      return true;
    }
    return false;
  }

  addNotification(type, source, message) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    this.notifications.push({ id: Date.now(), type, source, message, time, read: false });
    if (this.notifications.length > 100) this.notifications.shift();
    this.saveState();
  }

  getUnreadNotificationCount() {
    return this.notifications.filter(n => !n.read).length;
  }

  markAllNotificationsRead() {
    this.notifications.forEach(n => n.read = true);
    this.saveState();
  }

  resetAllState() {
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    localStorage.removeItem('astra_os_state');
    if (this.db) {
      try {
        const transaction = this.db.transaction(['state'], 'readwrite');
        const store = transaction.objectStore('state');
        store.delete('current_state');
      } catch (err) {
        console.error('[IndexedDB] Clear error', err);
      }
    }
    this.seedDefaults();
  }
}
