/**
 * High-level Translator API for SMALL100
 * Coordinates tokenizer, engine, and decoder
 */

import { SimpleBPETokenizer } from './SimpleBPETokenizer';
import { BeamSearchDecoder, BeamSearchConfig } from './BeamSearchDecoder';
import { TranslationEngine } from './TranslationEngine';

export interface TranslatorConfig extends Partial<BeamSearchConfig> {
  logSteps?: boolean;
}

export class Translator {
  private tokenizer: SimpleBPETokenizer;
  private engine: TranslationEngine;
  private decoder: BeamSearchDecoder;
  private languageTokenMap: Map<string, number>;
  private config: TranslatorConfig;

  private constructor(
    tokenizer: SimpleBPETokenizer,
    engine: TranslationEngine,
    decoder: BeamSearchDecoder,
    languageTokenMap: Map<string, number>,
    config: TranslatorConfig
  ) {
    this.tokenizer = tokenizer;
    this.engine = engine;
    this.decoder = decoder;
    this.languageTokenMap = languageTokenMap;
    this.config = config;
  }

  /**
   * Create a Translator from model data
   */
  static async create(
    encoderData: ArrayBuffer,
    decoderData: ArrayBuffer,
    vocab: Record<string, number>,
    addedTokens: Array<{ id: number; content: string }>,
    config: TranslatorConfig = {}
  ): Promise<Translator> {
    const tokenizer = new SimpleBPETokenizer(vocab);
    const engine = await TranslationEngine.create(encoderData, decoderData);

    const decoderConfig: Partial<BeamSearchConfig> = {
      numBeams: config.numBeams ?? 5,
      maxLength: config.maxLength ?? 200,
      lengthPenalty: config.lengthPenalty ?? 1.0,
      repetitionPenalty: config.repetitionPenalty ?? 1.2,
      noRepeatNgramSize: config.noRepeatNgramSize ?? 3,
      eosTokenId: tokenizer.eosTokenId,
      padTokenId: tokenizer.padTokenId,
    };

    const decoder = new BeamSearchDecoder(decoderConfig);

    // Build language token map
    const languageTokenMap = new Map<string, number>();
    for (const token of addedTokens) {
      const match = token.content.match(/^__(\w+)__$/);
      if (match) {
        languageTokenMap.set(match[1], token.id);
      }
    }

    console.log(`[Translator] Loaded ${languageTokenMap.size} language tokens`);

    return new Translator(tokenizer, engine, decoder, languageTokenMap, config);
  }

  /**
   * Translate text to target language
   */
  async translate(text: string, targetLanguage: string): Promise<string> {
    const startTime = performance.now();

    // Get target language token
    const langTokenId = this.languageTokenMap.get(targetLanguage);
    if (!langTokenId) {
      throw new Error(`Unknown target language: ${targetLanguage}`);
    }

    if (this.config.logSteps) {
      console.log(`[Translate] Text: "${text}" -> ${targetLanguage}`);
    }

    // Tokenize input
    const inputTokens = this.tokenizer.encode(text);
    const inputIds = [...inputTokens, this.tokenizer.eosTokenId];
    const attentionMask = inputIds.map(() => 1);

    if (this.config.logSteps) {
      console.log(`[Translate] Input tokens: ${inputIds.length}`);
    }

    // Run encoder
    await this.engine.encode(inputIds, attentionMask);

    // Initialize decoder with language token
    const initialIds = [this.tokenizer.eosTokenId, langTokenId];

    // Run beam search
    const outputIds = await this.decoder.decode(
      initialIds,
      (batch) => this.engine.getNextLogits(batch)
    );

    // Decode output
    const result = this.tokenizer.decode(outputIds);

    const elapsed = performance.now() - startTime;
    console.log(`[Translate] Completed in ${elapsed.toFixed(0)}ms: "${result}"`);

    return result;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.languageTokenMap.keys());
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(langCode: string): boolean {
    return this.languageTokenMap.has(langCode);
  }

  /**
   * Get underlying translation engine (for debugging)
   */
  get translationEngine(): TranslationEngine {
    return this.engine;
  }

  /**
   * Close and release resources
   */
  close(): void {
    this.engine.close();
  }
}
