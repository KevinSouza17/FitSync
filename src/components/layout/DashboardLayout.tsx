import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../../context/AuthContext";
import { NotificationsProvider } from "../../context/NotificationsContext";
import { InstallPrompt } from "../InstallPrompt";

export function DashboardLayout() {
  const { profile } = useAuth();
  const themeClass = profile?.is_professional ? "theme-pro" : "";

  return (
    <NotificationsProvider>
      <div className={`flex h-screen-ios flex-col overflow-hidden bg-surface-base lg:flex-row ${themeClass}`}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto ios-scroll">
          <Outlet />
        </main>
      </div>
      <InstallPrompt />
    </NotificationsProvider>
  );
}
