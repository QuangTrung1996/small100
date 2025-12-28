/**
 * High-level Translator API for SMALL100
 * Coordinates tokenizer, engine, and decoder
 */

import { SimpleBPETokenizer } from "./SimpleBPETokenizer";
import { BeamSearchDecoder, BeamSearchConfig } from "./BeamSearchDecoder";
import { TranslationEngine } from "./TranslationEngine";

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
      numBeams: config.numBeams ?? 2, // Reduced for speed
      maxLength: config.maxLength ?? 200,
      lengthPenalty: config.lengthPenalty ?? 1.0,
      repetitionPenalty: config.repetitionPenalty ?? 1.0, // Reduced for accuracy
      noRepeatNgramSize: config.noRepeatNgramSize ?? 0, // Disabled for accuracy
      eosTokenId: tokenizer.eosTokenId,
      padTokenId: tokenizer.padTokenId,
      useGreedyDecode: (config as any).useGreedyDecode ?? false,
    };

    const decoder = new BeamSearchDecoder(decoderConfig);

    // Build language token map
    const languageTokenMap = new Map<string, number>();

    // Handle different formats of addedTokens
    let tokenArray: Array<{ id: number; content: string }> = [];

    if (Array.isArray(addedTokens)) {
      tokenArray = addedTokens;
    } else if (addedTokens && typeof addedTokens === "object") {
      // If it's an object with content/id keys, convert to array
      tokenArray = Object.entries(addedTokens).map(([content, id]) => ({
        content,
        id: typeof id === "number" ? id : parseInt(id as string, 10),
      }));
    }

    console.log(`[Translator] Processing ${tokenArray.length} added tokens`);

    for (const token of tokenArray) {
      const content = token.content || (token as any).key || "";
      const match = content.match(/^__(\w+)__$/);
      if (match) {
        languageTokenMap.set(match[1], token.id);
      }
    }

    console.log(`[Translator] Loaded ${languageTokenMap.size} language tokens`);

    return new Translator(tokenizer, engine, decoder, languageTokenMap, config);
  }

  /**
   * Translate text to target language
   * SMALL100 format: encoder input = [tgt_lang_code] + src_tokens + [EOS]
   *                  decoder input starts with [EOS, tgt_lang_code]
   */
  async translate(text: string, targetLanguage: string): Promise<string> {
    const startTime = performance.now();

    // Get target language token
    const langTokenId = this.languageTokenMap.get(targetLanguage);
    if (!langTokenId) {
      throw new Error(`Unknown target language: ${targetLanguage}`);
    }

    if (this.config.logSteps) {
      console.log(
        `[Translate] Text: "${text}" -> ${targetLanguage} (lang token: ${langTokenId})`
      );
    }

    // Tokenize input
    const inputTokens = this.tokenizer.encode(text);

    // DEBUG: Log tokenization details
    console.log(`[Translate] Input text: "${text}"`);
    console.log(`[Translate] Tokenized: [${inputTokens.join(", ")}]`);
    console.log(
      `[Translate] Token strings: ${inputTokens
        .map((id) => this.tokenizer.decodeToken(id))
        .join(" | ")}`
    );

    // SMALL100 format: [tgt_lang_code] + src_tokens + [EOS]
    const inputIds = [langTokenId, ...inputTokens, this.tokenizer.eosTokenId];
    const attentionMask = inputIds.map(() => 1);

    if (this.config.logSteps) {
      console.log(
        `[Translate] Input tokens: ${inputIds.length} (including lang token)`
      );
    }

    // Run encoder
    await this.engine.encode(inputIds, attentionMask);

    // Initialize decoder with [EOS, tgt_lang_code]
    const initialIds = [this.tokenizer.eosTokenId, langTokenId];

    // Run beam search
    const outputIds = await this.decoder.decode(initialIds, (batch) =>
      this.engine.getNextLogits(batch)
    );

    // DEBUG: Log output tokens
    console.log(`[Translate] Output IDs: [${outputIds.join(", ")}]`);
    console.log(
      `[Translate] Output tokens: ${outputIds
        .map((id) => this.tokenizer.decodeToken(id))
        .join(" | ")}`
    );

    // Decode output
    const result = this.tokenizer.decode(outputIds);

    const elapsed = performance.now() - startTime;
    console.log(
      `[Translate] Completed in ${elapsed.toFixed(0)}ms: "${result}"`
    );

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
