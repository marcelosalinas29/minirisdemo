import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import AppointmentPage from "./pages/AppointmentPage";
import NewAppointmentPage from "./pages/NewAppointmentPage";
import HistoryPage from "./pages/HistoryPage";
import ImportStudiesPage from "./pages/ImportStudiesPage";
import AuditPage from "./pages/AuditPage";
import BackupPage from "./pages/BackupPage";
import MyStylePage from "./pages/MyStylePage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ConsultorPage from "./pages/ConsultorPage";
import PatientsPage from "./pages/PatientsPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import ScheduleConfigPage from "./pages/ScheduleConfigPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminResendLinksPage from "./pages/AdminResendLinksPage";
import NotFound from "./pages/NotFound";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

const queryClient = new QueryClient();

function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtimeSync();
  return <>{children}</>;
}

// Remonta la ficha al cambiar de turno para que no quede el informe del paciente anterior en pantalla.
const AppointmentPageKeyed = () => {
  const { id } = useParams<{ id: string }>();
  return <AppointmentPage key={id} />;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <RealtimeProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/appointment/:id" element={<ProtectedRoute><AppointmentPageKeyed /></ProtectedRoute>} />
                <Route path="/consultor" element={<ProtectedRoute><ConsultorPage /></ProtectedRoute>} />
                <Route path="/mi-estilo" element={<ProtectedRoute><MyStylePage /></ProtectedRoute>} />
                <Route path="/respaldo" element={<ProtectedRoute><BackupPage /></ProtectedRoute>} />
                <Route path="/auditoria" element={<ProtectedRoute><AuditPage /></ProtectedRoute>} />
                <Route path="/importar" element={<ProtectedRoute><ImportStudiesPage /></ProtectedRoute>} />
                <Route path="/historial" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
                <Route path="/new" element={<ProtectedRoute><NewAppointmentPage /></ProtectedRoute>} />
                <Route path="/patients" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/schedule" element={<ProtectedRoute><ScheduleConfigPage /></ProtectedRoute>} />
                <Route path="/admin-users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
                <Route path="/admin-resend-links" element={<ProtectedRoute><AdminResendLinksPage /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </RealtimeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
