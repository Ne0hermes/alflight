import os

file_path = r'D:\Applicator\alflight\src\features\flight-wizard\steps\Step6WeightBalance.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Delete lines 231 to 425 (1-based) -> indices 230 to 424
del lines[230:425]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Deleted {425-230} lines.")
