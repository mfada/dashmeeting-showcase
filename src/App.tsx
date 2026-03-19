import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Overview from "./pages/Overview";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Meetings from "./pages/Meetings";
import MeetingDetail from "./pages/MeetingDetail";
import Tasks from "./pages/Tasks";
import Imports from "./pages/Imports";
import Analytics from "./pages/Analytics";
import Calendar from "./pages/Calendar";
import Timeline from "./pages/Timeline";
import UsersPage from "./pages/Users";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Office365Callback from "./pages/Office365Callback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/office365/callback" element={<Office365Callback />} />
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/" element={<Overview />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/meetings" element={<Meetings />} />
              <Route path="/meetings/:id" element={<MeetingDetail />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/imports" element={<Imports />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
