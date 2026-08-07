import { useEffect, useRef } from "react";
import { format, isToday, isYesterday } from "../../lib/dateFormat";
import Avatar from "../shared/Avatar";
import EmptyState from "../shared/EmptyState";
import { FiCornerUpLeft, FiEdit2, FiTrash2, FiSmile } from "react-icons/fi";

const REACTION_CHOICES = ["👍", "🎉", "❤️", "😂", "👀"];

const dateLabel = (date) => {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
};

const groupByDate = (messages) => {
  const groups = [];
  let currentKey = null;
  for (const m of messages) {
    const date = new Date(m.created_at);
    const key = date.toDateString();
    if (key !== currentKey) {
      groups.push({ key, date, items: [] });
      currentKey = key;
    }
    groups[groups.length - 1].items.push(m);
  }
  return groups;
};

const groupReactions = (reactions = []) => {
  const map = {};
  for (const r of reactions) {
    map[r.emoji] = map[r.emoji] || [];
    map[r.emoji].push(r.user_id);
  }
  return map;
};

const MessageList = ({ messages, error, currentUserId, onReply, onEdit, onDelete, onReact, emptyLabel }) => {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (error) {
    return <div className="nx-error" role="alert">Couldn&apos;t load messages: {error}</div>;
  }

  if (!messages.length) {
    return <EmptyState title="No messages yet" description={emptyLabel || "Start the conversation."} />;
  }

  const groups = groupByDate(messages);

  return (
    <div className="msg-list">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="msg-date-separator">
            <span>{dateLabel(group.date)}</span>
          </div>
          {group.items.map((m) => {
            const reactions = groupReactions(m.reactions);
            const replyTo = messages.find((x) => x.id === m.reply_to_id);
            return (
              <div className="msg-row" key={m.id}>
                <Avatar src={m.sender?.avatar_url} name={m.sender?.username} size={30} />
                <div className="msg-body">
                  <div className="msg-meta">
                    <span className="msg-author">{m.sender?.username || "Unknown"}</span>
                    <span className="msg-time">{format(new Date(m.created_at))}</span>
                    {m.edited_at && <span className="msg-edited">(edited)</span>}
                  </div>
                  {replyTo && (
                    <div className="msg-reply-context">
                      Replying to <strong>{replyTo.sender?.username}</strong>: {replyTo.body?.slice(0, 80)}
                    </div>
                  )}
                  {m.body && <p className="msg-text">{m.body}</p>}
                  {m.attachments?.map((a) => (
                    <div className="msg-attachment" key={a.id}>
                      {a.type?.startsWith("image/") ? (
                        <img src={a.url} alt={a.name} />
                      ) : (
                        <a href={a.url} target="_blank" rel="noreferrer">📎 {a.name}</a>
                      )}
                    </div>
                  ))}
                  {Object.keys(reactions).length > 0 && (
                    <div className="msg-reactions">
                      {Object.entries(reactions).map(([emoji, uids]) => (
                        <button
                          type="button"
                          key={emoji}
                          className={`msg-reaction ${uids.includes(currentUserId) ? "is-mine" : ""}`}
                          onClick={() => onReact(m.id, emoji)}
                        >
                          {emoji} {uids.length}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="msg-hover-actions">
                  <div className="msg-reaction-picker">
                    <button type="button" className="nx-btn nx-btn-ghost nx-btn-icon nx-btn-sm" title="React">
                      <FiSmile size={14} />
                    </button>
                    <div className="msg-reaction-choices">
                      {REACTION_CHOICES.map((emoji) => (
                        <button type="button" key={emoji} onClick={() => onReact(m.id, emoji)}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="button" className="nx-btn nx-btn-ghost nx-btn-icon nx-btn-sm" title="Reply" onClick={() => onReply(m)}>
                    <FiCornerUpLeft size={14} />
                  </button>
                  {m.sender_id === currentUserId && (
                    <>
                      <button type="button" className="nx-btn nx-btn-ghost nx-btn-icon nx-btn-sm" title="Edit" onClick={() => onEdit(m)}>
                        <FiEdit2 size={14} />
                      </button>
                      <button type="button" className="nx-btn nx-btn-ghost nx-btn-icon nx-btn-sm" title="Delete" onClick={() => onDelete(m)}>
                        <FiTrash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};

export default MessageList;
