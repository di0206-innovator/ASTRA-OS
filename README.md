# Astra OS — AI-First Desktop Experience

Astra OS is a browser-based, AI-first simulated desktop operating system. Built on vanilla HTML, CSS, and modern JavaScript, it implements custom systems-level primitives including a process scheduler, job control architecture, an environment variables block with POSIX-style substitution, a PATH executable resolver, and a sandboxed Web Worker execution context.

---

## Key Features & Architecture

### 1. Custom Systems Kernel
The core operations of Astra OS are managed by a centralized `Kernel` class (`js/kernel.js`) running in the main thread:
- **Process Management**: Spawns and tracks active processes in a simulated process table.
- **VFS (Virtual File System)**: Interacts with an IndexedDB backend for persistent storage.
- **Syscall Layer**: Implements a secure system call mechanism (`Astra.syscall`) allowing executing contexts to request resource mutations (such as file reads/writes, process spawning, and clipboard operations).

### 2. POSIX-Style Shell Upgrades
- **Environment Variables**: Managed via state persistence. Supports `export KEY=VALUE`, `unset KEY`, and `env` commands.
- **Variable Substitution**: Automatically preprocesses commands, replacing `$VAR` or `${VAR}` with their active environment variables before tokenization.
- **PATH Resolution**: When executing a non-builtin command, the kernel searches through configured directories in the `$PATH` environment variable (e.g., `/bin`). It automatically attempts to execute matching shell scripts (`.sh`) or JavaScript files (`.js`).

### 3. Job Control & Asynchronous Execution
- Supports background execution suffix (`&`) to run shell tasks asynchronously without blocking the terminal.
- Job Control commands:
  - `jobs`: Lists active background tasks.
  - `fg [job_id]`: Pulls a background job into the foreground, dumping its output buffer and redirecting live logging back to the terminal.
  - `kill [pid]`: Terminates a running process.

### 4. Sandboxed Web Worker Processes
- Execution of external JavaScript utility files (`.js`) runs inside a dedicated Web Worker sandbox (`js/worker.js`).
- The worker context has access to a secure, frozen copy of `Astra.env` and streams stdout/stderr back to the terminal window via structured messaging.

### 5. System-Wide Clipboard Bridge
- Features a shared clipboard bridge allowing seamless clipboard operations (`pbcopy` and `pbpaste`) between the simulated operating system and the host system using standard browser Clipboard APIs.

---

## Project Structure

```
├── css/
│   └── style.css            # Custom UI stylesheet with modern desktop elements
├── js/
│   ├── app.js               # Application bootstrap
│   ├── apps-system.js       # System GUI applications (Files, Settings, System Monitor)
│   ├── apps-tools.js        # Core GUI utilities (Browser, Daily Briefing, Editor)
│   ├── apps.js              # Application launcher and terminal integration
│   ├── kernel.js            # Main OS Kernel and system call handler
│   ├── security.js          # XSS escaping and prototype pollution guards
│   ├── state.js             # OS state storage, VFS management, and IndexedDB layer
│   ├── ui.js                # Window manager and desktop UI interaction layer
│   └── worker.js            # Web Worker execution sandbox for scripts
├── scripts/                 # Utility automation and build helper scripts
├── tests/
│   ├── stress_test.js       # End-to-end automated testing suite with Puppeteer
│   └── take_screenshots.js  # Automated screenshot capture test helper
├── index.html               # Main desktop entrypoint
├── LICENSE                  # MIT License
└── package.json             # Node dependencies and execution scripts
```

---

## Getting Started

### Prerequisites
- Python 3 (for serving files)
- Node.js (for running tests)

### Running Locally
1. Start the HTTP server:
   ```bash
   npm run dev
   ```
   Or serve the root directory manually using Python:
   ```bash
   python3 -m http.server 8080
   ```
2. Navigate to `http://localhost:8080/` in your web browser.
3. Authenticate at the login screen using the default PIN: `1234`.

---

## Testing & Quality Assurance

To execute the automated end-to-end stress test suite:
1. Navigate to the `tests` directory and install dependencies:
   ```bash
   cd tests && npm install
   ```
2. Run the test script:
   ```bash
   node stress_test.js
   ```
This test covers authentication, terminal built-ins, job control asynchronously, VFS IndexedDB serialization, environment propagation to Web Workers, and application installations from the App Store.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
