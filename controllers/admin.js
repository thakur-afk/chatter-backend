import { Chat } from "../models/ChatSchema.js";
import jwt from "jsonwebtoken";
import { Message } from "../models/MessageSchema.js";
import { User } from "../models/UserSchema.js";
import { TryCatch, cookieOptions } from "../utils/features.js";

import { ErrorHandler } from "../utils/utility.js";

const loginAdmin = TryCatch(async (req, res, next) => {
  const adminSecretKey = process.env.ADMIN_SECRET_KEY;
  const { secretKey } = req.body;
  if (!secretKey || secretKey === "")
    return next(new ErrorHandler("Please provide secret key", 401));

  const isMatched = secretKey === adminSecretKey;

  if (!isMatched) return next(new ErrorHandler("Secret key incorrrect", 401));

  const token = jwt.sign(secretKey, process.env.JWT_SECRET);

  return res
    .status(200)
    .cookie("chatter-admin-token", token, {
      ...cookieOptions,
      maxAge: 1000 * 60 * 15,
    })
    .json({
      success: true,
      message: "authenticated sucess , welcome  admin",
    });
});
const logoutAdmin = TryCatch(async (req, res, next) => {
  return res
    .status(200)
    .cookie("chatter-admin-token", "", {
      ...cookieOptions,
      maxAge: 0,
    })
    .json({
      success: true,
      message: "logged out successfully",
    });
});

const getAdminData = TryCatch(async (req, res, next) => {
  return res.status(200).json({
    admin: true,
  });
});

const getAllUsers = TryCatch(async (req, res, next) => {
  const users = await User.find({});

  const transformedUsers = await Promise.all(
    users.map(async ({ _id, name, avatar, username }) => {
      const [groups, friends] = await Promise.all([
        Chat.find({ groupChat: true, members: _id }).countDocuments(),
        Chat.find({ groupChat: false, members: _id }).countDocuments(),
      ]);

      return {
        _id,
        name,
        username,
        avatar: avatar.url,
        groups,
        friends,
      };
    })
  );

  return res.status(200).json({
    sucess: true,
    users: transformedUsers,
  });
});

const getAllChats = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({})
    .populate("members", "name avatar")
    .populate("creator", "name avatar");

  const transformedChats = await Promise.all(
    chats.map(async ({ _id, members, name, creator, groupChat }) => {
      const totalMessages = await Message.countDocuments({ chat: _id });

      return {
        _id,
        groupChat,
        name,
        avatar: members.slice(0, 3).map((member) => member.avatar.url),
        members: members.map(({ _id, name, avatar }) => ({
          _id,
          name,
          avatar: avatar.url,
        })),
        creator: {
          name: creator?.name || "None",
          avatar: creator?.avatar.url || "",
        },
        totalMembers: members.length,
        totalMessages,
      };
    })
  );

  return res.status(200).json({
    success: true,
    chats: transformedChats,
  });
});

const getAllMessages = TryCatch(async (req, res, next) => {
  const messages = await Message.find()
    .populate("sender", "name avatar")
    .populate("chat", "groupChat");

  const transformedMessages = messages.map(
    ({ content, attachments, _id, sender, createdAt, chat }) => ({
      _id,
      attachments,
      content,
      createdAt,
      chat: chat._id,
      groupChat: chat.groupChat,
      sender: {
        _id: sender._id,
        name: sender.name,
        avatar: sender.avatar.url,
      },
    })
  );

  return res.status(200).json({ success: true, messages: transformedMessages });
});

const getDashboardStats = TryCatch(async (req, res, next) => {
  const [groupsCount, usersCount, totalChatsCount, messagesCount] =
    await Promise.all([
      Chat.countDocuments({ groupChat: true }),
      User.countDocuments(),
      Chat.countDocuments(),
      Message.countDocuments(),
    ]);

  const today = new Date();

  const last7Days = new Date();

  last7Days.setDate(last7Days.getDate() - 7);

  const last7Messages = await Message.find({
    createdAt: {
      $gte: last7Days,
      $lte: today,
    },
  }).select("createdAt");

  const messages = new Array(7).fill(0);

  last7Messages.forEach((message) => {
    const approxIndex =
      (today.getTime() - message.createdAt.getTime()) / (1000 * 60 * 60 * 24);

    const index = Math.floor(approxIndex);

    messages[6 - index]++;
  });

  const stats = {
    groupsCount,
    usersCount,
    totalChatsCount,
    messagesCount,
    messages,
  };

  return res.status(200).json({
    success: true,
    stats,
  });
});

export {
  loginAdmin,
  getAllUsers,
  getAllChats,
  getAllMessages,
  getDashboardStats,
  logoutAdmin,
  getAdminData,
};
