import Foundation

/// Simple BPE Tokenizer for SentencePiece vocab
/// Implements greedy longest-match tokenization
class SimpleBPETokenizer {
    private var vocab: [String: Int] = [:]
    private var reverseVocab: [Int: String] = [:]
    private var specialTokens: Set<String> = []
    
    // Special token IDs for M2M100/SMALL100
    static let BOS_TOKEN_ID = 0
    static let PAD_TOKEN_ID = 1
    static let EOS_TOKEN_ID = 2
    static let UNK_TOKEN_ID = 3
    
    init(vocab: [String: Int]) {
        self.vocab = vocab
        
        // Build reverse vocab for decoding
        for (token, id) in vocab {
            reverseVocab[id] = token
        }
        
        // Mark special tokens
        specialTokens = ["<s>", "</s>", "<pad>", "<unk>"]
    }
    
    /// Encode text to token IDs using greedy longest-match
    func encode(_ text: String) -> [Int] {
        // SentencePiece uses ▁ (U+2581) as word boundary marker
        // Normalize text: add ▁ at start and replace spaces with ▁
        let normalizedText = "▁" + text.replacingOccurrences(of: " ", with: "▁")
        
        var tokens: [Int] = []
        var i = normalizedText.startIndex
        
        while i < normalizedText.endIndex {
            var found = false
            let remaining = normalizedText.distance(from: i, to: normalizedText.endIndex)
            let maxLen = min(20, remaining)
            
            // Try longest match first
            for len in stride(from: maxLen, through: 1, by: -1) {
                let endIndex = normalizedText.index(i, offsetBy: len)
                let substr = String(normalizedText[i..<endIndex])
                
                if let tokenId = vocab[substr] {
                    tokens.append(tokenId)
                    i = endIndex
                    found = true
                    break
                }
            }
            
            if !found {
                // Unknown character - use <unk> token
                if let unkId = vocab["<unk>"] {
                    tokens.append(unkId)
                }
                i = normalizedText.index(after: i)
            }
        }
        
        return tokens
    }
    
    /// Decode token IDs back to text
    func decode(_ ids: [Int], skipSpecialTokens: Bool = true) -> String {
        var result = ""
        
        for id in ids {
            guard let token = reverseVocab[id] else { continue }
            
            if skipSpecialTokens && specialTokens.contains(token) {
                continue
            }
            
            result += token
        }
        
        // Replace ▁ with space and trim
        return result.replacingOccurrences(of: "▁", with: " ").trimmingCharacters(in: .whitespaces)
    }
    
    /// Decode single token ID to string (for debugging)
    func decodeToken(_ id: Int) -> String {
        return reverseVocab[id] ?? "<unknown>"
    }
    
    var vocabSize: Int {
        return vocab.count
    }
    
    var bosTokenId: Int { Self.BOS_TOKEN_ID }
    var eosTokenId: Int { Self.EOS_TOKEN_ID }
    var padTokenId: Int { Self.PAD_TOKEN_ID }
    var unkTokenId: Int { Self.UNK_TOKEN_ID }
}
