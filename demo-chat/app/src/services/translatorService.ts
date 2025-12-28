/**
 * Translator Service
 * Wraps the Small100OnnxTranslator plugin for translation functionality
 */

// Import will be available after npm install
// import { Small100OnnxTranslator } from 'small100-onnx-translator';

type ProgressCallback = (progress: number) => void;

class TranslatorService {
  private isInitialized = false;
  private plugin: any = null;

  async initialize(onProgress?: ProgressCallback): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Dynamic import for the plugin
      const { Small100OnnxTranslator } = await import('small100-onnx-translator');
      this.plugin = Small100OnnxTranslator;

      // Check if model is downloaded
      const status = await this.plugin.getModelStatus();
      
      if (!status.isDownloaded) {
        // Download model with progress callback
        await this.plugin.downloadModel({
          onProgress: (event: { progress: number }) => {
            onProgress?.(event.progress);
          },
        });
      }

      // Initialize the translator
      await this.plugin.initialize();
      
      this.isInitialized = true;
      onProgress?.(100);
    } catch (error) {
      console.error('Failed to initialize translator:', error);
      // For web demo without actual plugin, we'll use a mock
      this.isInitialized = true;
      onProgress?.(100);
    }
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    if (!text.trim()) {
      return text;
    }

    if (sourceLang === targetLang) {
      return text;
    }

    try {
      if (this.plugin) {
        const result = await this.plugin.translate({
          text,
          sourceLang,
          targetLang,
        });
        return result.translatedText;
      }
      
      // Mock translation for demo (when plugin is not available)
      return this.mockTranslate(text, sourceLang, targetLang);
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  }

  private mockTranslate(
    text: string,
    _sourceLang: string,
    targetLang: string
  ): string {
    // Simple mock for demo purposes
    return `[${targetLang}] ${text}`;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const translatorService = new TranslatorService();
