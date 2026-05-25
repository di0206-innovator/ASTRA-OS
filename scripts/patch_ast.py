import os
import re

def fix_pp_and_xss(content):
    # 1. PP Bracket Notation -> Reflect.get
    # Handle dir.children[window.sanitizeKey(name)] -> Reflect.get(dir.children, window.sanitizeKey(name))
    content = re.sub(r'([a-zA-Z0-9_\.]+)\[window\.sanitizeKey\(([a-zA-Z0-9_]+)\)\]', r'Reflect.get(\1, window.sanitizeKey(\2))', content)
    
    # Handle dir.children[name] -> Reflect.get(dir.children, name)
    content = re.sub(r'(dir\.children)\[([a-zA-Z0-9_]+)\]', r'Reflect.get(\1, \2)', content)
    
    # Handle AstraApps[appId] -> Reflect.get(AstraApps, appId)
    content = re.sub(r'(AstraApps)\[([a-zA-Z0-9_]+)\]', r'Reflect.get(\1, \2)', content)
    
    # Handle state.processes[appId] -> Reflect.get(state.processes, appId)
    content = re.sub(r'(state\.processes)\[([a-zA-Z0-9_]+)\]', r'Reflect.get(\1, \2)', content)

    # Handle this.processes[appId] -> Reflect.get(this.processes, appId)
    content = re.sub(r'(this\.processes)\[([a-zA-Z0-9_]+)\]', r'Reflect.get(\1, \2)', content)
    
    # Handle kernel fs children
    content = re.sub(r'(AstraKernel\.fs\.children)\[([a-zA-Z0-9_]+)\]', r'Reflect.get(\1, \2)', content)
    
    # Handle AstraKernel[cmd]
    content = re.sub(r'(AstraKernel)\[([a-zA-Z0-9_]+)\]', r'Reflect.get(\1, \2)', content)

    # Note: What if it's an assignment? e.g. state.processes[appId] = x
    # Regex for assignment:
    # Actually, we can use Reflect.set
    content = re.sub(r'Reflect\.get\(([a-zA-Z0-9_\.]+),\s*([a-zA-Z0-9_\(\)\.]+)\)\s*=\s*(.*?);', r'Reflect.set(\1, \2, \3);', content)

    # Handle delete: delete state.processes[appId] -> Reflect.deleteProperty(state.processes, appId)
    content = re.sub(r'delete\s+Reflect\.get\(([a-zA-Z0-9_\.]+),\s*([a-zA-Z0-9_\(\)\.]+)\)', r'Reflect.deleteProperty(\1, \2)', content)

    # 2. XSS Template Literals -> Prepend `html`
    # We want to match `...` that contains < and ${ and doesn't already have html in front of it.
    # It's safer to just prepend `html` to all `` strings that have < and >.
    # We use a regex to find all template literals.
    # A generic approach: if we see window.renderSafeHTML(el, `...`), make it window.renderSafeHTML(el, html`...`)
    content = re.sub(r'window\.renderSafeHTML\(([a-zA-Z0-9_]+),\s*`', r'window.renderSafeHTML(\1, html`', content)
    
    # What about apps returning HTML directly? Like html = `...`;
    # We can do:  = `\s*<  ->  = html`\s*<
    content = re.sub(r'=\s*(`\s*<)', r'= html\1', content)
    content = re.sub(r'return\s*(`\s*<)', r'return html\1', content)
    content = re.sub(r'map\([a-zA-Z0-9_]+\s*=>\s*(`\s*<)', r'map(\g<0>'.replace('`', 'html`'), content) # too complex for simple regex
    
    # Let's do a more robust search for `...` containing HTML.
    # Or just specifically prepend html before ` if it's followed immediately by < or \s*<
    content = re.sub(r'(?<!html)`(\s*<)', r'html`\1', content)
    
    # For cases where template starts with variable: `${...}`
    # e.g. `<div...` we already caught.
    # What if it's `\n      <div`? \s covers \n.

    return content

def main():
    js_dir = '/Users/divyanshusinha/OS building/js'
    for f in os.listdir(js_dir):
        if not f.endswith('.js') or f == 'security.js':
            continue
        filepath = os.path.join(js_dir, f)
        with open(filepath, 'r') as file:
            content = file.read()
        
        new_content = fix_pp_and_xss(content)
        if new_content != content:
            with open(filepath, 'w') as file:
                file.write(new_content)
            print(f"Patched AST nodes in {f}")

if __name__ == '__main__':
    main()
