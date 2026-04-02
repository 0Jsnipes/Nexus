import { useEffect, useRef, useState } from "react";
import "./chat.css";
import EmojiPicker from "emoji-picker-react";
import {
  arrayUnion,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { storage } from "../lib/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useChatStore } from "../lib/chatStore";
import { useUserStore } from "../lib/userStore";
import upload from "../lib/upload";
import { format } from "timeago.js";

const Chat = ({ isMobile = false, onBack, onOpenDetail }) => {
  const [chat, setChat] = useState({ messages: [] });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [img, setImg] = useState({ file: null, url: "", preview: null });
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [status, setStatus] = useState("No status available");

  const { currentUser } = useUserStore();
  const { chatId, user, isCurrentUserBlocked, isReceiverBlocked } =
    useChatStore();

  const endRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const cameraStreamRef = useRef(null);


 // Handle taking a photo
const handleTakePhoto = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
    });
    cameraStreamRef.current = stream;

    // Use srcObject to display the video stream
    const videoElement = document.getElementById("cameraPreview");
    if (videoElement) {
      videoElement.srcObject = stream;
    }

    setImg({ ...img, preview: true }); // Change to a boolean to track preview state
  } catch (err) {
    console.error("Error accessing camera:", err);
  }
};

// Capture photo from video stream
const handleCapturePhoto = () => {
  const videoElement = document.getElementById("cameraPreview");
  if (!videoElement) return;

  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoElement, 0, 0);

  const photoURL = canvas.toDataURL("image/png");

  // Stop the video stream
  if (cameraStreamRef.current) {
    cameraStreamRef.current.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
  }

  setImg({ file: photoURL, url: photoURL, preview: null });
};

// Close the camera preview
const handleCloseCamera = () => {
  if (cameraStreamRef.current) {
    cameraStreamRef.current.getTracks().forEach((track) => track.stop());
  }
  setImg({ ...img, preview: null });
};


  // Handle recording audio
  const handleRecordAudio = async () => {
    if (isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            const audioChunks = [];
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
                const audioURL = URL.createObjectURL(audioBlob);
                setAudioURL(audioURL);

                // Stop the audio stream
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);

            const recordingRef = { current: true }; // Use a ref to track recording status
            setRecordTime(0);
            let seconds = 0;
            const interval = setInterval(() => {
                if (!recordingRef.current) {
                    clearInterval(interval);
                } else {
                    seconds += 1;
                    setRecordTime(seconds);
                }
            }, 1000);

            mediaRecorder.onstop = () => {
                recordingRef.current = false; // Stop the interval when recording stops
                const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
                const audioURL = URL.createObjectURL(audioBlob);
                setAudioURL(audioURL);
                stream.getTracks().forEach((track) => track.stop());
            };

        } catch (err) {
            console.error("Error accessing microphone:", err);
        }
    }
};


  const handleDeleteRecording = () => {
    setAudioURL("");
    setRecordTime(0);
  };

  const handleSendAudio = async () => {
    if (!audioURL) {
        console.error("No audio to send.");
        return;
    }

    try {
        const audioBlob = await fetch(audioURL).then((res) => res.blob());

        // Firebase Storage: Upload audio
        const storageRef = ref(storage, `audio/${Date.now()}.wav`);
        const snapshot = await uploadBytes(storageRef, audioBlob);

        // Get URL for the uploaded file
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Firestore: Save metadata
        const audioData = {
            url: downloadURL,
            timestamp: new Date(),
        };

        await addDoc(collection(db, "audioFiles"), audioData);

        console.log("Audio uploaded successfully!");
    } catch (error) {
        console.error("Error uploading audio:", error);
    }
};

  // Listen to chat data changes
  useEffect(() => {
    if (!chatId) return;

    const unSub = onSnapshot(doc(db, "chats", chatId), (res) => {
      if (res.exists()) {
        setChat(res.data());
      } else {
        console.error("Chat document not found");
      }
    });

    return () => unSub();
  }, [chatId]);

  // Scroll to the bottom when messages change
  useEffect(() => {
    if (chat?.messages?.length) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat?.messages]);

  // Handle emoji selection
  const handleEmoji = (e) => {
    setText((prev) => prev + e.emoji);
    setOpen(false);
  };

  // Handle image selection
  const handleImg = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setImg({
        file: file,
        url: url,
        preview: url, // Set preview URL
      });
    }
  };
  
  // Handle removing the preview
  const handleRemovePreview = () => {
    setImg({ file: null, url: "", preview: null });
  };
   // Call functionality
   const handleCall = () => {
    alert("Calling functionality is under development...");
  };

  // Video Call functionality
  const handleVideoCall = () => {
    alert("Video call functionality is under development...");
  };

const toggleUserInfo = () => {
  setShowInfo((prev) => !prev);
};

const handleInfoAction = () => {
  if (isMobile) {
    onOpenDetail?.();
    return;
  }

  toggleUserInfo();
};

const handleSend = async () => {
  if (!chatId || (text.trim() === "" && !audioURL && !img.file)) return; // Allow sending if img.file exists

  let imgUrl = null;

  try {
    if (img.file) {
      imgUrl = await upload(img.file); // Upload the image and get the URL
    }

    const message = {
      senderId: currentUser.id,
      text,
      createdAt: new Date(),
      ...(imgUrl && { img: imgUrl }), // Include the image URL if present
      ...(audioURL && { audio: audioURL }), // Include audio URL if present
    };

    await updateDoc(doc(db, "chats", chatId), {
      messages: arrayUnion(message),
    });

    const userIDs = [currentUser.id, user.id];

    await Promise.all(
      userIDs.map(async (id) => {
        const userChatsRef = doc(db, "userchats", id);
        const userChatsSnapshot = await getDoc(userChatsRef);

        if (userChatsSnapshot.exists()) {
          const userChatsData = userChatsSnapshot.data();

          const chatIndex = userChatsData.chats.findIndex(
            (c) => c.chatId === chatId
          );

          if (chatIndex !== -1) {
            userChatsData.chats[chatIndex].lastMessage =
              text || imgUrl ? "Image Message" : "Audio Message"; // Update last message info
            userChatsData.chats[chatIndex].updatedAt = Date.now();

            await updateDoc(userChatsRef, {
              chats: userChatsData.chats,
            });
          }
        }
      })
    );
  } catch (err) {
    console.error("Failed to send message:", err);
  } finally {
    setImg({ file: null, url: "" });
    setText("");
    setAudioURL("");
    setRecordTime(0);
  }
};



  {/*get user status*/}
  useEffect(() => {
    const fetchStatus = async () => {
      if (user?.id) {
        const fetchedStatus = await fetchUserStatus(user.id);
        setStatus(fetchedStatus);
      }
    };
    fetchStatus();
  }, [user?.id]);
  
  const fetchUserStatus = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        return userDoc.data().status;
      }
      console.error("User not found");
    } catch (error) {
      console.error("Error fetching user status:", error);
    }
    return "No status available"; // Default fallback
  };
  

  return (
    <div className="chat">
      {/* Top Section */}
      <div className="top">
        <div className="topContent">
          {isMobile && (
            <button type="button" className="mobileNavButton" onClick={onBack}>
              Chats
            </button>
          )}
          <div className="user">
            <img src={user?.avatar || "./avatar.png"} alt="User Avatar" />
            <div className="texts">
              <span>{user?.username}</span>
              <p>{user?.status || "No status available"}</p>
            </div>
          </div>
        </div>
        <div className="icons">
          <img src="./phone.png" alt="Phone"  onClick={handleCall}/>
          <img src="./video.png" alt="Video"  onClick={handleVideoCall}/>
          <img src="./info.png" alt="Info"    onClick={handleInfoAction}/>
        </div>
        {showInfo && !isMobile && (
  <div className="popup">
    <h3>User Info</h3>
    <p>{user?.bio || "No additional bio information available."}</p>
  </div>
)}
      </div>

     {/* Center Section */}
<div className="center">
  
  {chat?.messages?.length > 0 ? (
    chat.messages.map((message) => (
      <div
        className={
          message.senderId === currentUser?.id
            ? "message own"
            : "message"
        }
        key={message?.createdAt || Math.random()} // Ensure unique keys
      >
        <div className="texts">
        

          {message.img && <img src={message.img} alt="Message" />}
          {message.audio && (
            <audio controls>
              <source src={message.audio} type="audio/wav" />
              Your browser does not support the audio element.
            </audio>
          )}
          {message.text && <p>{message.text}</p>}
          <span>
            {message.createdAt
              ? format(message.createdAt.toDate())
              : "Just now"}
          </span>
         
        </div>
      </div>
    ))
  ) : (
    <p>No messages yet. Start the conversation!</p>
  )}
  {img.preview && (
      <div className="imagePreview">
        <img src={img.preview} alt="Preview" />
        <button className="removePreviewButton" onClick={handleRemovePreview}>
          Remove
          </button>
          </div>)}
  <div ref={endRef}></div>
</div>


      {/* Camera Preview *}
      {img.preview && (
  <div className="previewOverlay">
    <video
      id="cameraPreview"
      autoPlay
      playsInline
      muted // Avoid feedback noise
    ></video>
    <button className="captureButton" onClick={handleCapturePhoto}>
      Capture
    </button>
    <button className="closeButton" onClick={handleCloseCamera}>
      Close
    </button>
  </div>
)}
*/}

      {/* Bottom Section */}
      <div className="bottom">
        <div className="icons">
          <label htmlFor="file">
            <img src="./img.png" alt="Attach" />
          </label>
          <input
            type="file"
            id="file"
            style={{ display: "none" }}
            onChange={handleImg}
          />
         {/*<img src="./camera.png" alt="Camera" onClick={handleTakePhoto}/>*/}
          <img src="./mic.png" alt="Mic" onClick={handleRecordAudio} />
        </div>
        {isRecording ? (
          <div className="recordingOverlay">
            <span>{recordTime}s</span>
            <button className="stopButton" onClick={handleRecordAudio}>
            ■
            </button>
          </div>
        ) : audioURL ? (
          <div className="playbackControls">
            <audio controls src={audioURL}></audio>
            <button className="deleteButton" onClick={handleDeleteRecording}>
              Del
            </button>
          </div>
        ) : (
          <input
  type="text"
  placeholder={
    isCurrentUserBlocked || isReceiverBlocked
      ? "You cannot send a message"
      : "Type a message..."
  }
  value={text}
  onChange={(e) => setText(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter" && !isCurrentUserBlocked && !isReceiverBlocked) {
      handleSend();
      handleSendAudio();
      setImg({ file: null, url: "", preview: null });
    }
  }}
  disabled={isCurrentUserBlocked || isReceiverBlocked}
/>

        )}
        <div className="emoji">
          <img
            src="./emoji.png"
            alt="Emoji"
            onClick={() => setOpen((prev) => !prev)}
          />
          <div className="picker">
            {open && <EmojiPicker onEmojiClick={handleEmoji} />}
          </div>
        </div>
        <button
          className="sendButton"
          onClick={() => {
            handleSend();
            handleSendAudio();
            setImg({ file: null, url: "", preview: null })
          }}
          disabled={isCurrentUserBlocked || isReceiverBlocked}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;
