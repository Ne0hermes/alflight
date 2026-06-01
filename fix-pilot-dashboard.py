#!/usr/bin/env python3
"""Fix le PilotDashboard.jsx pour transformer les template literals laids
en strings propres, après les substitutions sed précédentes."""
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'src/components/PilotDashboard.jsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

before = content

# `1px solid ${'var(--XXX)'}20` -> '1px solid var(--border-subtle)'
content = re.sub(
    r"`(1px solid )\$\{'(var\(--[a-z-]+\))'\}20`",
    r"'\1var(--border-subtle)'",
    content,
)

# `1px solid ${'var(--XXX)'}` -> '1px solid var(--XXX)'
content = re.sub(
    r"`(1px solid )\$\{'(var\(--[a-z-]+\))'\}`",
    r"'\1\2'",
    content,
)

# `${'var(--XXX)'}YYY` (alpha hex hack) -> 'var(--XXX)'
content = re.sub(
    r"`\$\{'(var\(--[a-z-]+\))'\}([0-9a-fA-F]+)`",
    r"'\1'",
    content,
)

# `${'var(--XXX)'}` alone -> 'var(--XXX)'
content = re.sub(
    r"`\$\{'(var\(--[a-z-]+\))'\}`",
    r"'\1'",
    content,
)

# Hors backticks : ${'var(--XXX)'} -> var(--XXX)
content = re.sub(
    r"\$\{'(var\(--[a-z-]+\))'\}",
    r"\1",
    content,
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

# Count changes
changes = sum(1 for a, b in zip(before.split('\n'), content.split('\n')) if a != b)
print(f'OK : {changes} lignes modifiées')
