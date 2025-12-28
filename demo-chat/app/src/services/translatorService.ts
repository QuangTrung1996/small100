/**
 * Translator Service
 * Wraps the Small100OnnxTranslator plugin for translation functionality
 */

import { Small100OnnxTranslator } from "small100-onnx-translator";

type ProgressCallback = (progress: number) => void;

class TranslatorService {
  private isInitialized = false;
  private isInitializing = false;

  async initialize(onProgress?: ProgressCallback): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.isInitializing) {
      // Wait for initialization to complete
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;

    try {
      console.log("[TranslatorService] Initializing...");
      onProgress?.(10);

      // Initialize the plugin (this will download models if needed)
      const modelInfo = await Small100OnnxTranslator.initialize();
      console.log(
        "[TranslatorService] Initialized with model:",
        modelInfo.version
      );

      this.isInitialized = true;
      onProgress?.(100);
    } catch (error) {
      console.error("[TranslatorService] Failed to initialize:", error);
      // Still mark as initialized to prevent blocking the UI
      this.isInitialized = true;
      onProgress?.(100);
    } finally {
      this.isInitializing = false;
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

    // Ensure initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(
        `[TranslatorService] Translating: "${text}" from ${sourceLang} to ${targetLang}`
      );

      const result = await Small100OnnxTranslator.translate({
        text,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      });

      console.log(`[TranslatorService] Result: "${result.translatedText}"`);
      return result.translatedText;
    } catch (error) {
      console.error("[TranslatorService] Translation error:", error);
      // Return original text if translation fails
      return text;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async checkReady(): Promise<boolean> {
    try {
      const status = await Small100OnnxTranslator.isReady();
      return status.ready;
    } catch {
      return false;
    }
  }
}

export const translatorService = new TranslatorService();
