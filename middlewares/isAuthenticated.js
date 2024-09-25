import jwt from "jsonwebtoken";
import { ErrorHandler } from "../utils/utility.js";
import { cookie } from "express-validator";
import { User } from "../models/UserSchema.js";
import { ne } from "@faker-js/faker";

const isAuthenticated = (req, res, next) => {
  const token = req.cookies["chatter-token"];

  if (!token)
    return next(new ErrorHandler("Please login to access the data", 401));

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded._id;

  next();
};

const adminOnly = (req, res, next) => {
  const token = req.cookies["chatter-admin-token"];

  if (!token) return next(new ErrorHandler("Only admin can access", 401));

  const secretKey = jwt.verify(token, process.env.JWT_SECRET);

  const adminSecretKey = process.env.ADMIN_SECRET_KEY || "ASDasdasdasd";

  const isMatched = secretKey === adminSecretKey;

  if (!isMatched) return next(new ErrorHandler("Invalid Admin Key", 401));

  next();
};

const socketAuthenticator = async (err, socket, next) => {
  try {
    if (err) return next(err);

    const authToken = socket.request.cookies["chatter-token"];

    if (!authToken)
      return next(new ErrorHandler("please login to access this route", 401));

    const decodedData = jwt.verify(authToken, process.env.JWT_SECRET);

    const user = await User.findById(decodedData._id);

    if (!user)
      return next(
        new ErrorHandler("please login to access to this route", 401)
      );

    socket.user = user;

    return next();
  } catch (error) {
    return next(new ErrorHandler("please login to access this route", 401));
  }
};

export { isAuthenticated, adminOnly, socketAuthenticator };
