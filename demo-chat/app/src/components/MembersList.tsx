import type { Member } from '../types';
import { LANGUAGES } from './LanguageSelector';
import { XMarkIcon, UserIcon } from './icons';

interface MembersListProps {
  members: Member[];
  currentUserId: string;
  onClose: () => void;
}

export default function MembersList({
  members,
  currentUserId,
  onClose,
}: MembersListProps) {
  return (
    <div className="absolute inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-64 bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">
            Members ({members.length})
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-auto p-2">
          {members.map((member) => {
            const langInfo = LANGUAGES.find((l) => l.code === member.language);
            const isCurrentUser = member.id === currentUserId;

            return (
              <div
                key={member.id}
                className={`flex items-center gap-3 p-2 rounded-lg ${
                  isCurrentUser ? 'bg-primary-50' : 'hover:bg-gray-50'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    member.isHost ? 'bg-yellow-100' : 'bg-gray-100'
                  }`}
                >
                  <UserIcon
                    className={`w-5 h-5 ${
                      member.isHost ? 'text-yellow-600' : 'text-gray-500'
                    }`}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-medium text-gray-800 truncate">
                      {member.name}
                    </p>
                    {isCurrentUser && (
                      <span className="text-xs text-primary-600">(You)</span>
                    )}
                    {member.isHost && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                        Host
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {langInfo?.name || member.language}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
