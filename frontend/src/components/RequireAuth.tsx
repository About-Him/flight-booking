import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!user || user.role === 'USER') {
    return <Navigate to="/" replace />;
  }
  return children;
}

export function RequireSuperadmin({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role !== 'SUPERADMIN') {
    return <Navigate to="/" replace />;
  }
  return children;
}
