import Foundation
import Capacitor

/// Capacitor Plugin for SMALL100 ONNX Translation
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
    private var translator: Translator?
    
    override public func load() {
        modelManager = ModelManager()
    }
    
    @objc func initialize(_ call: CAPPluginCall) {
        guard let modelManager = modelManager else {
            call.reject("Model manager not initialized")
            return
        }
        
        if modelManager.isModelsReady() {
            initTranslator(call)
        } else {
            downloadModels(call)
        }
    }
    
    @objc func isReady(_ call: CAPPluginCall) {
        call.resolve([
            "ready": modelManager?.isModelsReady() == true && translator != nil
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
                        call.reject("Download failed: \(error.localizedDescription)")
                    } else if version != nil {
                        self.initTranslator(call)
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
        
        guard let translator = translator, translator.isReady else {
            call.reject("Translator not initialized. Call initialize() first.")
            return
        }
        
        let sourceLanguage = call.getString("sourceLanguage") ?? "auto"
        let targetLanguage = call.getString("targetLanguage") ?? "en"
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let srcLang = sourceLanguage == "auto" ? "en" : sourceLanguage
                let result = try translator.translate(text: text, targetLanguage: targetLanguage)
                
                DispatchQueue.main.async {
                    call.resolve([
                        "translatedText": result,
                        "sourceLanguage": srcLang,
                        "targetLanguage": targetLanguage
                    ])
                }
            } catch {
                print("[Small100Onnx] Translation error: \(error)")
                DispatchQueue.main.async {
                    call.reject("Translation failed: \(error.localizedDescription)")
                }
            }
        }
    }
    
    @objc func getModelInfo(_ call: CAPPluginCall) {
        guard let modelManager = modelManager else {
            call.reject("Model manager not initialized")
            return
        }
        call.resolve(modelManager.getModelInfo())
    }
    
    @objc func clearModels(_ call: CAPPluginCall) {
        guard let modelManager = modelManager else {
            call.reject("Model manager not initialized")
            return
        }
        
        do {
            translator?.close()
            translator = nil
            try modelManager.clearModels()
            call.resolve()
        } catch {
            call.reject("Clear failed: \(error.localizedDescription)")
        }
    }
    
    @objc func debugInfo(_ call: CAPPluginCall) {
        var result: [String: Any] = [:]
        
        if let engine = translator?.translationEngine {
            result["encoderInputs"] = engine.encoderInputNames
            result["encoderOutputs"] = engine.encoderOutputNames
            result["decoderInputs"] = engine.decoderInputNames
            result["decoderOutputs"] = engine.decoderOutputNames
        }
        
        call.resolve(result)
    }
    
    // MARK: - Private
    
    private func initTranslator(_ call: CAPPluginCall) {
        guard let modelManager = modelManager else {
            call.reject("Model manager not initialized")
            return
        }
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                self.translator = try Translator.create(modelsDir: modelManager.getModelsDirectory())
                
                DispatchQueue.main.async {
                    call.resolve(modelManager.getModelInfo())
                }
            } catch {
                print("[Small100Onnx] Init error: \(error)")
                DispatchQueue.main.async {
                    call.reject("Init failed: \(error.localizedDescription)")
                }
            }
        }
    }
}
