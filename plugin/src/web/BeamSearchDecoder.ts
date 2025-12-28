/**
 * Beam Search Decoder for autoregressive generation
 * Supports length penalty, repetition penalty, and n-gram blocking
 */

export interface BeamSearchConfig {
  numBeams: number;
  maxLength: number;
  lengthPenalty: number;
  repetitionPenalty: number;
  noRepeatNgramSize: number;
  eosTokenId: number;
  padTokenId: number;
}

export interface Beam {
  tokenIds: number[];
  score: number;
  finished: boolean;
}

export type GetNextLogitsCallback = (inputIds: number[][]) => Promise<Float32Array[]>;

export class BeamSearchDecoder {
  private config: BeamSearchConfig;

  constructor(config: Partial<BeamSearchConfig> = {}) {
    this.config = {
      numBeams: config.numBeams ?? 5,
      maxLength: config.maxLength ?? 200,
      lengthPenalty: config.lengthPenalty ?? 1.0,
      repetitionPenalty: config.repetitionPenalty ?? 1.2,
      noRepeatNgramSize: config.noRepeatNgramSize ?? 3,
      eosTokenId: config.eosTokenId ?? 2,
      padTokenId: config.padTokenId ?? 1,
    };
  }

  /**
   * Run beam search decoding
   */
  async decode(
    initialTokenIds: number[],
    getNextLogits: GetNextLogitsCallback
  ): Promise<number[]> {
    const { numBeams, maxLength, eosTokenId, padTokenId } = this.config;

    // Initialize beams
    let beams: Beam[] = [{
      tokenIds: [...initialTokenIds],
      score: 0.0,
      finished: false,
    }];

    // Expand to numBeams on first step
    for (let step = 0; step < maxLength; step++) {
      const activeBeams = beams.filter(b => !b.finished);
      if (activeBeams.length === 0) break;

      // Get input sequences
      const inputBatch = activeBeams.map(b => b.tokenIds);
      const logitsBatch = await getNextLogits(inputBatch);

      // Collect all candidates
      const candidates: Beam[] = [];

      for (let i = 0; i < activeBeams.length; i++) {
        const beam = activeBeams[i];
        const logits = logitsBatch[i];
        const vocabSize = logits.length;

        // Apply repetition penalty
        this.applyRepetitionPenalty(logits, beam.tokenIds);

        // Apply n-gram blocking
        this.applyNgramBlocking(logits, beam.tokenIds, vocabSize);

        // Convert to probabilities
        const probs = this.softmax(logits);

        // Get top-k candidates
        const topK = this.getTopK(probs, numBeams * 2);

        for (const { index, prob } of topK) {
          const newTokenIds = [...beam.tokenIds, index];
          const logProb = Math.log(Math.max(prob, 1e-10));
          const newScore = beam.score + logProb;
          const isFinished = index === eosTokenId;

          candidates.push({
            tokenIds: newTokenIds,
            score: isFinished ? this.applyLengthPenalty(newScore, newTokenIds.length) : newScore,
            finished: isFinished,
          });
        }
      }

      // Keep finished beams
      const finishedBeams = beams.filter(b => b.finished);

      // Select top beams
      candidates.sort((a, b) => b.score - a.score);
      beams = [...finishedBeams, ...candidates]
        .sort((a, b) => b.score - a.score)
        .slice(0, numBeams);

      // Early stopping if all beams are finished
      if (beams.every(b => b.finished)) break;
    }

    // Return best beam (excluding special tokens at the end)
    beams.sort((a, b) => b.score - a.score);
    const best = beams[0];
    let result = best.tokenIds.slice(initialTokenIds.length);

    // Remove EOS and PAD tokens
    result = result.filter(id => id !== eosTokenId && id !== padTokenId);

    return result;
  }

  private applyRepetitionPenalty(logits: Float32Array, previousTokens: number[]): void {
    const { repetitionPenalty } = this.config;
    const seen = new Set(previousTokens);

    for (const tokenId of seen) {
      if (tokenId < logits.length) {
        if (logits[tokenId] > 0) {
          logits[tokenId] /= repetitionPenalty;
        } else {
          logits[tokenId] *= repetitionPenalty;
        }
      }
    }
  }

  private applyNgramBlocking(logits: Float32Array, previousTokens: number[], vocabSize: number): void {
    const { noRepeatNgramSize } = this.config;
    if (noRepeatNgramSize <= 0 || previousTokens.length < noRepeatNgramSize - 1) return;

    // Build n-gram history
    const ngrams = new Set<string>();
    for (let i = 0; i <= previousTokens.length - noRepeatNgramSize; i++) {
      const ngram = previousTokens.slice(i, i + noRepeatNgramSize).join(',');
      ngrams.add(ngram);
    }

    // Get current prefix
    const prefix = previousTokens.slice(-(noRepeatNgramSize - 1)).join(',') + ',';

    // Block tokens that would complete a repeated n-gram
    for (let token = 0; token < vocabSize; token++) {
      if (ngrams.has(prefix + token)) {
        logits[token] = -Infinity;
      }
    }
  }

  private applyLengthPenalty(score: number, length: number): number {
    const { lengthPenalty } = this.config;
    return score / Math.pow(length, lengthPenalty);
  }

  private softmax(logits: Float32Array): Float32Array {
    const maxLogit = Math.max(...logits);
    const exps = new Float32Array(logits.length);
    let sumExp = 0;

    for (let i = 0; i < logits.length; i++) {
      exps[i] = Math.exp(logits[i] - maxLogit);
      sumExp += exps[i];
    }

    for (let i = 0; i < exps.length; i++) {
      exps[i] /= sumExp;
    }

    return exps;
  }

  private getTopK(probs: Float32Array, k: number): Array<{ index: number; prob: number }> {
    const indexed = Array.from(probs)
      .map((prob, index) => ({ index, prob }))
      .filter(({ prob }) => isFinite(prob) && prob > 0);

    indexed.sort((a, b) => b.prob - a.prob);
    return indexed.slice(0, k);
  }
}
