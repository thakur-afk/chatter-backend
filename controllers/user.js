import { compare } from "bcrypt";
import { User } from "../models/UserSchema.js";
import { Request } from "../models/RequestSchema.js";

import {
  TryCatch,
  sendToken,
  cookieOptions,
  emitEvent,
  uploadFilesToCloudinery,
} from "../utils/features.js";
import { ErrorHandler } from "../utils/utility.js";
import { Chat } from "../models/ChatSchema.js";
import { NEW_REQUEST, REFETCH_CHATS } from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";

const newUser = TryCatch(async (req, res, next) => {
  const { name, username, bio, password } = req.body;

  const file = req.file;

  if (!file) return next(new ErrorHandler("Please Upload Avatar"));

  const result = await uploadFilesToCloudinery([file]);

  const avatar = {
    public_id: result[0].public_id,
    url: result[0].url,
  };

  const user = await User.create({
    name,
    bio,
    username,
    password,
    avatar,
  });

  sendToken(res, user, 401, "successfuly resgistered");
});

const login = TryCatch(async (req, res, next) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username }).select("+password");

  if (!user) return next(new ErrorHandler("Invalid username or password", 401));

  const isMatch = await compare(password, user.password);

  if (!isMatch)
    return next(new ErrorHandler("Invalid username or password", 401));

  sendToken(res, user, 200, `welcome back ${user.name}`);
});

const getMyProfile = TryCatch(async (req, res, next) => {
  const user = await User.findById(req.user);

  if (!user) return next(new ErrorHandler("Enter valid Username", 404));

  res.status(200).json({
    status: true,
    user,
  });
});

const logout = TryCatch(async (req, res, next) => {
  const user = await User.findById(req.user);

  if (!user) return next(new ErrorHandler("Enter valid Username"));

  return res
    .status(200)
    .cookie("chatter-token", "", { ...cookieOptions, maxAge: 0 })
    .json({
      status: true,
      message: "logout successfull",
    });
});

const searchUser = TryCatch(async (req, res, next) => {
  const { name = "" } = req.query;

  const mychats = await Chat.find({ groupChat: false, members: req.user });

  const allUsersFromMyChat = mychats.flatMap((i) => i.members);

  const allUsersExceptMeAndFriends = await User.find({
    _id: { $nin: allUsersFromMyChat },
    name: { $regex: name, $options: "i" },
  });

  const users = allUsersExceptMeAndFriends.map(({ _id, name, avatar }) => ({
    _id,
    name,
    avatar: avatar.url,
  }));

  return res.status(200).json({
    status: true,
    users,
  });
});

const sendRequest = TryCatch(async (req, res, next) => {
  const { userId } = req.body;

  const request = await Request.findOne({
    $or: [
      { sender: req.user, receiver: userId },
      { sender: userId, receiver: req.user },
    ],
  });

  if (request) return next(new ErrorHandler("Request already sent", 400));

  await Request.create({
    sender: req.user,
    receiver: userId,
  });

  emitEvent(req, NEW_REQUEST, [userId]);

  return res.status(200).json({
    success: true,
    message: "Request sent successfully",
  });
});

const acceptFriendRequest = TryCatch(async (req, res, next) => {
  const { requestId, accept } = req.body;
  const request = await Request.findById(requestId)
    .populate("sender", "name")
    .populate("receiver", "name");

  if (!request) return next(new ErrorHandler("Request not Found", 404));

  if (request.receiver._id.toString() !== req.user.toString())
    return next(new ErrorHandler("You are not authorized", 401));

  if (!accept) {
    await Request.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Friend Request Rejected",
    });
  }

  const members = [request.sender._id, request.receiver._id];

  await Promise.all([
    Chat.create({
      members,
      name: `${request.sender.name} - ${request.receiver.name}`,
    }),
    request.deleteOne(),
  ]);

  emitEvent(req, REFETCH_CHATS, members);

  return res.status(200).json({
    success: true,
    message: "Request accepted successfully",
    senderId: request.sender._id,
  });
});

const getMyNotifications = TryCatch(async (req, res, next) => {
  const requests = await Request.find({ receiver: req.user }).populate(
    "sender",
    "name avatar"
  );

  const allRequests = requests.map(({ _id, sender }) => ({
    _id,
    sender: {
      _id: sender._id,
      name: sender.name,
      avatar: sender.avatar.url,
    },
  }));

  return res.status(200).json({
    success: true,
    allRequests,
  });
});

const getMyFriends = TryCatch(async (req, res, next) => {
  const chatId = req.query.chatId;

  const chats = await Chat.find({
    members: req.user,
    groupChat: false,
  }).populate("members", "name avatar");

  const friends = chats.map(({ members }) => {
    const otherUser = getOtherMember(members, req.user);

    return {
      _id: otherUser._id,
      name: otherUser.name,
      avatar: otherUser.avatar.url,
    };
  });

  if (chatId) {
    const chat = await Chat.findById(chatId);

    const availableFriends = friends.filer(
      (friend) => !chat.members.includes(friend)
    );

    return res.status(200).json({
      success: true,
      friends: availableFriends,
    });
  }
  return res.status(200).json({
    success: true,
    friends,
  });
});

export {
  login,
  newUser,
  getMyProfile,
  logout,
  searchUser,
  sendRequest,
  acceptFriendRequest,
  getMyNotifications,
  getMyFriends,
};
