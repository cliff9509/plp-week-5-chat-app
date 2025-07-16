const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
app.use(cors());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const users = {}; // socket.id => username
const availableRooms = ["General", "Tech", "Gaming", "Random"];

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on("join", (username) => {
    users[socket.id] = username;
    socket.emit("roomsList", availableRooms);
    io.emit("onlineUsers", Object.values(users));
    console.log(`👤 ${username} joined`);
  });

  socket.on("chatMessage", (msg) => {
    const user = users[socket.id];
    const timestamp = new Date().toISOString();
    io.emit("chatMessage", { user, msg, timestamp });

    // Delivery ack
    socket.emit("messageDelivered", { to: "Global", timestamp });
  });

  socket.on("privateMessage", ({ to, msg }) => {
    const from = users[socket.id];
    const toSocketId = Object.keys(users).find((id) => users[id] === to);
    const timestamp = new Date().toISOString();

    if (toSocketId) {
      io.to(toSocketId).emit("privateMessage", { from, msg, timestamp });
      socket.emit("privateMessage", { from, msg, timestamp });

      // Acknowledge delivery
      socket.emit("messageDelivered", { to, timestamp });
    }
  });

  socket.on("joinRoom", (roomName) => {
    const username = users[socket.id];
    const currentRooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
    currentRooms.forEach((r) => socket.leave(r));
    socket.join(roomName);

    socket.emit("joinedRoom", roomName);

    socket.to(roomName).emit("roomMessage", {
      user: "System",
      msg: `${username} has joined the room.`,
      room: roomName,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("roomMessage", ({ room, msg }) => {
    const user = users[socket.id];
    const timestamp = new Date().toISOString();
    io.to(room).emit("roomMessage", { user, msg, room, timestamp });

    socket.emit("messageDelivered", { room, timestamp });
  });

  socket.on("typing", (isTyping) => {
    const user = users[socket.id];
    socket.broadcast.emit("typing", { user, isTyping });
  });

  socket.on("disconnect", () => {
    const user = users[socket.id];
    delete users[socket.id];
    io.emit("onlineUsers", Object.values(users));
    console.log(`🔴 ${user || "Unknown"} disconnected`);
  });
});

server.listen(3000, () => {
  console.log("✅ Server listening on http://localhost:3000");
});



