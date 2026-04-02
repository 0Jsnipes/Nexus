import { useState } from "react";
import "./userInfo.css";
import { useUserStore } from "../../lib/userStore";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

const Userinfo = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupMode, setPopupMode] = useState(""); // "status" or "bio"
  const [inputValue, setInputValue] = useState("");
  const { currentUser, logout, fetchUserInfo } = useUserStore();

  // Handle Firestore updates for status or bio
  const handleSave = async () => {
    try {
      const userRef = doc(db, "users", currentUser.id);
      if (popupMode === "status") {
        await updateDoc(userRef, { status: inputValue });
        console.log("Status updated successfully!");
        // Optionally refresh or update local state
        await fetchUserInfo(currentUser.id);
      } else if (popupMode === "bio") {
        await updateDoc(userRef, { bio: inputValue });
        console.log("Bio updated successfully!");
        // Optionally refresh or update local state
        await fetchUserInfo(currentUser.id);
      }
      handleClosePopup(); // Close the popup
    } catch (error) {
      console.error(`Error updating ${popupMode}:`, error);
    }
  };

  const handleOpenPopup = (mode) => {
    setPopupMode(mode);
    setInputValue(
      mode === "status" ? currentUser.status || "" : currentUser.bio || ""
    );
    setIsPopupOpen(true);
  };

  const handleClosePopup = () => {
    setPopupMode("");
    setInputValue("");
    setIsPopupOpen(false);
  };

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
  };

  return (
    <div className="userInfo">
      <div className="user">
        <img src={currentUser.avatar || "./avatar.png"} alt="User Avatar" />
        <h2>{currentUser.username}</h2>
        <h5>{currentUser.status || "No status set"}</h5>
        <p>{currentUser.bio || "No bio available"}</p>
      </div>
      <div className="icons">
        <img
          src="./more.png"
          alt="More Options"
          className="more-icon"
          onClick={() => setDropdownOpen((prev) => !prev)}
        />
        {dropdownOpen && (
          <div className="dropdown">
            <button onClick={handleLogout}>Logout</button>
            <button onClick={() => handleOpenPopup("status")}>Set Status</button>
            <button onClick={() => handleOpenPopup("bio")}>Edit Bio</button>
          </div>
        )}
        <img src="./video.png" alt="Video" />
        <img src="./edit.png" alt="Edit" />
      </div>
      {/* Pop-up Modal */}
      {isPopupOpen && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>{popupMode === "status" ? "Set Status" : "Edit Bio"}</h3>
            {popupMode === "status" ? (
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter new status"
              />
            ) : (
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter new bio"
              />
            )}
            <div>
              <button onClick={handleSave}>
                {popupMode === "status" ? "Set Status" : "Set Bio"}
              </button>
              <button className="cancel" onClick={handleClosePopup}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Userinfo;
