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

export interface TextMessage {
  content: string;
  sender: string;
  timestamp: number;
  type: string;
  edited: boolean;
  _id: string;
  name?: string;
}

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

export interface ConnectionLog {
  type: string;
  username: string;
  timestamp: number;
  name?: string;
}

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

export interface Image {
  sender: string;
  imageName: string;
  timestamp: number;
  name?: string;
}

export const Config = model("Config", new Schema({
  noConnectionLogs: Boolean
}), "config");

export interface Config {
  noConnectionLogs: boolean;
}
