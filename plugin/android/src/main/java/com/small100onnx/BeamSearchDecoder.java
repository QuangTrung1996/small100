package com.small100onnx;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Beam Search Decoder for sequence generation
 * Supports repetition penalty and n-gram blocking
 */
public class BeamSearchDecoder {
    
    public interface DecoderCallback {
        /**
         * Get logits for the next token given current sequence
         * @param ids Current token sequence
         * @return Logits array for vocabulary
         */
        float[] getNextLogits(int[] ids) throws Exception;
    }
    
    private final int eosTokenId;
    private final int numBeams;
    private final float lengthPenalty;
    private final float repetitionPenalty;
    private final int noRepeatNgramSize;
    
    public BeamSearchDecoder(int eosTokenId, int numBeams, float lengthPenalty, 
                             float repetitionPenalty, int noRepeatNgramSize) {
        this.eosTokenId = eosTokenId;
        this.numBeams = numBeams;
        this.lengthPenalty = lengthPenalty;
        this.repetitionPenalty = repetitionPenalty;
        this.noRepeatNgramSize = noRepeatNgramSize;
    }
    
    public BeamSearchDecoder(int eosTokenId) {
        this(eosTokenId, 5, 1.0f, 1.2f, 3);
    }
    
    /**
     * Run beam search decoding
     * @param startTokenIds Initial token sequence
     * @param maxNewTokens Maximum tokens to generate
     * @param callback Callback to get next token logits
     * @return Best token sequence
     */
    public int[] decode(int[] startTokenIds, int maxNewTokens, DecoderCallback callback) throws Exception {
        List<Beam> beams = new ArrayList<>();
        beams.add(new Beam(startTokenIds, 0.0f, false));
        
        List<Beam> finishedBeams = new ArrayList<>();
        
        for (int step = 0; step < maxNewTokens; step++) {
            List<Beam> activeBeams = filterActiveBeams(beams);
            if (activeBeams.isEmpty()) break;
            
            if (shouldEarlyStop(finishedBeams, activeBeams)) break;
            
            List<Beam> allCandidates = new ArrayList<>();
            
            for (Beam beam : activeBeams) {
                float[] logits = callback.getNextLogits(beam.ids);
                List<Beam> candidates = expandBeam(beam, logits);
                allCandidates.addAll(candidates);
            }
            
            sortByNormalizedScore(allCandidates);
            distributeBeams(allCandidates, beams, finishedBeams);
        }
        
        return selectBest(beams, finishedBeams, startTokenIds);
    }
    
    private List<Beam> filterActiveBeams(List<Beam> beams) {
        List<Beam> active = new ArrayList<>();
        for (Beam b : beams) {
            if (!b.finished) active.add(b);
        }
        return active;
    }
    
    private boolean shouldEarlyStop(List<Beam> finishedBeams, List<Beam> activeBeams) {
        if (finishedBeams.size() < numBeams) return false;
        
        float bestFinished = normalizedScore(finishedBeams.get(0));
        float bestActive = normalizedScore(activeBeams.get(0));
        return bestFinished > bestActive;
    }
    
    private List<Beam> expandBeam(Beam beam, float[] logits) {
        int vocabSize = logits.length;
        
        // Apply repetition penalty
        applyRepetitionPenalty(logits, beam.ids);
        
        // Compute log probabilities
        float[] logProbs = logSoftmax(logits);
        
        // Whether to suppress EOS
        boolean suppressEOS = beam.ids.length <= 1;
        
        // Get top-k candidates
        List<TokenScore> topTokens = getTopTokens(logProbs, vocabSize, beam.ids, suppressEOS);
        
        // Create candidate beams
        List<Beam> candidates = new ArrayList<>();
        int topK = numBeams * 2;
        
        for (int k = 0; k < Math.min(topK, topTokens.size()); k++) {
            TokenScore ts = topTokens.get(k);
            int[] newIds = Arrays.copyOf(beam.ids, beam.ids.length + 1);
            newIds[newIds.length - 1] = ts.id;
            
            candidates.add(new Beam(newIds, beam.score + ts.logProb, ts.id == eosTokenId));
        }
        
        return candidates;
    }
    
    private void applyRepetitionPenalty(float[] logits, int[] seenIds) {
        Set<Integer> seen = new HashSet<>();
        for (int id : seenIds) seen.add(id);
        
        for (int i = 0; i < logits.length; i++) {
            if (seen.contains(i)) {
                logits[i] = logits[i] > 0 ? logits[i] / repetitionPenalty : logits[i] * repetitionPenalty;
            }
        }
    }
    
    private float[] logSoftmax(float[] logits) {
        float max = Float.NEGATIVE_INFINITY;
        for (float v : logits) if (v > max) max = v;
        
        float sumExp = 0;
        for (float v : logits) sumExp += (float) Math.exp(v - max);
        float logSumExp = max + (float) Math.log(sumExp);
        
        float[] result = new float[logits.length];
        for (int i = 0; i < logits.length; i++) {
            result[i] = logits[i] - logSumExp;
        }
        return result;
    }
    
    private List<TokenScore> getTopTokens(float[] logProbs, int vocabSize, int[] currentIds, boolean suppressEOS) {
        List<TokenScore> scores = new ArrayList<>();
        
        for (int i = 0; i < vocabSize; i++) {
            if (suppressEOS && i == eosTokenId) continue;
            if (wouldRepeatNgram(currentIds, i)) continue;
            scores.add(new TokenScore(i, logProbs[i]));
        }
        
        Collections.sort(scores, (a, b) -> Float.compare(b.logProb, a.logProb));
        return scores;
    }
    
    private boolean wouldRepeatNgram(int[] tokens, int nextToken) {
        if (noRepeatNgramSize <= 0 || tokens.length < noRepeatNgramSize - 1) return false;
        
        int[] newNgram = new int[noRepeatNgramSize];
        int start = tokens.length - (noRepeatNgramSize - 1);
        for (int i = 0; i < noRepeatNgramSize - 1; i++) {
            newNgram[i] = tokens[start + i];
        }
        newNgram[noRepeatNgramSize - 1] = nextToken;
        
        for (int i = 0; i <= tokens.length - noRepeatNgramSize; i++) {
            boolean match = true;
            for (int j = 0; j < noRepeatNgramSize; j++) {
                if (tokens[i + j] != newNgram[j]) {
                    match = false;
                    break;
                }
            }
            if (match) return true;
        }
        return false;
    }
    
    private void sortByNormalizedScore(List<Beam> beams) {
        Collections.sort(beams, (a, b) -> Float.compare(normalizedScore(b), normalizedScore(a)));
    }
    
    private float normalizedScore(Beam beam) {
        return beam.score / (float) Math.pow(beam.ids.length, lengthPenalty);
    }
    
    private void distributeBeams(List<Beam> candidates, List<Beam> beams, List<Beam> finishedBeams) {
        beams.clear();
        
        for (Beam candidate : candidates) {
            if (candidate.finished) {
                insertSorted(finishedBeams, candidate);
            } else if (beams.size() < numBeams) {
                beams.add(candidate);
            }
            
            if (beams.size() >= numBeams && finishedBeams.size() >= numBeams) break;
        }
    }
    
    private void insertSorted(List<Beam> list, Beam beam) {
        float score = normalizedScore(beam);
        int idx = 0;
        for (int i = 0; i < list.size(); i++) {
            if (normalizedScore(list.get(i)) < score) {
                idx = i;
                break;
            }
            idx = i + 1;
        }
        list.add(idx, beam);
    }
    
    private int[] selectBest(List<Beam> beams, List<Beam> finishedBeams, int[] fallback) {
        List<Beam> all = new ArrayList<>();
        all.addAll(finishedBeams);
        all.addAll(beams);
        
        if (all.isEmpty()) return fallback;
        
        sortByNormalizedScore(all);
        return all.get(0).ids;
    }
    
    // Inner classes
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
