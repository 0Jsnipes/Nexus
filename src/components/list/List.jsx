import ChatList from "./chatList/ChatList";
import UserInfo from "./userInfo/UserInfo";
import "./list.css";

const List = ({ onChatSelect }) => {
  return (
    <div className="list">
      <UserInfo />
      <ChatList onChatSelect={onChatSelect} />
    </div>
  );
};

export default List;
