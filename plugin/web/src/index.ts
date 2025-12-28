import { WebPlugin } from '@capacitor/core';
import type {
  Small100OnnxTranslatorPlugin,
  ModelInfo,
  TranslateOptions,
  TranslateResult,
} from '../../src/definitions';

const HUGGINGFACE_BASE = 'https://huggingface.co/lyphanthuc/small100-onnx/tree/main';
const DB_NAME = 'Small100OnnxDB';
const STORE_NAME = 'models';

export class Small100OnnxTranslatorWeb extends WebPlugin implements Small100OnnxTranslatorPlugin {
  private db: IDBDatabase | null = null;
  private modelInfo: ModelInfo = { version: '' };

  async initialize(): Promise<ModelInfo> {
    await this.initDB();
    
    // Check if models exist
    const existing = await this.getModelInfo();
    if (existing.version) {
      return existing;
    }

    // Download models
    return this.downloadModels();
  }

  async isReady(): Promise<{ ready: boolean }> {
    const info = await this.getModelInfo();
    return { ready: !!info.version };
  }

  async downloadModels(): Promise<ModelInfo> {
    try {
      // Fetch version from HuggingFace
      const versionResponse = await fetch(
        `${HUGGINGFACE_BASE}/version.txt`
      );
      const version = (await versionResponse.text()).trim();

      // Download model files
      const files = [
        'added_tokens.json',
        'decoder_int8.onnx',
        'encoder_int8.onnx',
        'sentencepiece.bpe.model',
        'special_tokens_map.json',
        'tokenizer_config.json',
        'vocab.json',
      ];

      const modelDir = `${HUGGINGFACE_BASE}/${version}`;
      const downloadedFiles: { [key: string]: ArrayBuffer } = {};

      console.log(`Downloading models from version: ${version}`);

      for (const file of files) {
        const url = `${modelDir}/${file}`;
        console.log(`Downloading: ${file}`);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to download ${file}: ${response.statusText}`);
        }
        downloadedFiles[file] = await response.arrayBuffer();
      }

      // Save to IndexedDB
      await this.saveModels(downloadedFiles, version);

      this.modelInfo = {
        version,
        downloadedAt: new Date().toISOString(),
        modelPath: DB_NAME,
      };

      return this.modelInfo;
    } catch (error) {
      console.error('Failed to download models:', error);
      throw error;
    }
  }

  async translate(options: TranslateOptions): Promise<TranslateResult> {
    const { text, sourceLanguage = 'auto', targetLanguage = 'en' } = options;

    try {
      // For now, return a placeholder translation
      // In a real implementation, this would run the ONNX model
      console.log(
        `Translating from ${sourceLanguage} to ${targetLanguage}: ${text}`
      );

      // TODO: Implement actual ONNX model inference
      // This requires loading the ONNX runtime and the model files from IndexedDB

      return {
        translatedText: `[Translated] ${text}`,
        sourceLanguage,
        targetLanguage,
      };
    } catch (error) {
      console.error('Translation failed:', error);
      throw error;
    }
  }

  async getModelInfo(): Promise<ModelInfo> {
    if (this.modelInfo.version) {
      return this.modelInfo;
    }

    // Try to load from IndexedDB
    try {
      await this.initDB();
      const stored = await this.getStoredModelInfo();
      if (stored) {
        this.modelInfo = stored;
        return stored;
      }
    } catch (error) {
      console.error('Failed to load model info:', error);
    }

    return { version: '' };
  }

  async clearModels(): Promise<void> {
    try {
      if (this.db) {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        await new Promise((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve(undefined);
          request.onerror = () => reject(request.error);
        });
      }
      this.modelInfo = { version: '' };
    } catch (error) {
      console.error('Failed to clear models:', error);
      throw error;
    }
  }

  // Private methods
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  private async saveModels(
    files: { [key: string]: ArrayBuffer },
    version: string
  ): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      // Save model files
      for (const [filename, data] of Object.entries(files)) {
        store.put(data, `model_${filename}`);
      }

      // Save metadata
      store.put(
        {
          version,
          downloadedAt: new Date().toISOString(),
        },
        'metadata'
      );

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async getStoredModelInfo(): Promise<ModelInfo | null> {
    if (!this.db) return null;

    const transaction = this.db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get('metadata');
      request.onsuccess = () => {
        const metadata = request.result;
        if (metadata) {
          resolve({
            version: metadata.version,
            downloadedAt: metadata.downloadedAt,
            modelPath: DB_NAME,
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}
