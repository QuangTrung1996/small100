import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Small100OnnxTranslator } from 'small100-onnx-translator';
import './App.css';
const LANGUAGES = {
    vi: '🇻🇳 Vietnamese',
    en: '🇺🇸 English',
    ja: '🇯🇵 Japanese',
    fr: '🇫🇷 French',
    es: '🇪🇸 Spanish',
    de: '🇩🇪 German',
    zh: '🇨🇳 Chinese',
    ko: '🇰🇷 Korean',
    auto: '🔄 Auto-detect',
};
function App() {
    const [status, setStatus] = useState('idle');
    const [modelInfo, setModelInfo] = useState(null);
    const [sourceText, setSourceText] = useState('Xin chào');
    const [sourceLanguage, setSourceLanguage] = useState('vi');
    const [targetLanguage, setTargetLanguage] = useState('en');
    const [translatedText, setTranslatedText] = useState('');
    const [logs, setLogs] = useState([]);
    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs((prev) => [
            ...prev,
            { timestamp, message, type },
        ].slice(-50)); // Keep last 50 logs
    };
    useEffect(() => {
        // Auto-initialize on component mount
        const checkAndInitialize = async () => {
            try {
                setStatus('initializing');
                addLog('Checking if models are ready...', 'info');
                const { ready } = await Small100OnnxTranslator.isReady();
                if (ready) {
                    const info = await Small100OnnxTranslator.getModelInfo();
                    setModelInfo(info);
                    setStatus('ready');
                    addLog(`✅ Models ready! Version: ${info.version}`, 'success');
                }
                else {
                    addLog('Models not found. Click "Initialize" to download.', 'warning');
                    setStatus('idle');
                }
            }
            catch (error) {
                addLog(`⚠️ Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
                setStatus('idle');
            }
        };
        checkAndInitialize();
    }, []);
    const handleInitialize = async () => {
        try {
            setStatus('initializing');
            addLog('Starting model initialization...', 'info');
            const info = await Small100OnnxTranslator.initialize();
            setModelInfo(info);
            setStatus('ready');
            addLog(`✅ Models initialized! Version: ${info.version}`, 'success');
        }
        catch (error) {
            setStatus('error');
            addLog(`❌ Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    };
    const handleTranslate = async () => {
        if (!sourceText.trim()) {
            addLog('Please enter text to translate', 'warning');
            return;
        }
        try {
            setStatus('translating');
            addLog(`Translating "${sourceText}" from ${sourceLanguage} to ${targetLanguage}...`, 'info');
            const result = await Small100OnnxTranslator.translate({
                text: sourceText,
                sourceLanguage,
                targetLanguage,
            });
            setTranslatedText(result.translatedText);
            setStatus('ready');
            addLog(`✅ Translation complete: "${result.translatedText}"`, 'success');
        }
        catch (error) {
            setStatus('error');
            addLog(`❌ Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    };
    const handleClearModels = async () => {
        try {
            addLog('Clearing downloaded models...', 'info');
            await Small100OnnxTranslator.clearModels();
            setModelInfo(null);
            setStatus('idle');
            addLog('✅ Models cleared', 'success');
        }
        catch (error) {
            addLog(`❌ Clear failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    };
    return (_jsxs("div", { className: "app-container", children: [_jsxs("div", { className: "card main-card", children: [_jsxs("div", { className: "header", children: [_jsx("h1", { children: "\uD83C\uDF10 Small100 ONNX Translator" }), _jsx("p", { children: "Offline translation powered by ONNX Runtime" })] }), _jsxs("div", { className: `status-bar status-${status}`, children: [_jsx("div", { className: "status-indicator" }), _jsxs("span", { children: [status === 'idle' && 'Ready to initialize', status === 'initializing' && 'Initializing models...', status === 'ready' && modelInfo && `Ready • v${modelInfo.version}`, status === 'translating' && 'Translating...', status === 'error' && 'Error occurred'] })] }), status === 'idle' && (_jsxs("div", { className: "init-section", children: [_jsx("button", { className: "btn btn-primary btn-large", onClick: handleInitialize, disabled: status !== 'idle', children: "\uD83D\uDCE5 Initialize & Download Models" }), _jsx("p", { className: "hint", children: "First-time setup: Downloads ~100MB of model files" })] })), status !== 'idle' && (_jsxs("div", { className: "translation-section", children: [_jsxs("div", { className: "input-group", children: [_jsx("label", { children: "Source Text" }), _jsxs("div", { className: "input-with-select", children: [_jsx("input", { type: "text", value: sourceText, onChange: (e) => setSourceText(e.target.value), placeholder: "Enter text to translate...", disabled: status !== 'ready' }), _jsx("select", { value: sourceLanguage, onChange: (e) => setSourceLanguage(e.target.value), disabled: status !== 'ready', className: "language-select", children: Object.entries(LANGUAGES).map(([code, name]) => (_jsx("option", { value: code, children: name }, code))) })] })] }), _jsx("button", { className: "btn btn-swap", onClick: () => {
                                    setSourceLanguage(targetLanguage);
                                    setTargetLanguage(sourceLanguage);
                                    if (translatedText) {
                                        setSourceText(translatedText);
                                        setTranslatedText('');
                                    }
                                }, disabled: status !== 'ready', title: "Swap source and target languages", children: "\u21C5" }), _jsx("button", { className: "btn btn-primary", onClick: handleTranslate, disabled: status !== 'ready' || !sourceText.trim(), children: status === 'translating' ? '⏳ Translating...' : '🔄 Translate' }), _jsxs("div", { className: "input-group", children: [_jsx("label", { children: "Target Language" }), _jsx("select", { value: targetLanguage, onChange: (e) => setTargetLanguage(e.target.value), disabled: status !== 'ready', children: Object.entries(LANGUAGES)
                                            .filter(([code]) => code !== 'auto')
                                            .map(([code, name]) => (_jsx("option", { value: code, children: name }, code))) })] }), translatedText && (_jsxs("div", { className: "result-box", children: [_jsx("label", { children: "Translation" }), _jsx("div", { className: "result-text", children: translatedText }), _jsx("button", { className: "btn btn-secondary btn-small", onClick: () => {
                                            navigator.clipboard.writeText(translatedText);
                                            addLog('✅ Copied to clipboard', 'success');
                                        }, children: "\uD83D\uDCCB Copy" })] }))] })), modelInfo && (_jsxs("div", { className: "footer-actions", children: [_jsx("button", { className: "btn btn-secondary btn-small", onClick: handleClearModels, children: "\uD83D\uDDD1\uFE0F Clear Models" }), _jsxs("span", { className: "model-info", children: ["Downloaded: ", new Date(modelInfo.downloadedAt || '').toLocaleDateString()] })] }))] }), _jsxs("div", { className: "card logs-card", children: [_jsx("h3", { children: "\uD83D\uDCCB Activity Log" }), _jsx("div", { className: "logs-container", children: logs.length === 0 ? (_jsx("p", { className: "empty-logs", children: "Logs will appear here..." })) : (logs.map((log, idx) => (_jsxs("div", { className: `log-entry log-${log.type}`, children: [_jsx("span", { className: "log-time", children: log.timestamp }), _jsx("span", { className: "log-message", children: log.message })] }, idx)))) })] })] }));
}
export default App;
