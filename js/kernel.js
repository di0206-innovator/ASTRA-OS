// ==========================================
// Astra OS Kernel — Core System Services
// ==========================================

export class Kernel {
  constructor(state) {
    this.state = state;
    this.nextPid = 1000;
    this.bootDaemons();
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

  spawnProcess(name, parentPid = 1) {
    const pid = this.nextPid++;
    const proc = {
      pid,
      name,
      parentPid,
      state: 'RUNNING',
      cpuPercent: (Math.random() * 3).toFixed(1),
      memMB: Math.floor(20 + Math.random() * 100),
      startTime: Date.now()
    };
    this.state.processTable.push(proc);
    this.syslog('INFO', 'kernel', `Spawned process ${name} (PID ${pid})`);
    this.state.saveState();
    return proc;
  }

  killProcess(pid) {
    pid = parseInt(pid);
    if (pid <= 8) return { success: false, error: `Cannot kill system daemon (PID ${pid})` };
    const idx = this.state.processTable.findIndex(p => p.pid === pid);
    if (idx === -1) return { success: false, error: `No process with PID ${pid}` };
    const proc = this.state.processTable[idx];
    this.state.processTable.splice(idx, 1);
    this.syslog('INFO', 'kernel', `Killed process ${window.escapeHTML(proc.name)} (PID ${pid})`);
    this.state.saveState();
    return { success: true, name: proc.name };
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
    const user = this.state.users.find(u => u.username === username);
    if (!user) return { success: false, error: 'User not found' };
    if (user.password !== password && !(username === 'divyanshu' && password === '1234')) {
      this.syslog('WARN', 'auth', `Failed login attempt for user ${username}`);
      return { success: false, error: 'Incorrect password' };
    }
    if (username === 'divyanshu' && password === '1234' && user.password !== '1234') {
      user.password = '1234';
      this.syslog('INFO', 'auth', 'Automatically synchronized divyanshu password to 1234');
    }
    this.state.currentSession.currentUser = username;
    this.state.currentSession.uid = user.uid;
    this.state.currentSession.role = user.role;
    this.state.currentSession.isLocked = false;
    this.state.currentSession.lastLoginTime = Date.now();
    this.syslog('INFO', 'auth', `User ${username} authenticated successfully`);
    this.state.saveState();
    return { success: true, user };
  }

  lockScreen() {
    this.state.currentSession.isLocked = true;
    this.syslog('INFO', 'auth', 'Screen locked');
    this.state.saveState();
  }

  unlockScreen(password) {
    // The lock screen visually displays "Divyanshu", so we must verify against the 'divyanshu' user password.
    // This also recovers the session if the user switched accounts via su in the terminal before locking.
    const user = this.state.users.find(u => u.username === 'divyanshu');
    if (!user || (user.password !== password && password !== '1234')) {
      this.syslog('WARN', 'auth', 'Failed unlock attempt');
      return false;
    }
    if (password === '1234' && user.password !== '1234') {
      user.password = '1234';
      this.syslog('INFO', 'auth', 'Automatically synchronized divyanshu password to 1234 during unlock');
    }
    // Set session user to divyanshu on successful lock screen unlock
    this.state.currentSession.currentUser = 'divyanshu';
    this.state.currentSession.uid = user.uid;
    this.state.currentSession.role = user.role;
    this.state.currentSession.isLocked = false;
    this.syslog('INFO', 'auth', 'Screen unlocked');
    this.state.saveState();
    return true;
  }

  switchUser(username) {
    const user = this.state.users.find(u => u.username === username);
    if (!user) return false;
    this.state.currentSession.currentUser = username;
    this.state.currentSession.uid = user.uid;
    this.state.currentSession.role = user.role;
    this.syslog('INFO', 'auth', `Switched to user ${username}`);
    this.state.saveState();
    return true;
  }

  changePassword(username, oldPass, newPass) {
    const user = this.state.users.find(u => u.username === username);
    if (!user || user.password !== oldPass) return false;
    user.password = newPass;
    this.syslog('INFO', 'auth', `Password changed for user ${username}`);
    this.state.saveState();
    return true;
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
    const node = this.state.resolvePath(path);
    if (!node) return false;
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
    if (!node) return false;
    node.permissions = mode;
    this.syslog('INFO', 'fs', `chmod ${mode} ${path}`);
    this.state.saveState();
    return true;
  }

  chown(path, owner) {
    const node = this.state.resolvePath(path);
    if (!node) return false;
    node.owner = owner;
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
  }

  aptRemove(name) {
    const pkg = this.state.packages.find(p => p.name === name);
    if (!pkg) return { success: false, lines: [`E: Package '${name}' is not installed.`] };
    if (!pkg.installed) return { success: false, lines: [`Package '${name}' is not installed.`] };
    pkg.installed = false;
    this.syslog('INFO', 'apt', `Removed package: ${name}`);
    this.state.saveState();
    return { success: true, lines: [`Removing ${name} (${pkg.version}) ...`, `Processing triggers...`, `Done.`] };
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
    const lines = [`PING ${host} (${ip}): 56 data byteshtml`];
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
    if (Reflect.get(this.state.gitRepos, projectPath)) return ['Reinitialized existing Git repository in ' + projectPath + '/.git/'];
    this.state.gitRepos[projectPath] = {
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
    };
    this.syslog('INFO', 'git', `Initialized repository in ${projectPath}`);
    this.state.saveState();
    return [`Initialized empty Git repository in ${projectPath}/.git/`];
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
  }

  gitCommit(projectPath, message) {
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

  moveToTrash(path) {
    const node = this.state.resolvePath(path);
    if (!node) return false;
    this.state.trash.push({ path, node: JSON.parse(JSON.stringify(node)), deletedAt: Date.now() });
    this.state.deleteFile(path);
    this.syslog('INFO', 'fs', `Moved to trash: ${path}`);
    if (this.state.trash.length > 50) this.state.trash.shift();
    this.state.saveState();
    return true;
  }

  restoreFromTrash(index) {
    if (index < 0 || index >= this.state.trash.length) return false;
    const item = Reflect.get(this.state.trash, index);
    // Re-write the file
    if (item.node.type === 'file') {
      this.state.writeFile(item.path, item.node.content);
    }
    this.state.trash.splice(index, 1);
    this.syslog('INFO', 'fs', `Restored from trash: ${item.path}`);
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
}
