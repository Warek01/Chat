import { model, Schema } from "mongoose";

export const TextMessage = model(
  "Text Message",
  new Schema({
    content: {
      type: String,
      required: true
    },
    author: {
      type: String,
      required: true
    },
    timestamp: {
      type: Number,
      required: true
    },
    is_edited: {
      type: Boolean,
      default: false,
      required: false
    },
    object_type: {
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
    author: {
      type: String,
      required: true
    },
    timestamp: {
      type: Number,
      required: true
    },
    object_type: {
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
    author: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    timestamp: {
      type: Number,
      required: true
    },
    object_type: {
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
    noConnectionLogs: {
      type: Boolean,
      required: false,
      default: false
    },
    noNotifications: {
      type: Boolean,
      required: false,
      default: false
    }
  }),
  "config"
);
