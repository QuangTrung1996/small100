import Foundation
import Capacitor
import onnxruntime_objc

@objc(Small100OnnxTranslatorPlugin)
public class Small100OnnxTranslatorPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "Small100OnnxTranslatorPlugin"
    public let jsName = "Small100OnnxTranslator"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isReady", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadModels", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "translate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getModelInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearModels", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "debugInfo", returnType: CAPPluginReturnPromise),
    ]
    
    private var modelManager: ModelManager?
    private var env: ORTEnv?
    private var encoderSession: ORTSession?
    private var decoderSession: ORTSession?
    private var tokenizer: SimpleBPETokenizer?
    private var languageTokenMap: [String: Int] = [:]
    
    override public func load() {
        modelManager = ModelManager()
        do {
            env = try ORTEnv(loggingLevel: ORTLoggingLevel.warning)
        } catch {
            print("[Small100Onnx] Failed to create ORTEnv: \(error)")
        }
    }
    
    @objc func initialize(_ call: CAPPluginCall) {
        guard let modelManager = modelManager else {
            call.reject("Model manager not initialized")
            return
        }
        
        if modelManager.isModelsReady() {
            do {
                try initOrtSessions()
                try loadTokenizer()
            } catch {
                call.reject("Failed to init: \(error.localizedDescription)")
                return
            }
            let info = modelManager.getModelInfo()
            call.resolve(info)
        } else {
            downloadModels(call)
        }
    }
    
    @objc func isReady(_ call: CAPPluginCall) {
        guard let modelManager = modelManager else {
            call.reject("Model manager not initialized")
            return
        }
        
        call.resolve([
            "ready": modelManager.isModelsReady()
        ])
    }
    
    @objc func downloadModels(_ call: CAPPluginCall) {
        guard let modelManager = modelManager else {
            call.reject("Model manager not initialized")
            return
        }
        
        DispatchQueue.global(qos: .userInitiated).async {
            modelManager.downloadModels { version, error in
                DispatchQueue.main.async {
                    if let error = error {
                        call.reject("Failed to download models: \(error.localizedDescription)")
                    } else if version != nil {
                        do {
                            try self.initOrtSessions()
                            try self.loadTokenizer()
                        } catch {
                            call.reject("Failed to init: \(error.localizedDescription)")
                            return
                        }
                        let info = modelManager.getModelInfo()
                        call.resolve(info)
                    }
                }
            }
        }
    }
    
    @objc func translate(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), !text.isEmpty else {
            call.reject("Text is required")
            return
        }
        
        guard let modelManager = modelManager, modelManager.isModelsReady() else {
            call.reject("Models not ready. Please download models first.")
            return
        }
        
        guard encoderSession != nil && decoderSession != nil else {
            call.reject("ONNX sessions not initialized")
            return
        }
        
        guard tokenizer != nil else {
            call.reject("Tokenizer not initialized")
            return
        }
        
        let sourceLanguage = call.getString("sourceLanguage") ?? "auto"
        let targetLanguage = call.getString("targetLanguage") ?? "en"
        
        // Run translation in background
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let srcLang = sourceLanguage == "auto" ? "en" : sourceLanguage
                let translatedText = try self.performTranslation(text: text, srcLang: srcLang, tgtLang: targetLanguage)
                
                DispatchQueue.main.async {
                    call.resolve([
                        "translatedText": translatedText,
                        "sourceLanguage": srcLang,
                        "targetLanguage": targetLanguage
                    ])
                }
            } catch {
                print("[Small100Onnx] Translation failed: \(error)")
                DispatchQueue.main.async {
                    call.reject("Translation failed: \(error.localizedDescription)")
                }
            }
        }
    }
    
    private func performTranslation(text: String, srcLang: String, tgtLang: String) throws -> String {
        print("[Small100Onnx] Starting translation: \"\(text)\" from \(srcLang) to \(tgtLang)")
        
        guard let tokenizer = tokenizer else {
            throw NSError(domain: "Small100Onnx", code: -1, userInfo: [NSLocalizedDescriptionKey: "Tokenizer not loaded"])
        }
        
        // Get target language token
        let tgtToken = "__\(tgtLang)__"
        guard let tgtTokenId = languageTokenMap[tgtToken] else {
            throw NSError(domain: "Small100Onnx", code: -1, userInfo: [NSLocalizedDescriptionKey: "Unknown target language: \(tgtLang)"])
        }
        print("[Small100Onnx] Target language token: \(tgtToken) (ID: \(tgtTokenId))")
        
        // Tokenize input
        let textTokens = tokenizer.encode(text)
        print("[Small100Onnx] Tokenized to \(textTokens.count) tokens")
        
        // Build input_ids: [tgt_lang_token, ...tokens, eos_token]
        var inputIds = [Int64(tgtTokenId)]
        inputIds.append(contentsOf: textTokens.map { Int64($0) })
        inputIds.append(Int64(tokenizer.eosTokenId))
        
        // Build attention mask (all 1s)
        let attentionMask = [Int64](repeating: 1, count: inputIds.count)
        
        // Run encoder
        print("[Small100Onnx] Running encoder...")
        let startEncoder = Date()
        
        let inputIdsTensor = try ORTValue(tensorData: NSMutableData(bytes: inputIds, length: inputIds.count * MemoryLayout<Int64>.size),
                                           elementType: .int64,
                                           shape: [1, NSNumber(value: inputIds.count)])
        let attMaskTensor = try ORTValue(tensorData: NSMutableData(bytes: attentionMask, length: attentionMask.count * MemoryLayout<Int64>.size),
                                          elementType: .int64,
                                          shape: [1, NSNumber(value: attentionMask.count)])
        
        let encoderOutput = try encoderSession!.run(withInputs: ["input_ids": inputIdsTensor, "attention_mask": attMaskTensor],
                                                     outputNames: ["last_hidden_state"],
                                                     runOptions: nil)
        
        guard let encoderHidden = encoderOutput["last_hidden_state"] else {
            throw NSError(domain: "Small100Onnx", code: -1, userInfo: [NSLocalizedDescriptionKey: "Encoder output not found"])
        }
        
        let encoderTime = Date().timeIntervalSince(startEncoder) * 1000
        let encoderShape = try encoderHidden.tensorTypeAndShapeInfo().shape
        print("[Small100Onnx] Encoder completed in \(String(format: "%.2f", encoderTime))ms, shape: \(encoderShape)")
        
        // Beam search decode
        print("[Small100Onnx] Running beam search decode...")
        let startDecode = Date()
        let decoderStartTokens = [tokenizer.eosTokenId]
        let translatedIds = try beamSearchDecode(encoderHidden: encoderHidden, attentionMask: attentionMask, startTokenIds: decoderStartTokens, maxNewTokens: 256, numBeams: 5, lengthPenalty: 1.0)
        let decodeTime = Date().timeIntervalSince(startDecode) * 1000
        print("[Small100Onnx] Decode completed in \(String(format: "%.2f", decodeTime))ms, generated \(translatedIds.count) tokens")
        
        // Detokenize
        let result = detokenize(translatedIds)
        print("[Small100Onnx] Translation result: \"\(result)\"")
        
        return result
    }
    
    private func beamSearchDecode(encoderHidden: ORTValue, attentionMask: [Int64], startTokenIds: [Int], maxNewTokens: Int, numBeams: Int, lengthPenalty: Float) throws -> [Int] {
        guard let tokenizer = tokenizer else {
            throw NSError(domain: "Small100Onnx", code: -1, userInfo: [NSLocalizedDescriptionKey: "Tokenizer not loaded"])
        }
        
        let repetitionPenalty: Float = 1.2
        let noRepeatNgramSize = 3
        
        struct Beam {
            var ids: [Int]
            var score: Float
            var finished: Bool
        }
        
        var beams = [Beam(ids: startTokenIds, score: 0.0, finished: false)]
        var finishedBeams: [Beam] = []
        
        let encoderShape = try encoderHidden.tensorTypeAndShapeInfo().shape
        let seqLen = encoderShape[1].intValue
        let hiddenSize = encoderShape[2].intValue
        
        // Get encoder hidden data
        let encoderData = try encoderHidden.tensorData() as Data
        
        for step in 0..<maxNewTokens {
            // Filter active beams
            let activeBeams = beams.filter { !$0.finished }
            if activeBeams.isEmpty { break }
            
            // Early stopping
            if finishedBeams.count >= numBeams {
                let bestFinished = finishedBeams[0].score / pow(Float(finishedBeams[0].ids.count), lengthPenalty)
                let bestActive = activeBeams[0].score / pow(Float(activeBeams[0].ids.count), lengthPenalty)
                if bestFinished > bestActive {
                    print("[Small100Onnx] Early stop at step \(step)")
                    break
                }
            }
            
            var allCandidates: [Beam] = []
            
            // Process each active beam
            for beam in activeBeams {
                // Prepare decoder input
                var decoderInputIds = beam.ids.map { Int64($0) }
                
                let decoderInputTensor = try ORTValue(tensorData: NSMutableData(bytes: &decoderInputIds, length: decoderInputIds.count * MemoryLayout<Int64>.size),
                                                       elementType: .int64,
                                                       shape: [1, NSNumber(value: decoderInputIds.count)])
                
                var attMask = attentionMask
                let attMaskTensor = try ORTValue(tensorData: NSMutableData(bytes: &attMask, length: attMask.count * MemoryLayout<Int64>.size),
                                                  elementType: .int64,
                                                  shape: [1, NSNumber(value: attMask.count)])
                
                let decoderOutput = try decoderSession!.run(withInputs: [
                    "input_ids": decoderInputTensor,
                    "encoder_hidden_states": encoderHidden,
                    "encoder_attention_mask": attMaskTensor
                ], outputNames: ["logits"], runOptions: nil)
                
                guard let logitsValue = decoderOutput["logits"] else {
                    throw NSError(domain: "Small100Onnx", code: -1, userInfo: [NSLocalizedDescriptionKey: "Decoder output not found"])
                }
                
                let logitsShape = try logitsValue.tensorTypeAndShapeInfo().shape
                let vocabSize = logitsShape[2].intValue
                let logitsData = try logitsValue.tensorData() as Data
                let lastPos = logitsShape[1].intValue - 1
                
                // Get logits for last position
                var lastLogits = [Float](repeating: 0, count: vocabSize)
                logitsData.withUnsafeBytes { ptr in
                    let floatPtr = ptr.bindMemory(to: Float.self)
                    let offset = lastPos * vocabSize
                    for i in 0..<vocabSize {
                        lastLogits[i] = floatPtr[offset + i]
                    }
                }
                
                // Apply repetition penalty
                let seenTokens = Set(beam.ids)
                for i in 0..<vocabSize {
                    if seenTokens.contains(i) {
                        if lastLogits[i] > 0 {
                            lastLogits[i] /= repetitionPenalty
                        } else {
                            lastLogits[i] *= repetitionPenalty
                        }
                    }
                }
                
                // Log-softmax
                let maxLogit = lastLogits.max() ?? 0
                let sumExp = lastLogits.reduce(0) { $0 + exp($1 - maxLogit) }
                let logSumExp = maxLogit + log(sumExp)
                
                // Suppress EOS for first token
                let suppressEOS = beam.ids.count <= 1
                
                // Get top candidates
                let topK = numBeams * 2
                var tokenScores: [(id: Int, logProb: Float)] = []
                
                for i in 0..<vocabSize {
                    if suppressEOS && i == tokenizer.eosTokenId { continue }
                    if noRepeatNgramSize > 0 && wouldRepeatNgram(tokens: beam.ids, nextToken: i, n: noRepeatNgramSize) { continue }
                    tokenScores.append((id: i, logProb: lastLogits[i] - logSumExp))
                }
                
                tokenScores.sort { $0.logProb > $1.logProb }
                
                for k in 0..<min(topK, tokenScores.count) {
                    let ts = tokenScores[k]
                    var newIds = beam.ids
                    newIds.append(ts.id)
                    allCandidates.append(Beam(ids: newIds, score: beam.score + ts.logProb, finished: ts.id == tokenizer.eosTokenId))
                }
            }
            
            // Sort by normalized score
            allCandidates.sort { a, b in
                let scoreA = a.score / pow(Float(a.ids.count), lengthPenalty)
                let scoreB = b.score / pow(Float(b.ids.count), lengthPenalty)
                return scoreA > scoreB
            }
            
            beams.removeAll()
            for candidate in allCandidates {
                if candidate.finished {
                    finishedBeams.append(candidate)
                    finishedBeams.sort { a, b in
                        let scoreA = a.score / pow(Float(a.ids.count), lengthPenalty)
                        let scoreB = b.score / pow(Float(b.ids.count), lengthPenalty)
                        return scoreA > scoreB
                    }
                } else if beams.count < numBeams {
                    beams.append(candidate)
                }
                if beams.count >= numBeams && finishedBeams.count >= numBeams { break }
            }
            
            // Log progress
            if step == 0 || step == 5 || step % 20 == 0 {
                if let best = beams.first ?? finishedBeams.first {
                    let ids = Array(best.ids.dropFirst())
                    print("[Small100Onnx] Step \(step): \"\(tokenizer.decode(ids, skipSpecialTokens: true))\"")
                }
            }
        }
        
        // Select best result
        var allBeams = finishedBeams + beams
        if allBeams.isEmpty { return startTokenIds }
        
        allBeams.sort { a, b in
            let scoreA = a.score / pow(Float(a.ids.count), lengthPenalty)
            let scoreB = b.score / pow(Float(b.ids.count), lengthPenalty)
            return scoreA > scoreB
        }
        
        return allBeams[0].ids
    }
    
    private func wouldRepeatNgram(tokens: [Int], nextToken: Int, n: Int) -> Bool {
        if n <= 0 || tokens.count < n - 1 { return false }
        
        // Build the new n-gram
        let start = tokens.count - (n - 1)
        var newNgram = Array(tokens[start...])
        newNgram.append(nextToken)
        
        // Check existing n-grams
        for i in 0...(tokens.count - n) {
            let existing = Array(tokens[i..<(i + n)])
            if existing == newNgram { return true }
        }
        return false
    }
    
    private func detokenize(_ ids: [Int]) -> String {
        guard let tokenizer = tokenizer else { return "" }
        
        // Output format: [EOS, content_tokens..., EOS]
        // Skip the first token (EOS start token)
        if ids.count <= 1 { return "" }
        
        var outputIds = Array(ids.dropFirst())
        
        // Remove EOS at end if present
        if let last = outputIds.last, last == tokenizer.eosTokenId {
            outputIds.removeLast()
        }
        
        // Filter special tokens and language tokens (>= 128000)
        outputIds = outputIds.filter { id in
            id != tokenizer.eosTokenId &&
            id != tokenizer.bosTokenId &&
            id != tokenizer.padTokenId &&
            id < 128000
        }
        
        return tokenizer.decode(outputIds, skipSpecialTokens: true)
    }
    
    private func loadTokenizer() throws {
        guard let modelManager = modelManager else {
            throw NSError(domain: "Small100Onnx", code: -1, userInfo: [NSLocalizedDescriptionKey: "Model manager not initialized"])
        }
        
        let modelDir = modelManager.getModelsDirectory()
        
        // Load vocab.json
        let vocabURL = modelDir.appendingPathComponent("vocab.json")
        let vocabData = try Data(contentsOf: vocabURL)
        guard let vocabDict = try JSONSerialization.jsonObject(with: vocabData) as? [String: Int] else {
            throw NSError(domain: "Small100Onnx", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid vocab.json format"])
        }
        
        tokenizer = SimpleBPETokenizer(vocab: vocabDict)
        print("[Small100Onnx] Tokenizer loaded with vocab size: \(tokenizer?.vocabSize ?? 0)")
        
        // Load added_tokens.json for language tokens
        let addedTokensURL = modelDir.appendingPathComponent("added_tokens.json")
        let addedTokensData = try Data(contentsOf: addedTokensURL)
        guard let addedTokensDict = try JSONSerialization.jsonObject(with: addedTokensData) as? [String: Int] else {
            throw NSError(domain: "Small100Onnx", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid added_tokens.json format"])
        }
        
        languageTokenMap = addedTokensDict
        print("[Small100Onnx] Loaded \(languageTokenMap.count) language tokens")
    }
    
    @objc func getModelInfo(_ call: CAPPluginCall) {
        guard let modelManager = modelManager else {
            call.reject("Model manager not initialized")
            return
        }
        
        let info = modelManager.getModelInfo()
        call.resolve(info)
    }
    
    @objc func clearModels(_ call: CAPPluginCall) {
        guard let modelManager = modelManager else {
            call.reject("Model manager not initialized")
            return
        }
        
        do {
            try modelManager.clearModels()
            encoderSession = nil
            decoderSession = nil
            tokenizer = nil
            languageTokenMap = [:]
            call.resolve()
        } catch {
            call.reject("Failed to clear models: \(error.localizedDescription)")
        }
    }
    
    @objc func debugInfo(_ call: CAPPluginCall) {
        var result: [String: Any] = [:]
        
        if let encoder = encoderSession {
            result["encoderInputs"] = (try? encoder.inputNames()) ?? []
            result["encoderOutputs"] = (try? encoder.outputNames()) ?? []
        }
        if let decoder = decoderSession {
            result["decoderInputs"] = (try? decoder.inputNames()) ?? []
            result["decoderOutputs"] = (try? decoder.outputNames()) ?? []
        }
        
        call.resolve(result)
    }

    private func initOrtSessions() throws {
        guard let env = env, let modelManager = modelManager else {
            throw NSError(domain: "Small100Onnx", code: -1, userInfo: [NSLocalizedDescriptionKey: "Environment not initialized"])
        }
        
        let modelsDir = modelManager.getModelsDirectory()
        let encoderPath = modelsDir.appendingPathComponent("encoder_int8.onnx").path
        let decoderPath = modelsDir.appendingPathComponent("decoder_int8.onnx").path
        
        let opts = try ORTSessionOptions()
        encoderSession = try ORTSession(env: env, modelPath: encoderPath, sessionOptions: opts)
        decoderSession = try ORTSession(env: env, modelPath: decoderPath, sessionOptions: opts)
        print("[Small100Onnx] ONNX sessions created successfully")
    }
}
