import Foundation

class ModelManager {
    private static let huggingfaceBase = "https://huggingface.co/lyphanthuc/small100-onnx/resolve/main"
    private static let modelDirectory = "Small100Models"
    
    private static let modelFiles = [
        "added_tokens.json",
        "decoder_int8.onnx",
        "encoder_int8.onnx",
        "sentencepiece.bpe.model",
        "special_tokens_map.json",
        "tokenizer_config.json",
        "vocab.json"
    ]
    
    private let fileManager = FileManager.default
    
    func getModelsDirectory() -> URL {
        let cacheDir = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let modelDir = cacheDir.appendingPathComponent(Self.modelDirectory)
        
        if !fileManager.fileExists(atPath: modelDir.path) {
            try? fileManager.createDirectory(at: modelDir, withIntermediateDirectories: true)
        }
        
        return modelDir
    }
    
    func isModelsReady() -> Bool {
        let modelDir = getModelsDirectory()
        for file in Self.modelFiles {
            let filePath = modelDir.appendingPathComponent(file)
            if !fileManager.fileExists(atPath: filePath.path) {
                return false
            }
        }
        return true
    }
    
    func downloadModels(completion: @escaping (String?, Error?) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let version = try self.fetchVersion()
                let versionDir = "\(Self.huggingfaceBase)/\(version)"
                
                let modelDir = self.getModelsDirectory()
                
                for file in Self.modelFiles {
                    let urlString = "\(versionDir)/\(file)"
                    try self.downloadFile(from: urlString, to: modelDir.appendingPathComponent(file))
                }
                
                self.saveModelInfo(version: version)
                completion(version, nil)
            } catch {
                completion(nil, error)
            }
        }
    }
    
    func getModelInfo() -> [String: Any] {
        var info: [String: Any] = [
            "version": UserDefaults.standard.string(forKey: "small100_model_version") ?? "",
            "modelPath": getModelsDirectory().path
        ]
        
        if let downloadTime = UserDefaults.standard.string(forKey: "small100_download_time") {
            info["downloadedAt"] = downloadTime
        }
        
        return info
    }
    
    func clearModels() throws {
        let modelDir = getModelsDirectory()
        try fileManager.removeItem(at: modelDir)
        UserDefaults.standard.removeObject(forKey: "small100_model_version")
        UserDefaults.standard.removeObject(forKey: "small100_download_time")
    }
    
    // MARK: - Private Methods
    
    private func fetchVersion() throws -> String {
        let urlString = "\(Self.huggingfaceBase)/version.txt"
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "InvalidURL", code: -1, userInfo: nil)
        }
        
        let data = try Data(contentsOf: url)
        guard let versionString = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "DecodingError", code: -2, userInfo: nil)
        }
        
        return versionString.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    private func downloadFile(from urlString: String, to destination: URL) throws {
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "InvalidURL", code: -1, userInfo: nil)
        }
        
        let data = try Data(contentsOf: url)
        try data.write(to: destination)
    }
    
    private func saveModelInfo(version: String) {
        let isoFormatter = ISO8601DateFormatter()
        let timestamp = isoFormatter.string(from: Date())
        
        UserDefaults.standard.set(version, forKey: "small100_model_version")
        UserDefaults.standard.set(timestamp, forKey: "small100_download_time")
    }
}
