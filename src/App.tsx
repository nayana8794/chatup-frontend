// chatup/frontend/src/App.tsx
import React from "react";
import { AppThemeProvider } from "./theme/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RealtimeProvider } from "./context/RealtimeContext";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { ChangePasswordModal } from "./components/ChangePasswordModal";

const AppContent: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <Login />;
  }

  return (
    <>
      <Dashboard />
      <ChangePasswordModal />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <AppThemeProvider>
      <AuthProvider>
        <RealtimeProvider>
          <AppContent />
        </RealtimeProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
};

export default App;