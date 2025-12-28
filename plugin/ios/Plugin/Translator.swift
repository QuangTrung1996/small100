import Foundation

/// High-level translation API
/// Coordinates tokenizer, engine, and decoder
class Translator {
    
    private let tokenizer: SimpleBPETokenizer
    private let engine: TranslationEngine
    private let decoder: BeamSearchDecoder
    private let languageTokenMap: [String: Int]
    
    private init(tokenizer: SimpleBPETokenizer, engine: TranslationEngine,
                 decoder: BeamSearchDecoder, languageTokenMap: [String: Int]) {
        self.tokenizer = tokenizer
        self.engine = engine
        self.decoder = decoder
        self.languageTokenMap = languageTokenMap
    }
    
    /// Create Translator from model directory
    static func create(modelsDir: URL) throws -> Translator {
        // Load tokenizer
        let tokenizer = try loadTokenizer(from: modelsDir)
        print("[Translator] Tokenizer loaded, vocab size: \(tokenizer.vocabSize)")
        
        // Load language tokens
        let langTokens = try loadLanguageTokens(from: modelsDir)
        print("[Translator] Language tokens loaded: \(langTokens.count)")
        
        // Create engine and load models
        let engine = try TranslationEngine()
        try engine.loadModels(from: modelsDir)
        
        // Create beam search decoder
        let decoder = BeamSearchDecoder(eosTokenId: tokenizer.eosTokenId)
        
        return Translator(tokenizer: tokenizer, engine: engine, decoder: decoder, languageTokenMap: langTokens)
    }
    
    /// Translate text to target language
    func translate(text: String, targetLanguage: String) throws -> String {
        print("[Translator] Translating: \"\(text)\" to \(targetLanguage)")
        
        // Get target language token ID
        let tgtToken = "__\(targetLanguage)__"
        guard let tgtTokenId = languageTokenMap[tgtToken] else {
            throw TranslationError.unknownLanguage(targetLanguage)
        }
        
        // Tokenize input
        let textTokens = tokenizer.encode(text)
        
        // Build encoder input: [tgt_lang_token, ...tokens, eos_token]
        var inputIds: [Int64] = [Int64(tgtTokenId)]
        inputIds.append(contentsOf: textTokens.map { Int64($0) })
        inputIds.append(Int64(tokenizer.eosTokenId))
        
        // Attention mask (all 1s)
        let attentionMask = [Int64](repeating: 1, count: inputIds.count)
        
        // Run encoder
        let startEncoder = Date()
        try engine.runEncoder(inputIds: inputIds, attentionMask: attentionMask)
        print("[Translator] Encoder: \(Int(Date().timeIntervalSince(startEncoder) * 1000))ms")
        
        // Beam search decode
        let startDecode = Date()
        let startTokens = [tokenizer.eosTokenId]
        
        let outputIds = try decoder.decode(startTokenIds: startTokens, maxNewTokens: 256) { ids in
            try self.engine.runDecoderStep(decoderInputIds: ids)
        }
        print("[Translator] Decoder: \(Int(Date().timeIntervalSince(startDecode) * 1000))ms")
        
        // Clear engine cache
        engine.clearCache()
        
        // Detokenize result
        let result = detokenize(outputIds)
        print("[Translator] Result: \"\(result)\"")
        
        return result
    }
    
    /// Check if translator is ready
    var isReady: Bool {
        return engine.isReady
    }
    
    /// Release resources
    func close() {
        engine.close()
    }
    
    /// Get supported language codes
    var supportedLanguages: [String] {
        languageTokenMap.keys.map { $0.replacingOccurrences(of: "__", with: "") }
    }
    
    // For debug
    var translationEngine: TranslationEngine { engine }
    
    // MARK: - Private
    
    private func detokenize(_ ids: [Int]) -> String {
        guard ids.count > 1 else { return "" }
        
        var outputIds = Array(ids.dropFirst())
        
        // Remove EOS at end if present
        if let last = outputIds.last, last == tokenizer.eosTokenId {
            outputIds.removeLast()
        }
        
        // Filter special and language tokens
        outputIds = outputIds.filter { id in
            id != tokenizer.eosTokenId &&
            id != tokenizer.bosTokenId &&
            id != tokenizer.padTokenId &&
            id < 128000
        }
        
        return tokenizer.decode(outputIds, skipSpecialTokens: true)
    }
    
    private static func loadTokenizer(from modelsDir: URL) throws -> SimpleBPETokenizer {
        let vocabURL = modelsDir.appendingPathComponent("vocab.json")
        let data = try Data(contentsOf: vocabURL)
        guard let vocab = try JSONSerialization.jsonObject(with: data) as? [String: Int] else {
            throw NSError(domain: "Translator", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid vocab.json"])
        }
        return SimpleBPETokenizer(vocab: vocab)
    }
    
    private static func loadLanguageTokens(from modelsDir: URL) throws -> [String: Int] {
        let url = modelsDir.appendingPathComponent("added_tokens.json")
        let data = try Data(contentsOf: url)
        guard let tokens = try JSONSerialization.jsonObject(with: data) as? [String: Int] else {
            throw NSError(domain: "Translator", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid added_tokens.json"])
        }
        return tokens
    }
}
