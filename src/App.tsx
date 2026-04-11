import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider, useTheme } from "next-themes";
import Layout from "./components/Layout";
import NotFound from "./pages/NotFound";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const Index = lazy(() => import("./pages/Index"));
const InboxPage = lazy(() => import("./pages/InboxPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const AgendaPage = lazy(() => import("./pages/AgendaPage"));
const HabitsPage = lazy(() => import("./pages/HabitsPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
    },
  },
});

function PageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <PageSpinner />;
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

function AppContent() {
  const { resolvedTheme } = useTheme();

  return (
    <TooltipProvider>
      <Sonner theme={resolvedTheme as "light" | "dark"} />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageSpinner />}>
            <AppRoutes />
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AppContent />
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
