import os
import re

def fix_broken_html_tags(content):
    """Fix all broken template literal patterns caused by the automated html tag insertion."""
    
    # 1. Fix `html\`)\` patterns — stray closing paren before template. 
    # e.g., `html\`)` should be just `\`)`
    # Pattern: html` at end of a .map() callback should be just `
    # e.g., `html`).join('')` → `).join('')`
    content = re.sub(r'html`\)\.join', r'`).join', content)
    
    # 2. Fix `` html`); `` → `` `); `` (closing renderSafeHTML call)
    content = re.sub(r'html`\);', r'`);', content)
    
    # 3. Fix `=> html\`)` in .map callbacks — opening a template with `)` 
    # e.g., `.map(p => html\`)` should be `.map(p => \``
    # This means the html was inserted before the `)` backtick which is actually the template open
    content = re.sub(r'html`\)', r'html`', content)
    
    # 4. Fix `</tag>html\`` patterns — stray html before closing backtick
    # e.g., `</button>html\`` → `</button>\``
    content = re.sub(r'html`(?=[;\)\.,\s\n\r])', r'`', content)
    # But we need to be careful: don't remove `html\`` when it's the opening tag
    # Actually, `html\`` at end of an element is always wrong. Let's be more precise:
    # Pattern: `>html\`` or text content followed by `html\`` at line boundaries
    content = re.sub(r'>(html`)', r'>`', content) 
    
    # 5. Fix `}html\`` → `}\``
    content = re.sub(r'\}html`', r'}`', content)
    
    # 6. Fix double-map: `.map(map(` → `.map(`
    content = re.sub(r'\.map\(map\(', r'.map(', content)
    
    # 7. Fix stray `html` appended to string values that shouldn't have it
    # e.g., `${pid})html\`` → `${pid})\``  
    # Pattern: `)html\`` → `)\``
    content = re.sub(r'\)html`', r')`', content)
    
    # 8. Fix `${value}html\`` that shows up mid-string
    # e.g., `${f}html\`` should be `${f}\``
    content = re.sub(r'\}html`', r'}`', content)
    
    return content

def main():
    js_dir = '/Users/divyanshusinha/OS building/js'
    for f in os.listdir(js_dir):
        if not f.endswith('.js'):
            continue
        filepath = os.path.join(js_dir, f)
        with open(filepath, 'r') as file:
            content = file.read()
        
        new_content = fix_broken_html_tags(content)
        if new_content != content:
            with open(filepath, 'w') as file:
                file.write(new_content)
            print(f"Fixed broken html tags in {f}")
        else:
            print(f"No changes needed in {f}")

if __name__ == '__main__':
    main()
