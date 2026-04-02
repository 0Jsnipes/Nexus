import { useEffect, useState } from "react";
import { onSnapshot, doc, updateDoc, arrayRemove, arrayUnion } from "firebase/firestore";
import { useChatStore } from "../lib/chatStore";
import { db, auth } from "../lib/firebase";
import { useUserStore } from "../lib/userStore";
import "./detail.css";

const Detail = ({ isMobile = false, onBack }) => {
  const { chatId, user, isReceiverBlocked, changeBlock } = useChatStore();
  const { currentUser } = useUserStore();
  const [images, setImages] = useState([]); // Store shared photos
  const [isPhotosOpen, setIsPhotosOpen] = useState(false); // Toggle photos section
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false); // Toggle privacy settings
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false); // Toggle chat settings
  const [isMuted, setIsMuted] = useState(false); // Mute chat notifications

  useEffect(() => {
    if (!chatId) return;

    // Fetch and filter images from chat messages
    const unSub = onSnapshot(doc(db, "chats", chatId), (docSnap) => {
      if (docSnap.exists()) {
        const chatData = docSnap.data();
        const sharedImages = chatData.messages
          ?.filter((message) => message.img) // Only messages with images
          .map((message) => ({
            url: message.img,
            name: message.img.split("/").pop(), // Extract filename from URL
          }));
        setImages(sharedImages || []);
      }
    });

    return () => unSub();
  }, [chatId]);

  const toggleSection = (section) => {
    if (section === "photos") {
      setIsPhotosOpen((prev) => !prev);
    } else if (section === "privacy") {
      setIsPrivacyOpen((prev) => !prev);
    } else if (section === "chatSettings") {
      setIsChatSettingsOpen((prev) => !prev);
    }
  };

  const handleBlockUser = async () => {
    if (!user || !currentUser) return;

    const userDocRef = doc(db, "users", currentUser.id);

    try {
      await updateDoc(userDocRef, {
        blocked: isReceiverBlocked
          ? arrayRemove(user.id)
          : arrayUnion(user.id),
      });
      changeBlock(); // Update block status in store
    } catch (err) {
      console.error("Failed to block/unblock user:", err);
    }
  };

  const handleMuteChat = () => {
    setIsMuted((prev) => !prev);
    alert(isMuted ? "Chat unmuted" : "Chat muted");
  };

  const handleLogout = () => {
    auth.signOut();
    window.location.reload();
  };

  return (
    <div className="detail">
      {isMobile && (
        <div className="detailMobileHeader">
          <button type="button" className="mobileNavButton" onClick={onBack}>
            Back
          </button>
          <span>Conversation Details</span>
        </div>
      )}
      {/* User Information */}
      <div className="user">
        <img src={user?.avatar || "./avatar.png"} alt="User Avatar" />
        <h2>{user?.username || "Unknown User"}</h2>
        <p>{user?.status || "No status available"}</p>
        {user?.bio && <span className="userBio">{user.bio}</span>}
      </div>

      {/* Shared Photos Section */}
      <div className="info">
        <div className="option">
          <div className="title" onClick={() => toggleSection("photos")}>
            <span>Shared Photos</span>
            <img
              src={isPhotosOpen ? "./arrowUp.png" : "./arrowDown.png"}
              alt="Toggle"
            />
          </div>
          {isPhotosOpen && (
            <div className="photos">
              {images.length > 0 ? (
                images.map((image, index) => (
                  <div className="photoItem" key={index}>
                    <img src={image.url} alt="Shared" className="photoDetail" />
                    <a
                      href={image.url}
                      download={image.name}
                      onClick={() => alert("Downloading...")}
                    >
                      <img src="./download.png" alt="Download" className="icon" />
                    </a>
                  </div>
                ))
              ) : (
                <p>No shared photos yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Privacy Settings Section */}
        <div className="option">
          <div className="title" onClick={() => toggleSection("privacy")}>
            <span>Privacy Settings</span>
            <img
              src={isPrivacyOpen ? "./arrowUp.png" : "./arrowDown.png"}
              alt="Toggle"
            />
          </div>
          {isPrivacyOpen && (
            <div className="privacy center-container">
              <button onClick={handleBlockUser}>
                {isReceiverBlocked ? "Unblock User" : "Block User"}
              </button>
            </div>
          )}
        </div>

        {/* Chat Settings Section */}
        <div className="option">
          <div className="title" onClick={() => toggleSection("chatSettings")}>
            <span>Chat Settings</span>
            <img
              src={isChatSettingsOpen ? "./arrowUp.png" : "./arrowDown.png"}
              alt="Toggle"
            />
          </div>
          {isChatSettingsOpen && (
            <div className="chatSettings center-container">
                <button onClick={handleMuteChat}>
                {isMuted ? "Unmute Chat" : "Mute Chat"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Block and Logout Buttons */}
      <div className="footer">
        <button className="blockButton" onClick={handleBlockUser}>
          {isReceiverBlocked ? "Unblock User" : "Block User"}
        </button>
        <button className="logoutButton" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Detail;
