import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import AppointmentPage from "./pages/AppointmentPage";
import NewAppointmentPage from "./pages/NewAppointmentPage";
import PatientsPage from "./pages/PatientsPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import ScheduleConfigPage from "./pages/ScheduleConfigPage";
import NotFound from "./pages/NotFound";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

const queryClient = new QueryClient();

function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtimeSync();
  return <>{children}</>;
}

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
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/appointment/:id" element={<ProtectedRoute><AppointmentPage /></ProtectedRoute>} />
                <Route path="/new" element={<ProtectedRoute><NewAppointmentPage /></ProtectedRoute>} />
                <Route path="/patients" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/schedule" element={<ProtectedRoute><ScheduleConfigPage /></ProtectedRoute>} />
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
