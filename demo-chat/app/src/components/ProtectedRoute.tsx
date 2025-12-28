import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentRoom, isConnected } = useAppStore();

  // Redirect if not in a room or not connected
  if (!currentRoom || !isConnected) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
