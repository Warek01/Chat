"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const mongoose_1 = require("mongoose");
exports.Message = mongoose_1.model("message", new mongoose_1.Schema({
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
