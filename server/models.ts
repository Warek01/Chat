import { model, Schema } from "mongoose";

export const Message = model("message", new Schema({
  content: {
    type: String,
    required: false
  },
  sender: {
    type: String,
    required: true
  },
  timestamp: {
    type: Number,
    required: false
  },
  type: {
    type: String,
    default: "message",
    required: true
  }
}), "messages");

export interface MessageBody {
  content: string,
  sender: string,
  timestamp: number
}
