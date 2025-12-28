import { useState, useEffect } from 'react';
import { Small100OnnxTranslator } from 'small100-onnx-translator';
import type {
  ModelInfo,
} from 'small100-onnx-translator';
import './App.css';

type Status = 'idle' | 'initializing' | 'ready' | 'translating' | 'error';

interface TranslationLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

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
  const [status, setStatus] = useState<Status>('idle');
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [sourceText, setSourceText] = useState('Xin chào');
  const [sourceLanguage, setSourceLanguage] = useState('vi');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [translatedText, setTranslatedText] = useState('');
  const [logs, setLogs] = useState<TranslationLog[]>([]);

  const addLog = (message: string, type: TranslationLog['type'] = 'info') => {
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
        } else {
          addLog('Models not found. Click "Initialize" to download.', 'warning');
          setStatus('idle');
        }
      } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      addLog(`❌ Clear failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  return (
    <div className="app-container">
      <div className="card main-card">
        {/* Header */}
        <div className="header">
          <h1>🌐 Small100 ONNX Translator</h1>
          <p>Offline translation powered by ONNX Runtime</p>
        </div>

        {/* Status Bar */}
        <div className={`status-bar status-${status}`}>
          <div className="status-indicator"></div>
          <span>
            {status === 'idle' && 'Ready to initialize'}
            {status === 'initializing' && 'Initializing models...'}
            {status === 'ready' && modelInfo && `Ready • v${modelInfo.version}`}
            {status === 'translating' && 'Translating...'}
            {status === 'error' && 'Error occurred'}
          </span>
        </div>

        {/* Initialize Button */}
        {status === 'idle' && (
          <div className="init-section">
            <button
              className="btn btn-primary btn-large"
              onClick={handleInitialize}
              disabled={status !== 'idle'}
            >
              📥 Initialize & Download Models
            </button>
            <p className="hint">First-time setup: Downloads ~100MB of model files</p>
          </div>
        )}

        {/* Translation Interface */}
        {status !== 'idle' && (
          <div className="translation-section">
            {/* Source Text */}
            <div className="input-group">
              <label>Source Text</label>
              <div className="input-with-select">
                <input
                  type="text"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Enter text to translate..."
                  disabled={status !== 'ready'}
                />
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  disabled={status !== 'ready'}
                  className="language-select"
                >
                  {Object.entries(LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Swap Button */}
            <button
              className="btn btn-swap"
              onClick={() => {
                setSourceLanguage(targetLanguage);
                setTargetLanguage(sourceLanguage);
                if (translatedText) {
                  setSourceText(translatedText);
                  setTranslatedText('');
                }
              }}
              disabled={status !== 'ready'}
              title="Swap source and target languages"
            >
              ⇅
            </button>

            {/* Translate Button */}
            <button
              className="btn btn-primary"
              onClick={handleTranslate}
              disabled={status !== 'ready' || !sourceText.trim()}
            >
              {status === 'translating' ? '⏳ Translating...' : '🔄 Translate'}
            </button>

            {/* Target Language */}
            <div className="input-group">
              <label>Target Language</label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                disabled={status !== 'ready'}
              >
                {Object.entries(LANGUAGES)
                  .filter(([code]) => code !== 'auto')
                  .map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Translation Result */}
            {translatedText && (
              <div className="result-box">
                <label>Translation</label>
                <div className="result-text">{translatedText}</div>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => {
                    navigator.clipboard.writeText(translatedText);
                    addLog('✅ Copied to clipboard', 'success');
                  }}
                >
                  📋 Copy
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        {modelInfo && (
          <div className="footer-actions">
            <button
              className="btn btn-secondary btn-small"
              onClick={handleClearModels}
            >
              🗑️ Clear Models
            </button>
            <span className="model-info">
              Downloaded: {new Date(modelInfo.downloadedAt || '').toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Logs Panel */}
      <div className="card logs-card">
        <h3>📋 Activity Log</h3>
        <div className="logs-container">
          {logs.length === 0 ? (
            <p className="empty-logs">Logs will appear here...</p>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className={`log-entry log-${log.type}`}>
                <span className="log-time">{log.timestamp}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
