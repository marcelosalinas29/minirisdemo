import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, isViewer } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Cargando...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // Médico consultor: solo el buscador de estudios y su perfil
  if (isViewer && location.pathname !== '/consultor' && location.pathname !== '/profile') {
    return <Navigate to="/consultor" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
