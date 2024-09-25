import mongoose from "mongoose";

import jwt from "jsonwebtoken";

import { v2 } from "cloudinary";
import { v4 as uuid } from "uuid";
import { getBase64, getSockets } from "../lib/helper.js";

const connectDB = (uri) => {
  mongoose
    .connect(uri, { dbName: "Chatter" })
    .then((data) => console.log(`connected to db: ${data.connection.db}`))
    .catch((err) => {
      throw err;
    });
};

const cookieOptions = {
  maxAge: 15 * 24 * 60 * 60 * 1000,
  sameSite: "none",
  httpOnly: true,
  secure: true,
};

const sendToken = (res, user, code, message) => {
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

  return res.status(code).cookie("chatter-token", token, cookieOptions).json({
    success: true,
    user,
    message,
  });
};

const TryCatch = (passedFunction) => async (req, res, next) => {
  try {
    await passedFunction(req, res, next);
  } catch (error) {
    next(error);
  }
};

const emitEvent = (req, event, users, data) => {
  const io = req.app.get("io");

  const usersSocket = getSockets(users);

  io.to(usersSocket).emit(event, data);
};

const uploadFilesToCloudinery = async (files = []) => {
  const UplaodPromises = files.map((file) => {
    return new Promise((resolve, reject) => {
      v2.uploader.upload(
        getBase64(file),
        {
          resource_type: "auto",
          public_id: uuid(),
        },
        (error, result) => {
          if (error) return reject(error);

          resolve(result);
        }
      );
    });
  });

  try {
    const results = await Promise.all(UplaodPromises);

    const formattedResult = results.map((result) => ({
      public_id: result.public_id,
      url: result.secure_url,
    }));

    return formattedResult;
  } catch (error) {
    throw new Error("error uplaoding files in cloudinery", error);
  }
};

const deleteFromCloudinery = async (public_ids) => {};

export {
  connectDB,
  sendToken,
  TryCatch,
  cookieOptions,
  emitEvent,
  deleteFromCloudinery,
  uploadFilesToCloudinery,
};
