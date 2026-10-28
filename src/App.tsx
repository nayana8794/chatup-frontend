// chatup/frontend/src/App.tsx
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppThemeProvider } from "./theme/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RealtimeProvider } from "./context/RealtimeContext";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { ChangePasswordModal } from "./components/ChangePasswordModal";
import { IncomingCallModal } from "./components/IncomingCallModal";
import { Calling } from "./pages/Calling";
import { PushNotificationPrompt } from "./components/PushNotificationPrompt";
import { subscribeToPushNotifications } from "./utils/pushManager";
import apiClient from "./api/client";

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const [activeCallRoomId, setActiveCallRoomId] = useState<string | null>(null);
  const [activeCallType, setActiveCallType] = useState<"video" | "audio">("video");

  useEffect(() => {
    const savedLang = localStorage.getItem("chatup_lang");
    if (savedLang) {
      i18n.changeLanguage(savedLang);
    }
  }, [i18n]);

  useEffect(() => {
    if (user && "Notification" in window && Notification.permission === "granted") {
      subscribeToPushNotifications().catch(() => { });
    }
  }, [user]);

  // Handle URL Auto-Join safely: Verify call is still active before mounting Calling view
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    const type = (params.get("type") as "video" | "audio" | null) || "video";

    if (room) {
      window.history.replaceState({}, document.title, window.location.pathname);
      apiClient
        .get<{ is_active: boolean }>(`/calling/room-status?room_id=${encodeURIComponent(room)}`)
        .then((res) => {
          if (res.data.is_active) {
            setActiveCallRoomId(room);
            setActiveCallType(type);
          } else {
            console.log("Call was already concluded by the host.");
          }
        })
        .catch(() => { });
    }
  }, [user]);

  if (!user) {
    return <Login />;
  }

  if (activeCallRoomId) {
    return (
      <Calling
        initialRoomId={activeCallRoomId}
        initialCallType={activeCallType}
        onBack={() => setActiveCallRoomId(null)}
      />
    );
  }

  return (
    <>
      <Dashboard />
      <ChangePasswordModal />
      <IncomingCallModal onAcceptCall={(roomId, type) => {
        setActiveCallRoomId(roomId);
        if (type) setActiveCallType(type);
      }} />
      <PushNotificationPrompt />
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