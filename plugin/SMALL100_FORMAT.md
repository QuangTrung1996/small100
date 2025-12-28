# SMALL100 Model Input/Output Format

> ⚠️ **QUAN TRỌNG**: Đọc kỹ file này trước khi sửa đổi translation code!

## Encoder Input Format

```
[tgt_lang_code] + source_tokens + [EOS]
```

**Ví dụ**: Dịch "Xin chào" sang tiếng Nhật (`ja`)

```
Input: [__ja__ token ID] + [tokenize("Xin chào")] + [EOS token ID]
```

## Decoder Input Format

Decoder bắt đầu với:

```
[EOS] + [tgt_lang_code]
```

Sau đó tiếp tục generate token cho đến khi gặp EOS.

## Special Token IDs

| Token        | ID  | Mô tả             |
| ------------ | --- | ----------------- |
| `<s>` (BOS)  | 0   | Begin of sentence |
| `<pad>`      | 1   | Padding           |
| `</s>` (EOS) | 2   | End of sentence   |
| `<unk>`      | 3   | Unknown token     |

## Language Token Format

Language tokens có dạng `__xx__` trong file `added_tokens.json`:

- `__vi__` → Vietnamese
- `__ja__` → Japanese
- `__en__` → English
- ... (xem full list trong added_tokens.json)

## Code Reference

### Web (TypeScript)

```typescript
// File: plugin/src/web/Translator.ts

// Encoder input
const inputIds = [langTokenId, ...inputTokens, this.tokenizer.eosTokenId];

// Decoder initial tokens
const initialIds = [this.tokenizer.eosTokenId, langTokenId];
```

### iOS (Swift)

```swift
// File: plugin/ios/Plugin/Translator.swift

// Encoder input
var inputIds: [Int64] = [Int64(tgtTokenId)]
inputIds.append(contentsOf: textTokens.map { Int64($0) })
inputIds.append(Int64(tokenizer.eosTokenId))
```

### Android (Java)

```java
// File: plugin/android/src/main/java/com/small100onnx/Translator.java

// Encoder input
long[] inputIds = new long[textTokens.length + 2];
inputIds[0] = tgtTokenId;
for (int i = 0; i < textTokens.length; i++) {
    inputIds[i + 1] = textTokens[i];
}
inputIds[inputIds.length - 1] = tokenizer.getEosTokenId();
```

## Lỗi Thường Gặp

### ❌ SAI: Thiếu language token ở đầu encoder input

```typescript
const inputIds = [...inputTokens, this.tokenizer.eosTokenId];
// Kết quả: Dịch sai hoặc ra kết quả vô nghĩa
```

### ✅ ĐÚNG: Có language token ở đầu

```typescript
const inputIds = [langTokenId, ...inputTokens, this.tokenizer.eosTokenId];
```

## Tham Khảo

- [HuggingFace SMALL100](https://huggingface.co/alirezamsh/small100)
- Paper: "SMaLL-100: Introducing Shallow Multilingual Machine Translation Model for Low-Resource Languages" (EMNLP 2022)
