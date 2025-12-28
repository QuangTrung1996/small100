import UIKit

/**
 * Test View Controller for Small100 ONNX Translator (iOS)
 *
 * Usage:
 * 1. Add this view controller to your test app
 * 2. Ensure models are downloaded to Documents directory
 * 3. Run the app and test translations
 */
class TranslatorTestViewController: UIViewController {
    
    // UI Elements
    private let inputTextView = UITextView()
    private let srcLangPicker = UIPickerView()
    private let tgtLangPicker = UIPickerView()
    private let translateButton = UIButton(type: .system)
    private let resultLabel = UILabel()
    private let logTextView = UITextView()
    
    // Data
    private let languages = ["en", "vi", "ja", "ko", "zh", "fr", "de", "es"]
    private let languageNames = [
        "English", "Vietnamese", "Japanese", "Korean",
        "Chinese", "French", "German", "Spanish"
    ]
    
    private var translator: Translator?
    private var selectedSrcIndex = 1  // Vietnamese
    private var selectedTgtIndex = 0  // English
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        initializeTranslator()
    }
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        title = "Small100 Translator Test"
        
        // Container stack
        let stackView = UIStackView()
        stackView.axis = .vertical
        stackView.spacing = 16
        stackView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stackView)
        
        NSLayoutConstraint.activate([
            stackView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            stackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            stackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            stackView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16)
        ])
        
        // Input text view
        inputTextView.text = "Xin chào, tôi là một trợ lý AI."
        inputTextView.font = .systemFont(ofSize: 16)
        inputTextView.layer.borderColor = UIColor.systemGray4.cgColor
        inputTextView.layer.borderWidth = 1
        inputTextView.layer.cornerRadius = 8
        inputTextView.heightAnchor.constraint(equalToConstant: 100).isActive = true
        stackView.addArrangedSubview(inputTextView)
        
        // Language pickers row
        let langRow = UIStackView()
        langRow.axis = .horizontal
        langRow.spacing = 8
        langRow.distribution = .fillEqually
        langRow.heightAnchor.constraint(equalToConstant: 120).isActive = true
        
        srcLangPicker.delegate = self
        srcLangPicker.dataSource = self
        srcLangPicker.tag = 0
        srcLangPicker.selectRow(selectedSrcIndex, inComponent: 0, animated: false)
        
        tgtLangPicker.delegate = self
        tgtLangPicker.dataSource = self
        tgtLangPicker.tag = 1
        tgtLangPicker.selectRow(selectedTgtIndex, inComponent: 0, animated: false)
        
        langRow.addArrangedSubview(srcLangPicker)
        
        let arrowLabel = UILabel()
        arrowLabel.text = "→"
        arrowLabel.textAlignment = .center
        arrowLabel.widthAnchor.constraint(equalToConstant: 30).isActive = true
        langRow.addArrangedSubview(arrowLabel)
        
        langRow.addArrangedSubview(tgtLangPicker)
        stackView.addArrangedSubview(langRow)
        
        // Translate button
        translateButton.setTitle("Translate", for: .normal)
        translateButton.titleLabel?.font = .boldSystemFont(ofSize: 18)
        translateButton.backgroundColor = .systemBlue
        translateButton.setTitleColor(.white, for: .normal)
        translateButton.layer.cornerRadius = 8
        translateButton.heightAnchor.constraint(equalToConstant: 50).isActive = true
        translateButton.isEnabled = false
        translateButton.addTarget(self, action: #selector(translateTapped), for: .touchUpInside)
        stackView.addArrangedSubview(translateButton)
        
        // Result label
        resultLabel.numberOfLines = 0
        resultLabel.font = .systemFont(ofSize: 18)
        resultLabel.textAlignment = .center
        resultLabel.text = "Initializing..."
        stackView.addArrangedSubview(resultLabel)
        
        // Quick test buttons
        let testLabel = UILabel()
        testLabel.text = "Quick Tests:"
        testLabel.font = .boldSystemFont(ofSize: 14)
        stackView.addArrangedSubview(testLabel)
        
        let testRow = UIStackView()
        testRow.axis = .horizontal
        testRow.spacing = 8
        testRow.distribution = .fillEqually
        
        addTestButton(to: testRow, title: "VI→EN", text: "Xin chào", src: 1, tgt: 0)
        addTestButton(to: testRow, title: "EN→VI", text: "Hello", src: 0, tgt: 1)
        addTestButton(to: testRow, title: "JA→EN", text: "こんにちは", src: 2, tgt: 0)
        
        stackView.addArrangedSubview(testRow)
        
        // Log text view
        let logLabel = UILabel()
        logLabel.text = "Log:"
        logLabel.font = .boldSystemFont(ofSize: 14)
        stackView.addArrangedSubview(logLabel)
        
        logTextView.isEditable = false
        logTextView.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        logTextView.backgroundColor = .systemGray6
        logTextView.layer.cornerRadius = 8
        stackView.addArrangedSubview(logTextView)
    }
    
    private func addTestButton(to stack: UIStackView, title: String, text: String, src: Int, tgt: Int) {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.backgroundColor = .systemGray5
        button.layer.cornerRadius = 4
        button.addAction(UIAction { [weak self] _ in
            self?.inputTextView.text = text
            self?.selectedSrcIndex = src
            self?.selectedTgtIndex = tgt
            self?.srcLangPicker.selectRow(src, inComponent: 0, animated: true)
            self?.tgtLangPicker.selectRow(tgt, inComponent: 0, animated: true)
            self?.translateTapped()
        }, for: .touchUpInside)
        stack.addArrangedSubview(button)
    }
    
    private func log(_ message: String) {
        let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
        let logMessage = "[\(timestamp)] \(message)\n"
        print(logMessage)
        DispatchQueue.main.async {
            self.logTextView.text += logMessage
            let bottom = NSRange(location: self.logTextView.text.count - 1, length: 1)
            self.logTextView.scrollRangeToVisible(bottom)
        }
    }
    
    private func initializeTranslator() {
        log("Initializing translator...")
        
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            do {
                guard let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
                    self?.log("ERROR: Cannot get documents directory")
                    return
                }
                
                let modelDir = documentsPath.appendingPathComponent("models")
                let encoderPath = modelDir.appendingPathComponent("encoder_int8.onnx")
                
                guard FileManager.default.fileExists(atPath: encoderPath.path) else {
                    self?.log("ERROR: Models not found at \(modelDir.path)")
                    self?.log("Please download models first using ModelManager")
                    return
                }
                
                self?.translator = try Translator.create(modelPath: modelDir.path)
                
                self?.log("✓ Translator initialized successfully")
                if let langs = self?.translator?.getSupportedLanguages() {
                    self?.log("Supported languages: \(langs.count)")
                }
                
                DispatchQueue.main.async {
                    self?.translateButton.isEnabled = true
                    self?.resultLabel.text = "Ready to translate!"
                }
                
            } catch {
                self?.log("ERROR: \(error.localizedDescription)")
            }
        }
    }
    
    @objc private func translateTapped() {
        guard let translator = translator else {
            log("Translator not initialized")
            return
        }
        
        let text = inputTextView.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            log("Please enter text")
            return
        }
        
        let srcLang = languages[selectedSrcIndex]
        let tgtLang = languages[selectedTgtIndex]
        
        translateButton.isEnabled = false
        resultLabel.text = "Translating..."
        
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            do {
                let start = CFAbsoluteTimeGetCurrent()
                self?.log("Translating: \"\(text)\" (\(srcLang) → \(tgtLang))")
                
                let result = try translator.translate(text: text, targetLanguage: tgtLang)
                
                let elapsed = Int((CFAbsoluteTimeGetCurrent() - start) * 1000)
                self?.log("✓ Result: \"\(result)\" (\(elapsed)ms)")
                
                DispatchQueue.main.async {
                    self?.resultLabel.text = "\(result)\n\n(\(elapsed)ms)"
                    self?.translateButton.isEnabled = true
                }
                
            } catch {
                self?.log("ERROR: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    self?.resultLabel.text = "Error: \(error.localizedDescription)"
                    self?.translateButton.isEnabled = true
                }
            }
        }
    }
    
    deinit {
        translator?.close()
    }
}

// MARK: - UIPickerViewDelegate & DataSource

extension TranslatorTestViewController: UIPickerViewDelegate, UIPickerViewDataSource {
    func numberOfComponents(in pickerView: UIPickerView) -> Int {
        return 1
    }
    
    func pickerView(_ pickerView: UIPickerView, numberOfRowsInComponent component: Int) -> Int {
        return languageNames.count
    }
    
    func pickerView(_ pickerView: UIPickerView, titleForRow row: Int, forComponent component: Int) -> String? {
        return languageNames[row]
    }
    
    func pickerView(_ pickerView: UIPickerView, didSelectRow row: Int, inComponent component: Int) {
        if pickerView.tag == 0 {
            selectedSrcIndex = row
        } else {
            selectedTgtIndex = row
        }
    }
}
