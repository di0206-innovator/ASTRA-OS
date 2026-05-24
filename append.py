import os

with open('style-phase6.css', 'r') as f:
    new_css = f.read()

with open('style.css', 'a') as f:
    f.write('\n\n' + new_css)
