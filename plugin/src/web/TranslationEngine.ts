/**
 * Translation Engine for SMALL100 ONNX model
 * Handles ONNX session management and inference
 */

declare const ort: any;

export class TranslationEngine {
  private encoderSession: any = null;
  private decoderSession: any = null;
  private encoderHidden: any = null;
  private encoderMask: any = null;

  // Cached input/output names
  encoderInputNames: string[] = [];
  encoderOutputNames: string[] = [];
  decoderInputNames: string[] = [];
  decoderOutputNames: string[] = [];

  private constructor() {}

  /**
   * Create a new TranslationEngine with loaded ONNX sessions
   */
  static async create(
    encoderData: ArrayBuffer,
    decoderData: ArrayBuffer
  ): Promise<TranslationEngine> {
    const engine = new TranslationEngine();

    const options = {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    };

    // Load encoder
    engine.encoderSession = await ort.InferenceSession.create(encoderData, options);
    engine.encoderInputNames = engine.encoderSession.inputNames;
    engine.encoderOutputNames = engine.encoderSession.outputNames;

    // Load decoder
    engine.decoderSession = await ort.InferenceSession.create(decoderData, options);
    engine.decoderInputNames = engine.decoderSession.inputNames;
    engine.decoderOutputNames = engine.decoderSession.outputNames;

    console.log('[Engine] Encoder inputs:', engine.encoderInputNames);
    console.log('[Engine] Encoder outputs:', engine.encoderOutputNames);
    console.log('[Engine] Decoder inputs:', engine.decoderInputNames);
    console.log('[Engine] Decoder outputs:', engine.decoderOutputNames);

    return engine;
  }

  /**
   * Run encoder on input tokens
   */
  async encode(inputIds: number[], attentionMask: number[]): Promise<void> {
    const seqLen = inputIds.length;

    const inputIdsTensor = new ort.Tensor('int64', BigInt64Array.from(inputIds.map(BigInt)), [1, seqLen]);
    const attentionMaskTensor = new ort.Tensor('int64', BigInt64Array.from(attentionMask.map(BigInt)), [1, seqLen]);

    const inputName = this.encoderInputNames.find((n: string) => /input_ids/i.test(n)) || this.encoderInputNames[0];
    const maskName = this.encoderInputNames.find((n: string) => /attention_mask/i.test(n));

    const feeds: Record<string, any> = { [inputName]: inputIdsTensor };
    if (maskName) {
      feeds[maskName] = attentionMaskTensor;
    }

    const result = await this.encoderSession.run(feeds);

    const hiddenName = this.encoderOutputNames.find((n: string) => /last_hidden_state|encoder_hidden_states/i.test(n))
      || this.encoderOutputNames[0];

    this.encoderHidden = result[hiddenName];
    this.encoderMask = attentionMaskTensor;

    console.log(`[Engine] Encoded: shape [1, ${seqLen}, ${this.encoderHidden.dims[2]}]`);
  }

  /**
   * Get logits for next token prediction
   */
  async getNextLogits(decoderInputIds: number[][]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];

    const inputName = this.decoderInputNames.find((n: string) => /input_ids/i.test(n)) || this.decoderInputNames[0];
    const hiddenName = this.decoderInputNames.find((n: string) => /encoder_hidden_states|encoder_outputs|memory/i.test(n));
    const maskName = this.decoderInputNames.find((n: string) => /encoder_attention_mask|attention_mask/i.test(n));
    const logitsName = this.decoderOutputNames.find((n: string) => /logits|output/i.test(n)) || this.decoderOutputNames[0];

    for (const inputIds of decoderInputIds) {
      const seqLen = inputIds.length;
      const inputTensor = new ort.Tensor('int64', BigInt64Array.from(inputIds.map(BigInt)), [1, seqLen]);

      const feeds: Record<string, any> = { [inputName]: inputTensor };

      if (hiddenName) {
        feeds[hiddenName] = this.encoderHidden;
      }
      if (maskName) {
        feeds[maskName] = this.encoderMask;
      }

      const output = await this.decoderSession.run(feeds);
      const logitsTensor = output[logitsName];

      // Get logits for last position
      const vocabSize = logitsTensor.dims[2];
      const lastPos = seqLen - 1;
      const logits = new Float32Array(vocabSize);

      const data = logitsTensor.data;
      const offset = lastPos * vocabSize;

      for (let i = 0; i < vocabSize; i++) {
        logits[i] = data[offset + i];
      }

      results.push(logits);
    }

    return results;
  }

  /**
   * Close ONNX sessions
   */
  close(): void {
    // Note: ort.InferenceSession may not have explicit close()
    // Set to null to allow GC
    this.encoderSession = null;
    this.decoderSession = null;
    this.encoderHidden = null;
    this.encoderMask = null;
  }
}
