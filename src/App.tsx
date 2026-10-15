// chatup/frontend/src/App.tsx
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next"; // i18n import කරන්න
import { AppThemeProvider } from "./theme/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RealtimeProvider } from "./context/RealtimeContext";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { ChangePasswordModal } from "./components/ChangePasswordModal";
import { IncomingCallModal } from "./components/IncomingCallModal";
import { Calling } from "./pages/Calling";

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const [activeCallRoomId, setActiveCallRoomId] = useState<string | null>(null);

  // App එක Load වූ විට localStorage එකේ ඇති භාෂාව set කිරීම
  useEffect(() => {
    const savedLang = localStorage.getItem("chatup_lang");
    if (savedLang) {
      i18n.changeLanguage(savedLang);
    }
  }, [i18n]);

  if (!user) {
    return <Login />;
  }

  if (activeCallRoomId) {
    return <Calling initialRoomId={activeCallRoomId} onBack={() => setActiveCallRoomId(null)} />;
  }

  return (
    <>
      <Dashboard />
      <ChangePasswordModal />
      <IncomingCallModal onAcceptCall={(roomId) => setActiveCallRoomId(roomId)} />
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