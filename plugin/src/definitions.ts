import { Plugin } from '@capacitor/core';

export interface ModelInfo {
  version: string;
  downloadedAt?: string;
  modelPath?: string;
}

export interface TranslateOptions {
  text: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

export interface TranslateResult {
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

export interface Small100OnnxTranslatorPlugin extends Plugin {
  /**
   * Initialize the plugin and download models if needed
   */
  initialize(): Promise<ModelInfo>;

  /**
   * Check if models are downloaded and ready
   */
  isReady(): Promise<{ ready: boolean }>;

  /**
   * Download model files from HuggingFace
   */
  downloadModels(): Promise<ModelInfo>;

  /**
   * Translate text using the ONNX model
   */
  translate(options: TranslateOptions): Promise<TranslateResult>;

  /**
   * Get current model version information
   */
  getModelInfo(): Promise<ModelInfo>;

  /**
   * Clear downloaded models
   */
  clearModels(): Promise<void>;

  /**
   * Get debug information about encoder/decoder IO names
   */
  debugInfo(): Promise<{ encoderInputs: string[]; encoderOutputs: string[]; decoderInputs: string[]; decoderOutputs: string[]; }>;
}
