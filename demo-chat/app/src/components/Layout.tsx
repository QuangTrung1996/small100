import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="h-full flex flex-col bg-gray-100 safe-area-top safe-area-bottom">
      {children}
    </div>
  );
}
