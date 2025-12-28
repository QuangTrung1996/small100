package com.small100onnx;

import android.util.Log;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * Translator - high-level translation API
 * Coordinates tokenizer, engine, and decoder
 */
public class Translator {
    private static final String TAG = "Translator";
    
    private final SimpleBPETokenizer tokenizer;
    private final TranslationEngine engine;
    private final BeamSearchDecoder decoder;
    private final Map<String, Integer> languageTokenMap;
    
    private Translator(SimpleBPETokenizer tokenizer, TranslationEngine engine,
                       BeamSearchDecoder decoder, Map<String, Integer> languageTokenMap) {
        this.tokenizer = tokenizer;
        this.engine = engine;
        this.decoder = decoder;
        this.languageTokenMap = languageTokenMap;
    }
    
    /**
     * Create Translator from model directory
     */
    public static Translator create(File modelsDir) throws Exception {
        // Load tokenizer
        SimpleBPETokenizer tokenizer = loadTokenizer(modelsDir);
        Log.d(TAG, "Tokenizer loaded, vocab size: " + tokenizer.getVocabSize());
        
        // Load language tokens
        Map<String, Integer> langTokens = loadLanguageTokens(modelsDir);
        Log.d(TAG, "Language tokens loaded: " + langTokens.size());
        
        // Create engine and load models
        TranslationEngine engine = new TranslationEngine();
        engine.loadModels(modelsDir);
        
        // Create beam search decoder
        BeamSearchDecoder decoder = new BeamSearchDecoder(tokenizer.getEosTokenId());
        
        return new Translator(tokenizer, engine, decoder, langTokens);
    }
    
    /**
     * Translate text to target language
     */
    public String translate(String text, String targetLanguage) throws Exception {
        Log.d(TAG, "Translating: \"" + text + "\" to " + targetLanguage);
        
        // Get target language token ID
        String tgtToken = "__" + targetLanguage + "__";
        Integer tgtTokenId = languageTokenMap.get(tgtToken);
        if (tgtTokenId == null) {
            throw new IllegalArgumentException("Unknown target language: " + targetLanguage);
        }
        
        // Tokenize input
        int[] textTokens = tokenizer.encode(text);
        
        // Build encoder input: [tgt_lang_token, ...tokens, eos_token]
        long[] inputIds = new long[textTokens.length + 2];
        inputIds[0] = tgtTokenId;
        for (int i = 0; i < textTokens.length; i++) {
            inputIds[i + 1] = textTokens[i];
        }
        inputIds[inputIds.length - 1] = tokenizer.getEosTokenId();
        
        // Attention mask (all 1s)
        long[] attentionMask = new long[inputIds.length];
        Arrays.fill(attentionMask, 1L);
        
        // Run encoder
        long startEncoder = System.currentTimeMillis();
        engine.runEncoder(inputIds, attentionMask);
        Log.d(TAG, "Encoder: " + (System.currentTimeMillis() - startEncoder) + "ms");
        
        // Beam search decode
        long startDecode = System.currentTimeMillis();
        int[] startTokens = {tokenizer.getEosTokenId()};
        
        int[] outputIds = decoder.decode(startTokens, 256, ids -> engine.runDecoderStep(ids));
        Log.d(TAG, "Decoder: " + (System.currentTimeMillis() - startDecode) + "ms");
        
        // Clear engine cache
        engine.clearCache();
        
        // Detokenize result
        String result = detokenize(outputIds);
        Log.d(TAG, "Result: \"" + result + "\"");
        
        return result;
    }
    
    /**
     * Check if translator is ready
     */
    public boolean isReady() {
        return engine.isReady();
    }
    
    /**
     * Release resources
     */
    public void close() {
        engine.close();
    }
    
    /**
     * Get supported language codes
     */
    public String[] getSupportedLanguages() {
        return languageTokenMap.keySet().stream()
            .map(s -> s.replace("__", ""))
            .toArray(String[]::new);
    }
    
    // For debug
    public TranslationEngine getEngine() {
        return engine;
    }
    
    // Private helpers
    
    private String detokenize(int[] ids) {
        // Skip first token (EOS start) and last EOS
        if (ids.length <= 1) return "";
        
        int end = ids.length;
        if (ids[end - 1] == tokenizer.getEosTokenId()) end--;
        
        // Filter special and language tokens
        int[] filtered = Arrays.stream(ids, 1, end)
            .filter(id -> id != tokenizer.getEosTokenId() 
                       && id != tokenizer.getBosTokenId()
                       && id != tokenizer.getPadTokenId()
                       && id < 128000)
            .toArray();
        
        return tokenizer.decode(filtered, true);
    }
    
    private static SimpleBPETokenizer loadTokenizer(File modelsDir) throws Exception {
        File vocabFile = new File(modelsDir, "vocab.json");
        String json = readFile(vocabFile);
        JSONObject vocabObj = new JSONObject(json);
        
        Map<String, Integer> vocab = new HashMap<>();
        Iterator<String> keys = vocabObj.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            vocab.put(key, vocabObj.getInt(key));
        }
        
        return new SimpleBPETokenizer(vocab);
    }
    
    private static Map<String, Integer> loadLanguageTokens(File modelsDir) throws Exception {
        File file = new File(modelsDir, "added_tokens.json");
        String json = readFile(file);
        JSONObject obj = new JSONObject(json);
        
        Map<String, Integer> result = new HashMap<>();
        Iterator<String> keys = obj.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            result.put(key, obj.getInt(key));
        }
        
        return result;
    }
    
    private static String readFile(File file) throws Exception {
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] data = new byte[(int) file.length()];
            fis.read(data);
            return new String(data, StandardCharsets.UTF_8);
        }
    }
}
