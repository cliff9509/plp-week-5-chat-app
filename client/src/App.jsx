import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

function App() {
  const [username, setUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingStatus, setTypingStatus] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [privateMessages, setPrivateMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState("");
  const [roomMessages, setRoomMessages] = useState([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    socket.on("chatMessage", (data) => {
      setMessages((prev) => [...prev, data]);
      if (!document.hasFocus()) notify("New Global Message", data.msg);
    });

    socket.on("privateMessage", ({ from, msg, timestamp }) => {
      setPrivateMessages((prev) => [
        ...prev,
        { from, to: username, msg, timestamp },
      ]);
      if (!document.hasFocus()) notify(`Private Message from ${from}`, msg);
    });

    socket.on("roomMessage", ({ user, msg, room, timestamp }) => {
      setRoomMessages((prev) => [...prev, { user, msg, room, timestamp }]);
      if (!document.hasFocus() && user !== "System")
        notify(`Room ${room}`, `${user}: ${msg}`);
    });

    socket.on("typing", ({ user, isTyping }) => {
      setTypingStatus(isTyping ? `${user} is typing...` : "");
    });

    socket.on("onlineUsers", (users) => {
      setOnlineUsers(users.filter((u) => u !== username));
    });

    socket.on("roomsList", (roomList) => {
      setRooms(roomList);
    });

    socket.on("joinedRoom", (roomName) => {
      setCurrentRoom(roomName);
      setRoomMessages([]);
    });

    socket.on("messageDelivered", ({ to, room, timestamp }) => {
      console.log("✅ Delivered to:", to || room || "Global", "at", timestamp);
    });

    return () => {
      socket.off("chatMessage");
      socket.off("privateMessage");
      socket.off("roomMessage");
      socket.off("typing");
      socket.off("onlineUsers");
      socket.off("roomsList");
      socket.off("joinedRoom");
      socket.off("messageDelivered");
    };
  }, [username]);

  useEffect(() => {
    if (username) {
      socket.emit("join", username);
      if ("Notification" in window) {
        Notification.requestPermission();
      }
    }
  }, [username]);

  const handleSend = () => {
    if (!input.trim()) return;
    const timestamp = new Date().toISOString();

    if (selectedUser) {
      socket.emit("privateMessage", { to: selectedUser, msg: input });
      setPrivateMessages((prev) => [
        ...prev,
        { from: username, to: selectedUser, msg: input, timestamp },
      ]);
    } else if (currentRoom) {
      socket.emit("roomMessage", { room: currentRoom, msg: input });
    } else {
      socket.emit("chatMessage", input);
    }

    setInput("");
    socket.emit("typing", false);
  };

  const handleTyping = (e) => {
    const value = e.target.value;
    setInput(value);
    socket.emit("typing", value.length > 0);
  };

  const handleLogin = () => {
    if (usernameInput.trim()) {
      setUsername(usernameInput.trim());
    }
  };

  const handleJoinRoom = (room) => {
    setSelectedUser("");
    socket.emit("joinRoom", room);
  };

  const getDisplayedMessages = () => {
    const all = selectedUser
      ? privateMessages.filter(
          (m) =>
            (m.from === selectedUser && m.to === username) ||
            (m.from === username && m.to === selectedUser)
        )
      : currentRoom
      ? roomMessages.filter((m) => m.room === currentRoom)
      : messages;

    const filtered = all
      .filter((m) =>
        m.msg.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(-visibleCount);

    return filtered;
  };

  const notify = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  };

  if (!username) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Enter your username</h2>
        <input
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          placeholder="Username"
        />
        <button onClick={handleLogin}>Join Chat</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, display: "flex", gap: 20 }}>
      <div style={{ minWidth: 200 }}>
        <h3>Online Users</h3>
        {onlineUsers.map((user) => (
          <div key={user}>
            <button
              onClick={() => {
                setSelectedUser(user);
                setCurrentRoom("");
                setVisibleCount(10);
              }}
            >
              💬 {user}
            </button>
          </div>
        ))}

        <hr />
        <h3>Rooms</h3>
        {rooms.map((room) => (
          <div key={room}>
            <button
              onClick={() => {
                handleJoinRoom(room);
                setVisibleCount(10);
              }}
            >
              🏠 {room}
            </button>
          </div>
        ))}

        <hr />
        <button
          onClick={() => {
            setSelectedUser("");
            setCurrentRoom("");
            setVisibleCount(10);
          }}
        >
          🌍 Global Chat
        </button>
      </div>

      <div style={{ flex: 1 }}>
        <h2>
          {selectedUser
            ? `Private chat with ${selectedUser}`
            : currentRoom
            ? `Room: ${currentRoom}`
            : "🌍 Global Chat"}
        </h2>

        {/* 🔍 Search Bar */}
        <input
          type="text"
          placeholder="🔍 Search messages..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginBottom: 10, width: "100%", padding: "5px" }}
        />

        {/* 📨 Message List */}
        <div
          style={{
            height: 300,
            overflowY: "auto",
            border: "1px solid #ccc",
            padding: 10,
          }}
        >
          <button onClick={() => setVisibleCount((c) => c + 10)}>
            ⬆ Load Older
          </button>
          {getDisplayedMessages().map((m, i) => (
            <div key={i}>
              <strong>{m.from || m.user || "You"}</strong>: {m.msg}
              <small style={{ marginLeft: 10, color: "#888" }}>
                {new Date(m.timestamp).toLocaleTimeString()}
              </small>
            </div>
          ))}
          <em>{typingStatus}</em>
        </div>

        {/* 💬 Input Area */}
        <div style={{ marginTop: 10 }}>
          <input
            value={input}
            onChange={handleTyping}
            placeholder="Type a message..."
            style={{ width: "80%", marginRight: 10 }}
          />
          <button onClick={handleSend}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default App;
