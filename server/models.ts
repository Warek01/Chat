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
  date: {
    type: Number,
    required: true
  }
}), "messages");
