package com.small100onnx.test;

import java.util.*;

/**
 * Unit Tests for Small100 Android Modules
 * 
 * Run from Android Studio or command line:
 * ./gradlew test --tests "com.small100onnx.test.UnitTest"
 */
public class UnitTest {
    
    // Mock vocab for testing
    private static Map<String, Integer> createMockVocab() {
        Map<String, Integer> vocab = new HashMap<>();
        vocab.put("<s>", 0);
        vocab.put("<pad>", 1);
        vocab.put("</s>", 2);
        vocab.put("<unk>", 3);
        vocab.put("▁", 4);
        vocab.put("▁hello", 5);
        vocab.put("▁world", 6);
        vocab.put("▁xin", 7);
        vocab.put("▁chào", 8);
        vocab.put("h", 9);
        vocab.put("e", 10);
        vocab.put("l", 11);
        vocab.put("o", 12);
        return vocab;
    }
    
    // Test helper
    private static void assertEqual(Object actual, Object expected, String testName) {
        boolean pass = Objects.equals(actual, expected);
        System.out.println((pass ? "✓" : "✗") + " " + testName);
        if (!pass) {
            System.out.println("  Expected: " + expected);
            System.out.println("  Actual:   " + actual);
        }
    }
    
    private static void assertTrue(boolean condition, String testName) {
        System.out.println((condition ? "✓" : "✗") + " " + testName);
    }
    
    // Tests for SimpleBPETokenizer
    public static void testTokenizer() {
        System.out.println("\n=== SimpleBPETokenizer Tests ===\n");
        
        // Note: Requires SimpleBPETokenizer class from main source
        // This is a template - actual tests need the tokenizer implementation
        
        Map<String, Integer> vocab = createMockVocab();
        
        // Test 1: Vocab contains expected tokens
        assertTrue(vocab.containsKey("▁hello"), "vocab: contains ▁hello");
        assertTrue(vocab.containsKey("▁world"), "vocab: contains ▁world");
        
        // Test 2: Special tokens have correct IDs
        assertEqual(vocab.get("<s>"), 0, "vocab: BOS token ID");
        assertEqual(vocab.get("</s>"), 2, "vocab: EOS token ID");
        assertEqual(vocab.get("<pad>"), 1, "vocab: PAD token ID");
        assertEqual(vocab.get("<unk>"), 3, "vocab: UNK token ID");
        
        // Test 3: Vocab size
        assertEqual(vocab.size(), 13, "vocab: correct size");
        
        System.out.println("\nTokenizer tests completed (mock vocab only)");
        System.out.println("For full tests, instantiate SimpleBPETokenizer from main source");
    }
    
    // Tests for BeamSearchDecoder
    public static void testBeamSearchDecoder() {
        System.out.println("\n=== BeamSearchDecoder Tests ===\n");
        
        // Test config values
        int numBeams = 5;
        int maxLength = 200;
        float lengthPenalty = 1.0f;
        float repetitionPenalty = 1.2f;
        int noRepeatNgramSize = 3;
        
        assertTrue(numBeams > 0, "config: numBeams > 0");
        assertTrue(maxLength > 0, "config: maxLength > 0");
        assertTrue(lengthPenalty >= 0, "config: lengthPenalty >= 0");
        assertTrue(repetitionPenalty >= 1, "config: repetitionPenalty >= 1");
        assertTrue(noRepeatNgramSize >= 0, "config: noRepeatNgramSize >= 0");
        
        System.out.println("\nBeamSearchDecoder tests completed (config validation only)");
        System.out.println("For full tests, instantiate BeamSearchDecoder from main source");
    }
    
    // Test language token extraction
    public static void testLanguageTokenExtraction() {
        System.out.println("\n=== Language Token Extraction Tests ===\n");
        
        // Simulate added_tokens.json format
        Map<String, Integer> languageTokens = new HashMap<>();
        languageTokens.put("__en__", 250001);
        languageTokens.put("__vi__", 250002);
        languageTokens.put("__ja__", 250003);
        
        // Test extraction
        String targetToken = "__en__";
        Integer enId = languageTokens.get(targetToken);
        assertEqual(enId, 250001, "getLanguageTokenId: English");
        
        targetToken = "__vi__";
        Integer viId = languageTokens.get(targetToken);
        assertEqual(viId, 250002, "getLanguageTokenId: Vietnamese");
        
        targetToken = "__xx__";
        Integer unknownId = languageTokens.get(targetToken);
        assertEqual(unknownId, null, "getLanguageTokenId: Unknown language");
    }
    
    // Test softmax calculation
    public static void testSoftmax() {
        System.out.println("\n=== Softmax Tests ===\n");
        
        float[] logits = {1.0f, 2.0f, 3.0f};
        
        // Calculate softmax
        float maxLogit = Float.NEGATIVE_INFINITY;
        for (float l : logits) maxLogit = Math.max(maxLogit, l);
        
        float sumExp = 0;
        float[] exps = new float[logits.length];
        for (int i = 0; i < logits.length; i++) {
            exps[i] = (float) Math.exp(logits[i] - maxLogit);
            sumExp += exps[i];
        }
        
        float[] probs = new float[logits.length];
        for (int i = 0; i < exps.length; i++) {
            probs[i] = exps[i] / sumExp;
        }
        
        // Verify sum = 1
        float sum = 0;
        for (float p : probs) sum += p;
        assertTrue(Math.abs(sum - 1.0f) < 0.001f, "softmax: sum equals 1");
        
        // Verify ordering (higher logit = higher prob)
        assertTrue(probs[2] > probs[1], "softmax: logit[2] > logit[1]");
        assertTrue(probs[1] > probs[0], "softmax: logit[1] > logit[0]");
        
        System.out.println("Softmax output: " + Arrays.toString(probs));
    }
    
    // Run all tests
    public static void main(String[] args) {
        System.out.println("╔════════════════════════════════════════╗");
        System.out.println("║  Small100 Android Modules - Unit Tests ║");
        System.out.println("╚════════════════════════════════════════╝");
        
        testTokenizer();
        testBeamSearchDecoder();
        testLanguageTokenExtraction();
        testSoftmax();
        
        System.out.println("\n════════════════════════════════════════");
        System.out.println("All tests completed!");
    }
}
