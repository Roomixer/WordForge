# Inlines src/*.js into a single self-contained HTML (dist/wordforge.html) for one-file hosting.
import re, pathlib
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text()
def inline(m):
    return '<script>\n' + (root / m.group(1)).read_text() + '\n</script>'
html = re.sub(r'<script src="(src/[^"]+)"></script>', inline, html)
body = html
for pat in [r'<!doctype html>\s*', r'<html[^>]*>\s*', r'</html>\s*', r'<head>\s*', r'</head>\s*', r'<body>\s*', r'</body>\s*', r'<meta name="viewport"[^>]*>\s*']:
    body = re.sub(pat, '', body, flags=re.I)
body = body.replace('<title>Wordforge</title>', '<title>Wordforge</title>\n<meta name="claude:viewport-fit-sides" content="cover">', 1)
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'wordforge.html').write_text(body)
print('built', len(body), 'bytes')
