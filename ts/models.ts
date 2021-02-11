import { model, Schema } from "mongoose";

export const TextMessage = model(
  "Text Message",
  new Schema({
    content: {
      type: String,
      required: true
    },
    sender: {
      type: String,
      required: true
    },
    timestamp: {
      type: Number,
      required: true
    },
    edited: {
      type: Boolean,
      default: false,
      required: false
    },
    name: {
      type: String,
      required: false,
      default: "text_message"
    }
  }),
  "text_messages"
);

export const ConnectionLog = model(
  "Connection Log",
  new Schema({
    type: {
      type: String,
      lowercase: true,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    timestamp: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: false,
      default: "connection_log"
    }
  }),
  "connection_logs"
);

export const Image = model(
  "Image File",
  new Schema({
    sender: {
      type: String,
      required: true
    },
    imageName: {
      type: String,
      required: true
    },
    timestamp: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: false,
      default: "image"
    }
  }),
  "image_files"
);

export const Config = model(
  "Config",
  new Schema({
    noConnectionLogs: Boolean
  }),
  "config"
);
