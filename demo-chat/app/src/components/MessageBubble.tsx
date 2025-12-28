import type { Message } from '../types';
import { LANGUAGES } from './LanguageSelector';
import { GlobeIcon } from './icons';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  userLanguage: string;
}

export default function MessageBubble({
  message,
  isOwn,
  userLanguage,
}: MessageBubbleProps) {
  const needsTranslation = message.sourceLang !== userLanguage;
  const displayText = message.translatedText || message.text;
  const sourceLangName = LANGUAGES.find((l) => l.code === message.sourceLang)?.name || message.sourceLang;

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} message-enter`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isOwn
            ? 'bg-primary-600 text-white rounded-br-md'
            : 'bg-white text-gray-800 shadow-sm rounded-bl-md'
        }`}
      >
        {/* Sender name (for others' messages) */}
        {!isOwn && (
          <p className="text-xs font-medium text-primary-600 mb-1">
            {message.senderName}
          </p>
        )}

        {/* Main message */}
        <p className="text-sm whitespace-pre-wrap break-words">{displayText}</p>

        {/* Translation info */}
        {needsTranslation && message.translatedText && (
          <div
            className={`mt-2 pt-2 border-t ${
              isOwn ? 'border-primary-500' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-1 text-xs opacity-70">
              <GlobeIcon className="w-3 h-3" />
              <span>Original ({sourceLangName})</span>
            </div>
            <p
              className={`text-xs mt-1 ${
                isOwn ? 'text-primary-200' : 'text-gray-500'
              }`}
            >
              {message.text}
            </p>
          </div>
        )}

        {/* Translating indicator */}
        {needsTranslation && message.isTranslating && (
          <div className="flex items-center gap-1 mt-1 text-xs opacity-70">
            <span className="spinner w-3 h-3" />
            <span>Translating...</span>
          </div>
        )}

        {/* Timestamp */}
        <p
          className={`text-xs mt-1 ${
            isOwn ? 'text-primary-200' : 'text-gray-400'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
