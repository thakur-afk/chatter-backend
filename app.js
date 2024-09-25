import express, { urlencoded } from "express";
import cors from "cors";
import { v2 } from "cloudinary";

import { TryCatch, connectDB } from "./utils/features.js";
import dotenv from "dotenv";
import { errorMiddleWare } from "./middlewares/error.js";
import cookieParser from "cookie-parser";
import userRoute from "./routes/user.js";
import chatRoute from "./routes/chat.js";
import adminRoute from "./routes/admin.js";
import { Server, Socket } from "socket.io";
import { createUser } from "./seeders/seed.js";
import { createServer } from "http";
import { v4 as uuid } from "uuid";
import {
  createGroupChats,
  createMessagesInAChat,
  createSingleChats,
} from "./seeders/chat.js";
import {
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  START_TYPING,
  STOP_TYPING,
} from "./constants/events.js";
import { getSockets } from "./lib/helper.js";
import { Message } from "./models/MessageSchema.js";
import { corsOptions } from "./constants/config.js";
import { socketAuthenticator } from "./middlewares/isAuthenticated.js";

dotenv.config({
  path: "./.env",
});

const mongoURI = process.env.MONGO_URI;
connectDB(mongoURI);
const app = express();

const server = createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});

app.set("io", io);

const socketIds = new Map();
let onlineSockets = [];

v2.config({
  api_key: process.env.CLOUDINERY_API_KEY,
  api_secret: process.env.CLOUDINERY_API_SECRET,
  cloud_name: process.env.CLOUDINERY_CLOUD_NAME,
});
// Using middlewares
app.use(cookieParser());

app.use(express.json());

app.use(cors(corsOptions));

app.use("/api/v1/users", userRoute);
app.use("/api/v1/chat", chatRoute);
app.use("/api/v1/admin", adminRoute);

io.use((socket, next) => {
  cookieParser()(socket.request, socket.request.res, async (err) => {
    await socketAuthenticator(err, socket, next);
  });
});

io.on("connection", (socket) => {
  const user = socket.user;

  socketIds.set(user._id.toString(), socket.id);

  //online users
  if (!onlineSockets.includes(user._id)) {
    onlineSockets.push(user._id);
  }

  io.emit("ONLINE_USERS", { onlineSockets });
  //

  socket.on(START_TYPING, async ({ chatId, members }) => {
    const socketMembers = getSockets(members);
    io.to(socketMembers).emit(START_TYPING, { members, chatId });
  });
  socket.on(STOP_TYPING, async ({ chatId, members }) => {
    const socketMembers = getSockets(members);
    io.to(socketMembers).emit(STOP_TYPING, { members, chatId });
  });

  socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
    const messageForRealTime = {
      content: message,
      _id: uuid(),
      sender: {
        _id: user._id,
        name: user.name,
      },
      chat: chatId,
      createdAt: new Date().toString(),
    };

    const messageForDB = {
      content: message,
      sender: user._id,
      chat: chatId,
    };

    const membersSocket = getSockets(members);

    io.to(membersSocket).emit(NEW_MESSAGE, {
      chatId,
      message: messageForRealTime,
    });
    io.to(membersSocket).emit(NEW_MESSAGE_ALERT, { chatId });

    try {
      await Message.create(messageForDB);
    } catch (error) {}
  });

  socket.on("disconnect", () => {
    socketIds.delete(user._id.toString());
    //online users

    onlineSockets = onlineSockets.filter((data) => data !== user._id);

    io.emit("ONLINE_USERS", { onlineSockets });
  });
});

app.use(errorMiddleWare);

server.listen(3000, () => {});

export { socketIds };
