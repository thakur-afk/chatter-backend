import express from "express";
import {
  getAdminData,
  getAllChats,
  getAllMessages,
  getAllUsers,
  getDashboardStats,
  loginAdmin,
  logoutAdmin,
} from "../controllers/admin.js";
import { adminOnly } from "../middlewares/isAuthenticated.js";

const app = express.Router();
app.post("/verify", loginAdmin);

app.get("/logout", logoutAdmin);
app.use(adminOnly);
app.get("/", getAdminData);

app.get("/users", getAllUsers);
app.get("/chats", getAllChats);
app.get("/messages", getAllMessages);

app.get("/stats", getDashboardStats);

export default app;
