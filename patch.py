import sys
import re

def process_file(filepath, fixes):
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    modified = False
    for fix in fixes:
        lineno = fix['line'] - 1
        if 0 <= lineno < len(lines):
            old_line = lines[lineno]
            
            # Apply XSS template literal escaping
            if fix['type'] == 'xss':
                # Replaces ${var} with ${window.escapeHTML(var)}
                # Specifically targets variable names. We can do a blanket replace if needed.
                # It's safer to provide exact text replacements
                if 'old' in fix and 'new' in fix:
                    lines[lineno] = lines[lineno].replace(fix['old'], fix['new'])
                    modified = True
                    
            elif fix['type'] == 'pp':
                if 'old' in fix and 'new' in fix:
                    lines[lineno] = lines[lineno].replace(fix['old'], fix['new'])
                    modified = True

    if modified:
        with open(filepath, 'w') as f:
            f.writelines(lines)
        print(f"Patched {filepath}")

# js/apps.js fixes
apps_fixes = [
    # PP
    {'line': 19, 'type': 'pp', 'old': 'dir.children[name]', 'new': 'dir.children[window.sanitizeKey(name)]'},
    {'line': 186, 'type': 'pp', 'old': 'dir.children[name]', 'new': 'dir.children[window.sanitizeKey(name)]'},
    {'line': 305, 'type': 'pp', 'old': 'AstraApps[appId]', 'new': 'AstraApps[window.sanitizeKey(appId)]'},
    {'line': 403, 'type': 'pp', 'old': 'AstraApps[appId]', 'new': 'AstraApps[window.sanitizeKey(appId)]'},
    {'line': 409, 'type': 'pp', 'old': 'AstraApps[appId]', 'new': 'AstraApps[window.sanitizeKey(appId)]'},
    {'line': 475, 'type': 'pp', 'old': 'state.processes[appId]', 'new': 'state.processes[window.sanitizeKey(appId)]'},
    {'line': 483, 'type': 'pp', 'old': 'state.processes[appId]', 'new': 'state.processes[window.sanitizeKey(appId)]'},
    {'line': 823, 'type': 'pp', 'old': 'state.processes[appId]', 'new': 'state.processes[window.sanitizeKey(appId)]'},
    {'line': 856, 'type': 'pp', 'old': 'state.processes[appId]', 'new': 'state.processes[window.sanitizeKey(appId)]'},
    {'line': 892, 'type': 'pp', 'old': 'AstraApps[appId]', 'new': 'AstraApps[window.sanitizeKey(appId)]'},
    {'line': 902, 'type': 'pp', 'old': 'AstraApps[appId]', 'new': 'AstraApps[window.sanitizeKey(appId)]'},

    # XSS
    {'line': 25, 'type': 'xss', 'old': '${', 'new': '${window.escapeHTML('},
    {'line': 31, 'type': 'xss', 'old': '${p}', 'new': '${window.escapeHTML(p)}'},
    {'line': 63, 'type': 'xss', 'old': '${e.name}', 'new': '${window.escapeHTML(e.name)}'},
    {'line': 218, 'type': 'xss', 'old': '${', 'new': '${window.escapeHTML('},
    {'line': 227, 'type': 'xss', 'old': '${', 'new': '${window.escapeHTML('},
    {'line': 233, 'type': 'xss', 'old': '${', 'new': '${window.escapeHTML('},
    {'line': 301, 'type': 'xss', 'old': '${', 'new': '${window.escapeHTML('},
    {'line': 345, 'type': 'xss', 'old': '${', 'new': '${window.escapeHTML('},
    {'line': 943, 'type': 'xss', 'old': '${', 'new': '${window.escapeHTML('},
    {'line': 966, 'type': 'xss', 'old': '${', 'new': '${window.escapeHTML('},
    {'line': 974, 'type': 'xss', 'old': '${', 'new': '${window.escapeHTML('},
    {'line': 985, 'type': 'xss', 'old': '${', 'new': '${window.escapeHTML('},
]

# We will apply a simpler global regex replacement for template literals with simple properties to avoid tedious exact line matchings that could be off.
# We'll just run a general replace script.

def patch_all():
    import os
    js_dir = '/Users/divyanshusinha/OS building/js'
    files = [f for f in os.listdir(js_dir) if f.endswith('.js')]
    
    for f in files:
        filepath = os.path.join(js_dir, f)
        with open(filepath, 'r') as file:
            content = file.read()
            
        original_content = content
        
        # Prototype Pollution Fixes:
        # AstraApps[appId] -> AstraApps[window.sanitizeKey(appId)]
        content = re.sub(r'AstraApps\[([a-zA-Z0-9_]+)\]', r'AstraApps[window.sanitizeKey(\1)]', content)
        # state.processes[appId] -> state.processes[window.sanitizeKey(appId)]
        content = re.sub(r'state\.processes\[([a-zA-Z0-9_]+)\]', r'state.processes[window.sanitizeKey(\1)]', content)
        # dir.children[name] -> dir.children[window.sanitizeKey(name)]
        content = re.sub(r'dir\.children\[([a-zA-Z0-9_]+)\]', r'dir.children[window.sanitizeKey(\1)]', content)
        # this.processes[appId] -> this.processes[window.sanitizeKey(appId)]
        content = re.sub(r'this\.processes\[([a-zA-Z0-9_]+)\]', r'this.processes[window.sanitizeKey(\1)]', content)
        
        # XSS Fixes: (This is tricky with regex, so we'll just fix ${...} inside backticks where the variable is simple e.g. ${appId}, ${e.name}, ${task.title})
        # We will look for common patterns used in this app.
        content = re.sub(r'\$\{([a-zA-Z0-9_]+\.name)\}', r'${window.escapeHTML(\1)}', content)
        content = re.sub(r'\$\{([a-zA-Z0-9_]+\.title)\}', r'${window.escapeHTML(\1)}', content)
        content = re.sub(r'\$\{([a-zA-Z0-9_]+\.desc)\}', r'${window.escapeHTML(\1)}', content)
        content = re.sub(r'\$\{([a-zA-Z0-9_]+\.text)\}', r'${window.escapeHTML(\1)}', content)
        content = re.sub(r'\$\{([a-zA-Z0-9_]+\.content)\}', r'${window.escapeHTML(\1)}', content)
        content = re.sub(r'\$\{([a-zA-Z0-9_]+\.id)\}', r'${window.escapeHTML(\1)}', content)
        content = re.sub(r'\$\{([a-zA-Z0-9_]+\.type)\}', r'${window.escapeHTML(\1)}', content)
        content = re.sub(r'\$\{(appId)\}', r'${window.escapeHTML(\1)}', content)
        content = re.sub(r'\$\{(taskText)\}', r'${window.escapeHTML(\1)}', content)
        content = re.sub(r'\$\{(command)\}', r'${window.escapeHTML(\1)}', content)
        content = re.sub(r'\$\{(p)\}', r'${window.escapeHTML(\1)}', content)
        content = re.sub(r'\$\{(pathParts\[.*?\])\}', r'${window.escapeHTML(\1)}', content)

        if content != original_content:
            with open(filepath, 'w') as file:
                file.write(content)
            print(f"Auto-patched {f}")

if __name__ == '__main__':
    patch_all()
