import json

v = json.load(open('temp_vocab.json', 'r', encoding='utf-8'))

text = 'こんにちは'
print('Looking for:', text)

# Check individual and combined tokens
chars = ['こ', 'ん', 'に', 'ち', 'は', 'こん', 'にち', 'こんにち', 'こんにちは']

for c in chars:
    plain = v.get(c, "NOT FOUND")
    with_marker = v.get('▁' + c, "NOT FOUND")
    print(f"'{c}': {plain} | '▁{c}': {with_marker}")

print("\n--- Simulating tokenization ---")
# Simulate greedy longest-match tokenization
normalized = '▁' + text
print(f"Normalized: '{normalized}'")

i = 0
tokens = []
while i < len(normalized):
    found = False
    max_len = min(20, len(normalized) - i)
    
    for length in range(max_len, 0, -1):
        substr = normalized[i:i+length]
        if substr in v:
            tokens.append((substr, v[substr]))
            i += length
            found = True
            break
    
    if not found:
        print(f"Unknown char at {i}: '{normalized[i]}' (ord={ord(normalized[i])})")
        tokens.append(('<unk>', 3))
        i += 1

print(f"Tokens: {tokens}")
print(f"Token IDs: {[t[1] for t in tokens]}")

# Check "すいません" too
print("\n--- Testing すいません ---")
text2 = 'すいません'
normalized2 = '▁' + text2
i = 0
tokens2 = []
while i < len(normalized2):
    found = False
    max_len = min(20, len(normalized2) - i)
    
    for length in range(max_len, 0, -1):
        substr = normalized2[i:i+length]
        if substr in v:
            tokens2.append((substr, v[substr]))
            i += length
            found = True
            break
    
    if not found:
        tokens2.append(('<unk>', 3))
        i += 1

print(f"Tokens: {tokens2}")
