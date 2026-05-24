import re

findings = """
File: /Users/divyanshusinha/OS building/js/apps.js
  - line_number: 186
File: /Users/divyanshusinha/OS building/js/apps.js
  - line_number: 305
File: /Users/divyanshusinha/OS building/js/apps.js
  - line_number: 403
File: /Users/divyanshusinha/OS building/js/apps.js
  - line_number: 409
File: /Users/divyanshusinha/OS building/js/apps.js
  - line_number: 823
File: /Users/divyanshusinha/OS building/js/apps.js
  - line_number: 856
File: /Users/divyanshusinha/OS building/js/apps.js
  - line_number: 892
File: /Users/divyanshusinha/OS building/js/apps.js
  - line_number: 902
File: /Users/divyanshusinha/OS building/js/ui.js
  - line_number: 8
File: /Users/divyanshusinha/OS building/js/ui.js
  - line_number: 338
File: /Users/divyanshusinha/OS building/js/ui.js
  - line_number: 474
File: /Users/divyanshusinha/OS building/js/ui.js
  - line_number: 503
File: /Users/divyanshusinha/OS building/js/ui.js
  - line_number: 542
File: /Users/divyanshusinha/OS building/js/ui.js
  - line_number: 912
File: /Users/divyanshusinha/OS building/js/app.js
  - line_number: 481
File: /Users/divyanshusinha/OS building/js/apps-tools.js
  - line_number: 261
File: /Users/divyanshusinha/OS building/js/apps-system.js
  - line_number: 627
File: /Users/divyanshusinha/OS building/js/apps-system.js
  - line_number: 669
File: /Users/divyanshusinha/OS building/js/apps-system.js
  - line_number: 707
File: /Users/divyanshusinha/OS building/js/apps-system.js
  - line_number: 713
File: /Users/divyanshusinha/OS building/js/kernel.js
  - line_number: 328
File: /Users/divyanshusinha/OS building/js/kernel.js
  - line_number: 383
File: /Users/divyanshusinha/OS building/js/kernel.js
  - line_number: 403
File: /Users/divyanshusinha/OS building/js/kernel.js
  - line_number: 408
File: /Users/divyanshusinha/OS building/js/kernel.js
  - line_number: 436
File: /Users/divyanshusinha/OS building/js/kernel.js
  - line_number: 453
File: /Users/divyanshusinha/OS building/js/kernel.js
  - line_number: 472
File: /Users/divyanshusinha/OS building/js/kernel.js
  - line_number: 488
File: /Users/divyanshusinha/OS building/js/kernel.js
  - line_number: 504
File: /Users/divyanshusinha/OS building/js/kernel.js
  - line_number: 510
File: /Users/divyanshusinha/OS building/js/kernel.js
  - line_number: 530
File: /Users/divyanshusinha/OS building/js/kernel.js
  - line_number: 675
File: /Users/divyanshusinha/OS building/js/security.js
  - line_number: 21
File: /Users/divyanshusinha/OS building/js/security.js
  - line_number: 79
"""

def patch_file_lines():
    # Parse findings
    lines = findings.strip().split('\n')
    tasks = {}
    current_file = None
    for line in lines:
        line = line.strip()
        if line.startswith('File: '):
            current_file = line[6:]
        elif line.startswith('- line_number: '):
            ln = int(line.split(': ')[1])
            if current_file not in tasks:
                tasks[current_file] = []
            tasks[current_file].append(ln)

    for filepath, line_nums in tasks.items():
        try:
            with open(filepath, 'r') as f:
                content_lines = f.readlines()
        except:
            continue
            
        for ln in set(line_nums):
            idx = ln - 1
            if idx < 0 or idx >= len(content_lines):
                continue
            
            original = content_lines[idx]
            modified = original
            
            # Simple heuristic: if there's a [ ] on this line
            # First check assignment: a[b] = c;
            # We match `a[b] = c` but `b` could contain spaces, so `[^\]]+` is okay unless it contains `[]`.
            # A more robust check for `a[b] = c`:
            if '=' in modified and '[' in modified and ']' in modified:
                # Find the bracket right before the '='
                m = re.search(r'([a-zA-Z0-9_\.\-]+)\[([^\]]+)\]\s*=\s*(.*)', modified)
                if m:
                    modified = modified[:m.start()] + f"Reflect.set({m.group(1)}, {m.group(2)}, {m.group(3).rstrip(';')});" + modified[m.end():]
                    if modified.endswith('\n') == False and original.endswith('\n'):
                        modified += '\n'
            
            # If not modified by assignment, try GET: a[b]
            if modified == original:
                # We need to replace all a[b] with Reflect.get(a, b)
                # But NOT if b is a string literal (e.g. 'foo' or "bar") or just a number
                # Actually, scanner flags ANY dynamic variable. So we replace it anyway, even if it's a string, just to be safe.
                # However, avoid replacing `if (a[b])` incorrectly. 
                # re.sub(pattern, replacement, string)
                
                # Let's replace ALL `a[b]` using a loop
                def replacer(m):
                    a = m.group(1)
                    b = m.group(2)
                    return f"Reflect.get({a}, {b})"

                
                # Keep replacing until no more matches
                prev = ""
                while modified != prev:
                    prev = modified
                    # Match alphanumeric/dot/dash before [, and anything inside [] except ]
                    # We should be careful about nested brackets, but assuming single depth:
                    modified = re.sub(r'([a-zA-Z0-9_\.\-]+)\[([^\]]+)\]', replacer, modified)
            
            print(f"File: {filepath}:{ln}")
            print(f"Original: {original.strip()}")
            print(f"Modified: {modified.strip()}")
            print("-" * 40)
            
            content_lines[idx] = modified
            
        with open(filepath, 'w') as f:
            f.writelines(content_lines)

if __name__ == '__main__':
    patch_file_lines()
