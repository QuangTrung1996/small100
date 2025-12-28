import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import Header from '../components/Header';
import Button from '../components/Button';
import { PlusIcon, UsersIcon, CogIcon, ChatBubbleIcon, GlobeIcon } from '../components/icons';

export default function HomePage() {
  const navigate = useNavigate();
  const { settings, isTranslatorReady, isTranslatorLoading, translatorProgress } = useAppStore();

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Translation Chat"
        rightContent={
          <Link
            to="/settings"
            className="p-2 rounded-full hover:bg-primary-700 transition-colors"
          >
            <CogIcon className="w-5 h-5" />
          </Link>
        }
      />

      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="w-20 h-20 mx-auto bg-primary-100 rounded-full flex items-center justify-center">
            <ChatBubbleIcon className="w-10 h-10 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Translation Chat</h2>
          <p className="text-gray-500">
            Chat with people worldwide in your own language
          </p>
        </div>

        {/* Translator Status */}
        <div className="w-full max-w-xs">
          <div className="flex items-center justify-center gap-2 text-sm">
            <GlobeIcon className="w-4 h-4" />
            {isTranslatorLoading ? (
              <span className="text-yellow-600">
                Loading translator... {Math.round(translatorProgress)}%
              </span>
            ) : isTranslatorReady ? (
              <span className="text-green-600">Translator ready</span>
            ) : (
              <span className="text-gray-400">Translator initializing...</span>
            )}
          </div>
        </div>

        {/* User Info */}
        {settings.userName && (
          <div className="text-center text-sm text-gray-600">
            <p>Welcome, <span className="font-medium">{settings.userName}</span></p>
            <p className="text-xs text-gray-400">
              Language: {settings.language.toUpperCase()}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="w-full max-w-xs space-y-3">
          <Button
            fullWidth
            size="lg"
            onClick={() => navigate('/create-room')}
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Create Room
          </Button>

          <Button
            fullWidth
            size="lg"
            variant="outline"
            onClick={() => navigate('/join-room')}
          >
            <UsersIcon className="w-5 h-5 mr-2" />
            Join Room
          </Button>
        </div>

        {/* Setup Prompt */}
        {!settings.userName && (
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">
              Set up your profile first
            </p>
            <Link
              to="/settings"
              className="text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              Go to Settings →
            </Link>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-gray-400">
        Powered by Small100 ONNX Translator
      </footer>
    </div>
  );
}
