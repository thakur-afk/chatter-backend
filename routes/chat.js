import express from "express";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import { attachmentsMulter } from "../middlewares/multer.js";
import {
  addMembers,
  deleteChat,
  getChatDetails,
  getMessages,
  getMyChats,
  getMyGroup,
  leaveGroup,
  newGroup,
  removeMember,
  renameGroup,
  sendAttachments,
} from "../controllers/chat.js";
import {
  ChatValidator,
  RenameGroupValidator,
  addMembersValidator,
  leaveGroupValidator,
  newGroupValidator,
  removeGroupValidator,
  sendAttachmentsValidator,
  validatorHandler,
} from "../lib/validators.js";

const app = express.Router();

app.use(isAuthenticated);

app.post("/newgroup", newGroupValidator(), validatorHandler, newGroup);
app.get("/myChats", getMyChats);
app.get("/my/groups", getMyGroup);
app.put("/addmembers", addMembersValidator(), validatorHandler, addMembers);
app.put(
  "/removemember",
  removeGroupValidator(),
  validatorHandler,
  removeMember
);

app.delete("/leave/:id", leaveGroupValidator(), validatorHandler, leaveGroup);

app.post(
  "/attachments",
  attachmentsMulter,
  sendAttachmentsValidator(),
  validatorHandler,
  sendAttachments
);

app.get("/messages/:id", ChatValidator(), validatorHandler, getMessages);

app
  .route("/:id", ChatValidator(), validatorHandler)
  .get(getChatDetails)
  .put(RenameGroupValidator(), validatorHandler, renameGroup)
  .delete(deleteChat);

export default app;
