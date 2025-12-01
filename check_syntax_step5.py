
import re

def check_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    stack = []
    mapping = {')': '(', '}': '{', ']': '['}
    lines = content.split('\n')

    for i, line in enumerate(lines):
        for char in line:
            if char in '({[':
                stack.append((char, i + 1))
            elif char in ')}]':
                if not stack:
                    print(f"Error: Unmatched closing {char} at line {i + 1}")
                    return
                top, line_num = stack.pop()
                if mapping[char] != top:
                    print(f"Error: Mismatched {char} at line {i + 1}, expected closing for {top} from line {line_num}")
                    return

    if stack:
        for char, line_num in stack:
            print(f"Error: Unclosed {char} at line {line_num}")
    else:
        print("Syntax check passed: Braces are balanced.")

check_balance(r"D:\Applicator\alflight\src\features\flight-wizard\steps\Step5Fuel.jsx")
