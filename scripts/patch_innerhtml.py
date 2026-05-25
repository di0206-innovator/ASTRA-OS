import os
import re

def fix_inner_html(content):
    # Match template literals
    content = re.sub(r'([a-zA-Z0-9_\.\-\$\[\]]+)\.innerHTML\s*=\s*(`(?:[^`]|\\`)*?`)', r'window.renderSafeHTML(\1, \2)', content)
    # Match single quotes
    content = re.sub(r'([a-zA-Z0-9_\.\-\$\[\]]+)\.innerHTML\s*=\s*(\'(?:[^\']|\\\')*?\')', r'window.renderSafeHTML(\1, \2)', content)
    # Match double quotes
    content = re.sub(r'([a-zA-Z0-9_\.\-\$\[\]]+)\.innerHTML\s*=\s*("(?:[^"]|\\")*?")', r'window.renderSafeHTML(\1, \2)', content)
    # Match variables or expressions before a semicolon
    # E.g. element.innerHTML = something;
    content = re.sub(r'([a-zA-Z0-9_\.\-\$\[\]]+)\.innerHTML\s*=\s*([a-zA-Z0-9_\.\-\$\[\]\(\)\s\+]+)\s*;', r'window.renderSafeHTML(\1, \2);', content)
    return content

def main():
    js_dir = '/Users/divyanshusinha/OS building/js'
    for f in os.listdir(js_dir):
        if not f.endswith('.js') or f == 'security.js':
            continue
        filepath = os.path.join(js_dir, f)
        with open(filepath, 'r') as file:
            content = file.read()
        
        new_content = fix_inner_html(content)
        if new_content != content:
            with open(filepath, 'w') as file:
                file.write(new_content)
            print(f"Patched innerHTML in {f}")

if __name__ == '__main__':
    main()
