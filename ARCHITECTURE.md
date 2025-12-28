# Plugin Architecture Overview

## Project Structure

```
plugin/
├── src/                          # TypeScript source
│   ├── index.ts                 # Main entry point
│   ├── definitions.ts           # TypeScript interfaces
│   └── web/
│       └── index.ts             # Web implementation
│
├── android/
│   └── src/main/java/com/small100onnx/
│       ├── Small100OnnxTranslatorPlugin.java    # Android plugin
│       └── ModelManager.java                     # Model management
│
├── ios/
│   └── Plugin/
│       ├── Small100OnnxTranslatorPlugin.swift   # iOS plugin
│       └── ModelManager.swift                    # Model management
│
├── web/src/
│   └── index.ts                 # Web platform implementation
│
├── package.json                 # NPM configuration
├── tsconfig.json                # TypeScript configuration
├── rollup.config.js             # Build configuration
└── README.md                    # Plugin documentation
```

## Architecture Patterns

### 1. Plugin Structure

The plugin follows the Capacitor plugin pattern with platform-specific implementations:

```typescript
// Register the plugin
const Small100OnnxTranslator = registerPlugin<Small100OnnxTranslatorPlugin>(
  'Small100OnnxTranslator',
  {
    web: () => import('./web').then(m => new m.Small100OnnxTranslatorWeb()),
  }
);
```

### 2. Model Management

Each platform has a `ModelManager` that handles:
- **Version fetching** from HuggingFace `version.txt`
- **Model downloads** with progress tracking
- **Storage management** (platform-specific)
- **Metadata persistence**

#### Storage Locations

- **Android**: `context.getFilesDir()/Small100Models/`
- **iOS**: `~/Library/Caches/Small100Models/`
- **Web**: IndexedDB with key `Small100OnnxDB`

### 3. Model Files

Required files downloaded from HuggingFace:
```
{version}/
├── added_tokens.json
├── decoder_int8.onnx
├── encoder_int8.onnx
├── sentencepiece.bpe.model
├── special_tokens_map.json
├── tokenizer_config.json
└── vocab.json
```

### 4. Workflow

```
App Launch
    ↓
initialize()
    ↓
Check if models exist? 
    ├─ YES → Return cached model info
    └─ NO  → Download models
            ├─ Fetch version.txt
            ├─ Download all 7 files
            └─ Cache and save metadata
    ↓
Models Ready ✓
    ↓
translate(text, sourceLanguage, targetLanguage)
    └─ Load models from cache
       ├─ Initialize tokenizer
       ├─ Run ONNX inference
       └─ Decode result
```

## Key Implementation Details

### Android

- **Async Download**: Uses `ExecutorService` for non-blocking downloads
- **Persistence**: SharedPreferences for metadata, File system for models
- **Threading**: Downloads on background thread, callbacks on main thread
- **API Level**: Targets API 21+, compiles to API 33

### iOS

- **Async Download**: Uses DispatchQueue for async operations
- **Persistence**: UserDefaults for metadata, FileManager for models
- **Caching**: Stores in app's Caches directory (cleared on app uninstall)
- **Deployment Target**: iOS 12.0+

### Web

- **Async Download**: Uses Fetch API
- **Storage**: IndexedDB for persisting binary data
- **CORS**: Models hosted on HuggingFace (CORS enabled)
- **Browser Compatibility**: Works on all modern browsers

## Translation Flow (Placeholder)

Currently, the translation method returns a placeholder. To implement actual translation:

### Required Steps

1. **Integrate ONNX Runtime**
   - Android: Add `ai.onnxruntime:onnxruntime-android` dependency
   - iOS: Add ONNX Runtime pod dependency
   - Web: Add `onnxruntime-web` npm package

2. **Load Models**
   - Deserialize ONNX model files from storage
   - Initialize ONNX inference sessions

3. **Tokenization**
   - Use sentencepiece model for encoding
   - Split text into tokens

4. **Inference**
   - Run encoder on tokens
   - Run decoder to generate translations

5. **Decoding**
   - Convert output tokens back to text

## Error Handling

All platforms implement consistent error handling:

1. **Network Errors**: HTTP connection failures during download
2. **Storage Errors**: File I/O and IndexedDB errors
3. **Model Errors**: Invalid model files or corruption
4. **Validation**: All methods validate inputs before processing

## Security Considerations

1. **HTTPS Only**: Models downloaded from HTTPS URLs
2. **File Permissions**: 
   - Android: Private app directory
   - iOS: App's private Caches directory
3. **No Data Logging**: Translation text not logged or sent externally
4. **Offline**: No external communication after initial download

## Build Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Watch mode (development)
npm run watch

# Clean build artifacts
npm run clean

# Prepare for publishing
npm run prepublishOnly
```

## Testing Considerations

For each platform:

1. **Android**
   - Test with emulator and real device
   - Mock HTTP responses for download testing
   - Verify storage in app's file directory

2. **iOS**
   - Test with iOS Simulator and real device
   - Verify storage in Caches directory
   - Check memory pressure handling

3. **Web**
   - Test across browsers
   - Verify IndexedDB quota handling
   - Test offline functionality

## Next Phase: ONNX Integration

To complete the translation functionality:

1. Add ONNX Runtime dependencies
2. Implement model loading from storage
3. Implement tokenization
4. Implement inference pipeline
5. Comprehensive testing across platforms

---

**Status**: Model download and storage infrastructure complete. Translation inference placeholder in place.
