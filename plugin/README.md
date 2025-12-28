# Small100 ONNX Translator Plugin

A Capacitor plugin for offline translation using ONNX models. Supports Android, iOS, and Web platforms.

## Features

- 🚀 **Offline Translation**: Download ONNX models once, then use offline without internet
- 📱 **Cross-platform**: Works on Android, iOS, and Web
- 🌍 **Automatic Model Management**: Fetches and caches the latest models from HuggingFace
- 💾 **Persistent Storage**: Models are cached locally for fast access

## Installation

```bash
npm install small100-onnx-translator
npx cap sync
```

## Usage

### Initialization

```typescript
import { Small100OnnxTranslator } from 'small100-onnx-translator';

// Initialize plugin and download models if needed
const modelInfo = await Small100OnnxTranslator.initialize();
console.log('Model version:', modelInfo.version);
```

### Check if Models are Ready

```typescript
const { ready } = await Small100OnnxTranslator.isReady();
if (!ready) {
  const modelInfo = await Small100OnnxTranslator.downloadModels();
}
```

### Translate Text

```typescript
const result = await Small100OnnxTranslator.translate({
  text: 'Xin chào',
  sourceLanguage: 'vi',
  targetLanguage: 'en'
});

console.log('Translated:', result.translatedText);
```

### Get Model Information

```typescript
const info = await Small100OnnxTranslator.getModelInfo();
console.log('Current version:', info.version);
console.log('Downloaded at:', info.downloadedAt);
```

### Clear Models

```typescript
await Small100OnnxTranslator.clearModels();
```

## API

### `initialize(): Promise<ModelInfo>`

Initialize the plugin and download models if they don't exist.

**Returns**: Promise that resolves to `ModelInfo`

### `isReady(): Promise<{ ready: boolean }>`

Check if models are downloaded and ready to use.

### `downloadModels(): Promise<ModelInfo>`

Download or update models from HuggingFace.

### `translate(options: TranslateOptions): Promise<TranslateResult>`

Translate text using the ONNX model.

**Options**:
- `text` (string): Text to translate
- `sourceLanguage` (string, optional): Source language code (default: 'auto')
- `targetLanguage` (string, optional): Target language code (default: 'en')

**Returns**: Promise that resolves to `TranslateResult`

### `getModelInfo(): Promise<ModelInfo>`

Get current model information.

### `clearModels(): Promise<void>`

Delete all downloaded models.

## TypeScript Definitions

```typescript
interface ModelInfo {
  version: string;
  downloadedAt?: string;
  modelPath?: string;
}

interface TranslateOptions {
  text: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

interface TranslateResult {
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}
```

## Platform-Specific Notes

### Android
- Models are stored in the app's cache directory
- Requires INTERNET permission (automatically added)
- Minimum SDK version: 21

### iOS
- Models are stored in the app's Caches directory
- Minimum iOS version: 12.0

### Web
- Models are stored in IndexedDB
- Requires same-origin requests or CORS-enabled servers

## Development

### Build the plugin

```bash
cd plugin
npm install
npm run build
```

### Integrate into a Capacitor app

```bash
npm install --save-dev ./plugin
npx cap sync
```

## Model Sources

Models are downloaded from: https://huggingface.co/lyphanthuc/small100-onnx

## License

MIT
