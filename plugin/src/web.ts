import { WebPlugin } from '@capacitor/core';
import type {
  Small100OnnxTranslatorPlugin,
  ModelInfo,
  TranslateOptions,
  TranslateResult,
} from './definitions';
import type * as ORT from 'onnxruntime-web';

// Use global ort from CDN script tag
declare const ort: typeof ORT;

// Simple BPE Tokenizer for SentencePiece vocab
class SimpleBPETokenizer {
  private vocab: Record<string, number> = {};
  private reverseVocab: Record<number, string> = {};
  private specialTokens: Set<string> = new Set();
  
  constructor(vocab: Record<string, number>) {
    this.vocab = vocab;
    // Build reverse vocab for decoding
    for (const [token, id] of Object.entries(vocab)) {
      this.reverseVocab[id] = token;
    }
    // Mark special tokens
    this.specialTokens = new Set(['<s>', '</s>', '<pad>', '<unk>']);
  }
  
  encode(text: string): number[] {
    // SentencePiece uses ▁ (U+2581) as word boundary marker
    // Normalize text: add ▁ at start and replace spaces with ▁
    const normalizedText = '▁' + text.replace(/ /g, '▁');
    
    // Greedy longest-match tokenization
    const tokens: number[] = [];
    let i = 0;
    
    while (i < normalizedText.length) {
      let found = false;
      // Try longest match first (up to 20 chars)
      for (let len = Math.min(20, normalizedText.length - i); len > 0; len--) {
        const substr = normalizedText.substring(i, i + len);
        if (this.vocab[substr] !== undefined) {
          tokens.push(this.vocab[substr]);
          i += len;
          found = true;
          break;
        }
      }
      
      if (!found) {
        // Unknown character - use <unk> token or skip
        const unkId = this.vocab['<unk>'];
        if (unkId !== undefined) {
          tokens.push(unkId);
        }
        i++;
      }
    }
    
    return tokens;
  }
  
  decode(ids: number[], skipSpecialTokens: boolean = true): string {
    const tokens: string[] = [];
    
    for (const id of ids) {
      const token = this.reverseVocab[id];
      if (token === undefined) continue;
      
      if (skipSpecialTokens && this.specialTokens.has(token)) {
        continue;
      }
      
      tokens.push(token);
    }
    
    // Join and replace ▁ with space, then trim
    let result = tokens.join('');
    result = result.replace(/▁/g, ' ').trim();
    
    return result;
  }
  
  getVocabSize(): number {
    return Object.keys(this.vocab).length;
  }
}

const HUGGINGFACE_BASE = 'https://huggingface.co/lyphanthuc/small100-onnx/resolve/main';
const DB_NAME = 'Small100OnnxDB';
const STORE_NAME = 'models';

// Configure ONNX Runtime lazily when first needed
let ortConfigured = false;
function configureOrt() {
  if (ortConfigured) return;
  ortConfigured = true;
  
  try {
    if (typeof ort !== 'undefined' && ort.env && ort.env.wasm) {
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;
      console.log('[ONNX] Configured for WASM backend');
    }
  } catch (e) {
    console.warn('[ONNX] Configuration warning:', e);
  }
}

export class Small100OnnxTranslatorWeb extends WebPlugin implements Small100OnnxTranslatorPlugin {
  private db: IDBDatabase | null = null;
  private modelInfo: ModelInfo = { version: '' };
  private encoderSession: ORT.InferenceSession | null = null;
  private decoderSession: ORT.InferenceSession | null = null;
  private tokenizer: SimpleBPETokenizer | null = null;
  private languageTokenMap: Record<string, number> = {};
  private bosTokenId: number | null = null;
  private eosTokenId: number | null = null;

  async initialize(): Promise<ModelInfo> {
    await this.initDB();
    
    // Check if models exist and sessions are loaded
    const existing = await this.getModelInfo();
    if (existing.version) {
      console.log(`[Init] Models already downloaded: ${existing.version}`);
      // Ensure ORT sessions are loaded
      if (!this.encoderSession || !this.decoderSession) {
        console.log('[Init] Loading ORT sessions...');
        await this.loadOrtSessions();
      }
      return existing;
    }

    // Download models if not found
    console.log('[Init] No models found, starting download...');
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

      // Initialize ORT sessions
      await this.loadOrtSessions();

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

    console.log(`[Translate] Starting translation - Text: "${text}", Source: ${sourceLanguage}, Target: ${targetLanguage}`);

    try {
      // Ensure sessions are loaded
      console.log('[Translate] Step 1/7: Checking encoder/decoder sessions...');
      if (!this.encoderSession || !this.decoderSession) {
        console.log('[Translate] Sessions not loaded, loading now...');
        await this.loadOrtSessions();
        console.log('[Translate] Sessions loaded successfully');
      } else {
        console.log('[Translate] Sessions already loaded');
      }

      // Ensure tokenizer is loaded
      console.log('[Translate] Step 2/7: Checking tokenizer...');
      await this.ensureTokenizer();
      console.log('[Translate] Tokenizer ready');

      // Determine source/target language tokens
      console.log('[Translate] Step 3/7: Determining language tokens...');
      const srcLangCode = sourceLanguage === 'auto' ? 'en' : sourceLanguage;
      const tgtLangCode = targetLanguage;
      // SMALL100: Encoder input uses TARGET language token (language to translate TO)
      const tgtToken = this.langCodeToToken(tgtLangCode);
      const tgtTokenId = this.langCodeToTokenId(tgtLangCode);
      console.log(`[Translate] Source language: ${srcLangCode}`);
      console.log(`[Translate] Target language: ${tgtLangCode}, token: ${tgtToken}, token ID: ${tgtTokenId}`);

      if (tgtTokenId == null) {
        throw new Error(`Unknown target language '${targetLanguage}'.`);
      }

      // Tokenize input text - SMALL100 uses TARGET language token in encoder input
      console.log('[Translate] Step 4/7: Tokenizing input text...');
      const { input_ids, attention_mask } = await this.tokenize(text, tgtToken);
      console.log(`[Translate] Tokenized to ${input_ids.length} tokens:`, input_ids.slice(0, 10), '...');
      const inputIds = new BigInt64Array(input_ids.map(x => BigInt(x)));
      const attentionMask = new BigInt64Array(attention_mask.map(x => BigInt(x)));

      const encoderFeeds: Record<string, ORT.Tensor> = {
        input_ids: new ort.Tensor('int64', inputIds, [1, inputIds.length]),
        attention_mask: new ort.Tensor('int64', attentionMask, [1, attentionMask.length]),
      };

      // Run encoder
      console.log('[Translate] Step 5/7: Running encoder model...');
      const startEncoder = performance.now();
      const encoderOutput = await this.encoderSession!.run(encoderFeeds);
      const encoderTime = performance.now() - startEncoder;
      console.log(`[Translate] Encoder completed in ${encoderTime.toFixed(2)}ms`);

      // Find encoder hidden states tensor (heuristic: first output or contains 'last_hidden_state')
      const encOutputName = this.encoderSession!.outputNames.find(n => /last_hidden_state|encoder_hidden_states/i.test(n))
        || this.encoderSession!.outputNames[0];
      const encoderHidden = encoderOutput[encOutputName] as ORT.Tensor;
      console.log(`[Translate] Encoder output shape: [${encoderHidden.dims.join(', ')}]`);

      // Beam search decode using decoder session
      // SMALL100: decoder starts with EOS token, language is already in encoder prefix
      console.log('[Translate] Step 6/7: Running beam search decode...');
      const decoderStartTokens = [this.eosTokenId!];
      const numBeams = 5;
      const lengthPenalty = 1.0;
      console.log(`[Translate] Decoder start tokens: [${decoderStartTokens.join(', ')}], beams: ${numBeams}`);
      const startDecode = performance.now();
      const translatedIds = await this.beamSearchDecode(encoderHidden, attentionMask, decoderStartTokens, 256, numBeams, lengthPenalty);
      const decodeTime = performance.now() - startDecode;
      console.log(`[Translate] Decode completed in ${decodeTime.toFixed(2)}ms, generated ${translatedIds.length} tokens`);
      
      console.log('[Translate] Step 7/7: Detokenizing output...');
      const translatedText = await this.detokenize(translatedIds);

      console.log(
        `[Translate] ✓ Translation complete: "${text}" (${srcLangCode}) -> "${translatedText}" (${tgtLangCode})`
      );

      return {
        translatedText,
        sourceLanguage: srcLangCode,
        targetLanguage: tgtLangCode,
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

  async debugInfo(): Promise<{ encoderInputs: string[]; encoderOutputs: string[]; decoderInputs: string[]; decoderOutputs: string[]; }> {
    if (!this.encoderSession || !this.decoderSession) {
      await this.loadOrtSessions();
    }
    return {
      encoderInputs: this.encoderSession ? Array.from(this.encoderSession.inputNames) : [],
      encoderOutputs: this.encoderSession ? Array.from(this.encoderSession.outputNames) : [],
      decoderInputs: this.decoderSession ? Array.from(this.decoderSession.inputNames) : [],
      decoderOutputs: this.decoderSession ? Array.from(this.decoderSession.outputNames) : [],
    };
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

  private async loadOrtSessions(): Promise<void> {
    // Configure ONNX Runtime before creating sessions
    configureOrt();
    
    // Load model binaries from IndexedDB and create ORT sessions
    if (!this.db) {
      await this.initDB();
    }

    const encoder = await this.getModelBlob('model_encoder_int8.onnx');
    const decoder = await this.getModelBlob('model_decoder_int8.onnx');

    if (!encoder || !decoder) {
      throw new Error('Model files not found in storage. Call initialize() first.');
    }

    // Use WASM backend for web (CPU is not a valid backend for onnxruntime-web)
    const options: ORT.InferenceSession.SessionOptions = {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    };

    try {
      this.encoderSession = await ort.InferenceSession.create(encoder, options);
      console.log('Encoder session created successfully (WASM backend)');
      console.log('Encoder input names:', this.encoderSession.inputNames);
      console.log('Encoder output names:', this.encoderSession.outputNames);
    } catch (e) {
      console.error('Failed to create encoder session:', e);
      throw new Error(`Encoder initialization failed: ${e}`);
    }

    try {
      this.decoderSession = await ort.InferenceSession.create(decoder, options);
      console.log('Decoder session created successfully (WASM backend)');
      console.log('Decoder input names:', this.decoderSession.inputNames);
      console.log('Decoder output names:', this.decoderSession.outputNames);
    } catch (e) {
      console.error('Failed to create decoder session:', e);
      throw new Error(`Decoder initialization failed: ${e}`);
    }
  }

  private async getModelBlob(key: string): Promise<ArrayBuffer | null> {
    if (!this.db) return null;
    const transaction = this.db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- Tokenizer helpers ---
  private async ensureTokenizer(): Promise<void> {
    if (this.tokenizer) return;
    const info = await this.getModelInfo();
    if (!info.version) {
      throw new Error('Models not initialized. Call initialize() first.');
    }

    console.log('[Tokenizer] Loading tokenizer from local vocab.json...');

    try {
      // Load vocab.json from IndexedDB
      const vocab = await this.getJSON('model_vocab.json');
      if (!vocab) {
        throw new Error('vocab.json not found in storage');
      }
      
      // Create tokenizer instance
      this.tokenizer = new SimpleBPETokenizer(vocab);
      console.log(`[Tokenizer] Vocab size: ${this.tokenizer.getVocabSize()}`);
      
      // Load language token map from our stored added_tokens.json
      const addedTokens = await this.getJSON('model_added_tokens.json');
      this.languageTokenMap = addedTokens || {};

      // Set special token IDs - M2M100 uses these values
      this.bosTokenId = 0;
      this.eosTokenId = 2;

      console.log(`[Tokenizer] Special tokens - BOS: ${this.bosTokenId}, EOS: ${this.eosTokenId}`);
      console.log(`[Tokenizer] Language tokens: ${Object.keys(this.languageTokenMap).length}`);
      console.log('[Tokenizer] Tokenizer loaded successfully');

    } catch (error) {
      console.error('[Tokenizer] Failed to load tokenizer:', error);
      throw new Error(`Tokenizer initialization failed: ${error}`);
    }
  }

  private async tokenize(text: string, srcLangToken: string | null): Promise<{ input_ids: number[]; attention_mask: number[]; }> {
    if (!this.tokenizer) throw new Error('Tokenizer not loaded');
    
    // Encode using our SimpleBPETokenizer
    const tokenIds = this.tokenizer.encode(text);
    
    // Build input_ids: [src_lang_token, ...tokens, eos_token]
    const input_ids: number[] = [];
    
    // Add source language token at the beginning (M2M100 style)
    if (srcLangToken && this.languageTokenMap[srcLangToken] !== undefined) {
      input_ids.push(this.languageTokenMap[srcLangToken]);
    }
    
    // Add encoded tokens
    input_ids.push(...tokenIds);
    
    // Add EOS token at the end
    if (this.eosTokenId !== null) {
      input_ids.push(this.eosTokenId);
    }
    
    // Attention mask is all 1s
    const attention_mask = new Array(input_ids.length).fill(1);

    return { input_ids, attention_mask };
  }

  private async detokenize(ids: number[]): Promise<string> {
    if (!this.tokenizer) throw new Error('Tokenizer not loaded');
    
    // Output format: [EOS, content_tokens..., EOS]
    // Skip the first token (EOS start token)
    let outputIds = ids.slice(1);
    
    // Remove EOS token if present at the end
    if (this.eosTokenId != null && outputIds.length > 0 && outputIds[outputIds.length - 1] === this.eosTokenId) {
      outputIds = outputIds.slice(0, -1);
    }
    
    // Also filter any remaining special tokens (EOS, BOS, PAD) and language tokens (>= 128000)
    outputIds = outputIds.filter(id => 
      id !== this.eosTokenId && 
      id !== this.bosTokenId && 
      id !== 1 && // PAD token
      id < 128000 // Filter out language tokens
    );
    
    console.log(`[Detokenize] Input ids: [${ids.join(', ')}]`);
    console.log(`[Detokenize] After filtering: [${outputIds.join(', ')}]`);
    
    return this.tokenizer.decode(outputIds, true);
  }

  private langCodeToToken(lang: string): string | null {
    const key = `__${lang}__`;
    return this.languageTokenMap && this.languageTokenMap[key] != null ? key : null;
  }

  private langCodeToTokenId(lang: string): number | null {
    const key = `__${lang}__`;
    const id = this.languageTokenMap[key];
    return typeof id === 'number' ? id : null;
  }

  // Beam search decode for better translation quality - BATCHED version for speed
  private async beamSearchDecode(
    encoderHidden: ORT.Tensor,
    attentionMask: BigInt64Array,
    startTokenIds: number[],
    maxNewTokens: number,
    numBeams: number = 5,
    lengthPenalty: number = 1.0,
    repetitionPenalty: number = 1.2,
    noRepeatNgramSize: number = 3
  ): Promise<number[]> {
    console.log(`[BeamSearch] Starting BATCHED with ${numBeams} beams, max ${maxNewTokens} tokens`);
    
    interface Beam {
      ids: number[];
      score: number;
      finished: boolean;
    }
    
    // Helper: check if adding token would create repeated n-gram
    const wouldRepeatNgram = (tokens: number[], nextToken: number, n: number): boolean => {
      if (n <= 0 || tokens.length < n - 1) return false;
      const lastNMinus1 = tokens.slice(-(n - 1));
      const newNgram = [...lastNMinus1, nextToken].join(',');
      // Check existing n-grams
      for (let i = 0; i <= tokens.length - n; i++) {
        if (tokens.slice(i, i + n).join(',') === newNgram) return true;
      }
      return false;
    };
    
    let beams: Beam[] = [{ ids: [...startTokenIds], score: 0, finished: false }];
    const finishedBeams: Beam[] = [];
    
    // Cache input names (avoid repeated lookups)
    const inputName = this.decoderSession!.inputNames.find(n => /input_ids/i.test(n)) || this.decoderSession!.inputNames[0];
    const encName = this.decoderSession!.inputNames.find(n => /encoder_hidden_states|encoder_outputs|memory/i.test(n));
    const maskName = this.decoderSession!.inputNames.find(n => /encoder_attention_mask|attention_mask/i.test(n));
    const logitsName = this.decoderSession!.outputNames.find(n => /logits|output/i.test(n)) || this.decoderSession!.outputNames[0];
    
    // Pre-compute encoder hidden expanded for batch (will resize as needed)
    const encSeqLen = encoderHidden.dims[1];
    const hiddenSize = encoderHidden.dims[2];
    const encData = encoderHidden.data as Float32Array;
    const attMaskLen = attentionMask.length;
    
    for (let step = 0; step < maxNewTokens; step++) {
      // Filter active beams
      const activeBeams = beams.filter(b => !b.finished);
      if (activeBeams.length === 0) break;
      
      // Early stopping check
      if (finishedBeams.length >= numBeams) {
        const bestFinishedScore = finishedBeams[0].score / Math.pow(finishedBeams[0].ids.length, lengthPenalty);
        const bestActiveScore = activeBeams[0].score / Math.pow(activeBeams[0].ids.length, lengthPenalty);
        if (bestFinishedScore > bestActiveScore) {
          console.log(`[BeamSearch] Early stop at step ${step}`);
          break;
        }
      }
      
      const batchSize = activeBeams.length;
      const seqLen = activeBeams[0].ids.length; // All beams same length at this step
      
      // Build batched decoder input
      const batchedIds = new BigInt64Array(batchSize * seqLen);
      for (let b = 0; b < batchSize; b++) {
        for (let s = 0; s < seqLen; s++) {
          batchedIds[b * seqLen + s] = BigInt(activeBeams[b].ids[s]);
        }
      }
      
      // Expand encoder hidden states for batch
      const batchedEncHidden = new Float32Array(batchSize * encSeqLen * hiddenSize);
      for (let b = 0; b < batchSize; b++) {
        batchedEncHidden.set(encData, b * encSeqLen * hiddenSize);
      }
      
      // Expand attention mask for batch
      const batchedAttMask = new BigInt64Array(batchSize * attMaskLen);
      for (let b = 0; b < batchSize; b++) {
        batchedAttMask.set(attentionMask, b * attMaskLen);
      }
      
      // Build feeds
      const feeds: Record<string, ORT.Tensor> = {};
      feeds[inputName] = new ort.Tensor('int64', batchedIds, [batchSize, seqLen]);
      if (encName) feeds[encName] = new ort.Tensor('float32', batchedEncHidden, [batchSize, encSeqLen, hiddenSize]);
      if (maskName) feeds[maskName] = new ort.Tensor('int64', batchedAttMask, [batchSize, attMaskLen]);
      
      // Single batched decoder call
      const out = await this.decoderSession!.run(feeds);
      const logits = out[logitsName] as ORT.Tensor;
      
      const data = logits.data as Float32Array;
      const vocab = logits.dims[2];
      
      // Process each beam's logits
      const allCandidates: Beam[] = [];
      
      for (let b = 0; b < batchSize; b++) {
        const beam = activeBeams[b];
        const start = (b * seqLen + seqLen - 1) * vocab; // Last position for this beam
        
        // Get raw logits and apply repetition penalty
        const rawLogits = new Float32Array(vocab);
        const seenTokens = new Set(beam.ids);
        
        for (let i = 0; i < vocab; i++) {
          let val = data[start + i];
          if (seenTokens.has(i)) {
            val = val > 0 ? val / repetitionPenalty : val * repetitionPenalty;
          }
          rawLogits[i] = val;
        }
        
        // Log-softmax
        let maxLogit = -Infinity;
        for (let i = 0; i < vocab; i++) {
          if (rawLogits[i] > maxLogit) maxLogit = rawLogits[i];
        }
        let sumExp = 0;
        for (let i = 0; i < vocab; i++) {
          sumExp += Math.exp(rawLogits[i] - maxLogit);
        }
        const logSumExp = maxLogit + Math.log(sumExp);
        
        // Suppress EOS for first token
        const suppressEOS = beam.ids.length <= 1;
        
        // Get top candidates
        const topK = numBeams * 2;
        const tokenScores: { id: number; logProb: number }[] = [];
        
        for (let i = 0; i < vocab; i++) {
          if (suppressEOS && i === this.eosTokenId) continue;
          if (noRepeatNgramSize > 0 && wouldRepeatNgram(beam.ids, i, noRepeatNgramSize)) continue;
          tokenScores.push({ id: i, logProb: rawLogits[i] - logSumExp });
        }
        
        // Partial sort - only need top K
        tokenScores.sort((a, b) => b.logProb - a.logProb);
        
        for (let k = 0; k < Math.min(topK, tokenScores.length); k++) {
          const token = tokenScores[k];
          allCandidates.push({
            ids: [...beam.ids, token.id],
            score: beam.score + token.logProb,
            finished: token.id === this.eosTokenId
          });
        }
      }
      
      // Sort and select top beams
      allCandidates.sort((a, b) => {
        const scoreA = a.score / Math.pow(a.ids.length, lengthPenalty);
        const scoreB = b.score / Math.pow(b.ids.length, lengthPenalty);
        return scoreB - scoreA;
      });
      
      beams = [];
      for (const candidate of allCandidates) {
        if (candidate.finished) {
          // Insert sorted
          const ns = candidate.score / Math.pow(candidate.ids.length, lengthPenalty);
          let idx = finishedBeams.findIndex(fb => 
            fb.score / Math.pow(fb.ids.length, lengthPenalty) < ns
          );
          if (idx === -1) idx = finishedBeams.length;
          finishedBeams.splice(idx, 0, candidate);
        } else if (beams.length < numBeams) {
          beams.push(candidate);
        }
        if (beams.length >= numBeams && finishedBeams.length >= numBeams) break;
      }
      
      // Log progress less frequently
      if (step === 0 || step === 5 || step % 20 === 0) {
        const best = beams[0] || finishedBeams[0];
        if (best && this.tokenizer) {
          console.log(`[BeamSearch] Step ${step}: "${this.tokenizer.decode(best.ids.slice(1), true)}"`);
        }
      }
    }
    
    // Select best result
    const allBeams = [...finishedBeams, ...beams];
    if (allBeams.length === 0) return startTokenIds;
    
    allBeams.sort((a, b) => {
      const scoreA = a.score / Math.pow(a.ids.length, lengthPenalty);
      const scoreB = b.score / Math.pow(b.ids.length, lengthPenalty);
      return scoreB - scoreA;
    });
    
    const best = allBeams[0];
    if (this.tokenizer) {
      console.log(`[BeamSearch] Final: "${this.tokenizer.decode(best.ids.slice(1), true)}" (len: ${best.ids.length})`);
    }
    
    return best.ids;
  }

  private async greedyDecode(
    encoderHidden: ORT.Tensor,
    attentionMask: BigInt64Array,
    startTokenIds: number[],
    maxNewTokens: number
  ): Promise<number[]> {
    console.log(`[Decode] Starting greedy decode with start tokens [${startTokenIds.join(', ')}], max ${maxNewTokens} tokens`);
    const ids: number[] = [...startTokenIds];
    const logInterval = 10; // Log every 10 steps
    for (let step = 0; step < maxNewTokens; step++) {
      if (step % logInterval === 0 || step < 3) {
        console.log(`[Decode] Step ${step}/${maxNewTokens}, current length: ${ids.length}`);
        // Decode and show current text
        if (this.tokenizer && ids.length > 1) {
          const currentText = this.tokenizer.decode(ids.slice(1)); // Skip start token
          console.log(`[Decode] Current text: "${currentText}"`);
          console.log(`[Decode] Token IDs: ${ids.slice(-5).join(', ')}...`); // Last 5 tokens
        }
      }
      const feeds: Record<string, ORT.Tensor> = {};
      const inputName = this.decoderSession!.inputNames.find(n => /input_ids/i.test(n)) || this.decoderSession!.inputNames[0];
      feeds[inputName] = new ort.Tensor('int64', new BigInt64Array(ids.map(x => BigInt(x))), [1, ids.length]);

      const encName = this.decoderSession!.inputNames.find(n => /encoder_hidden_states|encoder_outputs|memory/i.test(n));
      if (encName) feeds[encName] = encoderHidden;

      const maskName = this.decoderSession!.inputNames.find(n => /encoder_attention_mask|attention_mask/i.test(n));
      if (maskName) feeds[maskName] = new ort.Tensor('int64', attentionMask, [1, attentionMask.length]);

      const out = await this.decoderSession!.run(feeds);
      const logitsName = this.decoderSession!.outputNames.find(n => /logits|output/i.test(n)) || this.decoderSession!.outputNames[0];
      const logits = out[logitsName] as ORT.Tensor;

      // Debug logits shape on first step
      if (step === 0) {
        console.log(`[Decode] Logits tensor name: ${logitsName}, shape: [${logits.dims?.join(', ') || 'unknown'}]`);
        console.log(`[Decode] Output tensor names:`, Object.keys(out));
      }

      const data = logits.data as Float32Array | number[];
      const seqLen = (logits.dims && logits.dims.length >= 2) ? logits.dims[1] : ids.length;
      const vocab = (logits.dims && logits.dims.length >= 3) ? logits.dims[2] : Math.floor((data as any).length / seqLen) || 0;
      
      if (step === 0) {
        console.log(`[Decode] Computed seqLen=${seqLen}, vocab=${vocab}, data.length=${data.length}`);
      }
      
      const start = (seqLen - 1) * vocab;
      let maxId = 0;
      let maxVal = -Infinity;
      
      // Find top 5 tokens for debugging
      const topTokens: {id: number, val: number}[] = [];
      
      // Content tokens = total - start token [EOS]
      const contentTokensGenerated = ids.length - 1; // Subtract [EOS]
      const minContentTokens = 1; // At least generate 1 content token before allowing EOS
      const suppressEOS = contentTokensGenerated < minContentTokens;
      
      for (let i = 0; i < vocab; i++) {
        const val = (data as any)[start + i];
        
        // Skip EOS token if we haven't generated enough content yet
        if (suppressEOS && this.eosTokenId != null && i === this.eosTokenId) {
          continue;
        }
        
        if (val > maxVal) { maxVal = val; maxId = i; }
        topTokens.push({id: i, val});
      }
      topTokens.sort((a, b) => b.val - a.val);
      
      if (step === 0 && suppressEOS) {
        console.log(`[Decode] EOS suppressed (need ${minContentTokens - contentTokensGenerated} more content tokens)`);
      }
      
      if (step === 0) {
        console.log(`[Decode] Top 5 tokens:`, topTokens.slice(0, 5).map(t => {
          const tokenStr = this.tokenizer ? this.tokenizer.decode([t.id], false) : `ID:${t.id}`;
          return `${tokenStr}(${t.id}): ${t.val.toFixed(3)}`;
        }));
      }
      
      ids.push(maxId);
      
      // Debug: log generated token and EOS comparison
      if (step < 5 || step % logInterval === 0 || maxId === this.eosTokenId) {
        const tokenStr = this.tokenizer ? this.tokenizer.decode([maxId], false) : `ID:${maxId}`;
        console.log(`[Decode] Step ${step}: Generated token "${tokenStr}" (ID: ${maxId}), EOS: ${this.eosTokenId}`);
        
        // Show decoded text so far (skip start token)
        if (this.tokenizer && ids.length > 1) {
          const decodedText = this.tokenizer.decode(ids.slice(1), false);
          console.log(`[Decode] → Current text: "${decodedText}"`);
        }
      }
      
      if (this.eosTokenId != null && maxId === this.eosTokenId) {
        console.log(`[Decode] EOS token reached at step ${step}, stopping decode`);
        break;
      }
    }
    console.log(`[Decode] Decode finished with ${ids.length} tokens`);
    return ids;
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
