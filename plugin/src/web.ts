import { WebPlugin } from '@capacitor/core';
import type {
  Small100OnnxTranslatorPlugin,
  ModelInfo,
  TranslateOptions,
  TranslateResult,
} from './definitions';
import { Translator } from './web/Translator';

const HUGGINGFACE_BASE = 'https://huggingface.co/lyphanthuc/small100-onnx/resolve/main';
const DB_NAME = 'Small100OnnxDB';
const STORE_NAME = 'models';

declare const ort: any;

// Configure ONNX Runtime
let ortConfigured = false;
function configureOrt(): void {
  if (ortConfigured) return;
  ortConfigured = true;
  try {
    if (typeof ort !== 'undefined' && ort.env?.wasm) {
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;
      console.log('[ONNX] Configured for WASM backend');
    }
  } catch (e) {
    console.warn('[ONNX] Configuration warning:', e);
  }
}

/**
 * Capacitor Plugin for SMALL100 ONNX Translation (Web)
 */
export class Small100OnnxTranslatorWeb extends WebPlugin implements Small100OnnxTranslatorPlugin {
  private db: IDBDatabase | null = null;
  private modelInfo: ModelInfo = { version: '' };
  private translator: Translator | null = null;

  async initialize(): Promise<ModelInfo> {
    await this.initDB();

    const existing = await this.getModelInfo();
    if (existing.version) {
      console.log(`[Init] Models found: ${existing.version}`);
      if (!this.translator) {
        await this.initTranslator();
      }
      return existing;
    }

    console.log('[Init] No models found, downloading...');
    return this.downloadModels();
  }

  async isReady(): Promise<{ ready: boolean }> {
    const info = await this.getModelInfo();
    return { ready: !!info.version && this.translator !== null };
  }

  async downloadModels(): Promise<ModelInfo> {
    configureOrt();

    // Fetch version
    const versionResponse = await fetch(`${HUGGINGFACE_BASE}/version.txt`);
    const version = (await versionResponse.text()).trim();

    const files = [
      'added_tokens.json',
      'decoder_int8.onnx',
      'encoder_int8.onnx',
      'special_tokens_map.json',
      'tokenizer_config.json',
      'vocab.json',
    ];

    const modelDir = `${HUGGINGFACE_BASE}/${version}`;
    const downloadedFiles: Record<string, ArrayBuffer> = {};

    console.log(`[Download] Version: ${version}`);

    for (const file of files) {
      console.log(`[Download] ${file}`);
      const response = await fetch(`${modelDir}/${file}`);
      if (!response.ok) throw new Error(`Failed to download ${file}`);
      downloadedFiles[file] = await response.arrayBuffer();
    }

    await this.saveModels(downloadedFiles, version);
    await this.initTranslator();

    this.modelInfo = {
      version,
      downloadedAt: new Date().toISOString(),
      modelPath: DB_NAME,
    };

    return this.modelInfo;
  }

  async translate(options: TranslateOptions): Promise<TranslateResult> {
    const { text, sourceLanguage = 'auto', targetLanguage = 'en' } = options;

    if (!this.translator) {
      throw new Error('Translator not initialized. Call initialize() first.');
    }

    const srcLang = sourceLanguage === 'auto' ? 'en' : sourceLanguage;
    const translatedText = await this.translator.translate(text, targetLanguage);

    return {
      translatedText,
      sourceLanguage: srcLang,
      targetLanguage,
    };
  }

  async getModelInfo(): Promise<ModelInfo> {
    if (this.modelInfo.version) return this.modelInfo;

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
    if (this.translator) {
      this.translator.close();
      this.translator = null;
    }

    if (this.db) {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    this.modelInfo = { version: '' };
  }

  async debugInfo(): Promise<{
    encoderInputs: string[];
    encoderOutputs: string[];
    decoderInputs: string[];
    decoderOutputs: string[];
  }> {
    if (!this.translator) {
      return { encoderInputs: [], encoderOutputs: [], decoderInputs: [], decoderOutputs: [] };
    }

    const engine = this.translator.translationEngine;
    return {
      encoderInputs: engine.encoderInputNames,
      encoderOutputs: engine.encoderOutputNames,
      decoderInputs: engine.decoderInputNames,
      decoderOutputs: engine.decoderOutputNames,
    };
  }

  // Private methods

  private async initTranslator(): Promise<void> {
    configureOrt();

    const encoder = await this.getModelBlob('model_encoder_int8.onnx');
    const decoder = await this.getModelBlob('model_decoder_int8.onnx');
    const vocab = await this.getJSON('model_vocab.json');
    const addedTokens = await this.getJSON('model_added_tokens.json');

    if (!encoder || !decoder || !vocab || !addedTokens) {
      throw new Error('Model files not found. Call downloadModels() first.');
    }

    this.translator = await Translator.create(encoder, decoder, vocab, addedTokens);
  }

  private async initDB(): Promise<void> {
    if (this.db) return;

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

  private async saveModels(files: Record<string, ArrayBuffer>, version: string): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      for (const [filename, data] of Object.entries(files)) {
        store.put(data, `model_${filename}`);
      }
      store.put({ version, downloadedAt: new Date().toISOString() }, 'metadata');

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

  private async getModelBlob(key: string): Promise<ArrayBuffer | null> {
    if (!this.db) return null;

    const transaction = this.db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async getJSON(key: string): Promise<any | null> {
    const blob = await this.getModelBlob(key);
    if (!blob) return null;
    try {
      const text = await new Response(new Blob([blob])).text();
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}

// Re-export web modules for direct usage
export { SimpleBPETokenizer } from './web/SimpleBPETokenizer';
export { BeamSearchDecoder } from './web/BeamSearchDecoder';
export { TranslationEngine } from './web/TranslationEngine';
export { Translator } from './web/Translator';
