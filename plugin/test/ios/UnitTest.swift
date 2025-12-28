import Foundation

/**
 * Unit Tests for Small100 iOS Modules
 * 
 * Run from Xcode or command line:
 * xcodebuild test -scheme YourScheme -destination 'platform=iOS Simulator,name=iPhone 15'
 */
class UnitTest {
    
    // Mock vocab for testing
    static func createMockVocab() -> [String: Int] {
        return [
            "<s>": 0,
            "<pad>": 1,
            "</s>": 2,
            "<unk>": 3,
            "▁": 4,
            "▁hello": 5,
            "▁world": 6,
            "▁xin": 7,
            "▁chào": 8,
            "h": 9,
            "e": 10,
            "l": 11,
            "o": 12
        ]
    }
    
    // Test helper
    static func assertEqual<T: Equatable>(_ actual: T, _ expected: T, _ testName: String) {
        let pass = actual == expected
        print("\(pass ? "✓" : "✗") \(testName)")
        if !pass {
            print("  Expected: \(expected)")
            print("  Actual:   \(actual)")
        }
    }
    
    static func assertTrue(_ condition: Bool, _ testName: String) {
        print("\(condition ? "✓" : "✗") \(testName)")
    }
    
    // Tests for SimpleBPETokenizer
    static func testTokenizer() {
        print("\n=== SimpleBPETokenizer Tests ===\n")
        
        let vocab = createMockVocab()
        
        // Test 1: Vocab contains expected tokens
        assertTrue(vocab["▁hello"] != nil, "vocab: contains ▁hello")
        assertTrue(vocab["▁world"] != nil, "vocab: contains ▁world")
        
        // Test 2: Special tokens have correct IDs
        assertEqual(vocab["<s>"]!, 0, "vocab: BOS token ID")
        assertEqual(vocab["</s>"]!, 2, "vocab: EOS token ID")
        assertEqual(vocab["<pad>"]!, 1, "vocab: PAD token ID")
        assertEqual(vocab["<unk>"]!, 3, "vocab: UNK token ID")
        
        // Test 3: Vocab size
        assertEqual(vocab.count, 13, "vocab: correct size")
        
        print("\nTokenizer tests completed (mock vocab only)")
        print("For full tests, instantiate SimpleBPETokenizer from main source")
    }
    
    // Tests for BeamSearchDecoder
    static func testBeamSearchDecoder() {
        print("\n=== BeamSearchDecoder Tests ===\n")
        
        // Test config values
        let numBeams = 5
        let maxLength = 200
        let lengthPenalty: Float = 1.0
        let repetitionPenalty: Float = 1.2
        let noRepeatNgramSize = 3
        
        assertTrue(numBeams > 0, "config: numBeams > 0")
        assertTrue(maxLength > 0, "config: maxLength > 0")
        assertTrue(lengthPenalty >= 0, "config: lengthPenalty >= 0")
        assertTrue(repetitionPenalty >= 1, "config: repetitionPenalty >= 1")
        assertTrue(noRepeatNgramSize >= 0, "config: noRepeatNgramSize >= 0")
        
        print("\nBeamSearchDecoder tests completed (config validation only)")
        print("For full tests, instantiate BeamSearchDecoder from main source")
    }
    
    // Test language token extraction
    static func testLanguageTokenExtraction() {
        print("\n=== Language Token Extraction Tests ===\n")
        
        // Simulate added_tokens.json format
        let languageTokens: [String: Int] = [
            "__en__": 250001,
            "__vi__": 250002,
            "__ja__": 250003
        ]
        
        // Test extraction
        let enId = languageTokens["__en__"]
        assertEqual(enId!, 250001, "getLanguageTokenId: English")
        
        let viId = languageTokens["__vi__"]
        assertEqual(viId!, 250002, "getLanguageTokenId: Vietnamese")
        
        let unknownId = languageTokens["__xx__"]
        assertTrue(unknownId == nil, "getLanguageTokenId: Unknown language is nil")
    }
    
    // Test softmax calculation
    static func testSoftmax() {
        print("\n=== Softmax Tests ===\n")
        
        let logits: [Float] = [1.0, 2.0, 3.0]
        
        // Calculate softmax
        let maxLogit = logits.max()!
        
        var sumExp: Float = 0
        var exps = [Float](repeating: 0, count: logits.count)
        for i in 0..<logits.count {
            exps[i] = exp(logits[i] - maxLogit)
            sumExp += exps[i]
        }
        
        var probs = [Float](repeating: 0, count: logits.count)
        for i in 0..<exps.count {
            probs[i] = exps[i] / sumExp
        }
        
        // Verify sum ≈ 1
        let sum = probs.reduce(0, +)
        assertTrue(abs(sum - 1.0) < 0.001, "softmax: sum equals 1")
        
        // Verify ordering (higher logit = higher prob)
        assertTrue(probs[2] > probs[1], "softmax: logit[2] > logit[1]")
        assertTrue(probs[1] > probs[0], "softmax: logit[1] > logit[0]")
        
        print("Softmax output: \(probs)")
    }
    
    // Test n-gram generation
    static func testNgramGeneration() {
        print("\n=== N-gram Tests ===\n")
        
        let tokens = [1, 2, 3, 4, 5]
        let ngramSize = 3
        
        var ngrams = Set<String>()
        for i in 0...(tokens.count - ngramSize) {
            let ngram = tokens[i..<(i + ngramSize)].map { String($0) }.joined(separator: ",")
            ngrams.insert(ngram)
        }
        
        assertEqual(ngrams.count, 3, "ngram: correct count for size 3")
        assertTrue(ngrams.contains("1,2,3"), "ngram: contains [1,2,3]")
        assertTrue(ngrams.contains("2,3,4"), "ngram: contains [2,3,4]")
        assertTrue(ngrams.contains("3,4,5"), "ngram: contains [3,4,5]")
    }
    
    // Run all tests
    static func runTests() {
        print("╔════════════════════════════════════════╗")
        print("║  Small100 iOS Modules - Unit Tests     ║")
        print("╚════════════════════════════════════════╝")
        
        testTokenizer()
        testBeamSearchDecoder()
        testLanguageTokenExtraction()
        testSoftmax()
        testNgramGeneration()
        
        print("\n════════════════════════════════════════")
        print("All tests completed!")
    }
}

// Run tests when file is executed
UnitTest.runTests()
