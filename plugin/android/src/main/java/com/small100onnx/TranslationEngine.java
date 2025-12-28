package com.small100onnx;

import android.util.Log;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;

import java.io.File;
import java.nio.FloatBuffer;
import java.nio.LongBuffer;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/**
 * Translation Engine - handles ONNX model inference
 * Manages encoder/decoder sessions and translation pipeline
 */
public class TranslationEngine {
    private static final String TAG = "TranslationEngine";
    
    private final OrtEnvironment ortEnv;
    private OrtSession encoderSession;
    private OrtSession decoderSession;
    
    // Cached encoder output for beam search
    private float[][][] cachedEncoderHidden;
    private long[] cachedAttentionMask;
    private int cachedSeqLen;
    private int cachedHiddenSize;
    
    public TranslationEngine() throws OrtException {
        this.ortEnv = OrtEnvironment.getEnvironment();
    }
    
    /**
     * Load encoder and decoder models from directory
     */
    public void loadModels(File modelsDir) throws OrtException {
        File encoder = new File(modelsDir, "encoder_int8.onnx");
        File decoder = new File(modelsDir, "decoder_int8.onnx");
        
        OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
        encoderSession = ortEnv.createSession(encoder.getAbsolutePath(), opts);
        decoderSession = ortEnv.createSession(decoder.getAbsolutePath(), opts);
        
        Log.d(TAG, "Models loaded successfully");
    }
    
    /**
     * Run encoder on input tokens
     * @return Encoder hidden states shape [batch, seq_len, hidden_size]
     */
    public float[][][] runEncoder(long[] inputIds, long[] attentionMask) throws OrtException {
        OnnxTensor inputIdsTensor = OnnxTensor.createTensor(ortEnv,
            LongBuffer.wrap(inputIds), new long[]{1, inputIds.length});
        OnnxTensor attMaskTensor = OnnxTensor.createTensor(ortEnv,
            LongBuffer.wrap(attentionMask), new long[]{1, attentionMask.length});
        
        Map<String, OnnxTensor> inputs = new HashMap<>();
        inputs.put("input_ids", inputIdsTensor);
        inputs.put("attention_mask", attMaskTensor);
        
        try (OrtSession.Result result = encoderSession.run(inputs)) {
            float[][][] hidden = (float[][][]) result.get(0).getValue();
            
            // Cache for decoder use
            this.cachedEncoderHidden = hidden;
            this.cachedAttentionMask = attentionMask;
            this.cachedSeqLen = hidden[0].length;
            this.cachedHiddenSize = hidden[0][0].length;
            
            return hidden;
        } finally {
            inputIdsTensor.close();
            attMaskTensor.close();
        }
    }
    
    /**
     * Run decoder step to get logits for next token
     * Must call runEncoder first to cache encoder output
     */
    public float[] runDecoderStep(int[] decoderInputIds) throws OrtException {
        if (cachedEncoderHidden == null) {
            throw new IllegalStateException("Must call runEncoder first");
        }
        
        // Prepare decoder input
        long[] inputIds = new long[decoderInputIds.length];
        for (int i = 0; i < decoderInputIds.length; i++) {
            inputIds[i] = decoderInputIds[i];
        }
        
        OnnxTensor decoderInputTensor = OnnxTensor.createTensor(ortEnv,
            LongBuffer.wrap(inputIds), new long[]{1, inputIds.length});
        
        // Flatten encoder hidden
        float[] flatHidden = new float[cachedSeqLen * cachedHiddenSize];
        for (int s = 0; s < cachedSeqLen; s++) {
            System.arraycopy(cachedEncoderHidden[0][s], 0, flatHidden, s * cachedHiddenSize, cachedHiddenSize);
        }
        OnnxTensor encoderHiddenTensor = OnnxTensor.createTensor(ortEnv,
            FloatBuffer.wrap(flatHidden), new long[]{1, cachedSeqLen, cachedHiddenSize});
        
        OnnxTensor attMaskTensor = OnnxTensor.createTensor(ortEnv,
            LongBuffer.wrap(cachedAttentionMask), new long[]{1, cachedAttentionMask.length});
        
        Map<String, OnnxTensor> inputs = new HashMap<>();
        inputs.put("input_ids", decoderInputTensor);
        inputs.put("encoder_hidden_states", encoderHiddenTensor);
        inputs.put("encoder_attention_mask", attMaskTensor);
        
        try (OrtSession.Result result = decoderSession.run(inputs)) {
            float[][][] logits = (float[][][]) result.get(0).getValue();
            int lastPos = logits[0].length - 1;
            
            // Return copy of last position logits
            return Arrays.copyOf(logits[0][lastPos], logits[0][lastPos].length);
        } finally {
            decoderInputTensor.close();
            encoderHiddenTensor.close();
            attMaskTensor.close();
        }
    }
    
    /**
     * Clear cached encoder output
     */
    public void clearCache() {
        cachedEncoderHidden = null;
        cachedAttentionMask = null;
    }
    
    /**
     * Check if models are loaded
     */
    public boolean isReady() {
        return encoderSession != null && decoderSession != null;
    }
    
    /**
     * Close and release resources
     */
    public void close() {
        clearCache();
        if (encoderSession != null) {
            try { encoderSession.close(); } catch (Exception ignored) {}
            encoderSession = null;
        }
        if (decoderSession != null) {
            try { decoderSession.close(); } catch (Exception ignored) {}
            decoderSession = null;
        }
    }
    
    // Getters for debug info
    public String[] getEncoderInputNames() throws OrtException {
        return encoderSession != null ? encoderSession.getInputNames().toArray(new String[0]) : new String[0];
    }
    
    public String[] getEncoderOutputNames() throws OrtException {
        return encoderSession != null ? encoderSession.getOutputNames().toArray(new String[0]) : new String[0];
    }
    
    public String[] getDecoderInputNames() throws OrtException {
        return decoderSession != null ? decoderSession.getInputNames().toArray(new String[0]) : new String[0];
    }
    
    public String[] getDecoderOutputNames() throws OrtException {
        return decoderSession != null ? decoderSession.getOutputNames().toArray(new String[0]) : new String[0];
    }
}
