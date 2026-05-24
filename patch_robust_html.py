import os

def fix_all(content):
    # Fix the syntax error in apps.js
    content = content.replace("`)<span", "html`<span")
    
    new_content = ""
    i = 0
    while i < len(content):
        if content[i] == '`':
            # Check if it's already tagged with html
            if i >= 4 and content[i-4:i] == 'html':
                new_content += '`'
                i += 1
                continue
            
            # Check if it contains < before the next unescaped `
            has_html = False
            j = i + 1
            while j < len(content):
                if content[j] == '\\':
                    j += 2
                    continue
                if content[j] == '<':
                    has_html = True
                if content[j] == '`':
                    break
                j += 1
            
            if has_html:
                new_content += 'html`'
            else:
                new_content += '`'
            i += 1
        else:
            new_content += content[i]
            i += 1
    return new_content

def main():
    js_dir = '/Users/divyanshusinha/OS building/js'
    for f in os.listdir(js_dir):
        if not f.endswith('.js') or f == 'security.js':
            continue
        filepath = os.path.join(js_dir, f)
        with open(filepath, 'r') as file:
            content = file.read()
        
        new_content = fix_all(content)
        if new_content != content:
            with open(filepath, 'w') as file:
                file.write(new_content)
            print(f"Patched robust HTML in {f}")

if __name__ == '__main__':
    main()
