import express from "express";
import {
  acceptFriendRequest,
  getMyFriends,
  getMyNotifications,
  getMyProfile,
  login,
  logout,
  newUser,
  searchUser,
  sendRequest,
} from "../controllers/user.js";
import { multerUpload, singleAvatar } from "../middlewares/multer.js";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import {
  acceptRequestValidator,
  loginValidator,
  registerValidator,
  sendAttachmentsValidator,
  sendRequestValidator,
  validatorHandler,
} from "../lib/validators.js";

const app = express.Router();

app.post("/new", singleAvatar, registerValidator(), validatorHandler, newUser);
app.post("/login", loginValidator(), validatorHandler, login);

app.use(isAuthenticated);

app.get("/me", getMyProfile);
app.get("/logout", logout);
app.get("/searchUser", searchUser);
app.put("/sendRequest", sendRequestValidator(), validatorHandler, sendRequest);
app.put(
  "/acceptRequest",
  acceptRequestValidator(),
  validatorHandler,
  acceptFriendRequest
);

app.get("/notifications", getMyNotifications);
app.get("/friends", getMyFriends);

export default app;
