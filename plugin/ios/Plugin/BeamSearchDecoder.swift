import Foundation

/// Beam Search Decoder for sequence generation
/// Supports repetition penalty and n-gram blocking
class BeamSearchDecoder {
    
    typealias LogitsCallback = ([Int]) throws -> [Float]
    
    private let eosTokenId: Int
    private let numBeams: Int
    private let lengthPenalty: Float
    private let repetitionPenalty: Float
    private let noRepeatNgramSize: Int
    
    init(eosTokenId: Int, numBeams: Int = 5, lengthPenalty: Float = 1.0,
         repetitionPenalty: Float = 1.2, noRepeatNgramSize: Int = 3) {
        self.eosTokenId = eosTokenId
        self.numBeams = numBeams
        self.lengthPenalty = lengthPenalty
        self.repetitionPenalty = repetitionPenalty
        self.noRepeatNgramSize = noRepeatNgramSize
    }
    
    /// Run beam search decoding
    func decode(startTokenIds: [Int], maxNewTokens: Int, getLogits: LogitsCallback) throws -> [Int] {
        var beams = [Beam(ids: startTokenIds, score: 0.0, finished: false)]
        var finishedBeams: [Beam] = []
        
        for _ in 0..<maxNewTokens {
            let activeBeams = beams.filter { !$0.finished }
            if activeBeams.isEmpty { break }
            
            if shouldEarlyStop(finishedBeams: finishedBeams, activeBeams: activeBeams) { break }
            
            var allCandidates: [Beam] = []
            
            for beam in activeBeams {
                let logits = try getLogits(beam.ids)
                let candidates = expandBeam(beam: beam, logits: logits)
                allCandidates.append(contentsOf: candidates)
            }
            
            sortByNormalizedScore(&allCandidates)
            distributeBeams(candidates: allCandidates, beams: &beams, finishedBeams: &finishedBeams)
        }
        
        return selectBest(beams: beams, finishedBeams: finishedBeams, fallback: startTokenIds)
    }
    
    // MARK: - Private Methods
    
    private func shouldEarlyStop(finishedBeams: [Beam], activeBeams: [Beam]) -> Bool {
        guard finishedBeams.count >= numBeams else { return false }
        let bestFinished = normalizedScore(finishedBeams[0])
        let bestActive = normalizedScore(activeBeams[0])
        return bestFinished > bestActive
    }
    
    private func expandBeam(beam: Beam, logits: [Float]) -> [Beam] {
        var mutableLogits = logits
        
        // Apply repetition penalty
        applyRepetitionPenalty(&mutableLogits, seenIds: beam.ids)
        
        // Compute log probabilities
        let logProbs = logSoftmax(mutableLogits)
        
        // Whether to suppress EOS
        let suppressEOS = beam.ids.count <= 1
        
        // Get top-k candidates
        let topTokens = getTopTokens(logProbs: logProbs, currentIds: beam.ids, suppressEOS: suppressEOS)
        
        // Create candidate beams
        let topK = numBeams * 2
        return topTokens.prefix(topK).map { ts in
            var newIds = beam.ids
            newIds.append(ts.id)
            return Beam(ids: newIds, score: beam.score + ts.logProb, finished: ts.id == eosTokenId)
        }
    }
    
    private func applyRepetitionPenalty(_ logits: inout [Float], seenIds: [Int]) {
        let seen = Set(seenIds)
        for i in 0..<logits.count {
            if seen.contains(i) {
                logits[i] = logits[i] > 0 ? logits[i] / repetitionPenalty : logits[i] * repetitionPenalty
            }
        }
    }
    
    private func logSoftmax(_ logits: [Float]) -> [Float] {
        let maxVal = logits.max() ?? 0
        let sumExp = logits.reduce(0) { $0 + exp($1 - maxVal) }
        let logSumExp = maxVal + log(sumExp)
        return logits.map { $0 - logSumExp }
    }
    
    private func getTopTokens(logProbs: [Float], currentIds: [Int], suppressEOS: Bool) -> [(id: Int, logProb: Float)] {
        var scores: [(id: Int, logProb: Float)] = []
        
        for i in 0..<logProbs.count {
            if suppressEOS && i == eosTokenId { continue }
            if wouldRepeatNgram(tokens: currentIds, nextToken: i) { continue }
            scores.append((id: i, logProb: logProbs[i]))
        }
        
        return scores.sorted { $0.logProb > $1.logProb }
    }
    
    private func wouldRepeatNgram(tokens: [Int], nextToken: Int) -> Bool {
        guard noRepeatNgramSize > 0, tokens.count >= noRepeatNgramSize - 1 else { return false }
        
        let start = tokens.count - (noRepeatNgramSize - 1)
        var newNgram = Array(tokens[start...])
        newNgram.append(nextToken)
        
        for i in 0...(tokens.count - noRepeatNgramSize) {
            let existing = Array(tokens[i..<(i + noRepeatNgramSize)])
            if existing == newNgram { return true }
        }
        return false
    }
    
    private func normalizedScore(_ beam: Beam) -> Float {
        return beam.score / pow(Float(beam.ids.count), lengthPenalty)
    }
    
    private func sortByNormalizedScore(_ beams: inout [Beam]) {
        beams.sort { normalizedScore($0) > normalizedScore($1) }
    }
    
    private func distributeBeams(candidates: [Beam], beams: inout [Beam], finishedBeams: inout [Beam]) {
        beams.removeAll()
        
        for candidate in candidates {
            if candidate.finished {
                insertSorted(&finishedBeams, beam: candidate)
            } else if beams.count < numBeams {
                beams.append(candidate)
            }
            
            if beams.count >= numBeams && finishedBeams.count >= numBeams { break }
        }
    }
    
    private func insertSorted(_ list: inout [Beam], beam: Beam) {
        let score = normalizedScore(beam)
        let idx = list.firstIndex { normalizedScore($0) < score } ?? list.count
        list.insert(beam, at: idx)
    }
    
    private func selectBest(beams: [Beam], finishedBeams: [Beam], fallback: [Int]) -> [Int] {
        var all = finishedBeams + beams
        guard !all.isEmpty else { return fallback }
        sortByNormalizedScore(&all)
        return all[0].ids
    }
    
    // MARK: - Types
    
    private struct Beam {
        var ids: [Int]
        var score: Float
        var finished: Bool
    }
}
