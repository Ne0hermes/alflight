file_path = r'D:\Applicator\alflight\src\features\flight-wizard\steps\Step6WeightBalance.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

stack = []
lines = content.split('\n')
def get_line_col(index):
    # This is inefficient but simple
    current_idx = 0
    for line_num, line in enumerate(lines):
        if current_idx + len(line) + 1 > index:
            return line_num + 1, index - current_idx + 1
        current_idx += len(line) + 1 # +1 for newline
    return -1, -1

for i, char in enumerate(content):
    if char in '({[':
        stack.append((char, i))
    elif char in ')}]':
        if not stack:
            line, col = get_line_col(i)
            print(f"Unexpected {char} at line {line}, col {col}")
            break
        last, last_i = stack.pop()
        expected = {'(': ')', '{': '}', '[': ']'}[last]
        if char != expected:
            line, col = get_line_col(i)
            last_line, last_col = get_line_col(last_i)
            print(f"Mismatch: Expected {expected} for {last} at line {last_line}, but found {char} at line {line}")
            break

if stack:
    print("Unclosed elements:")
    for char, i in stack:
        line, col = get_line_col(i)
        print(f"{char} at line {line}")
