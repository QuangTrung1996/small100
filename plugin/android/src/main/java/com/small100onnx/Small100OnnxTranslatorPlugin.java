package com.small100onnx;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.nio.FloatBuffer;
import java.nio.LongBuffer;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(name = "Small100OnnxTranslator")
public class Small100OnnxTranslatorPlugin extends Plugin {
    private static final String TAG = "Small100Onnx";
    private static final String PREFS_NAME = "Small100OnnxPrefs";
    private static final String KEY_VERSION = "model_version";
    private static final String KEY_DOWNLOAD_TIME = "download_time";

    private ModelManager modelManager;
    private OrtEnvironment ortEnv;
    private OrtSession encoderSession;
    private OrtSession decoderSession;
    private SimpleBPETokenizer tokenizer;
    private Map<String, Integer> languageTokenMap;

    @Override
    public void load() {
        modelManager = new ModelManager(getContext());
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        if (modelManager.isModelsReady()) {
            try {
                initOrtSessions();
                loadTokenizer();
            } catch (Exception e) {
                call.reject("Failed to init ONNX runtime: " + e.getMessage());
                return;
            }
            JSObject result = getModelInfo();
            call.resolve(result);
        } else {
            downloadModels(call);
        }
    }

    @PluginMethod
    public void isReady(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ready", modelManager.isModelsReady());
        call.resolve(result);
    }

    @PluginMethod
    public void downloadModels(PluginCall call) {
        modelManager.downloadModels(new ModelManager.DownloadCallback() {
            @Override
            public void onProgress(int downloaded, int total) {
                JSObject data = new JSObject();
                data.put("downloaded", downloaded);
                data.put("total", total);
                notifyListeners("onDownloadProgress", data);
            }

            @Override
            public void onSuccess(String version) {
                saveModelInfo(version);
                try {
                    initOrtSessions();
                    loadTokenizer();
                } catch (Exception e) {
                    call.reject("Failed to init ONNX runtime: " + e.getMessage());
                    return;
                }
                JSObject result = getModelInfo();
                call.resolve(result);
            }

            @Override
            public void onError(Exception error) {
                call.reject("Failed to download models: " + error.getMessage());
            }
        });
    }

    @PluginMethod
    public void translate(PluginCall call) {
        String text = call.getString("text");
        String sourceLanguage = call.getString("sourceLanguage", "auto");
        String targetLanguage = call.getString("targetLanguage", "en");

        if (text == null || text.isEmpty()) {
            call.reject("Text is required");
            return;
        }

        if (!modelManager.isModelsReady()) {
            call.reject("Models not ready. Please download models first.");
            return;
        }

        if (encoderSession == null || decoderSession == null) {
            call.reject("ONNX sessions not initialized");
            return;
        }

        if (tokenizer == null) {
            call.reject("Tokenizer not initialized");
            return;
        }

        // Run translation in background thread
        new Thread(() -> {
            try {
                String srcLang = sourceLanguage.equals("auto") ? "en" : sourceLanguage;
                String translatedText = performTranslation(text, srcLang, targetLanguage);

                JSObject result = new JSObject();
                result.put("translatedText", translatedText);
                result.put("sourceLanguage", srcLang);
                result.put("targetLanguage", targetLanguage);
                
                getActivity().runOnUiThread(() -> call.resolve(result));
            } catch (Exception e) {
                Log.e(TAG, "Translation failed", e);
                getActivity().runOnUiThread(() -> call.reject("Translation failed: " + e.getMessage()));
            }
        }).start();
    }

    private String performTranslation(String text, String srcLang, String tgtLang) throws OrtException {
        Log.d(TAG, "Starting translation: \"" + text + "\" from " + srcLang + " to " + tgtLang);

        // Get target language token
        String tgtToken = "__" + tgtLang + "__";
        Integer tgtTokenId = languageTokenMap.get(tgtToken);
        
        if (tgtTokenId == null) {
            throw new RuntimeException("Unknown target language: " + tgtLang);
        }
        Log.d(TAG, "Target language token: " + tgtToken + " (ID: " + tgtTokenId + ")");

        // Tokenize input
        int[] textTokens = tokenizer.encode(text);
        Log.d(TAG, "Tokenized to " + textTokens.length + " tokens");

        // Build input_ids: [tgt_lang_token, ...tokens, eos_token]
        int[] inputIds = new int[textTokens.length + 2];
        inputIds[0] = tgtTokenId;
        System.arraycopy(textTokens, 0, inputIds, 1, textTokens.length);
        inputIds[inputIds.length - 1] = tokenizer.getEosTokenId();

        // Build attention mask (all 1s)
        long[] attentionMask = new long[inputIds.length];
        Arrays.fill(attentionMask, 1L);

        // Convert to long array for ONNX
        long[] inputIdsLong = new long[inputIds.length];
        for (int i = 0; i < inputIds.length; i++) {
            inputIdsLong[i] = inputIds[i];
        }

        // Run encoder
        Log.d(TAG, "Running encoder...");
        long startEncoder = System.currentTimeMillis();
        
        OnnxTensor inputIdsTensor = OnnxTensor.createTensor(ortEnv, 
            LongBuffer.wrap(inputIdsLong), new long[]{1, inputIdsLong.length});
        OnnxTensor attentionMaskTensor = OnnxTensor.createTensor(ortEnv,
            LongBuffer.wrap(attentionMask), new long[]{1, attentionMask.length});

        Map<String, OnnxTensor> encoderInputs = new HashMap<>();
        encoderInputs.put("input_ids", inputIdsTensor);
        encoderInputs.put("attention_mask", attentionMaskTensor);

        OrtSession.Result encoderResult = encoderSession.run(encoderInputs);
        
        // Get encoder hidden states
        float[][][] encoderHidden = (float[][][]) encoderResult.get(0).getValue();
        long encoderTime = System.currentTimeMillis() - startEncoder;
        Log.d(TAG, "Encoder completed in " + encoderTime + "ms, output shape: [1, " + 
            encoderHidden[0].length + ", " + encoderHidden[0][0].length + "]");

        // Beam search decode
        Log.d(TAG, "Running beam search decode...");
        long startDecode = System.currentTimeMillis();
        int[] decoderStartTokens = {tokenizer.getEosTokenId()};
        int[] translatedIds = beamSearchDecode(encoderHidden, attentionMask, decoderStartTokens, 256, 5, 1.0f);
        long decodeTime = System.currentTimeMillis() - startDecode;
        Log.d(TAG, "Decode completed in " + decodeTime + "ms, generated " + translatedIds.length + " tokens");

        // Detokenize
        String result = detokenize(translatedIds);
        Log.d(TAG, "Translation result: \"" + result + "\"");

        // Clean up
        inputIdsTensor.close();
        attentionMaskTensor.close();
        encoderResult.close();

        return result;
    }

    private int[] beamSearchDecode(float[][][] encoderHidden, long[] attentionMask, 
                                    int[] startTokenIds, int maxNewTokens, int numBeams, float lengthPenalty) throws OrtException {
        
        final float repetitionPenalty = 1.2f;
        final int noRepeatNgramSize = 3;
        
        List<Beam> beams = new ArrayList<>();
        beams.add(new Beam(startTokenIds, 0.0f, false));
        
        List<Beam> finishedBeams = new ArrayList<>();
        
        int seqLen = encoderHidden[0].length;
        int hiddenSize = encoderHidden[0][0].length;
        
        for (int step = 0; step < maxNewTokens; step++) {
            // Filter active beams
            List<Beam> activeBeams = new ArrayList<>();
            for (Beam b : beams) {
                if (!b.finished) activeBeams.add(b);
            }
            if (activeBeams.isEmpty()) break;
            
            // Early stopping
            if (finishedBeams.size() >= numBeams) {
                float bestFinished = finishedBeams.get(0).score / (float) Math.pow(finishedBeams.get(0).ids.length, lengthPenalty);
                float bestActive = activeBeams.get(0).score / (float) Math.pow(activeBeams.get(0).ids.length, lengthPenalty);
                if (bestFinished > bestActive) {
                    Log.d(TAG, "Early stop at step " + step);
                    break;
                }
            }
            
            List<Beam> allCandidates = new ArrayList<>();
            
            // Process each active beam
            for (Beam beam : activeBeams) {
                // Prepare decoder input
                long[] decoderInputIds = new long[beam.ids.length];
                for (int i = 0; i < beam.ids.length; i++) {
                    decoderInputIds[i] = beam.ids[i];
                }
                
                OnnxTensor decoderInputTensor = OnnxTensor.createTensor(ortEnv,
                    LongBuffer.wrap(decoderInputIds), new long[]{1, decoderInputIds.length});
                
                // Flatten encoder hidden for tensor creation
                float[] flatHidden = new float[seqLen * hiddenSize];
                for (int s = 0; s < seqLen; s++) {
                    System.arraycopy(encoderHidden[0][s], 0, flatHidden, s * hiddenSize, hiddenSize);
                }
                OnnxTensor encoderHiddenTensor = OnnxTensor.createTensor(ortEnv,
                    FloatBuffer.wrap(flatHidden), new long[]{1, seqLen, hiddenSize});
                
                OnnxTensor attMaskTensor = OnnxTensor.createTensor(ortEnv,
                    LongBuffer.wrap(attentionMask), new long[]{1, attentionMask.length});
                
                Map<String, OnnxTensor> decoderInputs = new HashMap<>();
                decoderInputs.put("input_ids", decoderInputTensor);
                decoderInputs.put("encoder_hidden_states", encoderHiddenTensor);
                decoderInputs.put("encoder_attention_mask", attMaskTensor);
                
                OrtSession.Result decoderResult = decoderSession.run(decoderInputs);
                
                // Get logits [1, seq_len, vocab_size]
                float[][][] logits = (float[][][]) decoderResult.get(0).getValue();
                int vocabSize = logits[0][0].length;
                int lastPos = logits[0].length - 1;
                
                // Get logits for last position
                float[] lastLogits = logits[0][lastPos];
                
                // Apply repetition penalty
                Set<Integer> seenTokens = new HashSet<>();
                for (int id : beam.ids) seenTokens.add(id);
                
                for (int i = 0; i < vocabSize; i++) {
                    if (seenTokens.contains(i)) {
                        if (lastLogits[i] > 0) {
                            lastLogits[i] /= repetitionPenalty;
                        } else {
                            lastLogits[i] *= repetitionPenalty;
                        }
                    }
                }
                
                // Log-softmax
                float maxLogit = Float.NEGATIVE_INFINITY;
                for (float v : lastLogits) if (v > maxLogit) maxLogit = v;
                
                float sumExp = 0;
                for (float v : lastLogits) sumExp += Math.exp(v - maxLogit);
                float logSumExp = maxLogit + (float) Math.log(sumExp);
                
                // Suppress EOS for first token
                boolean suppressEOS = beam.ids.length <= 1;
                
                // Get top candidates
                int topK = numBeams * 2;
                List<TokenScore> tokenScores = new ArrayList<>();
                
                for (int i = 0; i < vocabSize; i++) {
                    if (suppressEOS && i == tokenizer.getEosTokenId()) continue;
                    if (noRepeatNgramSize > 0 && wouldRepeatNgram(beam.ids, i, noRepeatNgramSize)) continue;
                    tokenScores.add(new TokenScore(i, lastLogits[i] - logSumExp));
                }
                
                Collections.sort(tokenScores, (a, b) -> Float.compare(b.logProb, a.logProb));
                
                for (int k = 0; k < Math.min(topK, tokenScores.size()); k++) {
                    TokenScore ts = tokenScores.get(k);
                    int[] newIds = Arrays.copyOf(beam.ids, beam.ids.length + 1);
                    newIds[newIds.length - 1] = ts.id;
                    
                    allCandidates.add(new Beam(newIds, beam.score + ts.logProb, 
                        ts.id == tokenizer.getEosTokenId()));
                }
                
                decoderInputTensor.close();
                encoderHiddenTensor.close();
                attMaskTensor.close();
                decoderResult.close();
            }
            
            // Sort candidates by normalized score
            Collections.sort(allCandidates, (a, b) -> {
                float scoreA = a.score / (float) Math.pow(a.ids.length, lengthPenalty);
                float scoreB = b.score / (float) Math.pow(b.ids.length, lengthPenalty);
                return Float.compare(scoreB, scoreA);
            });
            
            beams.clear();
            for (Beam candidate : allCandidates) {
                if (candidate.finished) {
                    finishedBeams.add(candidate);
                    // Keep sorted
                    Collections.sort(finishedBeams, (a, b) -> {
                        float scoreA = a.score / (float) Math.pow(a.ids.length, lengthPenalty);
                        float scoreB = b.score / (float) Math.pow(b.ids.length, lengthPenalty);
                        return Float.compare(scoreB, scoreA);
                    });
                } else if (beams.size() < numBeams) {
                    beams.add(candidate);
                }
                if (beams.size() >= numBeams && finishedBeams.size() >= numBeams) break;
            }
            
            // Log progress
            if (step == 0 || step == 5 || step % 20 == 0) {
                Beam best = !beams.isEmpty() ? beams.get(0) : (!finishedBeams.isEmpty() ? finishedBeams.get(0) : null);
                if (best != null) {
                    int[] ids = Arrays.copyOfRange(best.ids, 1, best.ids.length);
                    Log.d(TAG, "Step " + step + ": \"" + tokenizer.decode(ids, true) + "\"");
                }
            }
        }
        
        // Select best result
        List<Beam> allBeams = new ArrayList<>();
        allBeams.addAll(finishedBeams);
        allBeams.addAll(beams);
        
        if (allBeams.isEmpty()) return startTokenIds;
        
        Collections.sort(allBeams, (a, b) -> {
            float scoreA = a.score / (float) Math.pow(a.ids.length, lengthPenalty);
            float scoreB = b.score / (float) Math.pow(b.ids.length, lengthPenalty);
            return Float.compare(scoreB, scoreA);
        });
        
        return allBeams.get(0).ids;
    }
    
    private boolean wouldRepeatNgram(int[] tokens, int nextToken, int n) {
        if (n <= 0 || tokens.length < n - 1) return false;
        
        // Build the new n-gram
        int[] newNgram = new int[n];
        int start = tokens.length - (n - 1);
        for (int i = 0; i < n - 1; i++) {
            newNgram[i] = tokens[start + i];
        }
        newNgram[n - 1] = nextToken;
        
        // Check existing n-grams
        for (int i = 0; i <= tokens.length - n; i++) {
            boolean match = true;
            for (int j = 0; j < n; j++) {
                if (tokens[i + j] != newNgram[j]) {
                    match = false;
                    break;
                }
            }
            if (match) return true;
        }
        return false;
    }

    private String detokenize(int[] ids) {
        // Output format: [EOS, content_tokens..., EOS]
        // Skip the first token (EOS start token)
        if (ids.length <= 1) return "";
        
        int[] outputIds = Arrays.copyOfRange(ids, 1, ids.length);
        
        // Remove EOS at end if present
        if (outputIds.length > 0 && outputIds[outputIds.length - 1] == tokenizer.getEosTokenId()) {
            outputIds = Arrays.copyOf(outputIds, outputIds.length - 1);
        }
        
        // Filter special tokens and language tokens (>= 128000)
        List<Integer> filtered = new ArrayList<>();
        for (int id : outputIds) {
            if (id != tokenizer.getEosTokenId() && 
                id != tokenizer.getBosTokenId() && 
                id != tokenizer.getPadTokenId() &&
                id < 128000) {
                filtered.add(id);
            }
        }
        
        int[] finalIds = new int[filtered.size()];
        for (int i = 0; i < filtered.size(); i++) {
            finalIds[i] = filtered.get(i);
        }
        
        return tokenizer.decode(finalIds, true);
    }

    private void loadTokenizer() throws Exception {
        File modelDir = modelManager.getModelsDirectory();
        
        // Load vocab.json
        File vocabFile = new File(modelDir, "vocab.json");
        String vocabJson = readFileToString(vocabFile);
        JSONObject vocabObj = new JSONObject(vocabJson);
        
        Map<String, Integer> vocab = new HashMap<>();
        Iterator<String> keys = vocabObj.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            vocab.put(key, vocabObj.getInt(key));
        }
        
        tokenizer = new SimpleBPETokenizer(vocab);
        Log.d(TAG, "Tokenizer loaded with vocab size: " + tokenizer.getVocabSize());
        
        // Load added_tokens.json for language tokens
        File addedTokensFile = new File(modelDir, "added_tokens.json");
        String addedTokensJson = readFileToString(addedTokensFile);
        JSONObject addedTokensObj = new JSONObject(addedTokensJson);
        
        languageTokenMap = new HashMap<>();
        keys = addedTokensObj.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            languageTokenMap.put(key, addedTokensObj.getInt(key));
        }
        Log.d(TAG, "Loaded " + languageTokenMap.size() + " language tokens");
    }
    
    private String readFileToString(File file) throws Exception {
        FileInputStream fis = new FileInputStream(file);
        byte[] data = new byte[(int) file.length()];
        fis.read(data);
        fis.close();
        return new String(data, StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void getModelInfo(PluginCall call) {
        JSObject result = getModelInfo();
        call.resolve(result);
    }

    @PluginMethod
    public void clearModels(PluginCall call) {
        try {
            File modelDir = modelManager.getModelsDirectory();
            if (modelDir.exists()) {
                deleteDirectory(modelDir);
            }
            clearModelInfo();
            tokenizer = null;
            languageTokenMap = null;
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to clear models: " + e.getMessage());
        }
    }

    @PluginMethod
    public void debugInfo(PluginCall call) {
        JSObject result = new JSObject();
        try {
            if (encoderSession != null) {
                result.put("encoderInputs", encoderSession.getInputNames().toString());
                result.put("encoderOutputs", encoderSession.getOutputNames().toString());
            }
            if (decoderSession != null) {
                result.put("decoderInputs", decoderSession.getInputNames().toString());
                result.put("decoderOutputs", decoderSession.getOutputNames().toString());
            }
        } catch (OrtException e) {
            call.reject("Failed to get debug info: " + e.getMessage());
            return;
        }
        call.resolve(result);
    }

    // Private helper methods
    private JSObject getModelInfo() {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        JSObject result = new JSObject();

        String version = prefs.getString(KEY_VERSION, "");
        String downloadTime = prefs.getString(KEY_DOWNLOAD_TIME, "");

        result.put("version", version);
        if (!downloadTime.isEmpty()) {
            result.put("downloadedAt", downloadTime);
        }
        result.put("modelPath", modelManager.getModelsDirectory().getAbsolutePath());

        return result;
    }

    private void saveModelInfo(String version) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        String timestamp = sdf.format(new Date());

        prefs.edit()
            .putString(KEY_VERSION, version)
            .putString(KEY_DOWNLOAD_TIME, timestamp)
            .apply();
    }

    private void clearModelInfo() {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .remove(KEY_VERSION)
            .remove(KEY_DOWNLOAD_TIME)
            .apply();
    }

    private boolean deleteDirectory(File dir) {
        if (dir.isDirectory()) {
            File[] children = dir.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteDirectory(child);
                }
            }
        }
        return dir.delete();
    }

    @Override
    protected void handleOnDestroy() {
        if (modelManager != null) {
            modelManager.shutdown();
        }
        if (encoderSession != null) {
            try { encoderSession.close(); } catch (Exception ignored) {}
        }
        if (decoderSession != null) {
            try { decoderSession.close(); } catch (Exception ignored) {}
        }
        super.handleOnDestroy();
    }

    private void initOrtSessions() throws OrtException {
        ortEnv = OrtEnvironment.getEnvironment();
        File modelsDir = modelManager.getModelsDirectory();
        File encoder = new File(modelsDir, "encoder_int8.onnx");
        File decoder = new File(modelsDir, "decoder_int8.onnx");
        OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
        encoderSession = ortEnv.createSession(encoder.getAbsolutePath(), opts);
        decoderSession = ortEnv.createSession(decoder.getAbsolutePath(), opts);
        Log.d(TAG, "ONNX sessions created successfully");
    }
    
    // Helper classes
    private static class Beam {
        int[] ids;
        float score;
        boolean finished;
        
        Beam(int[] ids, float score, boolean finished) {
            this.ids = ids;
            this.score = score;
            this.finished = finished;
        }
    }
    
    private static class TokenScore {
        int id;
        float logProb;
        
        TokenScore(int id, float logProb) {
            this.id = id;
            this.logProb = logProb;
        }
    }
}
