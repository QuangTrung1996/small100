/**
 * Simple BPE Tokenizer for SentencePiece vocab
 * Implements greedy longest-match tokenization
 */
export class SimpleBPETokenizer {
  private vocab: Record<string, number> = {};
  private reverseVocab: Record<number, string> = {};
  private specialTokens: Set<string> = new Set();

  // Special token IDs for M2M100/SMALL100
  static readonly BOS_TOKEN_ID = 0;
  static readonly PAD_TOKEN_ID = 1;
  static readonly EOS_TOKEN_ID = 2;
  static readonly UNK_TOKEN_ID = 3;

  constructor(vocab: Record<string, number>) {
    this.vocab = vocab;

    // Build reverse vocab for decoding
    for (const [token, id] of Object.entries(vocab)) {
      this.reverseVocab[id] = token;
    }

    // Mark special tokens
    this.specialTokens = new Set(['<s>', '</s>', '<pad>', '<unk>']);
  }

  /**
   * Encode text to token IDs using greedy longest-match
   */
  encode(text: string): number[] {
    // SentencePiece uses ▁ (U+2581) as word boundary marker
    const normalizedText = '▁' + text.replace(/ /g, '▁');

    const tokens: number[] = [];
    let i = 0;

    while (i < normalizedText.length) {
      let found = false;
      const maxLen = Math.min(20, normalizedText.length - i);

      // Try longest match first
      for (let len = maxLen; len > 0; len--) {
        const substr = normalizedText.substring(i, i + len);
        if (this.vocab[substr] !== undefined) {
          tokens.push(this.vocab[substr]);
          i += len;
          found = true;
          break;
        }
      }

      if (!found) {
        // Unknown character - use <unk> token
        const unkId = this.vocab['<unk>'];
        if (unkId !== undefined) {
          tokens.push(unkId);
        }
        i++;
      }
    }

    return tokens;
  }

  /**
   * Decode token IDs back to text
   */
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

    // Replace ▁ with space and trim
    return tokens.join('').replace(/▁/g, ' ').trim();
  }

  /**
   * Decode single token ID (for debugging)
   */
  decodeToken(id: number): string {
    return this.reverseVocab[id] ?? '<unknown>';
  }

  get vocabSize(): number {
    return Object.keys(this.vocab).length;
  }

  get bosTokenId(): number { return SimpleBPETokenizer.BOS_TOKEN_ID; }
  get eosTokenId(): number { return SimpleBPETokenizer.EOS_TOKEN_ID; }
  get padTokenId(): number { return SimpleBPETokenizer.PAD_TOKEN_ID; }
  get unkTokenId(): number { return SimpleBPETokenizer.UNK_TOKEN_ID; }

  /**
   * Get language token ID from added_tokens.json format
   */
  static getLanguageTokenId(
    addedTokens: Array<{ id: number; content: string }>,
    langCode: string
  ): number | null {
    const targetToken = `__${langCode}__`;
    const token = addedTokens.find(t => t.content === targetToken);
    return token?.id ?? null;
  }
}
