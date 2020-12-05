import { model, Schema } from "mongoose";

export const Message = model("message", new Schema({
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
  }
}), "messages");

export interface MessageBody {
  content: string,
  sender: string,
  timestamp: number
}
