#!/usr/bin/env bash
# 把 index.html 及其依赖内联成单文件 cosmos-3d.html（可直接双击打开）
set -euo pipefail
cd "$(dirname "$0")"
python3 - <<'PY'
import re, pathlib, html
root = pathlib.Path('.')
doc = (root / 'index.html').read_text(encoding='utf-8')

css = (root / 'style.css').read_text(encoding='utf-8')
doc = doc.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')

def inline(m):
    src = m.group(1)
    code = (root / src).read_text(encoding='utf-8')
    code = code.replace('</script', '<\\/script')
    return '<script>\n/* ' + src + ' */\n' + code + '\n</script>'

doc = re.sub(r'<script src="([^"]+)"></script>', inline, doc)
out = pathlib.Path.cwd().parent / 'cosmos-3d.html'
out.write_text(doc, encoding='utf-8')
print('built', out, len(doc), 'bytes')
PY
