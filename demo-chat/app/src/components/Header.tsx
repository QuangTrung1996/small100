import { ArrowLeftIcon } from './icons';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}

export default function Header({
  title,
  showBack = false,
  onBack,
  rightContent,
}: HeaderProps) {
  return (
    <header className="bg-primary-600 text-white px-4 py-3 flex items-center gap-3 shadow-md">
      {showBack && (
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-primary-700 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
      )}
      <h1 className="flex-1 text-lg font-semibold truncate">{title}</h1>
      {rightContent && <div>{rightContent}</div>}
    </header>
  );
}
