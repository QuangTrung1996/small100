import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import Header from '../components/Header';
import Button from '../components/Button';
import Input from '../components/Input';
import LanguageSelector from '../components/LanguageSelector';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { settings, saveSettings } = useAppStore();

  const [userName, setUserName] = useState(settings.userName);
  const [language, setLanguage] = useState(settings.language);
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveSettings({ userName, language, serverUrl });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Settings"
        showBack
        onBack={() => navigate(-1)}
      />

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Profile Section */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Profile</h2>

          <Input
            label="Your Name"
            placeholder="Enter your name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />

          <LanguageSelector
            label="Your Language"
            value={language}
            onChange={setLanguage}
          />
        </section>

        {/* Server Section */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Server</h2>

          <Input
            label="Server URL"
            placeholder="ws://localhost:8000/ws"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            helperText="WebSocket server address"
          />
        </section>

        {/* Translator Section */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Translator</h2>

          <div className="text-sm text-gray-600">
            <p>Small100 ONNX Translator</p>
            <p className="text-xs text-gray-400 mt-1">
              Supports 100+ languages with offline translation
            </p>
          </div>

          <Button variant="outline" size="sm">
            Check Model Status
          </Button>
        </section>

        {/* About Section */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <h2 className="font-semibold text-gray-800">About</h2>
          <p className="text-sm text-gray-600">
            Translation Chat Demo v1.0.0
          </p>
          <p className="text-xs text-gray-400">
            Built with React, Capacitor & Small100-ONNX
          </p>
        </section>
      </div>

      {/* Save Button */}
      <div className="p-4 bg-white border-t">
        <Button fullWidth onClick={handleSave}>
          {saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
