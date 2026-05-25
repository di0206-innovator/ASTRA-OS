import os
import re

def fix_nested_html(content):
    # Repeatedly prepend html to any untagged template literal that contains < and ${
    # The regex looks for a backtick ` not preceded by html, followed by some optional whitespace, then <
    # We will just do a blind replace of any ` followed by < or \s*< to html`<
    
    # We need to make sure we don't accidentally do htmlhtml`
    
    # Pattern: match an open backtick not preceded by html or any word character
    # to avoid things like html` or myTag`
    
    # Regex: (?<![a-zA-Z0-9_])`(\s*<) -> html`\1
    
    new_content = content
    while True:
        prev_content = new_content
        new_content = re.sub(r'(?<![a-zA-Z0-9_])`(\s*<)', r'html`\1', new_content)
        if new_content == prev_content:
            break
            
    # Wait, some template literals don't start with < immediately.
    # For example:
    # `${items.map(item => `<div class="ctx-item">${item}</div>`)}`
    # Here it starts with < immediately.
    
    # What if it's something like:
    # `
    #   <div>...
    # `
    # The above regex catches it because `\s*<` matches `\n  <`.
    
    return new_content

def main():
    js_dir = '/Users/divyanshusinha/OS building/js'
    for f in os.listdir(js_dir):
        if not f.endswith('.js') or f == 'security.js':
            continue
        filepath = os.path.join(js_dir, f)
        with open(filepath, 'r') as file:
            content = file.read()
        
        new_content = fix_nested_html(content)
        if new_content != content:
            with open(filepath, 'w') as file:
                file.write(new_content)
            print(f"Patched nested html in {f}")

if __name__ == '__main__':
    main()
