import { useCallback, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AlertCenter from "./AlertCenter";
import LoginView from "./LoginView";
import ChangeDangerLevelPage from "./ChangeDangerLevelPage";
import EventLogPage from "./EventLogPage";
import IncidentReportsPage from "./IncidentReportsPage";
import IncidentAudioRecordPage from "./IncidentAudioRecordPage";
import MassNotificationPage from "./MassNotificationPage";
import SettingsPage from "./SettingsPage";
import { appendEvent } from "./eventLog";

const AUTH_SESSION_KEY = "lukoil_demo_session";
const AUTH_LOGIN_KEY = "lukoil_demo_login";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem(AUTH_SESSION_KEY) === "1"
  );

  const handleLogin = useCallback((login: string) => {
    sessionStorage.setItem(AUTH_SESSION_KEY, "1");
    sessionStorage.setItem(AUTH_LOGIN_KEY, login);
    appendEvent("Вход в систему", `Учётная запись: ${login}`);
    setIsAuthenticated(true);
  }, []);

  const handleLogout = useCallback(() => {
    const login = sessionStorage.getItem(AUTH_LOGIN_KEY);
    appendEvent(
      "Выход из системы",
      login && login.trim() ? `Учётная запись: ${login}` : undefined
    );
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_LOGIN_KEY);
    setIsAuthenticated(false);
  }, []);

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AlertCenter onLogout={handleLogout} />} />
        <Route path="/mass-alert" element={<MassNotificationPage />} />
        <Route
          path="/cancel-alert"
          element={<MassNotificationPage pageVariant="cancel" />}
        />
        <Route
          path="/change-danger-level"
          element={<ChangeDangerLevelPage />}
        />
        <Route path="/event-log" element={<EventLogPage onLogout={handleLogout} />} />
        <Route
          path="/incident-reports"
          element={<IncidentReportsPage onLogout={handleLogout} />}
        />
        <Route
          path="/incident-audio"
          element={<IncidentAudioRecordPage onLogout={handleLogout} />}
        />
        <Route path="/settings" element={<SettingsPage onLogout={handleLogout} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
