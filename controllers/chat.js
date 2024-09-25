import {
  TryCatch,
  deleteFromCloudinery,
  emitEvent,
  uploadFilesToCloudinery,
} from "../utils/features.js";
import { ErrorHandler } from "../utils/utility.js";
import { Chat } from "../models/ChatSchema.js";
import {
  ALERT,
  NEW_ATTACHMENT,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  REFETCH_CHATS,
} from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
import { User } from "../models/UserSchema.js";
import { Message } from "../models/MessageSchema.js";

const newGroup = TryCatch(async (req, res, next) => {
  const { name, members } = req.body;

  if (members.length < 2)
    return next(new ErrorHandler("Group chat must have 3 members", 400));

  const allmembers = [...members, req.user];

  await Chat.create({
    name,
    groupChat: true,
    members: allmembers,
    creator: req.user,
  });
  emitEvent(req, ALERT, allmembers, `Welcome to ${name} Group`);
  emitEvent(req, REFETCH_CHATS, members);

  res.status(200).json({
    success: true,
    message: "group created",
  });
});

const getMyChats = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({ members: req.user }).populate(
    "members",
    "name avatar"
  );

  const tranformChats = chats.map(({ _id, name, members, groupChat }) => {
    const othermembers = getOtherMember(members, req.user);
    return {
      _id,
      groupChat,
      avatar: groupChat
        ? members.slice(0, 3).map(({ avatar }) => avatar.url)
        : [othermembers.avatar.url],
      name: groupChat ? name : othermembers.name,
      members: members.reduce((prev, curr) => {
        if (curr._id.toString() !== req.user.toString()) {
          prev.push(curr._id);
        }
        return prev;
      }, []),
    };
  });
  return res.status(200).json({
    success: true,
    chats: tranformChats,
  });
});

const getMyGroup = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({
    members: req.user,
    creator: req.user,
    groupChat: true,
  }).populate("members", "name avatar");

  const groups = chats.map(({ _id, name, members, groupChat }) => {
    return {
      _id,
      groupChat,
      name,
      avatar: members.slice(0, 3).map(({ avatar }) => avatar.url),
      members: members.reduce((prev, curr) => {
        if (curr._id.toString() !== req.user.toString()) {
          prev.push(curr._id);
        }
        return prev;
      }, []),
    };
  });
  return res.status(200).json({
    success: true,
    groups: groups,
  });
});

const addMembers = TryCatch(async (req, res, next) => {
  const { chatId, members } = req.body;

  if (!members || members.length < 1)
    return next(new ErrorHandler("Please provide members", 400));

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("No Chat found", 404));

  if (!chat.groupChat) return next(new ErrorHandler("Not a Group chat", 400));

  if (chat.creator.toString() !== req.user.toString())
    return next(new ErrorHandler("You cannot add members to the groups", 403));

  const allmembersPromise = members.map((i) => User.findById(i, "name"));

  const allmembers = await Promise.all(allmembersPromise);

  const uniqueMembers = allmembers
    .filter((i) => !chat.members.includes(i._id.toString()))
    .map((i) => i._id);

  chat.members.push(...uniqueMembers);

  if (chat.members.length > 100)
    return next(new ErrorHandler("Group members limit reched", 400));

  await chat.save();
  const allUsersName = allmembers.map((i) => i.name).join(",");

  emitEvent(req, ALERT, chat.members, {
    chatId,
    content: `${allUsersName} added to the group`,
  });
  emitEvent(req, REFETCH_CHATS, chat.members);
  return res.status(200).json({
    success: true,
    message: "Members added successfully",
  });
});

const removeMember = TryCatch(async (req, res, next) => {
  const { userId, chatId } = req.body;

  const [chat, userThatWillBeRemoved] = await Promise.all([
    Chat.findById(chatId),
    User.findById(userId, "name"),
  ]);

  if (!chat) return next(new ErrorHandler("No Chat found", 404));

  if (!chat.groupChat) return next(new ErrorHandler("Not a Group chat", 400));

  if (chat.creator.toString() !== req.user.toString())
    return next(
      new ErrorHandler("You cannot remove members from the groups", 403)
    );
  if (chat.creator.toString() === userId.toString()) {
    return next(new ErrorHandler("Admin cannot be removed", 403));
  }

  if (chat.members.length <= 3)
    return next(new ErrorHandler("Group must have 3 Members", 400));

  const allmembers = chat.members;

  chat.members = chat.members.filter((i) => i.toString() !== userId.toString());

  await chat.save();

  emitEvent(req, ALERT, chat.members, {
    chatId,
    content: `${userThatWillBeRemoved.name} removed from the group`,
  });
  emitEvent(req, REFETCH_CHATS, allmembers);

  return res.status(200).json({
    success: true,
    message: "member removed successfully",
  });
});

const leaveGroup = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;

  const chat = await Chat.findById(chatId);
  if (!chat) return next(new ErrorHandler("No Chat found", 404));

  if (!chat.groupChat) return next(new ErrorHandler("Not a Group chat", 400));

  if (chat.members.length <= 3)
    return next(new ErrorHandler("Group must have 3 Members", 400));

  if (!chat.members.includes(req.user)) {
    return next(new ErrorHandler("You do not exist in this group", 400));
  }

  const remainingMembers = chat.members.filter(
    (member) => member.toString() !== req.user.toString()
  );

  chat.members = remainingMembers;

  if (chat.creator.toString() === req.user.toString()) {
    chat.creator = remainingMembers[0];
  }

  const user = await User.findById(req.user, "name");

  await chat.save();

  emitEvent(req, ALERT, chat.members, {
    chatId,
    content: `${user.name} left the group`,
  });

  return res.status(200).json({
    success: true,
    message: "User removed successfully",
  });
});

const sendAttachments = TryCatch(async (req, res, next) => {
  const { chatId } = req.body;
  const files = req.files || [];
  if (files.length < 1 || files.length > 5) {
    return next(new ErrorHandler("Please attach a file within range 1-5", 400));
  }

  const [chat, me] = await Promise.all([
    Chat.findById(chatId),
    User.findById(req.user),
  ]);

  if (!chat) return next(new ErrorHandler("No Chat found", 404));

  const attachments = await uploadFilesToCloudinery(files);

  const messagefordb = {
    content: "",
    attachments,
    chat: chatId,
    sender: me._id,
  };

  const messageForRealTime = {
    ...messagefordb,
    sender: {
      _id: me._id,
      name: me.name,
    },
  };

  const message = await Message.create(messagefordb);

  emitEvent(req, NEW_MESSAGE, chat.members, {
    message: messageForRealTime,
    chatId,
  });
  emitEvent(req, NEW_MESSAGE_ALERT, chat.members, {
    chatId,
  });

  res.status(200).json({
    success: true,
    message,
  });
});

const getChatDetails = TryCatch(async (req, res, next) => {
  if (req.query.populate === "true") {
    const chatId = req.params.id;
    const chat = await Chat.findById(chatId)
      .populate("members", "name avatar")
      .lean();

    if (!chat) return next(new ErrorHandler("No chat found", 404));
    chat.members = chat.members.map(({ _id, name, avatar }) => ({
      _id,
      name,
      avatar: avatar.url,
    }));
    return res.status(200).json({
      success: true,
      chat,
    });
  } else {
    const chatId = req.params.id;
    const chat = await Chat.findById(chatId);
    if (!chat) return next(new ErrorHandler("No chat found", 404));
    return res.status(200).json({
      success: true,
      chat,
    });
  }
});

const renameGroup = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;
  const { name } = req.body;

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("No Chat Found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("this is not a group chat", 403));

  if (chat.creator.toString() !== req.user.toString())
    return next(new ErrorHandler("Only admin is allowed to rename gorup", 403));

  chat.name = name;

  await chat.save();

  emitEvent(req, REFETCH_CHATS, chat.members);

  return res
    .status(200)
    .json({ success: true, message: "Name changed Successfully" });
});

const deleteChat = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("No Chat found", 404));
  const members = chat.members;

  if (chat.groupChat && chat.creator.toString() !== req.user.toString()) {
    return next(
      new ErrorHandler("You are not allowed to delete the chat", 403)
    );
  }
  if (chat.groupChat && !chat.members.includes(req.user.toString())) {
    return next(
      new ErrorHandler("You are not allowed to delete the chat", 403)
    );
  }

  const messagesWithAttachments = await Message.find({
    chat: chatId,
    attachments: { $exists: true, $ne: [] },
  });

  const publicIds = [];

  messagesWithAttachments.forEach(({ attachments }) =>
    attachments.forEach(({ public_id }) => publicIds.push(public_id))
  );

  await Promise.all([
    deleteFromCloudinery(publicIds),
    chat.deleteOne(),
    Message.deleteMany({ chat: chatId }),
  ]);

  emitEvent(req, REFETCH_CHATS, members);

  return res.status(200).json({
    success: true,
    message: "chat deleted successfully",
  });
});
const getMessages = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;

  const { page = 1 } = req.query;

  const result_per_page = 20;
  const skip = (page - 1) * result_per_page;

  const chat = await Chat.findById(chatId);
  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.members.includes(req.user.toString()))
    return next(new ErrorHandler("You cannot access this url", 403));

  const [messages, totalMessagesCount] = await Promise.all([
    Message.find({ chat: chatId })
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(result_per_page)
      .populate("sender", "name avatar")
      .lean(),
    Message.countDocuments({ chat: chatId }),
  ]);

  const totalPages = Math.ceil(totalMessagesCount / result_per_page);

  return res.status(200).json({
    success: true,
    messages: messages.reverse(),
    totalPages,
  });
});

export {
  newGroup,
  getMyChats,
  getMyGroup,
  addMembers,
  removeMember,
  leaveGroup,
  sendAttachments,
  getChatDetails,
  renameGroup,
  deleteChat,
  getMessages,
};
