import Foundation
import onnxruntime_objc

/// Translation Engine - handles ONNX model inference
class TranslationEngine {
    
    private let env: ORTEnv
    private var encoderSession: ORTSession?
    private var decoderSession: ORTSession?
    
    // Cached encoder output for beam search
    private var cachedEncoderHidden: ORTValue?
    private var cachedAttentionMask: [Int64] = []
    
    init() throws {
        self.env = try ORTEnv(loggingLevel: .warning)
    }
    
    /// Load encoder and decoder models from directory
    func loadModels(from modelsDir: URL) throws {
        let encoderPath = modelsDir.appendingPathComponent("encoder_int8.onnx").path
        let decoderPath = modelsDir.appendingPathComponent("decoder_int8.onnx").path
        
        let opts = try ORTSessionOptions()
        encoderSession = try ORTSession(env: env, modelPath: encoderPath, sessionOptions: opts)
        decoderSession = try ORTSession(env: env, modelPath: decoderPath, sessionOptions: opts)
        
        print("[TranslationEngine] Models loaded successfully")
    }
    
    /// Run encoder on input tokens
    func runEncoder(inputIds: [Int64], attentionMask: [Int64]) throws {
        guard let encoder = encoderSession else {
            throw TranslationError.notInitialized
        }
        
        let inputIdsTensor = try createInt64Tensor(inputIds, shape: [1, inputIds.count])
        let attMaskTensor = try createInt64Tensor(attentionMask, shape: [1, attentionMask.count])
        
        let output = try encoder.run(
            withInputs: ["input_ids": inputIdsTensor, "attention_mask": attMaskTensor],
            outputNames: ["last_hidden_state"],
            runOptions: nil
        )
        
        guard let hidden = output["last_hidden_state"] else {
            throw TranslationError.encoderFailed
        }
        
        // Cache for decoder
        cachedEncoderHidden = hidden
        cachedAttentionMask = attentionMask
    }
    
    /// Run decoder step to get logits for next token
    func runDecoderStep(decoderInputIds: [Int]) throws -> [Float] {
        guard let decoder = decoderSession, let encoderHidden = cachedEncoderHidden else {
            throw TranslationError.notInitialized
        }
        
        let inputIds = decoderInputIds.map { Int64($0) }
        let inputTensor = try createInt64Tensor(inputIds, shape: [1, inputIds.count])
        let attMaskTensor = try createInt64Tensor(cachedAttentionMask, shape: [1, cachedAttentionMask.count])
        
        let output = try decoder.run(
            withInputs: [
                "input_ids": inputTensor,
                "encoder_hidden_states": encoderHidden,
                "encoder_attention_mask": attMaskTensor
            ],
            outputNames: ["logits"],
            runOptions: nil
        )
        
        guard let logitsValue = output["logits"] else {
            throw TranslationError.decoderFailed
        }
        
        // Extract last position logits
        let shape = try logitsValue.tensorTypeAndShapeInfo().shape
        let vocabSize = shape[2].intValue
        let seqLen = shape[1].intValue
        let lastPos = seqLen - 1
        
        let data = try logitsValue.tensorData() as Data
        var logits = [Float](repeating: 0, count: vocabSize)
        
        data.withUnsafeBytes { ptr in
            let floatPtr = ptr.bindMemory(to: Float.self)
            let offset = lastPos * vocabSize
            for i in 0..<vocabSize {
                logits[i] = floatPtr[offset + i]
            }
        }
        
        return logits
    }
    
    /// Clear cached encoder output
    func clearCache() {
        cachedEncoderHidden = nil
        cachedAttentionMask = []
    }
    
    /// Check if models are loaded
    var isReady: Bool {
        return encoderSession != nil && decoderSession != nil
    }
    
    /// Close and release resources
    func close() {
        clearCache()
        encoderSession = nil
        decoderSession = nil
    }
    
    // Debug info
    var encoderInputNames: [String] { (try? encoderSession?.inputNames()) ?? [] }
    var encoderOutputNames: [String] { (try? encoderSession?.outputNames()) ?? [] }
    var decoderInputNames: [String] { (try? decoderSession?.inputNames()) ?? [] }
    var decoderOutputNames: [String] { (try? decoderSession?.outputNames()) ?? [] }
    
    // MARK: - Private
    
    private func createInt64Tensor(_ data: [Int64], shape: [Int]) throws -> ORTValue {
        var mutableData = data
        let nsShape = shape.map { NSNumber(value: $0) }
        return try ORTValue(
            tensorData: NSMutableData(bytes: &mutableData, length: data.count * MemoryLayout<Int64>.size),
            elementType: .int64,
            shape: nsShape
        )
    }
}

// MARK: - Errors

enum TranslationError: LocalizedError {
    case notInitialized
    case encoderFailed
    case decoderFailed
    case unknownLanguage(String)
    
    var errorDescription: String? {
        switch self {
        case .notInitialized: return "Translation engine not initialized"
        case .encoderFailed: return "Encoder inference failed"
        case .decoderFailed: return "Decoder inference failed"
        case .unknownLanguage(let lang): return "Unknown language: \(lang)"
        }
    }
}
