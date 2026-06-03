// Web Worker Sandbox for executing user scripts in Astra OS

const pendingSyscalls = new Map();
let syscallId = 0;

// Listen for messages from the Kernel
self.onmessage = async function(e) {
  const { type, code, path, env, id, result, error, token } = e.data;
  
  if (type === 'syscall_response') {
    const pending = pendingSyscalls.get(id);
    if (pending) {
      if (error) pending.reject(new Error(error));
      else pending.resolve(result);
      pendingSyscalls.delete(id);
    }
    return;
  }
  
  if (type === 'start') {
    // Intercept console.log, console.error, console.warn to stream logs back
    const originalLog = console.log;
    console.log = (...args) => {
      self.postMessage({ type: 'log', text: args.join(' '), cls: 'info' });
      originalLog.apply(console, args);
    };
    console.error = (...args) => {
      self.postMessage({ type: 'log', text: args.join(' '), cls: 'error' });
    };
    console.warn = (...args) => {
      self.postMessage({ type: 'log', text: args.join(' '), cls: 'warning' });
    };
    
    // Mock APIs inside the script execution environment
    const Astra = {
      env: Object.freeze({...(env || {})}),
      syscall: (callName, ...args) => {
        return new Promise((resolve, reject) => {
          const currentId = syscallId++;
          pendingSyscalls.set(currentId, { resolve, reject });
          self.postMessage({ type: 'syscall', id: currentId, token, callName, args });
        });
      }
    };
    
    try {
      // Evaluate the script code
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('Astra', code);
      await fn(Astra);
      self.postMessage({ type: 'done', success: true });
    } catch (err) {
      self.postMessage({ type: 'log', text: `Syntax/Runtime Error: ${err.message}`, cls: 'error' });
      self.postMessage({ type: 'done', success: false });
    }
  }
};
