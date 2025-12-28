"""
Test SMALL100 model with transformers to verify expected output
"""
import os

# Check if transformers is installed
try:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    import torch
except ImportError:
    print("Please install: pip install transformers torch sentencepiece")
    exit(1)

print("Loading SMALL100 model from HuggingFace...")
model_name = "alirezamsh/small100"

tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSeq2SeqLM.from_pretrained(model_name)

# Test cases
test_cases = [
    ("こんにちは", "vi"),  # Japanese -> Vietnamese
    ("すいません", "vi"),  # Japanese -> Vietnamese  
    ("Xin chào", "ja"),   # Vietnamese -> Japanese
]

print("\n" + "="*50)
print("SMALL100 Reference Output Test")
print("="*50)

for text, target_lang in test_cases:
    # Set target language
    tokenizer.tgt_lang = target_lang
    
    # Tokenize
    inputs = tokenizer(text, return_tensors="pt")
    
    print(f"\nInput: '{text}' -> {target_lang}")
    print(f"Input IDs: {inputs['input_ids'].tolist()}")
    
    # Generate
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            forced_bos_token_id=tokenizer.lang_code_to_id[target_lang],
            max_length=50,
            num_beams=1,  # Greedy
        )
    
    print(f"Output IDs: {outputs.tolist()}")
    
    # Decode
    result = tokenizer.decode(outputs[0], skip_special_tokens=True)
    print(f"Result: '{result}'")

print("\n" + "="*50)
print("Done!")
