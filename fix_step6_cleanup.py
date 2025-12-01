import os

file_path = r'D:\Applicator\alflight\src\features\flight-wizard\steps\Step6WeightBalance.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Delete lines 631 to 829 (1-based) -> indices 630 to 828
# Python slice [630:829] deletes indices 630, 631, ..., 828.
del lines[630:829]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Deleted {829-630} lines.")
