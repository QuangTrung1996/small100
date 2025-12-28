# Integration Guide

## Setup for Capacitor App

This guide shows how to integrate the Small100 ONNX Translator plugin into your Capacitor application.

### Prerequisites

- Capacitor 5.0+
- Node.js 14+
- For Android: Android Studio, JDK 11+
- For iOS: Xcode 13+

### Step 1: Initialize Capacitor Project

If you don't have a Capacitor project yet:

```bash
npm init @capacitor/app

# Choose your app name, package ID, etc.
# Example: "Small100App", "com.example.small100"
```

### Step 2: Install the Plugin

```bash
npm install ./plugin
```

### Step 3: Sync Native Projects

```bash
npx cap sync
```

### Step 4: Basic Usage in Your App

#### React/Vue/Angular Example

```typescript
import React, { useState, useEffect } from 'react';
import { Small100OnnxTranslator } from 'small100-onnx-translator';

export const TranslatorApp = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState('');
  
  useEffect(() => {
    initializePlugin();
  }, []);
  
  const initializePlugin = async () => {
    try {
      const modelInfo = await Small100OnnxTranslator.initialize();
      console.log('Models loaded:', modelInfo.version);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to initialize:', error);
    }
  };
  
  const handleTranslate = async (text: string) => {
    try {
      const result = await Small100OnnxTranslator.translate({
        text: text,
        sourceLanguage: 'vi',
        targetLanguage: 'en'
      });
      setResult(result.translatedText);
    } catch (error) {
      console.error('Translation failed:', error);
    }
  };
  
  if (isLoading) {
    return <div>Loading models...</div>;
  }
  
  return (
    <div>
      <h1>Translator</h1>
      <button onClick={() => handleTranslate('Xin chào')}>
        Translate "Xin chào"
      </button>
      {result && <p>Result: {result}</p>}
    </div>
  );
};
```

### Step 5: Build and Run

#### Android

```bash
npx cap open android
# Android Studio will open. Build and run from there.
```

#### iOS

```bash
npx cap open ios
# Xcode will open. Build and run from there.
# You may need to configure signing and provisioning profiles.
```

#### Web

```bash
npm run dev
# Your app will be served at http://localhost:3000 (or similar)
```

### Step 6: Handle Download Progress (Optional)

You can listen to download progress events:

```typescript
import { Small100OnnxTranslator } from 'small100-onnx-translator';

// Set up listener for Android/iOS
Small100OnnxTranslator.addListener('onDownloadProgress', (event: any) => {
  console.log(`Downloaded: ${event.downloaded}/${event.total}`);
});

// Start download
await Small100OnnxTranslator.downloadModels();
```

## Troubleshooting

### Android Issues

#### Issue: "Failed to download models"
- **Solution**: Check that `INTERNET` permission is in `AndroidManifest.xml`
- **Solution**: Ensure your device/emulator has internet connectivity

#### Issue: Plugin class not found
- **Solution**: Make sure to run `npx cap sync` after installing the plugin

### iOS Issues

#### Issue: CocoaPods error
- **Solution**: Run `pod repo update` in the `ios/App` directory

#### Issue: Swift compatibility
- **Solution**: Ensure Xcode 13+ is installed

### Web Issues

#### Issue: CORS errors when downloading
- **Solution**: The HuggingFace server supports CORS, but check your browser console
- **Solution**: Models are cached in IndexedDB, so they only need to download once

## Environment Configuration

### Android Build Configuration

The plugin requires:
- Minimum SDK: 21
- Target SDK: 33
- Compiler SDK: 33

Adjust in `android/variables.gradle` if needed.

### iOS Configuration

- Minimum iOS version: 12.0
- Update in `ios/App/Podfile` if needed

## Security Considerations

1. **Network Security**: Models are downloaded over HTTPS from HuggingFace
2. **Storage**: Models are stored in app cache directories (encrypted on iOS with file protection)
3. **Offline Mode**: Once downloaded, models work completely offline
4. **Data Privacy**: No translation data is sent to external servers

## Performance Tips

1. **First Launch**: Model download may take a few minutes depending on your connection
2. **Caching**: Models are cached, so subsequent app launches are instant
3. **Memory**: iOS has strict memory limits; consider lazy loading on older devices

## Next Steps

- Customize the translation UI for your needs
- Handle different language pairs
- Implement error recovery
- Add UI feedback for download progress

## Support

For issues or questions:
1. Check the [GitHub repository](https://huggingface.co/lyphanthuc/small100-onnx)
2. Check platform-specific logs:
   - Android: `adb logcat`
   - iOS: Xcode console
   - Web: Browser console

---

**Note**: The actual ONNX model inference implementation is currently a placeholder. 
You'll need to integrate ONNX Runtime for actual translation functionality.
