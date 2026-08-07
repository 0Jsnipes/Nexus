import { useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import { FiPaperclip, FiSmile, FiX, FiSend } from "react-icons/fi";
import { uploadFile } from "../../lib/storage";

const MessageComposer = ({ workspaceId, disabled, placeholder, replyTo, onCancelReply, onSend }) => {
  const [text, setText] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) setPendingFile(file);
  };

  const handleSubmit = async () => {
    if (sending || disabled) return;
    if (!text.trim() && !pendingFile) return;
    setSending(true);

    try {
      let attachments = [];
      if (pendingFile) {
        const url = await uploadFile(`${workspaceId}/attachments`, pendingFile);
        attachments = [{ url, name: pendingFile.name, type: pendingFile.type, size: pendingFile.size }];
      }
      await onSend({ body: text.trim(), replyToId: replyTo?.id, attachments });
      setText("");
      setPendingFile(null);
      onCancelReply?.();
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="msg-composer">
      {replyTo && (
        <div className="msg-composer-reply">
          <span>Replying to <strong>{replyTo.sender?.username}</strong></span>
          <button type="button" className="nx-btn nx-btn-ghost nx-btn-icon nx-btn-sm" onClick={onCancelReply}>
            <FiX size={14} />
          </button>
        </div>
      )}
      {pendingFile && (
        <div className="msg-composer-attachment">
          <span>{pendingFile.name}</span>
          <button type="button" className="nx-btn nx-btn-ghost nx-btn-icon nx-btn-sm" onClick={() => setPendingFile(null)}>
            <FiX size={14} />
          </button>
        </div>
      )}
      <div className="msg-composer-row">
        <button type="button" className="nx-btn nx-btn-ghost nx-btn-icon" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
          <FiPaperclip size={16} />
        </button>
        <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFile} />

        <textarea
          className="msg-composer-input"
          rows={1}
          placeholder={disabled ? "You don't have permission to post here" : placeholder || "Message..."}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="msg-composer-emoji">
          <button type="button" className="nx-btn nx-btn-ghost nx-btn-icon" onClick={() => setShowEmoji((v) => !v)} disabled={disabled}>
            <FiSmile size={16} />
          </button>
          {showEmoji && (
            <div className="msg-emoji-popover">
              <EmojiPicker
                onEmojiClick={(e) => {
                  setText((t) => t + e.emoji);
                  setShowEmoji(false);
                }}
              />
            </div>
          )}
        </div>

        <button type="button" className="nx-btn nx-btn-primary nx-btn-icon" onClick={handleSubmit} disabled={disabled || sending}>
          <FiSend size={15} />
        </button>
      </div>
    </div>
  );
};

export default MessageComposer;
