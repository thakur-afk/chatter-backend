import { body, check, param, query, validationResult } from "express-validator";
import { ErrorHandler } from "../utils/utility.js";

const validatorHandler = (req, res, next) => {
  const errors = validationResult(req);

  const errorMessages = errors
    .array()
    .map((error) => error.msg)
    .join(",");

  if (errors.isEmpty()) return next();

  return next(new ErrorHandler(errorMessages, 400));
};

const registerValidator = () => [
  body("name", "Please Enter Name").notEmpty(),
  body("password", "Please Enter password").notEmpty(),
  body("bio", "Please Enter Bio").notEmpty(),
  body("username", "Please Enter username").notEmpty(),
];
const loginValidator = () => [
  body("username", "Please Enter username").notEmpty(),
  body("password", "Please Enter password").notEmpty(),
];

const newGroupValidator = () => [
  body("name", "Please provide name").notEmpty(),
  body("members")
    .notEmpty()
    .withMessage("please provide members")
    .isArray({ min: 2, max: 100 })
    .withMessage("Members must be 2-100"),
];

const addMembersValidator = () => [
  body("chatId", "Please provide ChatId").notEmpty(),
  body("members")
    .notEmpty()
    .withMessage("please provide members")
    .isArray({ min: 1, max: 97 })
    .withMessage("Members must be 1-97"),
];

const removeGroupValidator = () => [
  body("chatId", "Please provide ChatId").notEmpty(),
  body("userId", "Please Enter ChatID").notEmpty(),
];
const leaveGroupValidator = () => [
  param("id", "Please Provide ChatID").notEmpty(),
];

const sendAttachmentsValidator = () => [
  body("chatId", "Please Provide ChatId").notEmpty(),
];

const ChatValidator = () => [param("id", "Please Provide ChatId").notEmpty()];

const RenameGroupValidator = () => [
  body("name", "Please Provide name").notEmpty(),
];

const sendRequestValidator = () => [
  body("userId", "Please Provide userId").notEmpty(),
];

const acceptRequestValidator = () => [
  body("requestId", "Please Provide request Id").notEmpty(),
  body("accept")
    .notEmpty()
    .withMessage("Please Provide userId")
    .isBoolean()
    .withMessage("Please provide boolean value"),
];

export {
  registerValidator,
  validatorHandler,
  loginValidator,
  newGroupValidator,
  addMembersValidator,
  removeGroupValidator,
  leaveGroupValidator,
  sendAttachmentsValidator,
  ChatValidator,
  RenameGroupValidator,
  sendRequestValidator,
  acceptRequestValidator,
};
