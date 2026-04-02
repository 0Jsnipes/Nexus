import { useEffect, useState } from "react";
import Chat from "./components/chat/Chat";
import Detail from "./components/detail/Detail";
import List from "./components/list/List";
import Login from "./components/login/Login";
import Notification from "./components/notifications/Notification";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./components/lib/firebase";
import { useUserStore } from "./components/lib/userStore";
import { useChatStore } from "./components/lib/chatStore";

const MOBILE_BREAKPOINT = 900;

const getIsMobile = () =>
  typeof window !== "undefined" &&
  window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;

const App = () => {
  const { currentUser, isLoading, fetchUserInfo } = useUserStore();
  const { chatId } = useChatStore();
  const [isMobile, setIsMobile] = useState(getIsMobile);
  const [mobileView, setMobileView] = useState("list");

  useEffect(() => {
    const unSub = onAuthStateChanged(auth, (user) => {
      fetchUserInfo(user?.uid);
    });

    return () => {
      unSub();
    };
  }, [fetchUserInfo]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT}px)`
    );

    const handleViewportChange = (event) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleViewportChange);
    } else {
      mediaQuery.addListener(handleViewportChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleViewportChange);
      } else {
        mediaQuery.removeListener(handleViewportChange);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setMobileView("list");
      return;
    }

    if (!isMobile) {
      setMobileView("chat");
      return;
    }

    if (!chatId) {
      setMobileView("list");
      return;
    }

    setMobileView((prevView) => (prevView === "detail" ? "detail" : "chat"));
  }, [currentUser, isMobile, chatId]);

  if (isLoading) return <div className="loading">Loading...</div>;

  const openListView = () => {
    setMobileView("list");
  };

  const openChatView = () => {
    if (chatId) {
      setMobileView("chat");
    }
  };

  const openDetailView = () => {
    if (chatId) {
      setMobileView("detail");
    }
  };

  let content = <Login />;

  if (currentUser) {
    if (isMobile) {
      if (mobileView === "detail" && chatId) {
        content = <Detail isMobile onBack={openChatView} />;
      } else if (chatId && mobileView === "chat") {
        content = (
          <Chat
            isMobile
            onBack={openListView}
            onOpenDetail={openDetailView}
          />
        );
      } else {
        content = <List onChatSelect={openChatView} />;
      }
    } else {
      content = (
        <>
          <List />
          {chatId && <Chat onOpenDetail={openDetailView} />}
          {chatId && <Detail />}
        </>
      );
    }
  }

  return (
    <div
      className={`container ${currentUser ? "app-shell" : "auth-shell"} ${
        isMobile ? "mobile-shell" : "desktop-shell"
      }`}
    >
      {content}
      <Notification />
    </div>
  );
};

export default App;
