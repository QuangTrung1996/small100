package com.small100onnx;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Simple BPE Tokenizer for SentencePiece vocab
 * Implements greedy longest-match tokenization
 */
public class SimpleBPETokenizer {
    private Map<String, Integer> vocab;
    private Map<Integer, String> reverseVocab;
    private Set<String> specialTokens;
    
    // Special token IDs for M2M100/SMALL100
    private static final int BOS_TOKEN_ID = 0;
    private static final int PAD_TOKEN_ID = 1;
    private static final int EOS_TOKEN_ID = 2;
    private static final int UNK_TOKEN_ID = 3;
    
    public SimpleBPETokenizer(Map<String, Integer> vocab) {
        this.vocab = vocab;
        this.reverseVocab = new HashMap<>();
        this.specialTokens = new HashSet<>();
        
        // Build reverse vocab for decoding
        for (Map.Entry<String, Integer> entry : vocab.entrySet()) {
            reverseVocab.put(entry.getValue(), entry.getKey());
        }
        
        // Mark special tokens
        specialTokens.add("<s>");
        specialTokens.add("</s>");
        specialTokens.add("<pad>");
        specialTokens.add("<unk>");
    }
    
    /**
     * Encode text to token IDs using greedy longest-match
     */
    public int[] encode(String text) {
        // SentencePiece uses ▁ (U+2581) as word boundary marker
        // Normalize text: add ▁ at start and replace spaces with ▁
        String normalizedText = "▁" + text.replace(" ", "▁");
        
        List<Integer> tokens = new ArrayList<>();
        int i = 0;
        
        while (i < normalizedText.length()) {
            boolean found = false;
            // Try longest match first (up to 20 chars)
            int maxLen = Math.min(20, normalizedText.length() - i);
            
            for (int len = maxLen; len > 0; len--) {
                String substr = normalizedText.substring(i, i + len);
                Integer tokenId = vocab.get(substr);
                
                if (tokenId != null) {
                    tokens.add(tokenId);
                    i += len;
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                // Unknown character - use <unk> token
                Integer unkId = vocab.get("<unk>");
                if (unkId != null) {
                    tokens.add(unkId);
                }
                i++;
            }
        }
        
        // Convert to int array
        int[] result = new int[tokens.size()];
        for (int j = 0; j < tokens.size(); j++) {
            result[j] = tokens.get(j);
        }
        return result;
    }
    
    /**
     * Decode token IDs back to text
     */
    public String decode(int[] ids, boolean skipSpecialTokens) {
        StringBuilder sb = new StringBuilder();
        
        for (int id : ids) {
            String token = reverseVocab.get(id);
            if (token == null) continue;
            
            if (skipSpecialTokens && specialTokens.contains(token)) {
                continue;
            }
            
            sb.append(token);
        }
        
        // Replace ▁ with space and trim
        String result = sb.toString().replace("▁", " ").trim();
        return result;
    }
    
    /**
     * Decode single token ID to string (for debugging)
     */
    public String decodeToken(int id) {
        String token = reverseVocab.get(id);
        return token != null ? token : "<unknown>";
    }
    
    public int getVocabSize() {
        return vocab.size();
    }
    
    public int getBosTokenId() {
        return BOS_TOKEN_ID;
    }
    
    public int getEosTokenId() {
        return EOS_TOKEN_ID;
    }
    
    public int getPadTokenId() {
        return PAD_TOKEN_ID;
    }
    
    public int getUnkTokenId() {
        return UNK_TOKEN_ID;
    }
}
