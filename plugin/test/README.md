# Small100 ONNX Translator - Test Guide

This guide explains how to test the Small100 ONNX Translator on all platforms.

## Test Cases

| Test ID | Input | Source | Target | Expected Output |
|---------|-------|--------|--------|-----------------|
| T001 | Xin chào | vi | en | Hello |
| T002 | Hello world | en | vi | Xin chào thế giới |
| T003 | こんにちは | ja | en | Hello |
| T004 | Bonjour | fr | en | Hello |
| T005 | Hello | en | zh | 你好 |
| T006 | Tôi là một trợ lý AI | vi | en | I am an AI assistant |
| T007 | Hello, how are you? | en | ja | こんにちは、お元気ですか? |

## Web Platform

### Setup
1. Build the plugin:
   ```bash
   cd plugin
   npm install
   npm run build
   ```

2. Serve test page:
   ```bash
   npx http-server . -p 8080
   ```

3. Open browser: http://localhost:8080/test/web/index.html

### Test File Location
- [test/web/index.html](test/web/index.html)

### Expected Behavior
- Models auto-download on first load (~300MB)
- Translation takes 2-10 seconds depending on text length
- Results appear in the UI

---

## Android Platform

### Setup
1. Add test activity to your app's `AndroidManifest.xml`:
   ```xml
   <activity android:name="com.small100onnx.test.TranslatorTestActivity" />
   ```

2. Copy test file:
   ```bash
   cp test/android/TranslatorTestActivity.java \
      android/src/main/java/com/small100onnx/test/
   ```

3. Ensure models are downloaded:
   ```kotlin
   val modelManager = ModelManager(context)
   modelManager.downloadModels()
   ```

### Test File Location
- [test/android/TranslatorTestActivity.java](test/android/TranslatorTestActivity.java)

### Dependencies
Add to `build.gradle`:
```gradle
implementation 'com.microsoft.onnxruntime:onnxruntime-android:1.17.0'
```

---

## iOS Platform

### Setup
1. Add test view controller to your app
2. Copy test file:
   ```bash
   cp test/ios/TranslatorTestViewController.swift \
      ios/Plugin/
   ```

3. Ensure models are downloaded:
   ```swift
   let modelManager = ModelManager()
   modelManager.downloadModels { result in
       // Models ready
   }
   ```

### Test File Location
- [test/ios/TranslatorTestViewController.swift](test/ios/TranslatorTestViewController.swift)

### Dependencies
Add to `Podfile`:
```ruby
pod 'onnxruntime-objc', '~> 1.17.0'
```

---

## Code Architecture

All platforms share the same modular architecture:

```
┌──────────────────────────────────────────────────────────┐
│                    Translator (High-level API)           │
├──────────────────────────────────────────────────────────┤
│  SimpleBPETokenizer  │  TranslationEngine  │ BeamSearch  │
│  (Tokenization)      │  (ONNX Sessions)    │ (Decoding)  │
└──────────────────────────────────────────────────────────┘
```

### Files by Platform

| Module | Web | Android | iOS |
|--------|-----|---------|-----|
| Tokenizer | SimpleBPETokenizer.ts | SimpleBPETokenizer.java | SimpleBPETokenizer.swift |
| Engine | TranslationEngine.ts | TranslationEngine.java | TranslationEngine.swift |
| Decoder | BeamSearchDecoder.ts | BeamSearchDecoder.java | BeamSearchDecoder.swift |
| Translator | Translator.ts | Translator.java | Translator.swift |
| Plugin | web.ts | Small100OnnxTranslatorPlugin.java | Small100OnnxTranslatorPlugin.swift |

---

## Troubleshooting

### Common Issues

1. **"Models not found"**
   - Ensure `ModelManager.downloadModels()` completed successfully
   - Check model directory exists with all required files

2. **"Unknown target language"**
   - Use ISO 639-1 language codes (en, vi, ja, etc.)
   - Call `translator.getSupportedLanguages()` to list available

3. **Slow translation**
   - First translation may be slower (model warm-up)
   - Long texts take more time

4. **Out of memory**
   - ONNX models are ~300MB
   - Close other apps if needed

### Debug Commands

**Web:**
```javascript
const debug = await translator.debugInfo();
console.log(debug.encoderInputs);
console.log(debug.decoderInputs);
```

**Android:**
```java
List<String> languages = translator.getSupportedLanguages();
Log.d("Test", "Languages: " + languages);
```

**iOS:**
```swift
let languages = translator.getSupportedLanguages()
print("Languages: \(languages)")
```
