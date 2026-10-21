import { useState, useEffect, useCallback } from "react";
import { AppSidebar, type TabType } from "@/components/app-sidebar";
import { LiveStreamSettings } from "@/view/live-stream-settings";
import { MoreSettings } from "@/view/more-settings";
import { Navbar } from "@/components/navbar";
import { StatusBar } from "@/components/status-bar";
import { LoginScreen } from "@/screens/login-screen";
import { LoadingScreen } from "@/screens/loading-screen";
import { useConfigStore } from "@/store/config";
import { Toaster } from "@/components/ui/sonner";
import { LiveRoomManager } from "@/view/manager/live-room-manager";
import { useWsStore } from "./store/ws";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { FloatingComments } from "@/view/floating-comments";
import { DetachedComments } from "@/view/detached-comments";
import { listen } from "@tauri-apps/api/event";
import { Overview } from "@/view/overview";
import { DataCenter } from "@/view/data-center";
import { TtsSettings } from "@/view/tts-settings";
import { useTtsStore } from "@/store/tts";

type AuthState = "loading" | "login" | "authenticated";

export default function App() {
  const isCommentsWindow = getCurrentWindow().label === "comments";
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [commentsDetached, setCommentsDetached] = useState(false);

  const init = useConfigStore((state) => state.init);
  const isInitialized = useConfigStore((state) => state.isInitialized);
  const theme = useConfigStore((state) => state.config.theme);
  const initListeners = useWsStore((state) => state.initListeners);

  useEffect(() => {
    const listener = initListeners();

    return () => {
      listener.then((f) => f());
    };
  }, [initListeners]);

  // 订阅弹幕流，交给播报规则引擎处理
  useEffect(() => {
    const stop = useTtsStore.getState().startBridge();
    return () => {
      stop();
    };
  }, []);

  useEffect(() => {
    if (isCommentsWindow) return;
    const unlisten = listen("comments-window-docked", () => {
      setCommentsDetached(false);
    });
    return () => {
      unlisten.then((dispose) => dispose());
    };
  }, [isCommentsWindow]);

  useEffect(() => {
    if (!isInitialized) {
      init();
    }
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [init, isInitialized, theme]);

  const handleValidationComplete = useCallback((isValid: boolean) => {
    if (isValid) {
      setAuthState("authenticated");
    } else {
      setAuthState("login");
    }
  }, []);

  const handleLoginSuccess = () => {
    setAuthState("loading");
  };

  const handleLogout = () => {
    const state = useConfigStore.getState();
    state.clearAuth();
    setAuthState("login");
  };

  const renderContent = () => {
    switch (authState) {
      case "loading":
        return (
          <LoadingScreen onValidationComplete={handleValidationComplete} />
        );
      case "login":
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
      case "authenticated":
        return (
          <>
            <div className="flex flex-1 overflow-hidden">
              <AppSidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onLogout={handleLogout}
              />
              <main className="themed-scrollbar flex-1 overflow-y-auto p-[18px]">
                {activeTab === "overview" && (
                  <Overview onNavigate={setActiveTab} />
                )}
                {activeTab === "stream" && <LiveStreamSettings />}
                {activeTab === "comments" && (
                  <DetachedComments
                    detached={commentsDetached}
                    onDetach={() => setCommentsDetached(true)}
                    onDock={() => setCommentsDetached(false)}
                  />
                )}
                {activeTab === "manager" && <LiveRoomManager />}
                {activeTab === "tts" && <TtsSettings />}
                {activeTab === "data" && <DataCenter />}
                {activeTab === "settings" && (
                  <MoreSettings onLogout={handleLogout} />
                )}
              </main>
            </div>
            <StatusBar />
          </>
        );
    }
  };

  if (isCommentsWindow) {
    return isInitialized ? (
      <FloatingComments />
    ) : (
      <div className="flex h-screen items-center justify-center bg-transparent text-sm text-white/70">
        正在载入弹幕...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden border border-border bg-background shadow-2xl">
      <Navbar />
      {isInitialized ? (
        renderContent()
      ) : (
        <div className="flex flex-1 items-center justify-center p-8">
          初始化中...
        </div>
      )}
      <Toaster />
    </div>
  );
}
