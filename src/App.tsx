import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import InboxPage from "./pages/InboxPage";
import TasksPage from "./pages/TasksPage";
import AgendaPage from "./pages/AgendaPage";
import HabitsPage from "./pages/HabitsPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import ProjectsPage from "./pages/ProjectsPage";
import SettingsPage from "./pages/SettingsPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/" element={<ProtectedRoute><Layout><Index /></Layout></ProtectedRoute>} />
    <Route path="/inbox" element={<ProtectedRoute><Layout><InboxPage /></Layout></ProtectedRoute>} />
    <Route path="/tarefas" element={<ProtectedRoute><Layout><TasksPage /></Layout></ProtectedRoute>} />
    <Route path="/agenda" element={<ProtectedRoute><Layout><AgendaPage /></Layout></ProtectedRoute>} />
    <Route path="/habitos" element={<ProtectedRoute><Layout><HabitsPage /></Layout></ProtectedRoute>} />
    <Route path="/projetos" element={<ProtectedRoute><Layout><ProjectsPage /></Layout></ProtectedRoute>} />
    <Route path="/configuracoes" element={<ProtectedRoute><Layout><SettingsPage /></Layout></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
